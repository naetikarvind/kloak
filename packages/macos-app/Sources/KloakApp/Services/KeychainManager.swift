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
                        notes: "Discovered from macOS Keychain. Import via Passwords.csv for full plaintext password.",
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

    // MARK: - Cross-Platform Passwords & Vault Importers (Apple, Google, Microsoft, Proton)

    public func importFromApplePasswordsCSV(_ content: String) -> [VaultItem] {
        return importFromProviderContent(content, provider: nil)
    }

    public func importFromProviderContent(_ content: String, provider: CloudProvider?) -> [VaultItem] {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return [] }

        // 1. Try JSON formats (Proton Pass JSON, Bitwarden JSON, Kloak JSON)
        if trimmed.hasPrefix("{") || trimmed.hasPrefix("[") {
            if let data = trimmed.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Check for Bitwarden / Kloak items array
                if let jsonItems = (json["items"] as? [[String: Any]]) ?? (json["vaults"] as? [[String: Any]]) {
                    var results: [VaultItem] = []
                    for entry in jsonItems {
                        let name = (entry["name"] as? String) ?? (entry["title"] as? String) ?? ""
                        var username = entry["username"] as? String ?? ""
                        var password = entry["password"] as? String ?? ""
                        var urls: [String] = []
                        var totp: String? = entry["totp"] as? String ?? entry["totpSecret"] as? String
                        let notes = (entry["notes"] as? String) ?? (entry["description"] as? String)

                        if let login = entry["login"] as? [String: Any] {
                            username = login["username"] as? String ?? username
                            password = login["password"] as? String ?? password
                            totp = login["totp"] as? String ?? totp
                            if let uriList = login["uris"] as? [[String: Any]] {
                                urls = uriList.compactMap { $0["uri"] as? String }
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

                        let tagList: [String]
                        if let p = provider {
                            tagList = [p.displayName, "\(p.displayName) Passwords"]
                        } else {
                            tagList = ["Apple Keychain", "iCloud Passwords"]
                        }

                        results.append(VaultItem(
                            type: itemType,
                            title: Self.cleanTitle(name.isEmpty ? "Imported Credential" : name),
                            username: username.isEmpty ? nil : username,
                            password: password.isEmpty ? nil : password,
                            urls: urls,
                            notes: notes,
                            totpSecret: totp,
                            tags: tagList
                        ))
                    }
                    if !results.isEmpty { return results }
                }
            }
        }

        // 2. CSV parsing for Apple Passwords, Google Passwords, Microsoft Edge, Proton Pass
        var results: [VaultItem] = []
        let lines = trimmed.components(separatedBy: .newlines)
        guard lines.count > 1 else { return results }

        let headers = parseCSVRow(lines[0])
        let headerLower = headers.map { $0.lowercased().trimmingCharacters(in: .whitespaces) }

        let titleIdx = headerLower.firstIndex(where: { ["title", "name", "entry", "item_name"].contains($0) })
        let urlIdx = headerLower.firstIndex(where: { ["url", "website", "domain", "uri", "login_uri", "website_url"].contains($0) })
        let userIdx = headerLower.firstIndex(where: { ["username", "user name", "email", "account", "login_username"].contains($0) })
        let passIdx = headerLower.firstIndex(where: { ["password", "pass", "login_password"].contains($0) })
        let notesIdx = headerLower.firstIndex(where: { ["notes", "note", "comments", "description", "extra"].contains($0) })
        let totpIdx = headerLower.firstIndex(where: { ["otpauth", "totp", "otp", "otpsecret", "login_totp"].contains($0) })

        let defaultTags: [String] = {
            if let p = provider {
                switch p {
                case .google: return ["Google", "Chrome Passwords"]
                case .microsoft: return ["Microsoft", "Edge Passwords"]
                case .proton: return ["Proton", "Proton Pass"]
                }
            }
            return ["Apple Keychain", "iCloud Passwords"]
        }()

        for i in 1..<lines.count {
            let line = lines[i].trimmingCharacters(in: .whitespacesAndNewlines)
            if line.isEmpty { continue }

            let cols = parseCSVRow(line)
            let fallbackName = provider != nil ? "\(provider!.displayName) Login" : "iCloud Login"
            let rawTitle = safeCol(cols, titleIdx) ?? safeCol(cols, urlIdx) ?? fallbackName
            let title = Self.cleanTitle(rawTitle)
            let url = safeCol(cols, urlIdx)
            let user = safeCol(cols, userIdx)
            let pass = safeCol(cols, passIdx)
            let note = safeCol(cols, notesIdx)
            var totpSecret: String? = nil

            if let raw = safeCol(cols, totpIdx), !raw.isEmpty {
                if raw.lowercased().hasPrefix("otpauth://") {
                    if let urlComp = URLComponents(string: raw),
                       let secretParam = urlComp.queryItems?.first(where: { $0.name == "secret" })?.value {
                        totpSecret = secretParam
                    }
                } else {
                    totpSecret = raw
                }
            }

            if user != nil || pass != nil || !title.isEmpty {
                results.append(VaultItem(
                    type: .login,
                    title: title,
                    username: user,
                    password: pass,
                    urls: url != nil && !url!.isEmpty ? [url!] : [],
                    notes: note ?? (provider != nil ? "Imported from \(provider!.displayName)" : "Imported from Apple Passwords"),
                    totpSecret: totpSecret,
                    tags: defaultTags
                ))
            }
        }

        return results
    }

    private func parseCSVRow(_ row: String) -> [String] {
        var fields: [String] = []
        var current = ""
        var inQuotes = false
        let chars = Array(row)
        var idx = 0

        while idx < chars.count {
            let ch = chars[idx]
            if ch == "\"" {
                if inQuotes && idx + 1 < chars.count && chars[idx + 1] == "\"" {
                    current.append("\"")
                    idx += 2
                    continue
                } else {
                    inQuotes.toggle()
                    idx += 1
                    continue
                }
            } else if ch == "," && !inQuotes {
                fields.append(current)
                current = ""
                idx += 1
                continue
            } else {
                current.append(ch)
                idx += 1
            }
        }
        fields.append(current)
        return fields
    }

    private func safeCol(_ cols: [String], _ idx: Int?) -> String? {
        guard let i = idx, i < cols.count else { return nil }
        let val = cols[i].trimmingCharacters(in: .whitespaces)
        return val.isEmpty ? nil : val
    }
}
