import Foundation

public struct CombinableCredentialGroup: Identifiable, Hashable, Sendable {
    public let id: String
    public let serviceKey: String
    public let title: String
    public let domain: String?
    public let primaryItem: VaultItem
    public let matchingItems: [VaultItem]
    public let hasLogin: Bool
    public let hasAuthenticator: Bool
    public let hasRecoveryCodes: Bool

    public var allItems: [VaultItem] {
        [primaryItem] + matchingItems
    }

    public var totalItemsCount: Int {
        allItems.count
    }

    public var loginItem: VaultItem? {
        allItems.first { $0.type == .login }
    }

    public var authenticatorItem: VaultItem? {
        allItems.first { $0.type == .authenticator || !($0.totpSecret ?? "").isEmpty }
    }

    public var recoveryItem: VaultItem? {
        allItems.first { $0.isRecoveryCode }
    }

    public var totalRecoveryCodes: Int {
        recoveryItem?.recoveryCodesList.count ?? 0
    }

    public var username: String {
        loginItem?.username ?? primaryItem.username ?? ""
    }
}

public struct CredentialCombinerService: Sendable {
    public static let shared = CredentialCombinerService()

    public init() {}

    // MARK: - Normalization & Service Extraction

    public func extractServiceKey(for item: VaultItem) -> String {
        // 1. Try URL domain first
        for url in item.urls where !url.isEmpty {
            let domain = DuplicateDetectorService.shared.normalizeDomain(url)
            if !domain.isEmpty {
                let brand = brandFromDomain(domain)
                if !brand.isEmpty { return brand }
            }
        }

        // 2. Derive from cleaned title
        let cleaned = BrandTitleService.cleanFilenameOrSlugTitle(item.title)
        var normalized = DuplicateDetectorService.shared.normalizeService(cleaned)

        // Strip common 2FA and note suffixes
        let suffixes = [
            " recovery codes", " recovery code", " recovery",
            " authenticator", " 2fa", " backup codes", " backup code",
            " backup", " codes", " code", " notes", " note", " keys", " key"
        ]
        for suffix in suffixes {
            if normalized.hasSuffix(suffix) {
                normalized = String(normalized.dropLast(suffix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        // Map common aliases
        if normalized == "protonmail" || normalized == "protonpass" || normalized == "protonvpn" {
            normalized = "proton"
        } else if normalized == "googlemail" || normalized == "gmail" {
            normalized = "google"
        }

        return normalized.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func brandFromDomain(_ domain: String) -> String {
        var d = domain.lowercased()
        if d.hasPrefix("www.") { d = String(d.dropFirst(4)) }
        let parts = d.components(separatedBy: ".")
        if parts.count >= 2 {
            let root = parts[0]
            if root == "protonmail" || root == "protonpass" || root == "protonvpn" {
                return "proton"
            }
            if root == "gmail" || root == "googlemail" {
                return "google"
            }
            return root
        }
        return d
    }

    // MARK: - Find Combinable Groups

    public func findCombinableGroups(in items: [VaultItem]) -> [CombinableCredentialGroup] {
        let validItems = items.filter { !$0.trashed }

        var grouped: [String: [VaultItem]] = [:]
        for item in validItems {
            let key = extractServiceKey(for: item)
            guard !key.isEmpty && key.count >= 2 else { continue }
            grouped[key, default: []].append(item)
        }

        var results: [CombinableCredentialGroup] = []

        for (key, groupItems) in grouped where groupItems.count >= 2 {
            let logins = groupItems.filter { $0.type == .login }
            let authenticators = groupItems.filter { $0.type == .authenticator || !($0.totpSecret ?? "").isEmpty }
            let recoveryNotes = groupItems.filter { $0.isRecoveryCode }

            let hasLogin = !logins.isEmpty
            let hasAuth = !authenticators.isEmpty
            let hasRec = !recoveryNotes.isEmpty

            // Check if there is genuine cross-functional data to combine
            let canCombine = (hasLogin && hasAuth && (logins.first?.totpSecret ?? "").isEmpty) ||
                             (hasLogin && hasRec && !(logins.first?.isRecoveryCode ?? false)) ||
                             (hasAuth && hasRec) ||
                             (hasLogin && hasAuth) ||
                             (hasLogin && hasRec) ||
                             (groupItems.contains { $0.type == .login } && groupItems.contains { $0.type == .authenticator || $0.type == .secureNote })

            guard canCombine else { continue }

            // Pick the best primary item:
            // 1. Login with both username and password
            // 2. Any login
            // 3. Authenticator
            // 4. First item
            let primary = logins.first(where: {
                ($0.username != nil && !$0.username!.isEmpty) &&
                ($0.password != nil && !$0.password!.isEmpty)
            }) ?? logins.first ?? authenticators.first ?? groupItems[0]

            let others = groupItems.filter { $0.id != primary.id }
            guard !others.isEmpty else { continue }

            let title = BrandTitleService.cleanTitle(primary.title, url: primary.urls.first)
            let domain = primary.urls.first.flatMap { DuplicateDetectorService.shared.normalizeDomain($0) }

            results.append(CombinableCredentialGroup(
                id: key,
                serviceKey: key,
                title: title,
                domain: domain,
                primaryItem: primary,
                matchingItems: others,
                hasLogin: hasLogin,
                hasAuthenticator: hasAuth,
                hasRecoveryCodes: hasRec
            ))
        }

        return results.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    // MARK: - User-Driven Multi-Item Combination & Preview

    /// Generates a live merged preview of the resulting unified item from any user-selected items.
    public func generatePreview(primaryId: String?, items: [VaultItem], customTitle: String? = nil) -> VaultItem? {
        guard !items.isEmpty else { return nil }

        let primary = items.first(where: { $0.id == primaryId })
            ?? items.first(where: { $0.type == .login })
            ?? items.first!

        var preview = primary

        if let ct = customTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !ct.isEmpty {
            preview.title = ct
        } else {
            preview.title = BrandTitleService.cleanTitle(primary.title, url: primary.urls.first)
        }

        for item in items where item.id != primary.id {
            // Username & Password
            if (preview.username == nil || preview.username?.isEmpty == true) && (item.username != nil && !item.username!.isEmpty) {
                preview.username = item.username
            }
            if (preview.password == nil || preview.password?.isEmpty == true) && (item.password != nil && !item.password!.isEmpty) {
                preview.password = item.password
            }

            // TOTP / 2FA
            if (preview.totpSecret == nil || preview.totpSecret?.isEmpty == true) && (item.totpSecret != nil && !item.totpSecret!.isEmpty) {
                preview.totpSecret = item.totpSecret
                preview.authenticatorDetails = item.authenticatorDetails
                if !preview.tags.contains("2FA") { preview.tags.append("2FA") }
            }

            // Recovery Codes / Notes
            if item.isRecoveryCode {
                if let recNote = item.notes, !recNote.isEmpty {
                    if preview.notes == nil || preview.notes?.isEmpty == true {
                        preview.notes = recNote
                    } else if let pNotes = preview.notes, !pNotes.contains(item.recoveryCodesList.first ?? "---") {
                        preview.notes = "\(pNotes)\n\n\(recNote)"
                    }
                }
                let combinedUsed = Set(preview.usedRecoveryCodes).union(item.usedRecoveryCodes)
                preview.usedRecoveryCodes = Array(combinedUsed).sorted()
                if !preview.tags.contains("Recovery Codes") { preview.tags.append("Recovery Codes") }
                if !preview.tags.contains("2FA") { preview.tags.append("2FA") }
            } else if let otherNotes = item.notes, !otherNotes.isEmpty {
                if preview.notes == nil || preview.notes?.isEmpty == true {
                    preview.notes = otherNotes
                } else if let pNotes = preview.notes, !pNotes.contains(otherNotes) {
                    preview.notes = "\(pNotes)\n\n\(otherNotes)"
                }
            }

            // URLs
            for u in item.urls where !preview.urls.contains(u) {
                preview.urls.append(u)
            }

            // Tags
            for t in item.tags where !preview.tags.contains(t) {
                preview.tags.append(t)
            }

            // Custom fields
            if let fields = item.customFields {
                var existing = preview.customFields ?? []
                for f in fields where !existing.contains(where: { $0.name.lowercased() == f.name.lowercased() }) {
                    existing.append(f)
                }
                preview.customFields = existing
            }
        }

        return preview
    }

    /// Combines any user-selected items from the vault into a single unified record.
    public func combineSelectedItems(
        primaryId: String,
        items: [VaultItem],
        customTitle: String? = nil,
        archiveOthersToTrash: Bool = true,
        in allItems: inout [VaultItem]
    ) -> VaultItem {
        guard let primaryIndex = allItems.firstIndex(where: { $0.id == primaryId }) else {
            return items.first!
        }

        guard let unifiedPreview = generatePreview(primaryId: primaryId, items: items, customTitle: customTitle) else {
            return allItems[primaryIndex]
        }

        var unified = unifiedPreview
        unified.updatedAt = ISO8601DateFormatter().string(from: Date())

        if archiveOthersToTrash {
            let now = ISO8601DateFormatter().string(from: Date())
            for item in items where item.id != primaryId {
                if let secIdx = allItems.firstIndex(where: { $0.id == item.id }) {
                    allItems[secIdx].trashed = true
                    allItems[secIdx].updatedAt = now
                }
            }
        }

        allItems[primaryIndex] = unified
        return unified
    }

    // MARK: - Combine Execution

    public func combine(group: CombinableCredentialGroup, in allItems: inout [VaultItem]) -> VaultItem {
        guard let primaryIndex = allItems.firstIndex(where: { $0.id == group.primaryItem.id }) else {
            return group.primaryItem
        }

        var unified = allItems[primaryIndex]

        for item in group.matchingItems {
            // 1. Merge TOTP / 2FA secret
            if (unified.totpSecret == nil || unified.totpSecret?.isEmpty == true) && (item.totpSecret != nil && !item.totpSecret!.isEmpty) {
                unified.totpSecret = item.totpSecret
                unified.authenticatorDetails = item.authenticatorDetails
                if !unified.tags.contains("2FA") {
                    unified.tags.append("2FA")
                }
            }

            // 2. Merge Recovery Codes
            if item.isRecoveryCode {
                if let recNote = item.notes, !recNote.isEmpty {
                    if unified.notes == nil || unified.notes?.isEmpty == true {
                        unified.notes = recNote
                    } else if let currentNotes = unified.notes, !currentNotes.contains(item.recoveryCodesList.first ?? "---") {
                        unified.notes = "\(currentNotes)\n\n\(recNote)"
                    }
                }
                // Merge used recovery code checkboxes
                let combinedUsed = Set(unified.usedRecoveryCodes).union(item.usedRecoveryCodes)
                unified.usedRecoveryCodes = Array(combinedUsed).sorted()

                if !unified.tags.contains("Recovery Codes") {
                    unified.tags.append("Recovery Codes")
                }
                if !unified.tags.contains("2FA") {
                    unified.tags.append("2FA")
                }
            } else if let otherNotes = item.notes, !otherNotes.isEmpty {
                if unified.notes == nil || unified.notes?.isEmpty == true {
                    unified.notes = otherNotes
                }
            }

            // 3. Merge username / password if missing on primary
            if (unified.username == nil || unified.username?.isEmpty == true) && (item.username != nil && !item.username!.isEmpty) {
                unified.username = item.username
            }
            if (unified.password == nil || unified.password?.isEmpty == true) && (item.password != nil && !item.password!.isEmpty) {
                unified.password = item.password
            }

            // 4. Merge URLs
            for u in item.urls where !unified.urls.contains(u) {
                unified.urls.append(u)
            }

            // 5. Merge Tags
            for t in item.tags where !unified.tags.contains(t) {
                unified.tags.append(t)
            }

            // 6. Merge Custom Fields
            if let fields = item.customFields {
                var existing = unified.customFields ?? []
                for field in fields where !existing.contains(where: { $0.name.lowercased() == field.name.lowercased() }) {
                    existing.append(field)
                }
                unified.customFields = existing
            }

            // 7. Safely archive secondary item to Trash so nothing is lost
            if let secondaryIndex = allItems.firstIndex(where: { $0.id == item.id }) {
                allItems[secondaryIndex].trashed = true
                allItems[secondaryIndex].updatedAt = ISO8601DateFormatter().string(from: Date())
            }
        }

        unified.updatedAt = ISO8601DateFormatter().string(from: Date())
        allItems[primaryIndex] = unified

        return unified
    }

    public func combineAll(groups: [CombinableCredentialGroup], in allItems: inout [VaultItem]) -> Int {
        var count = 0
        for group in groups {
            _ = combine(group: group, in: &allItems)
            count += 1
        }
        return count
    }
}
