import Foundation
import SwiftUI
import CryptoKit
import Combine

@MainActor
public final class VaultStore: ObservableObject {
    public static let shared = VaultStore()

    // MARK: - Published State
    @Published public var isUnlocked: Bool = false
    @Published public var hasVault: Bool = false
    @Published public var items: [VaultItem] = []
    @Published public var folders: [VaultFolder] = []
    @Published public var settings: VaultSettings = .default
    @Published public var lastError: String? = nil

    // MARK: - Private State
    private var vaultKey: SymmetricKey? = nil
    private var sessionVaultKey: SymmetricKey? = nil
    private var cachedHeader: VaultHeader? = nil
    private var autoLockTimer: Timer? = nil
    private var lastActivityTime: Date = Date()

    public static let vaultDirectoryURL: URL = {
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home.appendingPathComponent(".kloak", isDirectory: true)
    }()

    public static let vaultFileURL: URL = {
        return vaultDirectoryURL.appendingPathComponent("vault.kloak", isDirectory: false)
    }()

    public init() {
        checkVaultExistence()
    }

    // MARK: - Vault Existence Check

    public func checkVaultExistence() {
        let exists = FileManager.default.fileExists(atPath: Self.vaultFileURL.path)
        self.hasVault = exists
    }

    // MARK: - Vault Creation (First Launch)

    public func createVault(
        masterPassword: String,
        enableBiometrics: Bool = true,
        seedSampleData: Bool = true
    ) async throws {
        guard !masterPassword.isEmpty else {
            throw NSError(domain: "KloakVault", code: 1, userInfo: [NSLocalizedDescriptionKey: "Master password cannot be empty."])
        }

        // 1. Ensure ~/.kloak directory exists
        try FileManager.default.createDirectory(at: Self.vaultDirectoryURL, withIntermediateDirectories: true)

        // 2. Generate random 16-byte salt and random 32-byte Vault Key
        let saltHex = CryptoEngine.shared.generateSalt(byteCount: 16)
        let newVaultKey = CryptoEngine.shared.generateVaultKey()
        let vaultKeyData = CryptoEngine.shared.keyToData(newVaultKey)

        // 3. Derive Unlock Key from master password with PBKDF2 (600,000 iterations)
        let unlockKey = await Task.detached(priority: .userInitiated) {
            CryptoEngine.shared.deriveKey(password: masterPassword, saltHex: saltHex, iterations: 600_000)
        }.value

        // 4. Wrap the Vault Key with the Unlock Key
        let wrappedVaultKey = try CryptoEngine.shared.encrypt(key: unlockKey, plaintext: vaultKeyData)

        // 5. Construct Header
        let header = VaultHeader(
            kloakVersion: "1.0",
            formatVersion: 1,
            kdf: KdfParams(algorithm: "pbkdf2-sha256", iterations: 600_000, salt: saltHex),
            wrappedVaultKey: wrappedVaultKey,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )

        // 6. Construct initial Payload
        var initialSettings = VaultSettings.default
        initialSettings.biometricsEnabled = enableBiometrics

        let initialFolders: [VaultFolder] = [
            VaultFolder(id: "f_dev", name: "Development"),
            VaultFolder(id: "f_fin", name: "Finance"),
            VaultFolder(id: "f_rec", name: "Recovery")
        ]

        let initialItems: [VaultItem] = seedSampleData ? Self.defaultSeedItems : []

        let payload = VaultPayload(
            version: 1,
            items: initialItems,
            folders: initialFolders,
            settings: initialSettings,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )

        // 7. Encrypt Payload with Vault Key
        let payloadData = try JSONEncoder().encode(payload)
        let encryptedPayload = try CryptoEngine.shared.encrypt(key: newVaultKey, plaintext: payloadData)

        // 8. Write complete VaultFile atomically
        let vaultFile = VaultFile(header: header, encryptedPayload: encryptedPayload)
        let fileData = try JSONEncoder().encode(vaultFile)
        try fileData.write(to: Self.vaultFileURL, options: .atomic)

        // 9. Store in Keychain for biometric unlock if requested
        if enableBiometrics {
            _ = KeychainManager.shared.storeKey(keyData: vaultKeyData)
        } else {
            KeychainManager.shared.clearKey()
        }

        // 10. Update in-memory state
        self.vaultKey = newVaultKey
        self.cachedHeader = header
        self.items = initialItems
        self.folders = initialFolders
        self.settings = initialSettings
        self.hasVault = true
        self.isUnlocked = true
        self.lastError = nil

        startAutoLockTimer()
    }

    // MARK: - Unlock with Master Password

