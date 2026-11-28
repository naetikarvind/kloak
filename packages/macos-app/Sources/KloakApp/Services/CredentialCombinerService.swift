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
        allItems.first { SmartCredentialUnderstander.shared.classifyRole($0) == .login }
    }

    public var authenticatorItem: VaultItem? {
        allItems.first {
            let role = SmartCredentialUnderstander.shared.classifyRole($0)
            return role == .authenticator || !($0.totpSecret ?? "").isEmpty
        }
    }

    public var recoveryItem: VaultItem? {
        allItems.first { SmartCredentialUnderstander.shared.hasRecoveryCapability($0) }
    }

    public var totalRecoveryCodes: Int {
        recoveryItem?.recoveryCodesList.count ?? 0
    }

    public var username: String {
        loginItem?.username ?? primaryItem.username ?? ""
    }
}

public enum RecommendationTier: String, Sendable, Hashable {
    case strong = "Strong Match"
    case smart = "Smart Suggestion"
}

public struct SmartCombinationRecommendation: Identifiable, Hashable, Sendable {
    public let id: String
    public let group: CombinableCredentialGroup
    public let confidence: Double
    public let tier: RecommendationTier
    public let reasons: [String]
}

public struct CredentialCombinerService: Sendable {
    public static let shared = CredentialCombinerService()
    private let understander = SmartCredentialUnderstander.shared

    public init() {}

    // MARK: - Normalization, Service Extraction & Validation

    public func extractServiceKey(for item: VaultItem) -> String {
        understander.extractServiceKey(from: item)
    }

    public func validateCombination(_ items: [VaultItem]) -> CombineValidationResult {
        understander.validateCombination(items)
    }

    public func canAddItem(_ candidate: VaultItem, to currentSelection: [VaultItem]) -> CombineValidationResult {
        understander.canAddItem(candidate, to: currentSelection)
    }

    public func smartMatchSuggestion(for candidate: VaultItem, against selection: [VaultItem]) -> SmartServiceMatch? {
        understander.suggestionMatch(for: candidate, against: selection)
    }

    public func recommendCompanions(for selection: [VaultItem], in allItems: [VaultItem]) -> [(item: VaultItem, match: SmartServiceMatch)] {
        understander.recommendCompanions(for: selection, in: allItems, minimumConfidence: 0.65)
    }

    // MARK: - Smart Recommender & Find Combinable Groups

    /// Auto-recommends valid cross-type credential combinations (`Login + Authenticator / Recovery Code`),
    /// ranked by confidence score and enriched with human-readable match explanations.
    public func findRecommendedCombinations(in items: [VaultItem]) -> [SmartCombinationRecommendation] {
        let roleOrder: [CombinableCredentialRole: Int] = [
            .login: 0,
            .authenticator: 1,
            .recoveryCode: 2,
            .other: 3
        ]

        let candidates = items
            .filter { !$0.trashed && understander.classifyRole($0).isCombinable }
            .sorted { lhs, rhs in
                let lRole = roleOrder[understander.classifyRole(lhs)] ?? 3
                let rRole = roleOrder[understander.classifyRole(rhs)] ?? 3
                if lRole != rRole { return lRole < rRole }
                return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
            }

        var consumedIds: Set<String> = []
        var recommendations: [SmartCombinationRecommendation] = []

        for anchor in candidates {
            if consumedIds.contains(anchor.id) { continue }

            let anchorRole = understander.classifyRole(anchor)
            var cluster: [VaultItem] = [anchor]
            var pairMatches: [SmartServiceMatch] = []

            let missingRoles = [CombinableCredentialRole.login, .authenticator, .recoveryCode]
                .filter { $0 != anchorRole }

            for targetRole in missingRoles {
                var bestItem: VaultItem?
                var bestMatch: SmartServiceMatch?

                for candidate in candidates where !consumedIds.contains(candidate.id) && candidate.id != anchor.id {
                    guard understander.classifyRole(candidate) == targetRole else { continue }
                    guard understander.canAddItem(candidate, to: cluster).isAllowed else { continue }

                    if let match = understander.match(anchor, candidate, requireCompatibleUsernames: true, minimumConfidence: 0.72),
                       match.confidence > (bestMatch?.confidence ?? 0.0) {
                        bestMatch = match
                        bestItem = candidate
                    }
                }

                if let matched = bestItem, let m = bestMatch {
                    cluster.append(matched)
                    pairMatches.append(m)
                }
            }

            guard cluster.count >= 2, understander.validateCombination(cluster).isAllowed else {
                continue
            }

            let primary = understander.pickPrimaryItem(from: cluster)
            let others = cluster.filter { $0.id != primary.id }
            guard !others.isEmpty else { continue }

            for item in cluster {
                consumedIds.insert(item.id)
            }

            let rawKey = cluster.map { understander.extractServiceKey(from: $0) }.first(where: { !$0.isEmpty }) ?? ""
            let serviceKey = rawKey.isEmpty ? primary.title.lowercased() : rawKey
            let domain = cluster.compactMap { $0.urls.first }.compactMap { url in
                let d = DuplicateDetectorService.shared.normalizeDomain(url)
                return d.isEmpty ? nil : d
            }.first

            let primaryRole = understander.classifyRole(primary)
            let rawTitleSource = primaryRole == .recoveryCode && !serviceKey.isEmpty ? serviceKey : primary.title
            let cleanUrl = domain.map { "https://\($0)" } ?? primary.urls.first
            let title = BrandTitleService.cleanTitle(rawTitleSource, url: cleanUrl)

            let hasLogin = cluster.contains { understander.classifyRole($0) == .login }
            let hasAuth = cluster.contains { understander.classifyRole($0) == .authenticator }
            let hasRec = cluster.contains { understander.classifyRole($0) == .recoveryCode }

            let avgConfidence = pairMatches.isEmpty ? 0.85 : pairMatches.map(\.confidence).reduce(0, +) / Double(pairMatches.count)
            let tier: RecommendationTier = avgConfidence >= 0.90 ? .strong : .smart

            var reasons: [String] = []
            for m in pairMatches where !reasons.contains(m.reason) {
                reasons.append(m.reason)
            }
            if hasAuth && understander.classifyRole(primary) != .authenticator {
                reasons.append("Adds 2FA TOTP token")
            }
            if let recItem = cluster.first(where: { understander.classifyRole($0) == .recoveryCode }),
               !recItem.recoveryCodesList.isEmpty {
                reasons.append("Adds \(recItem.recoveryCodesList.count) recovery codes")
            }

            let group = CombinableCredentialGroup(
                id: "\(serviceKey)_\(primary.id)",
                serviceKey: serviceKey,
                title: title,
                domain: domain,
                primaryItem: primary,
                matchingItems: others,
                hasLogin: hasLogin,
                hasAuthenticator: hasAuth,
                hasRecoveryCodes: hasRec
            )

            recommendations.append(SmartCombinationRecommendation(
                id: group.id,
                group: group,
                confidence: avgConfidence,
                tier: tier,
                reasons: reasons
            ))
        }

        return recommendations.sorted { lhs, rhs in
            if abs(lhs.confidence - rhs.confidence) > 0.03 {
                return lhs.confidence > rhs.confidence
            }
            if lhs.group.totalItemsCount != rhs.group.totalItemsCount {
                return lhs.group.totalItemsCount > rhs.group.totalItemsCount
            }
            return lhs.group.title.localizedCaseInsensitiveCompare(rhs.group.title) == .orderedAscending
        }
    }

