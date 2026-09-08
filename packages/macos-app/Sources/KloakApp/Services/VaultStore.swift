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
        seedSampleData: Bool = true,
        importedItems: [VaultItem] = [],
        connectedAccounts: [OnboardingAccountConnection] = [],
        keychainSyncEnabled: Bool = false
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

        // 6. Construct initial Settings and Accounts
        var initialSettings = VaultSettings.default
        initialSettings.biometricsEnabled = enableBiometrics
        initialSettings.keychainSyncEnabled = keychainSyncEnabled

        if let firstConnected = connectedAccounts.first(where: { $0.isConnected }) {
            initialSettings.connectedAccountProvider = firstConnected.provider.rawValue
            initialSettings.connectedAccountEmail = firstConnected.email
            initialSettings.isAccountConnected = true
            initialSettings.connectedAccountToken = firstConnected.token
        }

        let initialFolders: [VaultFolder] = [
            VaultFolder(id: "f_dev", name: "Development"),
            VaultFolder(id: "f_fin", name: "Finance"),
            VaultFolder(id: "f_rec", name: "Recovery"),
            VaultFolder(id: "f_import", name: "Imported")
        ]

        var finalItems: [VaultItem] = []
        if seedSampleData {
            finalItems.append(contentsOf: Self.defaultSeedItems)
        }
        for imported in importedItems {
            if !finalItems.contains(where: { $0.title == imported.title && $0.username == imported.username }) {
                finalItems.append(imported)
            }
        }

        let payload = VaultPayload(
            version: 1,
            items: finalItems,
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
        self.items = finalItems
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

    public static let defaultSeedItems: [VaultItem] = []

    // MARK: - Vault Reset / Delete

    public func resetVault() {
        stopAutoLockTimer()
        self.isUnlocked = false
        self.hasVault = false
        self.items = []
        self.folders = []
        self.settings = .default
        self.vaultKey = nil
        self.sessionVaultKey = nil
        self.cachedHeader = nil

        try? FileManager.default.removeItem(at: Self.vaultFileURL)
        try? FileManager.default.removeItem(at: Self.vaultDirectoryURL)
        KeychainManager.shared.clearKey()
        checkVaultExistence()
    }
}