    public func unlock(password: String) async -> Bool {
        guard !password.isEmpty else { return false }
        guard FileManager.default.fileExists(atPath: Self.vaultFileURL.path) else {
            self.lastError = "Vault file not found."
            return false
        }

        do {
            let data = try Data(contentsOf: Self.vaultFileURL)
            let vaultFile = try JSONDecoder().decode(VaultFile.self, from: data)
            let header = vaultFile.header

            // Perform key derivation & decryption on background thread to prevent UI freezing
            let result: (SymmetricKey, VaultPayload)? = try await Task.detached(priority: .userInitiated) {
                let unlockKey = CryptoEngine.shared.deriveKey(
                    password: password,
                    saltHex: header.kdf.salt,
                    iterations: header.kdf.iterations
                )

                // 1. Unwrap Vault Key
                guard let vaultKeyData = try? CryptoEngine.shared.decrypt(key: unlockKey, container: header.wrappedVaultKey) else {
                    return nil
                }
                let unwrappedVaultKey = CryptoEngine.shared.keyFromData(vaultKeyData)

                // 2. Decrypt Payload
                guard let decryptedPayloadData = try? CryptoEngine.shared.decrypt(key: unwrappedVaultKey, container: vaultFile.encryptedPayload) else {
                    return nil
                }

                let payload = try JSONDecoder().decode(VaultPayload.self, from: decryptedPayloadData)
                return (unwrappedVaultKey, payload)
            }.value

            guard let (unwrappedVaultKey, payload) = result else {
                self.lastError = "Incorrect master password."
                return false
            }

            // Success
            self.vaultKey = unwrappedVaultKey
            self.sessionVaultKey = unwrappedVaultKey
            self.cachedHeader = header
            self.items = payload.items
            self.folders = payload.folders
            self.settings = payload.settings
            self.isUnlocked = true
            self.lastError = nil

            // Store in Keychain for biometric unlock across sessions
            let keyData = CryptoEngine.shared.keyToData(unwrappedVaultKey)
            _ = KeychainManager.shared.storeKey(keyData: keyData)

            startAutoLockTimer()
            return true
        } catch {
            self.lastError = "Failed to unlock vault: \(error.localizedDescription)"
            return false
        }
    }

    // MARK: - Unlock with Biometrics (Touch ID)

    public var hasBiometricSession: Bool {
        return sessionVaultKey != nil || KeychainManager.shared.retrieveKey() != nil
    }

    public func unlockWithBiometrics() async -> Bool {
        let candidateKey: SymmetricKey? = {
            if let key = sessionVaultKey { return key }
            if let data = KeychainManager.shared.retrieveKey() {
                return CryptoEngine.shared.keyFromData(data)
            }
            return nil
        }()

        guard let validKey = candidateKey else {
            self.lastError = "Enter master password once to activate Touch ID for this session."
            return false
        }
        guard FileManager.default.fileExists(atPath: Self.vaultFileURL.path) else {
            return false
        }

        return await withCheckedContinuation { continuation in
            BiometricAuth.shared.authenticate(reason: "Unlock your Kloak Vault with Touch ID") { [weak self] success, errMsg in
                Task { @MainActor [weak self] in
                    guard let self = self, success else {
                        if let err = errMsg {
                            self?.lastError = err
                        }
                        continuation.resume(returning: false)
                        return
                    }

                    do {
                        let data = try Data(contentsOf: Self.vaultFileURL)
                        let vaultFile = try JSONDecoder().decode(VaultFile.self, from: data)

                        let decryptedPayloadData = try CryptoEngine.shared.decrypt(
                            key: validKey,
                            container: vaultFile.encryptedPayload
                        )

                        let payload = try JSONDecoder().decode(VaultPayload.self, from: decryptedPayloadData)

                        self.vaultKey = validKey
                        self.sessionVaultKey = validKey
                        self.cachedHeader = vaultFile.header
                        self.items = payload.items
                        self.folders = payload.folders
                        self.settings = payload.settings
                        self.isUnlocked = true
                        self.lastError = nil

                        self.startAutoLockTimer()
                        continuation.resume(returning: true)
                    } catch {
                        self.lastError = "Decryption error"
                        continuation.resume(returning: false)
                    }
                }
            }
        }
    }

    // MARK: - Lock Vault

    public func lock() {
        self.vaultKey = nil
        self.isUnlocked = false
        stopAutoLockTimer()
    }

    // MARK: - Persistence (Save Vault)