    /// Discovers cross-type credential groups (`Login + Authenticator / Recovery Code`)
    /// using SmartCredentialUnderstander while strictly excluding same-type merges.
    public func findCombinableGroups(in items: [VaultItem]) -> [CombinableCredentialGroup] {
        findRecommendedCombinations(in: items)
            .filter { $0.confidence >= 0.80 }
            .map(\.group)
    }

    // MARK: - User-Driven Multi-Item Combination & Preview

    /// Generates a live merged preview of the resulting unified item from valid cross-type user-selected items.
    public func generatePreview(primaryId: String?, items: [VaultItem], customTitle: String? = nil) -> VaultItem? {
        guard !items.isEmpty else { return nil }
        if items.count >= 2 && !understander.validateCombination(items).isAllowed {
            return nil
        }

        let primary = items.first(where: { $0.id == primaryId })
            ?? understander.pickPrimaryItem(from: items)

        var preview = primary

        // Upgrade container type when combining (e.g. Login + Recovery -> Login; Auth + Recovery -> Authenticator)
        if items.contains(where: { understander.classifyRole($0) == .login }) {
            preview.type = .login
        } else if items.contains(where: { understander.classifyRole($0) == .authenticator }) {
            preview.type = .authenticator
        }

        if let ct = customTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !ct.isEmpty {
            preview.title = ct
        } else {
            let bestTitleSource = items.first(where: { understander.classifyRole($0) == .login })
                ?? items.first(where: { understander.classifyRole($0) == .authenticator })
                ?? primary
            let serviceKey = items.map { understander.extractServiceKey(from: $0) }.first(where: { !$0.isEmpty })
            let fallbackSource = (understander.classifyRole(bestTitleSource) == .recoveryCode && !(serviceKey ?? "").isEmpty)
                ? (serviceKey ?? bestTitleSource.title)
                : bestTitleSource.title
            let bestUrl = items.compactMap(\.urls.first).first
            preview.title = BrandTitleService.cleanTitle(fallbackSource, url: bestUrl)
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
            let isRecovery = understander.classifyRole(item) == .recoveryCode || item.isRecoveryCode
            if isRecovery {
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
            for u in item.urls where !preview.urls.contains(u) && !u.isEmpty {
                preview.urls.append(u)
            }

            // Tags
            for t in item.tags where !preview.tags.contains(t) && !t.isEmpty {
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

    /// Combines valid different-type items from the vault into a single unified record.
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

        guard understander.validateCombination(items).isAllowed,
              let unifiedPreview = generatePreview(primaryId: primaryId, items: items, customTitle: customTitle) else {
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
        combineSelectedItems(
            primaryId: group.primaryItem.id,
            items: group.allItems,
            customTitle: group.title,
            archiveOthersToTrash: true,
            in: &allItems
        )
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
