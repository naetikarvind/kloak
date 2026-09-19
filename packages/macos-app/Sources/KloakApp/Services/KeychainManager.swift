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
        var access: SecAccess?
        // Open access list allows ad-hoc builds of Kloak to access without prompting for keychain passwords
        _ = SecAccessCreate("Kloak" as CFString, nil, &access)

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: keyData
        ]

        if let access = access {
            query[kSecAttrAccess as String] = access
        } else {
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
        }

        clearKey()
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

    /// Strips any "Kloak — ", "Kloak - - ", "Kloak - ", "Kloak-", or "kloak — " prefixes from a title.
    public static func cleanTitle(_ raw: String) -> String {
        var title = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let separators = CharacterSet(charactersIn: "-—–: \t\r\n")

        while true {
            let lower = title.lowercased()
            if lower.hasPrefix("kloakapp") {
                title = String(title.dropFirst(8)).trimmingCharacters(in: separators)
                continue
            } else if lower.hasPrefix("kloak") {
                title = String(title.dropFirst(5)).trimmingCharacters(in: separators)
                continue
            }
            break
        }

        return title.isEmpty ? raw : title
    }

    /// Determines whether a keychain entry or vault item is an internal macOS system token,
    /// daemon credential, Apple developer registration/certificate, app safe storage encryption key,
    /// local development server/database key, or hardware/network key, rather than a genuine user password/login.
    public static func isSystemOrDeveloperItem(server: String, service: String, account: String, label: String) -> Bool {
        let lowerServer = server.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let lowerService = service.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let lowerAccount = account.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let lowerLabel = label.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let combined = "\(lowerServer) \(lowerService) \(lowerAccount) \(lowerLabel)"

        // 0. Developer API endpoints and API keys (e.g. api.github.com, Gemini/OpenAI API keys)
        if lowerServer.hasPrefix("api.") || lowerServer.contains(".api.") || lowerLabel.contains("api.github.com") || lowerServer == "api.github.com" {
            return true
        }
        if lowerLabel.contains("api key") || lowerLabel.contains("apikey") || lowerLabel.contains("api_key") ||
           lowerService.contains("api key") || lowerService.contains("apikey") || lowerService.contains("api_key") ||
           lowerAccount.contains("apikey") || lowerAccount.contains("api_key") || lowerAccount.contains("api key") {
            return true
        }

        // 1. Safe Storage, App Encryption Keys & Internal Secret/Token Storage
        let storagePatterns = [
            "safe storage",
            "safestorage",
            "safe meeting",
            "safemeeting",
            "safe_storage",
            "storage_key",
            "secret storage",
            "credential store",
            "tokenstore",
            "token store",
            "keystore",
            "database_key",
            "urlcache_key",
            "db_key",
            "sqlite_key",
            "realm_key",
            "storecontroller",
            "store controller",
            "fmfd",
            "identities cache",
            "identities settings",
            "identity cache",
            "identity setting",
            "identity settings",
            "microsoft office identities",
            "raycast",
            "logioptionsplus",
            "logioptions",
            "logitech",
            "persistent state",
            "bitmap encryption",
            "window bitmap",
            "drivefs",
            "shottr"
        ]
        for p in storagePatterns {
            if combined.contains(p) { return true }
        }

        // 2. Reverse DNS application bundle identifier format (e.g. "app.glaze.macos.main", "jacklandrin.OnlySwitch")
        let commonTLDs: Set<String> = [
            "com", "org", "net", "edu", "gov", "mil", "int",
            "io", "co", "ai", "me", "app", "dev", "is", "tv", "cc",
            "in", "uk", "de", "ca", "fr", "jp", "au", "us", "eu", "ch", "nl", "se", "no", "es", "it", "br", "nz", "za", "ru", "cn", "mx", "sg", "kr", "hk",
            "info", "biz", "xyz", "online", "site", "tech", "store", "live", "club", "space", "vip", "pro", "cloud", "agency", "digital"
        ]
        let parts = lowerService.split(separator: ".")
        if parts.count >= 2 && !lowerService.contains(" ") {
            if (lowerService.hasPrefix("com.") || lowerService.hasPrefix("org.") || lowerService.hasPrefix("net.")) && parts.count >= 3 {
                return true
            }
            if let lastPart = parts.last {
                let lastStr = String(lastPart)
                if !commonTLDs.contains(lastStr) {
                    return true
                }
            }
        }

        // 3. Developer & Local Databases, Dev Servers (e.g. Mysql@127.0.0.1:3306, postgres@localhost)
        let devServerPatterns = [
            "mysql@",
            "mysql:",
            "postgres@",
            "postgresql@",
            "redis@",
            "mongodb@",
            "127.0.0.1",
            "localhost:",
            "localhost@",
            ":3306",
            ":5432",
            ":6379",
            ":27017",
            ":8080"
        ]
        for p in devServerPatterns {
            if combined.contains(p) { return true }
        }
        if (lowerService.contains("mysql") || lowerServer.contains("mysql") || lowerLabel.contains("mysql")) &&
           (lowerAccount == "root" || lowerAccount.contains("admin") || combined.contains("localhost") || combined.contains("127.0.0.1")) {
            return true
        }

        // 4. Non-email accounts containing "key", "token", "vault", "encryption"
        if !lowerAccount.contains("@") && (
            lowerAccount.contains("key") ||
            lowerAccount.contains("token") ||
            lowerAccount.contains("vault") ||
            lowerAccount.contains("encryption")
        ) {
            return true
        }

        // 5. Generic Password account identical to service or label (internal cache/settings/token)
        if (lowerAccount == lowerService || lowerAccount == lowerLabel) && !lowerAccount.contains("@") {
            return true
        }

        // 6. CLI / Local agent tokens
        if lowerService == "gemini" && lowerAccount == "antigravity" {
            return true
        }

        // 7. Long numeric Gaia / DSID accounts (10+ digits without @)
        if !lowerAccount.contains("@") && lowerAccount.count >= 10 && lowerAccount.rangeOfCharacter(from: CharacterSet.decimalDigits.inverted) == nil {
            return true
        }

        // 5. Deactivated test accounts from setup/onboarding
        let testAccounts = [
            "alex.music@spotify.com",
            "alex@acme.slack.com",
            "alex.watch@gmail.com",
            "alex.dev@github.com"
        ]
        if testAccounts.contains(lowerAccount) {
            return true
        }
        if lowerLabel.contains("personal chatgpt api") && lowerAccount == "personal" {
            return true
        }

        // 6. Hardware devices & computer sharing credentials (e.g. "Naetik's MacBook Pro", iMac, Mac mini)
        let devicePatterns = [
            "macbook",
            "imac",
            "mac mini",
            "mac studio",
            "mac pro",
            "macintosh"
        ]
        for p in devicePatterns {
            if combined.contains(p) { return true }
        }

        // 7. Apple iCloud internal sync tokens (e.g. Service: "iCloud", Account: numeric DSID like "18410015217")
        if (lowerService == "icloud" || lowerService.hasPrefix("icloud.") || lowerService.hasSuffix(".icloud") || lowerLabel.contains("icloud.com")) &&
           (!lowerAccount.contains("@") || lowerAccount.rangeOfCharacter(from: CharacterSet.decimalDigits.inverted) == nil) {
            return true
        }

        // 5. Developer certificates, provisioning profiles, code signing, and developer registrations
        let devPatterns = [
            "apple development",
            "apple distribution",
            "developer id",
            "mac developer",
            "iphone developer",
            "ios developer",
            "iphone distribution",
            "apple worldwide developer",
            "software signing",
            "codesign",
            "code signing",
            "provisioning",
            "com.apple.developer",
            "developer registration",
            "apple certification",
            "xcode",
            "wwdr",
            "notarization",
            "development identity",
            "distribution identity",
            "altool",
            "csr",
            "identity:"
        ]
        for p in devPatterns {
            if combined.contains(p) { return true }
        }

        // 6. macOS System daemons, services, internal subsystems, and network/hardware credentials
        let systemPatterns = [
            "com.apple.",
            "apple-",
            "bluetooth",
            "airport",
            "airdrop",
            "handoff",
            "continuity",
            "sidecar",
            "session-key",
            "protectedcloudstorage",
            "identity root",
            "encryption root",
            "nonce root",
            "public key root",
            "private key root",
            "master key root",
            "cloudkit",
            "cloudd",
            "trustd",
            "securityd",
            "syncdefaultsd",
            "scopedbookmarkagent",
            "containermanager",
            "launchservices",
            "nsurlcredentialstorage",
            "securityagent",
            "loginwindow",
            "filevault",
            "wifianalytics",
            "wifi",
            "wi-fi",
            "wireless",
            "802.1x",
            "vtpm",
            "parallels",
            "vmware",
            "virtualbox",
            "xauth",
            "vpn",
            "wireguard",
            "ipsec",
            "ikev2",
            "configurationprofiles",
            "device enrollment",
            "mdm",
            "kerberos",
            "token",
            "certificate",
            "idmsa.apple.com",
            "identity.apple.com",
            "gsa.apple.com",
            "setup.icloud.com",
            "albert.apple.com",
            "smoot.apple.com",
            "appleid.apple.com",
            // Mobile Hotspots & Wireless Network SSIDs
            "hotspot",
            "personal hotspot",
            "mobile hotspot",
            "instant hotspot",
            "portable hotspot",
            "tether",
            "tethering",
            "androidap",
            "iphone hotspot",
            "phone hotspot",
            "mobile network",
            "cellular hotspot",
            "wlan",
            "ssid"
        ]
        for p in systemPatterns {
            if combined.contains(p) { return true }
        }

        // 7. AirPort, Wi-Fi or Wireless network services (blocks all mobile hotspots, SSIDs)
        if lowerService.contains("airport") || lowerService.contains("wifi") || lowerService.contains("wi-fi") || lowerService.contains("wireless") {
            return true
        }

        // 8. Reverse DNS bundle identifier format check (e.g. "ch.protonvpn.mac", "org.videolan.vlc")
        if lowerService.contains(".") && !lowerService.contains(" ") && (
            lowerService.hasPrefix("com.") || lowerService.hasPrefix("ch.") ||
            lowerService.hasPrefix("org.") || lowerService.hasPrefix("net.") ||
            lowerService.hasPrefix("io.") || lowerService.hasPrefix("de.") ||
            lowerService.hasPrefix("fr.") || lowerService.hasPrefix("uk.")
        ) {
            return true
        }

        // 9. Hex strings, UUIDs, and curly-brace GUIDs in account or service
        let uuidPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
        if lowerAccount.range(of: uuidPattern, options: .regularExpression) != nil ||
           lowerService.range(of: uuidPattern, options: .regularExpression) != nil {
            return true
        }
        if (lowerAccount.contains("{") && lowerAccount.contains("}")) ||
           (lowerService.contains("{") && lowerService.contains("}")) {
            return true
        }

        // 10. MAC address pattern (e.g., AA:BB:CC:DD:EE:FF)
        let macPattern = "([0-9a-f]{2}:){5}[0-9a-f]{2}"
        if lowerAccount.range(of: macPattern, options: .regularExpression) != nil ||
           lowerService.range(of: macPattern, options: .regularExpression) != nil {
            return true
        }

        // 11. High entropy / raw crypto tokens without spaces (30+ characters without email @ or space)
        if lowerAccount.count >= 30 && !lowerAccount.contains(" ") && !lowerAccount.contains("@") {
            return true
        }
        if lowerService.count >= 30 && !lowerService.contains(" ") && !lowerService.contains("@") {
            return true
        }

        // 12. Missing both account and server
        if lowerAccount.isEmpty && lowerServer.isEmpty {
            return true
        }

        return false
    }

    /// Imports all internet and genuine user logins directly from the macOS Keychain,
    /// strictly filtering out developer registrations and system internal tokens.
    public func importFromKeychain() -> [VaultItem] {
        var importedItems: [VaultItem] = []

        // 1. Query Internet Passwords (Safari / Web logins)
        let internetQuery: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecReturnAttributes as String: true,
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
                let path = item[kSecAttrPath as String] as? String ?? ""

                // Filter out developer registrations and system internal tokens
                if Self.isSystemOrDeveloperItem(server: server, service: "", account: account, label: label) {
                    continue
                }

                var urlStr = ""
                if !server.isEmpty {
                    urlStr = "\(protocolType)://\(server)"
                    if port > 0 && port != 80 && port != 443 {
                        urlStr += ":\(port)"
                    }
                    if !path.isEmpty && path != "/" {
                        urlStr += path.hasPrefix("/") ? path : "/\(path)"
                    }
                }

                let rawTitle = label.isEmpty ? (server.isEmpty ? "Keychain Login" : server) : label
                let title = Self.cleanTitle(rawTitle)

                if !account.isEmpty || !server.isEmpty {
                    let vaultItem = VaultItem(
                        type: .login,
                        title: title,
                        username: account.isEmpty ? nil : account,
                        password: nil,
                        urls: urlStr.isEmpty ? [] : [urlStr],
                        notes: nil,
                        tags: ["Apple Keychain", "Imported"]
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
        let title = Self.cleanTitle(item.title)

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
            kSecAttrLabel as String: title,
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

    /// Scans the macOS Keychain and returns a summary of accessible passwords without modifying anything,
    /// filtering out developer registrations and system internal tokens.
    public func scanKeychainSummary() -> KeychainScanPreview {
        var internetCount = 0

        // 1. Internet passwords count (Web and app logins)
        let internetQuery: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]
        var internetResult: CFTypeRef?
        let internetStatus = SecItemCopyMatching(internetQuery as CFDictionary, &internetResult)
        if internetStatus == errSecSuccess, let items = internetResult as? [[String: Any]] {
            internetCount = items.filter { item in
                let server = item[kSecAttrServer as String] as? String ?? ""
                let account = item[kSecAttrAccount as String] as? String ?? ""
                let label = item[kSecAttrLabel as String] as? String ?? server
                return !Self.isSystemOrDeveloperItem(server: server, service: "", account: account, label: label)
            }.count
        }

        let isAuth = internetStatus == errSecSuccess
        var errDesc: String? = nil
        if !isAuth && internetStatus != errSecItemNotFound {
            errDesc = "Keychain authorization required."
        }

        return KeychainScanPreview(
            internetPasswordsCount: internetCount,
            genericPasswordsCount: 0,
            isAuthorized: isAuth || internetCount > 0,
            error: errDesc
        )
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

    // MARK: - Universal Passwords & Vault Importers (Apple, Chrome, Bitwarden, 1Password, KeePass, Proton, Dashlane, LastPass)

    public func importFromApplePasswordsCSV(_ content: String) -> [VaultItem] {
        return importFromContent(content, filename: "Passwords.csv", provider: nil).items
    }

    public func importFromProviderContent(_ content: String, provider: CloudProvider?) -> [VaultItem] {
        return importFromContent(content, filename: nil, provider: provider).items
    }

    public func importFromFile(url: URL) throws -> (items: [VaultItem], providerName: String) {
        let content = try Self.readFileContent(at: url)
        return importFromContent(content, filename: url.lastPathComponent, provider: nil)
    }

    public static func readFileContent(at url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        if let str = String(data: data, encoding: .utf8) {
            return stripBOM(str)
        }
        if let str = String(data: data, encoding: .isoLatin1) {
            return stripBOM(str)
        }
        if let str = String(data: data, encoding: .windowsCP1252) {
            return stripBOM(str)
        }
        if let str = String(data: data, encoding: .macOSRoman) {
            return stripBOM(str)
        }
        if let str = String(data: data, encoding: .utf16) {
            return stripBOM(str)
        }
        throw NSError(domain: "KloakVault", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to read password file. Unsupported text encoding."])
    }

    public static func stripBOM(_ str: String) -> String {
        var res = str
        if res.hasPrefix("\u{FEFF}") {
            res.removeFirst()
        }
        return res
    }

    public func importFromContent(_ rawContent: String, filename: String? = nil, provider: CloudProvider? = nil) -> (items: [VaultItem], providerName: String) {
        let content = Self.stripBOM(rawContent.trimmingCharacters(in: .whitespacesAndNewlines))
        if content.isEmpty { return ([], "Empty File") }

        // 1. Detect KeePass XML
        if content.hasPrefix("<") && (content.contains("<KeePassFile>") || content.contains("<Entry>")) {
            let items = Self.parseKeePassXML(content)
            if !items.isEmpty {
                return (items, "KeePass")
            }
        }

        // 2. Detect JSON (Bitwarden, 1Password, Proton, Kloak, Generic)
        if content.hasPrefix("{") || content.hasPrefix("[") {
            let (items, pName) = Self.parseJSONExport(content, filename: filename, provider: provider)
            if !items.isEmpty {
                return (items, pName)
            }
        }

        // 3. RFC 4180 CSV Parsing
        let (csvItems, csvProvider) = Self.parseCSVExport(content, filename: filename, provider: provider)
        return (csvItems, csvProvider)
    }

    private static func parseJSONExport(_ content: String, filename: String?, provider: CloudProvider?) -> (items: [VaultItem], providerName: String) {
        guard let data = content.data(using: .utf8),
              let jsonObject = try? JSONSerialization.jsonObject(with: data) else {
            return ([], "JSON")
        }

        var results: [VaultItem] = []
        var detectedProvider = "Password Manager (JSON)"

        let fn = filename?.lowercased() ?? ""
        if fn.contains("bitwarden") { detectedProvider = "Bitwarden" }
        else if fn.contains("1password") { detectedProvider = "1Password" }
        else if fn.contains("proton") { detectedProvider = "Proton Pass" }
        else if let p = provider { detectedProvider = p.displayName }

        var itemDictionaries: [[String: Any]] = []

        if let dict = jsonObject as? [String: Any] {
            if let items = dict["items"] as? [[String: Any]] {
                itemDictionaries = items
                if detectedProvider == "Password Manager (JSON)" { detectedProvider = "Bitwarden" }
            } else if let vaults = dict["vaults"] as? [[String: Any]] {
                itemDictionaries = vaults
                if detectedProvider == "Password Manager (JSON)" { detectedProvider = "Bitwarden" }
            } else if let accounts = dict["accounts"] as? [[String: Any]] {
                itemDictionaries = accounts
                if detectedProvider == "Password Manager (JSON)" { detectedProvider = "1Password" }
            }
        } else if let array = jsonObject as? [[String: Any]] {
            itemDictionaries = array
        }

        for entry in itemDictionaries {
            let name = (entry["name"] as? String) ?? (entry["title"] as? String) ?? ""
            var username = entry["username"] as? String ?? ""
            var password = entry["password"] as? String ?? ""
            var urls: [String] = []
            var totp: String? = (entry["totp"] as? String) ?? (entry["totpSecret"] as? String)
            let notes = (entry["notes"] as? String) ?? (entry["description"] as? String)
            let tags: [String] = [detectedProvider, "Imported"]

            // Bitwarden login sub-object
            if let login = entry["login"] as? [String: Any] {
                username = (login["username"] as? String) ?? username
                password = (login["password"] as? String) ?? password
                totp = (login["totp"] as? String) ?? totp
                if let uriList = login["uris"] as? [[String: Any]] {
                    urls.append(contentsOf: uriList.compactMap { $0["uri"] as? String })
                }
            }

            // 1Password fields array
            if let fields = entry["fields"] as? [[String: Any]] {
                for f in fields {
                    let id = (f["id"] as? String)?.lowercased() ?? ""
                    let designation = (f["designation"] as? String)?.lowercased() ?? ""
                    let value = f["value"] as? String ?? ""
                    if designation == "username" || id == "username" || id == "user" {
                        if username.isEmpty { username = value }
                    } else if designation == "password" || id == "password" {
                        if password.isEmpty { password = value }
                    } else if id.contains("totp") || id.contains("one-time") {
                        if totp == nil || totp!.isEmpty { totp = value }
                    }
                }
            }

            if let singleUrl = entry["url"] as? String, !singleUrl.isEmpty {
                urls.append(singleUrl)
            }

            let itemType: ItemType
            if let typeStr = entry["type"] as? String {
                itemType = typeStr == "note" || typeStr == "secureNote" ? .secureNote :
                           typeStr == "card" ? .card :
                           typeStr == "alias" ? .emailAlias : .login
            } else if let typeNum = entry["type"] as? Int {
                itemType = typeNum == 2 ? .secureNote : typeNum == 3 ? .card : .login
            } else {
                itemType = .login
            }

            let finalTitle = cleanTitle(name.isEmpty ? (username.isEmpty ? "Imported Credential" : username) : name)
            if !username.isEmpty || !password.isEmpty || !finalTitle.isEmpty {
                results.append(VaultItem(
                    type: itemType,
                    title: finalTitle,
                    username: username.isEmpty ? nil : username,
                    password: password.isEmpty ? nil : password,
                    urls: urls,
                    notes: notes,
                    totpSecret: extractTotpSecret(totp),
                    tags: tags
                ))
            }
        }

        return (results, detectedProvider)
    }

    private static func parseKeePassXML(_ text: String) -> [VaultItem] {
        var items: [VaultItem] = []
        let entryBlocks = text.components(separatedBy: "<Entry>")
        guard entryBlocks.count > 1 else { return [] }

        for block in entryBlocks.dropFirst() {
            guard let endIdx = block.range(of: "</Entry>")?.lowerBound else { continue }
            let entryContent = String(block[..<endIdx])

            var title: String?
            var user: String?
            var pass: String?
            var url: String?
            var notes: String?
            var totp: String?

            let stringBlocks = entryContent.components(separatedBy: "<String>")
            for sb in stringBlocks.dropFirst() {
                guard let kStart = sb.range(of: "<Key>")?.upperBound,
                      let kEnd = sb.range(of: "</Key>")?.lowerBound,
                      let vStart = sb.range(of: "<Value")?.upperBound,
                      let vEnd = sb.range(of: "</Value>")?.lowerBound,
                      kStart < kEnd, vStart < vEnd else { continue }

                let key = String(sb[kStart..<kEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
                var valuePart = String(sb[vStart..<vEnd])
                if let closeTag = valuePart.range(of: ">")?.upperBound {
                    valuePart = String(valuePart[closeTag...])
                }
                let val = valuePart.trimmingCharacters(in: .whitespacesAndNewlines)
                    .replacingOccurrences(of: "&amp;", with: "&")
                    .replacingOccurrences(of: "&lt;", with: "<")
                    .replacingOccurrences(of: "&gt;", with: ">")
                    .replacingOccurrences(of: "&quot;", with: "\"")

                switch key.lowercased() {
                case "title": title = val
                case "username", "user name": user = val
                case "password": pass = val
                case "url", "web site", "website": url = val
                case "notes", "comment", "comments": notes = val
                case "otp", "totp", "otpauth": totp = val
                default: break
                }
            }

            let finalTitle = title ?? user ?? url ?? "KeePass Entry"
            if (user != nil && !user!.isEmpty) || (pass != nil && !pass!.isEmpty) || !finalTitle.isEmpty {
                items.append(VaultItem(
                    type: .login,
                    title: cleanTitle(finalTitle),
                    username: user,
                    password: pass,
                    urls: (url != nil && !url!.isEmpty) ? [url!] : [],
                    notes: notes,
                    totpSecret: extractTotpSecret(totp),
                    tags: ["KeePass", "Imported"]
                ))
            }
        }
        return items
    }

    private static func parseCSVExport(_ content: String, filename: String?, provider: CloudProvider?) -> (items: [VaultItem], providerName: String) {
        let rows = parseRFC4180CSV(content)
        guard rows.count > 1 else { return ([], "CSV File") }

        let headers = rows[0].map { header in
            var h = header.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if h.hasPrefix("\u{feff}") { h.removeFirst() }
            return h
        }

        // Provider auto-detection from headers and filename
        var detected = "Password File"
        let fn = filename?.lowercased() ?? ""

        if headers.contains("otpauth") && (headers.contains("title") || fn.contains("passwords") || fn.contains("apple") || fn.contains("safari")) {
            detected = "Apple Passwords"
        } else if headers.contains("login_uri") || headers.contains("login_totp") || fn.contains("bitwarden") {
            detected = "Bitwarden"
        } else if headers.contains("name") && headers.contains("url") && headers.contains("username") && headers.contains("password") && !headers.contains("otpauth") {
            detected = "Google Chrome"
        } else if (headers.contains("favorite") && headers.contains("archived") && headers.contains("tags")) || fn.contains("1password") {
            detected = "1Password"
        } else if headers.contains("grouping") || headers.contains("fav") || fn.contains("lastpass") {
            detected = "LastPass"
        } else if (headers.contains("account") && headers.contains("login name")) || fn.contains("keepass") {
            detected = "KeePass"
        } else if headers.contains("create_time") || headers.contains("modify_time") || fn.contains("proton") {
            detected = "Proton Pass"
        } else if headers.contains("secondary_login") || fn.contains("dashlane") {
            detected = "Dashlane"
        } else if let p = provider {
            detected = p.displayName
        }

        // Column Index Matching
        let passIdx = headers.firstIndex(where: { ["password", "pass", "login_password", "pin", "code"].contains($0) })
        let totpIdx = headers.firstIndex(where: { ["otpauth", "totp", "otp", "otpsecret", "login_totp", "authenticator", "two-factor", "2fa", "secret key"].contains($0) })
        let userIdx = headers.firstIndex(where: { ["username", "user name", "login name", "login_username", "email", "login", "user", "login id", "loginid", "account name"].contains($0) })
        let titleIdx = headers.firstIndex(where: {
            if $0 == "account" && userIdx != nil { return true }
            return ["title", "name", "entry", "item_name", "service", "label", "system", "app"].contains($0)
        }) ?? headers.firstIndex(where: { ["title", "name", "entry"].contains($0) })
        let urlIdx = headers.firstIndex(where: { ["url", "website", "domain", "uri", "login_uri", "website_url", "web site", "login url", "site", "host"].contains($0) })
        let notesIdx = headers.firstIndex(where: { ["notes", "note", "comments", "comment", "description", "extra", "memo", "instructions"].contains($0) })
        let folderIdx = headers.firstIndex(where: { ["folder", "group", "grouping", "category", "tags", "tag"].contains($0) })
        let favIdx = headers.firstIndex(where: { ["favorite", "fav", "starred"].contains($0) })

        var results: [VaultItem] = []

        for row in rows.dropFirst() {
            guard !row.allSatisfy({ $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else { continue }

            let rawTitle = safeCol(row, titleIdx) ?? safeCol(row, urlIdx) ?? safeCol(row, userIdx) ?? "Imported Login"
            let title = cleanTitle(rawTitle)
            let user = safeCol(row, userIdx)
            let pass = safeCol(row, passIdx)
            let url = safeCol(row, urlIdx)
            let note = safeCol(row, notesIdx)
            let rawTotp = safeCol(row, totpIdx)
            let folder = safeCol(row, folderIdx)
            let isFav = safeCol(row, favIdx)?.lowercased() == "true" || safeCol(row, favIdx) == "1"

            var tagList: [String] = [detected, "Imported"]
            if let f = folder, !f.isEmpty && !tagList.contains(f) {
                tagList.insert(f, at: 0)
            }

            if user != nil || pass != nil || !title.isEmpty || url != nil {
                results.append(VaultItem(
                    type: .login,
                    title: title,
                    username: user,
                    password: pass,
                    urls: (url != nil && !url!.isEmpty) ? [url!] : [],
                    notes: note,
                    totpSecret: extractTotpSecret(rawTotp),
                    tags: tagList,
                    favorite: isFav
                ))
            }
        }

        return (results, detected)
    }

    private static func extractTotpSecret(_ raw: String?) -> String? {
        guard let r = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !r.isEmpty else { return nil }
        if r.lowercased().hasPrefix("otpauth://") {
            if let comp = URLComponents(string: r),
               let sec = comp.queryItems?.first(where: { $0.name.lowercased() == "secret" })?.value {
                return sec.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return r
    }

    public static func parseRFC4180CSV(_ text: String) -> [[String]] {
        var records: [[String]] = []
        var currentRecord: [String] = []
        var currentField = ""
        var inQuotes = false
        let chars = Array(text)
        var i = 0
        let n = chars.count

        while i < n {
            let ch = chars[i]
            if inQuotes {
                if ch == "\"" {
                    if i + 1 < n && chars[i + 1] == "\"" {
                        currentField.append("\"")
                        i += 2
                        continue
                    } else {
                        inQuotes = false
                        i += 1
                        continue
                    }
                } else {
                    currentField.append(ch)
                    i += 1
                    continue
                }
            } else {
                if ch == "\"" {
                    inQuotes = true
                    i += 1
                    continue
                } else if ch == "," {
                    currentRecord.append(currentField)
                    currentField = ""
                    i += 1
                    continue
                } else if ch == "\r" {
                    if i + 1 < n && chars[i + 1] == "\n" {
                        i += 1
                    }
                    currentRecord.append(currentField)
                    currentField = ""
                    if !currentRecord.allSatisfy({ $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
                        records.append(currentRecord)
                    }
                    currentRecord = []
                    i += 1
                    continue
                } else if ch == "\n" {
                    currentRecord.append(currentField)
                    currentField = ""
                    if !currentRecord.allSatisfy({ $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
                        records.append(currentRecord)
                    }
                    currentRecord = []
                    i += 1
                    continue
                } else {
                    currentField.append(ch)
                    i += 1
                    continue
                }
            }
        }

        if !currentField.isEmpty || !currentRecord.isEmpty {
            currentRecord.append(currentField)
            if !currentRecord.allSatisfy({ $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
                records.append(currentRecord)
            }
        }

        return records
    }

    private static func safeCol(_ cols: [String], _ idx: Int?) -> String? {
        guard let i = idx, i < cols.count else { return nil }
        let val = cols[i].trimmingCharacters(in: .whitespacesAndNewlines)
        return val.isEmpty ? nil : val
    }
}
