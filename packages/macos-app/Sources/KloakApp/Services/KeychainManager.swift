import Foundation
import Security

public struct KeychainSyncResult: Sendable {
    public var importedCount: Int
    public var exportedCount: Int
    public var errors: [String]
}

public final class KeychainManager: @unchecked Sendable {
    public static let shared = KeychainManager()
    private let service = "app.kloak.vault"
    private let account = "master_key_envelope"

    // MARK: - Master Key Secure Enclave / Keychain Storage

    public func storeKey(keyData: Data) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: keyData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked
        ]

        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    public func retrieveKey() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return data
    }

    public func clearKey() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Apple Keychain Two-Way Sync (Logins & Passwords)

    /// Imports all internet and generic passwords directly from the macOS Keychain.
    public func importFromKeychain() -> [VaultItem] {
        var importedItems: [VaultItem] = []

        // 1. Query Internet Passwords (Safari / Web logins)
        let internetQuery: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]

        var internetResult: CFTypeRef?
        let internetStatus = SecItemCopyMatching(internetQuery as CFDictionary, &internetResult)

        if internetStatus == errSecSuccess, let items = internetResult as? [[String: Any]] {
            for item in items {
                let server = item[kSecAttrServer as String] as? String ?? ""
                let account = item[kSecAttrAccount as String] as? String ?? ""
                let label = item[kSecAttrLabel as String] as? String ?? server
                let protocolType = item[kSecAttrProtocol as String] as? String ?? "https"
                let port = item[kSecAttrPort as String] as? Int ?? 0

                var password = ""
                if let pwdData = item[kSecValueData as String] as? Data {
                    password = String(data: pwdData, encoding: .utf8) ?? ""
                }

                var urlStr = ""
                if !server.isEmpty {
                    urlStr = "\(protocolType)://\(server)"
                    if port > 0 && port != 80 && port != 443 {
                        urlStr += ":\(port)"
                    }
                }

                if !account.isEmpty || !password.isEmpty || !server.isEmpty {
                    let vaultItem = VaultItem(
                        type: .login,
                        title: label.isEmpty ? (server.isEmpty ? "Keychain Item" : server) : label,
                        username: account.isEmpty ? nil : account,
                        password: password.isEmpty ? nil : password,
                        urls: urlStr.isEmpty ? [] : [urlStr],
                        notes: "Imported directly from macOS Apple Keychain",
                        tags: ["Apple Keychain"]
                    )
                    importedItems.append(vaultItem)
                }
            }
        }

        // 2. Query Generic Passwords (App logins, tokens)
        let genericQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]

        var genericResult: CFTypeRef?
        let genericStatus = SecItemCopyMatching(genericQuery as CFDictionary, &genericResult)

        if genericStatus == errSecSuccess, let items = genericResult as? [[String: Any]] {
            for item in items {
                let serviceName = item[kSecAttrService as String] as? String ?? ""
                // Skip Kloak's own master key envelope
                if serviceName == service { continue }

                let account = item[kSecAttrAccount as String] as? String ?? ""
                let label = item[kSecAttrLabel as String] as? String ?? serviceName

                var password = ""
                if let pwdData = item[kSecValueData as String] as? Data {
                    password = String(data: pwdData, encoding: .utf8) ?? ""
                }

                if !account.isEmpty || !password.isEmpty || !serviceName.isEmpty {
                    let vaultItem = VaultItem(
                        type: .login,
                        title: label.isEmpty ? serviceName : label,
                        username: account.isEmpty ? nil : account,
                        password: password.isEmpty ? nil : password,
                        urls: [],
                        notes: "Imported from macOS Keychain Service: \(serviceName)",
                        tags: ["Apple Keychain", "App Login"]
                    )
                    importedItems.append(vaultItem)
                }
            }
        }

        return importedItems
    }

    /// Mirrors a single Kloak vault item into the macOS Keychain.
    public func saveItemToKeychain(_ item: VaultItem) -> Bool {
        guard let password = item.password, !password.isEmpty else { return false }
        let pwdData = Data(password.utf8)
        let username = item.username ?? ""
        let title = item.title

        var server = ""
        if let firstUrl = item.urls.first, let urlObj = URL(string: firstUrl), let host = urlObj.host {
            server = host
        } else {
            server = title.lowercased().replacingOccurrences(of: " ", with: "") + ".com"
        }

        // Remove any existing entry first
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecAttrServer as String: server,
            kSecAttrAccount as String: username
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Insert new entry
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecAttrServer as String: server,
            kSecAttrAccount as String: username,
            kSecAttrLabel as String: "Kloak — \(title)",
            kSecAttrComment as String: "Mirrored from Kloak Password Manager",
            kSecValueData as String: pwdData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Removes an item from the macOS Keychain.
    public func removeItemFromKeychain(_ item: VaultItem) -> Bool {
        let username = item.username ?? ""
        var server = ""
        if let firstUrl = item.urls.first, let urlObj = URL(string: firstUrl), let host = urlObj.host {
            server = host
        } else {
            server = item.title.lowercased().replacingOccurrences(of: " ", with: "") + ".com"
        }

        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecAttrServer as String: server,
            kSecAttrAccount as String: username
        ]
        let status = SecItemDelete(deleteQuery as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    /// Bulk mirrors all non-trashed logins to the macOS Keychain.
    public func mirrorAllLoginsToKeychain(_ items: [VaultItem]) -> Int {
        var syncedCount = 0
        let eligible = items.filter { $0.type == .login && !$0.trashed && $0.password != nil }
        for item in eligible {
            if saveItemToKeychain(item) {
                syncedCount += 1
            }
        }
        return syncedCount
    }
}
