import Foundation

public struct DuplicateDetectorService: Sendable {
    public static let shared = DuplicateDetectorService()

    public init() {}

    // MARK: - Normalization Helpers

    public func normalizeDomain(_ urlOrDomain: String) -> String {
        var str = urlOrDomain.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !str.isEmpty else { return "" }

        if str.contains(" ") {
            return ""
        }

        if let url = URL(string: str), let host = url.host {
            str = host.lowercased()
        } else if let url = URL(string: "https://" + str), let host = url.host {
            str = host.lowercased()
        }

        if str.hasPrefix("www.") {
            str = String(str.dropFirst(4))
        }

        if let colonIndex = str.firstIndex(of: ":") {
            str = String(str[..<colonIndex])
        }

        let labels = str.components(separatedBy: ".")
        if labels.count >= 2 {
            let twoPartQualifiers: Set<String> = ["co", "com", "net", "org", "edu", "gov", "ac", "ne", "or", "mil", "int"]
            if labels.count >= 3 && twoPartQualifiers.contains(labels[labels.count - 2]) {
                return labels.suffix(3).joined(separator: ".")
            }
            return labels.suffix(2).joined(separator: ".")
        }

        return str
    }

    public func normalizeService(_ title: String) -> String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        let domain = normalizeDomain(trimmed)
        if domain.contains(".") {
            return domain
        }