    public func saveVault() {
        guard let currentVaultKey = vaultKey else { return }

        Task {
            do {
                var header = self.cachedHeader
                if header == nil && FileManager.default.fileExists(atPath: Self.vaultFileURL.path) {
                    let fileData = try Data(contentsOf: Self.vaultFileURL)
                    let decoded = try JSONDecoder().decode(VaultFile.self, from: fileData)
                    header = decoded.header
                    self.cachedHeader = header
                }

                guard let validHeader = header else { return }

                let payload = VaultPayload(
                    version: 1,
                    items: self.items,
                    folders: self.folders,
                    settings: self.settings,
                    updatedAt: ISO8601DateFormatter().string(from: Date())
                )

                let payloadData = try JSONEncoder().encode(payload)
                let encryptedPayload = try CryptoEngine.shared.encrypt(key: currentVaultKey, plaintext: payloadData)

                let vaultFile = VaultFile(header: validHeader, encryptedPayload: encryptedPayload)
                let fileData = try JSONEncoder().encode(vaultFile)

                try fileData.write(to: Self.vaultFileURL, options: .atomic)
            } catch {
                print("[Kloak VaultStore] Error saving vault: \(error)")
            }
        }
    }

    // MARK: - CRUD Helpers

    public func saveItem(_ item: VaultItem) {
        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            items[idx] = item
        } else {
            items.append(item)
        }
        recordUserActivity()
        saveVault()
    }

    public func deleteItem(id: String) {
        items.removeAll { $0.id == id }
        recordUserActivity()
        saveVault()
    }

    public func updateSettings(_ newSettings: VaultSettings) {
        self.settings = newSettings
        if newSettings.biometricsEnabled {
            if let key = vaultKey {
                _ = KeychainManager.shared.storeKey(keyData: CryptoEngine.shared.keyToData(key))
            }
        } else {
            KeychainManager.shared.clearKey()
        }
        recordUserActivity()
        saveVault()
    }

    public func bulkImport(_ importedItems: [VaultItem]) -> (Int, [String]) {
        var addedCount = 0
        for item in importedItems {
            if !items.contains(where: { $0.title == item.title && $0.username == item.username }) {
                items.append(item)
                addedCount += 1
            }
        }
        recordUserActivity()
        saveVault()
        return (addedCount, [])
    }

    // MARK: - Master Password Change

    public func changeMasterPassword(oldPassword: String, newPassword: String) async -> Bool {
        guard !newPassword.isEmpty else { return false }
        guard let currentVaultKey = vaultKey else { return false }

        do {
            let data = try Data(contentsOf: Self.vaultFileURL)
            let vaultFile = try JSONDecoder().decode(VaultFile.self, from: data)
            let header = vaultFile.header

            // Verify old password
            let oldUnlockKey = CryptoEngine.shared.deriveKey(
                password: oldPassword,
                saltHex: header.kdf.salt,
                iterations: header.kdf.iterations
            )
            guard let _ = try? CryptoEngine.shared.decrypt(key: oldUnlockKey, container: header.wrappedVaultKey) else {
                return false
            }

            // Generate new salt and new unlock key for new password
            let newSaltHex = CryptoEngine.shared.generateSalt(byteCount: 16)
            let newUnlockKey = await Task.detached(priority: .userInitiated) {
                CryptoEngine.shared.deriveKey(password: newPassword, saltHex: newSaltHex, iterations: 600_000)
            }.value

            let vaultKeyData = CryptoEngine.shared.keyToData(currentVaultKey)
            let newWrappedVaultKey = try CryptoEngine.shared.encrypt(key: newUnlockKey, plaintext: vaultKeyData)

            let newHeader = VaultHeader(
                kloakVersion: "1.0",
                formatVersion: 1,
                kdf: KdfParams(algorithm: "pbkdf2-sha256", iterations: 600_000, salt: newSaltHex),
                wrappedVaultKey: newWrappedVaultKey,
                createdAt: header.createdAt
            )

            self.cachedHeader = newHeader
            saveVault()
            return true
        } catch {
            return false
        }
    }

    // MARK: - Export

    public func exportVault(format: String, password: String?) -> String {
        let exportableItems = items.filter { !$0.trashed }

        if format == "csv" {
            var csv = "Title,Username,Password,URL,TOTP,Notes,Tags\n"
            for item in exportableItems {
                let title = escapeCSV(item.title)
                let user = escapeCSV(item.username ?? "")
                let pass = escapeCSV(item.password ?? "")
                let url = escapeCSV(item.urls.first ?? "")
                let totp = escapeCSV(item.totpSecret ?? "")
                let notes = escapeCSV(item.notes ?? "")
                let tags = escapeCSV(item.tags.joined(separator: ";"))
                csv += "\(title),\(user),\(pass),\(url),\(totp),\(notes),\(tags)\n"
            }
            return csv
        } else {
            // JSON format
            let payload = VaultPayload(
                version: 1,
                items: exportableItems,
                folders: self.folders,
                settings: self.settings,
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
            if let data = try? JSONEncoder().encode(payload), let str = String(data: data, encoding: .utf8) {
                return str
            }
            return "{}"
        }
    }

    private func escapeCSV(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }

    // MARK: - Auto-Lock Timer

    public func recordUserActivity() {
        self.lastActivityTime = Date()
    }

    private func startAutoLockTimer() {
        stopAutoLockTimer()
        self.lastActivityTime = Date()

        autoLockTimer = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self, self.isUnlocked else { return }
                let autoLockMinutes = self.settings.autoLockMinutes
                guard autoLockMinutes > 0 else { return }

                let elapsedSeconds = Date().timeIntervalSince(self.lastActivityTime)
                if elapsedSeconds >= Double(autoLockMinutes * 60) {
                    print("[Kloak] Auto-locking vault due to inactivity (\(autoLockMinutes)m)")
                    self.lock()
                }
            }
        }
    }

    private func stopAutoLockTimer() {
        autoLockTimer?.invalidate()
        autoLockTimer = nil
    }

    // MARK: - Default Seed Items

    public static let defaultSeedItems: [VaultItem] = [
        VaultItem(
            type: .login,
            title: "GitHub",
            username: "alex.dev@github.com",
            password: "ghp_KloakSecurePassword982!",
            urls: ["https://github.com/login"],
            notes: "Developer token and primary login",
            totpSecret: "JBSWY3DPEHPK3PXP",
            tags: ["Development"],
            favorite: true
        ),
        VaultItem(
            type: .login,
            title: "ProtonMail",
            username: "security@proton.me",
            password: "Kloak-Proton-Encrypted#42",
            urls: ["https://mail.proton.me"],
            notes: "Primary zero-knowledge mailbox",
            totpSecret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
            tags: ["Email"],
            favorite: true
        ),
        VaultItem(
            type: .card,
            title: "Apple Card Titanium",
            username: "Alex Rivera",
            password: "842",
            notes: "Virtual card for online subscriptions",
            card: CardDetails(
                cardholderName: "Alex Rivera",
                number: "5532 8842 1928 4401",
                brand: "mastercard",
                expMonth: "09",
                expYear: "2028",
                cvv: "842",
                billingAddress: "742 Evergreen Terrace, Springfield, OR 97477"
            ),
            tags: ["Finance"],
            favorite: true
        ),
        VaultItem(
            type: .identity,
            title: "Personal Identity Profile",
            username: "Alex Rivera",
            notes: "Primary personal contact and identity information",
            identity: IdentityDetails(
                firstName: "Alex",
                lastName: "Rivera",
                email: "alex.rivera@example.com",
                phone: "+1 (555) 234-5678",
                address1: "742 Evergreen Terrace",
                city: "Springfield",
                state: "OR",
                zip: "97477",
                country: "United States",
                dateOfBirth: "1994-08-15",
                passportNumber: "P982341029",
                ssn: "•••-••-4819"
            ),
            tags: ["Personal"],
            favorite: true
        ),
        VaultItem(
            type: .emailAlias,
            title: "DuckDuckGo Shopping Alias",
            username: "shopping.kloak84@duck.com",
            notes: "Used for e-commerce checkouts and newsletter signups",
            alias: AliasDetails(
                aliasEmail: "shopping.kloak84@duck.com",
                forwardTo: "alex.dev@gmail.com",
                provider: "DuckDuckGo"
            ),
            tags: ["Privacy", "Alias"]
        ),
        VaultItem(
            type: .authenticator,
            title: "AWS Root Account 2FA",
            username: "AWS Production Infrastructure",
            notes: "Root credentials multi-factor authentication",
            totpSecret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
            authenticatorDetails: AuthenticatorDetails(
                issuer: "Amazon Web Services",
                algorithm: "TOTP",
                digits: 6,
                period: 30
            ),
            tags: ["Cloud", "Security"],
            favorite: true
        ),
        VaultItem(
            type: .secureNote,
            title: "Emergency Recovery Codes",
            notes: "1. 8849-2910-4491\n2. 9931-1029-4412\n3. 1102-4912-9901",
            tags: ["Recovery"]
        ),
        VaultItem(
            type: .login,
            title: "Spotify",
            username: "alex.music@spotify.com",
            password: "KloakMusicStream#99",
            urls: ["https://spotify.com"],
            notes: "Family plan master account",
            tags: ["Media"],
            favorite: true
        ),
        VaultItem(
            type: .login,
            title: "Slack Workspace",
            username: "alex@acme.slack.com",
            password: "KloakSlackChat#2026",
            urls: ["https://slack.com"],
            notes: "Engineering workspace",
            tags: ["Development"]
        ),
        VaultItem(
            type: .login,
            title: "Netflix",
            username: "alex.watch@gmail.com",
            password: "KloakStreaming#4K",
            urls: ["https://netflix.com"],
            notes: "Ultra HD Subscription",
            tags: ["Media"]
        )
    ]
}