        // Clean common suffixes and lowercased
        var clean = trimmed.lowercased()
        clean = clean.replacingOccurrences(of: "-", with: " ")
        clean = clean.replacingOccurrences(of: "_", with: " ")
        clean = clean.replacingOccurrences(of: ".com", with: "")
        clean = clean.replacingOccurrences(of: ".org", with: "")
        clean = clean.replacingOccurrences(of: ".net", with: "")
        clean = clean.replacingOccurrences(of: ".io", with: "")
        clean = clean.replacingOccurrences(of: ".app", with: "")
        clean = clean.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean
    }

    public func normalizeUsername(_ username: String?) -> String {
        guard let u = username?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !u.isEmpty else {
            return ""
        }
        return u
    }

    public func accountKey(for item: VaultItem) -> String {
        var domainKey = ""
        if let firstUrl = item.urls.first, !firstUrl.isEmpty {
            domainKey = normalizeDomain(firstUrl)
        }
        if domainKey.isEmpty {
            domainKey = normalizeService(item.title)
        }
        let userKey = normalizeUsername(item.username)
        return "\(domainKey)::\(userKey)"
    }

    // MARK: - In-Vault Duplicate Detection

    public func findDuplicateAccounts(in items: [VaultItem]) -> [DuplicateAccountGroup] {
        // Filter out trashed items; only inspect login or credentials with username or url
        let validItems = items.filter { !$0.trashed }

        var grouped: [String: [VaultItem]] = [:]
        for item in validItems {
            let key = accountKey(for: item)
            guard key != "::" && !key.hasPrefix("::") else { continue }
            grouped[key, default: []].append(item)
        }

        var results: [DuplicateAccountGroup] = []
        for (key, groupItems) in grouped where groupItems.count > 1 {
            let first = groupItems[0]
            let displayTitle = first.title.isEmpty ? (first.urls.first ?? "Unknown") : first.title
            let displayUsername = first.username ?? ""

            // Check if exact match (same password and totp)
            let firstPassword = first.password ?? ""
            let firstTotp = first.totpSecret ?? ""
            let isExact = groupItems.allSatisfy { item in
                (item.password ?? "") == firstPassword && (item.totpSecret ?? "") == firstTotp
            }

            results.append(DuplicateAccountGroup(
                id: key,
                title: displayTitle,
                username: displayUsername,
                items: groupItems,
                isExactMatch: isExact
            ))
        }

        // Sort: conflicting groups first, then by count descending, then by title
        return results.sorted { a, b in
            if a.isExactMatch != b.isExactMatch {
                return !a.isExactMatch // conflicts first
            }
            if a.items.count != b.items.count {
                return a.items.count > b.items.count
            }
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        }
    }

    public func findReusedPasswords(in items: [VaultItem]) -> [ReusedPasswordGroup] {
        let validItems = items.filter { !$0.trashed && $0.type == .login }

        var grouped: [String: [VaultItem]] = [:]
        for item in validItems {
            guard let pass = item.password, !pass.isEmpty else { continue }
            guard pass.count >= 4 else { continue } // Ignore trivial placeholder passwords
            grouped[pass, default: []].append(item)
        }

        var results: [ReusedPasswordGroup] = []
        for (pass, groupItems) in grouped where groupItems.count > 1 {
            results.append(ReusedPasswordGroup(
                id: UUID().uuidString,
                password: pass,
                items: groupItems.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            ))
        }

        return results.sorted { $0.items.count > $1.items.count }
    }

    // MARK: - Smart Merging

    public func smartMerge(items: [VaultItem]) -> (merged: VaultItem, trashedIds: [String]) {
        guard let first = items.first else {
            fatalError("Cannot merge empty item list")
        }
        guard items.count > 1 else {
            return (first, [])
        }

        // 1. Pick the primary base item:
        let sorted = items.sorted { a, b in
            let scoreA = itemCompletenessScore(a)
            let scoreB = itemCompletenessScore(b)
            if scoreA != scoreB {
                return scoreA > scoreB
            }
            return a.updatedAt > b.updatedAt
        }

        var merged = sorted[0]
        var trashedIds: [String] = []

        var allUrls = merged.urls
        var allTags = merged.tags
        var combinedNotes = merged.notes?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        var isFavorite = merged.favorite

        for item in sorted.dropFirst() {
            trashedIds.append(item.id)

            if isFavorite == false && item.favorite {
                isFavorite = true
            }

            // Union URLs
            for url in item.urls where !allUrls.contains(url) && !url.isEmpty {
                allUrls.append(url)
            }

            // Union Tags
            for tag in item.tags where !allTags.contains(tag) && !tag.isEmpty {
                allTags.append(tag)
            }

            // Merge Password if primary didn't have one
            if (merged.password == nil || merged.password?.isEmpty == true), let p = item.password, !p.isEmpty {
                merged.password = p
            }

            // Merge TOTP secret if primary didn't have one
            if (merged.totpSecret == nil || merged.totpSecret?.isEmpty == true), let t = item.totpSecret, !t.isEmpty {
                merged.totpSecret = t
            }

            // Merge Custom Fields
            if let secondaryFields = item.customFields {
                var currentFields = merged.customFields ?? []
                for field in secondaryFields {
                    if !currentFields.contains(where: { $0.name.lowercased() == field.name.lowercased() }) {
                        currentFields.append(field)
                    }
                }
                merged.customFields = currentFields.isEmpty ? nil : currentFields
            }

            // Merge Notes if different
            if let secNotes = item.notes?.trimmingCharacters(in: .whitespacesAndNewlines),
               !secNotes.isEmpty && !combinedNotes.contains(secNotes) {
                if combinedNotes.isEmpty {
                    combinedNotes = secNotes
                } else {
                    combinedNotes += "\n\n[Merged from duplicate]: \(secNotes)"
                }
            }
        }

        merged.urls = allUrls
        merged.tags = allTags
        merged.favorite = isFavorite
        merged.notes = combinedNotes.isEmpty ? nil : combinedNotes
        merged.updatedAt = ISO8601DateFormatter().string(from: Date())

        return (merged, trashedIds)
    }

    private func itemCompletenessScore(_ item: VaultItem) -> Int {
        var score = 0
        if let p = item.password, !p.isEmpty { score += 5 }
        if let t = item.totpSecret, !t.isEmpty { score += 4 }
        if !item.urls.isEmpty { score += 2 }
        if let n = item.notes, !n.isEmpty { score += 2 }
        if let c = item.customFields, !c.isEmpty { score += 2 }
        if item.favorite { score += 1 }
        return score
    }

    // MARK: - File vs Vault Comparison

    public func compareFileWithVault(
        fileItems: [VaultItem],
        vaultItems: [VaultItem],
        fileName: String? = nil
    ) -> FileImportComparisonResult {
        let activeVault = vaultItems.filter { !$0.trashed }

        // Build index of vault items by accountKey and by title+username
        var keyToVaultItem: [String: VaultItem] = [:]
        var titleUserToVaultItem: [String: VaultItem] = [:]
        var domainUserToVaultItem: [String: VaultItem] = [:]

        for v in activeVault {
            let key = accountKey(for: v)
            if !keyToVaultItem.keys.contains(key) {
                keyToVaultItem[key] = v
            }

            let titleKey = "\(v.title.lowercased())::\(normalizeUsername(v.username))"
            if !titleUserToVaultItem.keys.contains(titleKey) {
                titleUserToVaultItem[titleKey] = v
            }

            if let firstUrl = v.urls.first {
                let domain = normalizeDomain(firstUrl)
                if !domain.isEmpty {
                    let dKey = "\(domain)::\(normalizeUsername(v.username))"
                    if !domainUserToVaultItem.keys.contains(dKey) {
                        domainUserToVaultItem[dKey] = v
                    }
                }
            }
        }

        var comparisonItems: [FileImportComparisonItem] = []

        for item in fileItems {
            var cleanedItem = item
            cleanedItem.title = KeychainManager.cleanTitle(item.title)

            let key = accountKey(for: cleanedItem)
            let titleKey = "\(cleanedItem.title.lowercased())::\(normalizeUsername(cleanedItem.username))"
            var domainKey = ""
            if let firstUrl = cleanedItem.urls.first {
                let d = normalizeDomain(firstUrl)
                if !d.isEmpty {
                    domainKey = "\(d)::\(normalizeUsername(cleanedItem.username))"
                }
            }

            let matchedVaultItem = keyToVaultItem[key]
                ?? titleUserToVaultItem[titleKey]
                ?? (domainKey.isEmpty ? nil : domainUserToVaultItem[domainKey])

            if let matched = matchedVaultItem {
                let filePass = cleanedItem.password ?? ""
                let vaultPass = matched.password ?? ""
                let fileTotp = cleanedItem.totpSecret ?? ""
                let vaultTotp = matched.totpSecret ?? ""

                let passwordsMatch = (filePass == vaultPass)
                let totpMatch = fileTotp.isEmpty || (fileTotp == vaultTotp)

                if passwordsMatch && totpMatch {
                    comparisonItems.append(FileImportComparisonItem(
                        fileItem: cleanedItem,
                        matchedVaultItem: matched,
                        status: .exactMatch,
                        selectedStrategy: .skipDuplicate
                    ))
                } else {
                    comparisonItems.append(FileImportComparisonItem(
                        fileItem: cleanedItem,
                        matchedVaultItem: matched,
                        status: .conflict,
                        selectedStrategy: .updateExisting
                    ))
                }
            } else {
                comparisonItems.append(FileImportComparisonItem(
                    fileItem: cleanedItem,
                    matchedVaultItem: nil,
                    status: .new,
                    selectedStrategy: .updateExisting
                ))
            }
        }

        return FileImportComparisonResult(items: comparisonItems, fileName: fileName)
    }

    // MARK: - Resolution Application

    public func resolveImport(
        comparison: FileImportComparisonResult,
        globalStrategy: ImportDuplicateStrategy,
        overrides: [String: ImportDuplicateStrategy]
    ) -> (toAdd: [VaultItem], toUpdate: [VaultItem]) {
        var toAdd: [VaultItem] = []
        var toUpdate: [VaultItem] = []

        for item in comparison.items {
            let strategy = overrides[item.id] ?? globalStrategy

            switch item.status {
            case .new:
                toAdd.append(item.fileItem)

            case .exactMatch:
                switch strategy {
                case .skipDuplicate:
                    break
                case .updateExisting:
                    if var matched = item.matchedVaultItem {
                        var updated = false
                        for u in item.fileItem.urls where !matched.urls.contains(u) && !u.isEmpty {
                            matched.urls.append(u)
                            updated = true
                        }
                        for t in item.fileItem.tags where !matched.tags.contains(t) && !t.isEmpty {
                            matched.tags.append(t)
                            updated = true
                        }
                        if let n = item.fileItem.notes, !n.isEmpty, matched.notes?.contains(n) != true {
                            matched.notes = (matched.notes.map { "\($0)\n\(n)" }) ?? n
                            updated = true
                        }
                        if updated {
                            matched.updatedAt = ISO8601DateFormatter().string(from: Date())
                            toUpdate.append(matched)
                        }
                    }
                case .keepBoth:
                    var copy = item.fileItem
                    copy.id = UUID().uuidString
                    copy.title = "\(copy.title) (Imported)"
                    toAdd.append(copy)
                }

            case .conflict:
                switch strategy {
                case .skipDuplicate:
                    break
                case .updateExisting:
                    if var matched = item.matchedVaultItem {
                        if let newPass = item.fileItem.password, !newPass.isEmpty {
                            matched.password = newPass
                        }
                        if let newTotp = item.fileItem.totpSecret, !newTotp.isEmpty {
                            matched.totpSecret = newTotp
                        }
                        for u in item.fileItem.urls where !matched.urls.contains(u) && !u.isEmpty {
                            matched.urls.append(u)
                        }
                        for t in item.fileItem.tags where !matched.tags.contains(t) && !t.isEmpty {
                            matched.tags.append(t)
                        }
                        if let n = item.fileItem.notes, !n.isEmpty {
                            matched.notes = (matched.notes.map { "\($0)\n[Updated from import]: \(n)" }) ?? n
                        }
                        matched.updatedAt = ISO8601DateFormatter().string(from: Date())
                        toUpdate.append(matched)
                    }
                case .keepBoth:
                    var copy = item.fileItem
                    copy.id = UUID().uuidString
                    copy.title = "\(copy.title) (Imported)"
                    toAdd.append(copy)
                }
            }
        }

        return (toAdd, toUpdate)
    }

    // MARK: - Password Generator Helper

    public func generateSecurePassword(length: Int = 20) -> String {
        let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
        var result = ""
        for _ in 0..<max(12, length) {
            if let c = chars.randomElement() {
                result.append(c)
            }
        }
        return result
    }
}

