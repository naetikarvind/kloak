import SwiftUI

public struct CombineCredentialsView: View {
    @Binding var items: [VaultItem]
    @Binding var preselectedItemIds: Set<String>
    var onSaveItem: ((VaultItem) -> Void)? = nil
    var onSelectCombinedItem: ((String) -> Void)? = nil

    @State private var selectedItemIds: Set<String> = []
    @State private var primaryTargetId: String? = nil
    @State private var customTitleText: String = ""
    @State private var searchText: String = ""
    @State private var filterType: FilterType = .all
    @State private var archiveOthersToTrash: Bool = true
    @State private var revealPasswordPreview: Bool = false
    @State private var statusMessage: String? = nil
    @State private var lastCombinedItemId: String? = nil
    @State private var showSuggestionsSheet: Bool = false

    private enum FilterType: String, CaseIterable, Identifiable {
        case all = "All"
        case logins = "Logins"
        case twoFA = "2FA"
        case notes = "Recovery"

        var id: String { rawValue }
    }

    public init(
        items: Binding<[VaultItem]>,
        preselectedItemIds: Binding<Set<String>> = .constant([]),
        onSaveItem: ((VaultItem) -> Void)? = nil,
        onSelectCombinedItem: ((String) -> Void)? = nil
    ) {
        self._items = items
        self._preselectedItemIds = preselectedItemIds
        self.onSaveItem = onSaveItem
        self.onSelectCombinedItem = onSelectCombinedItem
    }

    private var nonTrashedItems: [VaultItem] {
        items.filter { !$0.trashed }
    }

    private var combinableVaultItems: [VaultItem] {
        nonTrashedItems.filter { SmartCredentialUnderstander.shared.classifyRole($0).isCombinable }
    }

    private var filteredVaultItems: [VaultItem] {
        let base: [VaultItem]
        switch filterType {
        case .all:
            base = combinableVaultItems
        case .logins:
            base = combinableVaultItems.filter { SmartCredentialUnderstander.shared.classifyRole($0) == .login }
        case .twoFA:
            base = combinableVaultItems.filter { SmartCredentialUnderstander.shared.classifyRole($0) == .authenticator }
        case .notes:
            base = combinableVaultItems.filter { SmartCredentialUnderstander.shared.classifyRole($0) == .recoveryCode }
        }

        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let queried: [VaultItem]
        if query.isEmpty {
            queried = base
        } else {
            queried = base.filter { item in
                item.title.lowercased().contains(query) ||
                (item.username?.lowercased().contains(query) ?? false) ||
                item.urls.contains { $0.lowercased().contains(query) } ||
                (item.notes?.lowercased().contains(query) ?? false)
            }
        }

        // Float selected items and Smart Credential Understander matches to the top
        guard !selectedItemsList.isEmpty else { return queried }
        return queried.sorted { lhs, rhs in
            let lSel = selectedItemIds.contains(lhs.id)
            let rSel = selectedItemIds.contains(rhs.id)
            if lSel != rSel { return lSel }

            let lSmart = CredentialCombinerService.shared.smartMatchSuggestion(for: lhs, against: selectedItemsList)?.confidence ?? 0
            let rSmart = CredentialCombinerService.shared.smartMatchSuggestion(for: rhs, against: selectedItemsList)?.confidence ?? 0
            if abs(lSmart - rSmart) > 0.001 { return lSmart > rSmart }

            let lAllowed = CredentialCombinerService.shared.canAddItem(lhs, to: selectedItemsList).isAllowed
            let rAllowed = CredentialCombinerService.shared.canAddItem(rhs, to: selectedItemsList).isAllowed
            if lAllowed != rAllowed { return lAllowed }

            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    private var selectedItemsList: [VaultItem] {
        combinableVaultItems.filter { selectedItemIds.contains($0.id) }
    }

    private var selectionValidation: CombineValidationResult {
        CredentialCombinerService.shared.validateCombination(selectedItemsList)
    }

    private var effectivePrimaryItem: VaultItem? {
        if let pid = primaryTargetId, let item = selectedItemsList.first(where: { $0.id == pid }) {
            return item
        }
        return selectedItemsList.first(where: { SmartCredentialUnderstander.shared.classifyRole($0) == .login })
            ?? selectedItemsList.first(where: { SmartCredentialUnderstander.shared.classifyRole($0) == .authenticator })
            ?? selectedItemsList.first
    }

    private var unifiedPreviewItem: VaultItem? {
        guard selectedItemsList.count >= 2, selectionValidation.isAllowed else { return nil }
        return CredentialCombinerService.shared.generatePreview(
            primaryId: effectivePrimaryItem?.id,
            items: selectedItemsList,
            customTitle: customTitleText.isEmpty ? nil : customTitleText
        )
    }

    private var smartRecommendations: [SmartCombinationRecommendation] {
        CredentialCombinerService.shared.findRecommendedCombinations(in: items)
    }

    private var suggestedMatches: [CombinableCredentialGroup] {
        smartRecommendations.filter { $0.confidence >= 0.80 }.map(\.group)
    }

    public var body: some View {
        HStack(spacing: 0) {
            // LEFT COLUMN: Vault Credential Selector
            leftSelectorColumn
                .frame(minWidth: 320, idealWidth: 380, maxWidth: 440)
                .background(Color.black.opacity(0.18))

            Divider().opacity(0.18)

            // RIGHT COLUMN: Live Interactive Merge Studio & Japanese Bento Preview
            rightMergeStudioColumn
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black.opacity(0.08))
        }
        .onAppear {
            applySanitizedPreselection(preselectedItemIds, replace: true)
        }
        .onChange(of: preselectedItemIds) { _, newIds in
            applySanitizedPreselection(newIds, replace: false)
        }
    }

    private func applySanitizedPreselection(_ candidateIds: Set<String>, replace: Bool) {
        guard !candidateIds.isEmpty else { return }
        var running = replace ? [] : selectedItemsList
        for id in candidateIds {
            guard let item = combinableVaultItems.first(where: { $0.id == id }) else { continue }
            if !running.contains(where: { $0.id == id }),
               CredentialCombinerService.shared.canAddItem(item, to: running).isAllowed {
                running.append(item)
            }
        }
        selectedItemIds = Set(running.map(\.id))
        if let primary = running.first(where: { SmartCredentialUnderstander.shared.classifyRole($0) == .login }) ?? running.first {
            primaryTargetId = primary.id
            customTitleText = BrandTitleService.cleanTitle(primary.title, url: primary.urls.first)
        }
    }

    // MARK: - Left Selector Column

    private var leftSelectorColumn: some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.merge")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    Text("Select Credentials")
                        .font(.system(size: 16, weight: .bold))

                    Spacer()

                    if !selectedItemIds.isEmpty {
                        Button("Clear (\(selectedItemIds.count))") {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                                selectedItemIds.removeAll()
                                primaryTargetId = nil
                                customTitleText = ""
                            }
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.secondary)
                        .buttonStyle(.plain)
                    }
                }

                Text("Combine credentials of different types only: Login + Authenticator / Recovery Code.")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)

                if !selectedItemsList.isEmpty {
                    let selectedRoles = Set(selectedItemsList.map { SmartCredentialUnderstander.shared.classifyRole($0) })
                    let missingRoles = [CombinableCredentialRole.login, .authenticator, .recoveryCode]
                        .filter { !selectedRoles.contains($0) }
                    HStack(spacing: 6) {
                        Image(systemName: selectionValidation.isAllowed ? "checkmark.seal.fill" : "sparkles")
                            .font(.system(size: 10))
                            .foregroundColor(selectionValidation.isAllowed ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.primaryAccent)
                        Text(missingRoles.isEmpty
                             ? "All 3 different credential types selected"
                             : "Compatible next: \(missingRoles.map(\.shortLabel).joined(separator: ", "))")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                // Search Bar
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    TextField("Search vault credentials...", text: $searchText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12))
                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                // Filter Tabs
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(FilterType.allCases) { filter in
                            Button(action: { filterType = filter }) {
                                Text(filter.rawValue)
                                    .font(.system(size: 11, weight: filterType == filter ? .semibold : .regular))
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 4)
                                    .background(filterType == filter ? LiquidGlassTheme.primaryAccent.opacity(0.2) : Color.white.opacity(0.05))
                                    .foregroundColor(filterType == filter ? LiquidGlassTheme.primaryAccent : .secondary)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Smart Recommender Quick-Load Strip
                if !smartRecommendations.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 5) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                            Text("Smart Recommender (\(smartRecommendations.count))")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.primary)
                            Spacer()
                            if !selectedItemIds.isEmpty {
                                Button("View All") {
                                    withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                                        selectedItemIds.removeAll()
                                        primaryTargetId = nil
                                        customTitleText = ""
                                    }
                                }
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                                .buttonStyle(.plain)
                            }
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(smartRecommendations.prefix(6)) { rec in
                                    Button(action: {
                                        loadSuggestedGroup(rec.group)
                                    }) {
                                        HStack(spacing: 4) {
                                            Text(rec.group.title)
                                                .font(.system(size: 10, weight: .semibold))
                                                .foregroundColor(.primary)
                                            Text("\(Int((rec.confidence * 100).rounded()))%")
                                                .font(.system(size: 9, weight: .bold))
                                                .foregroundColor(rec.tier == .strong ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.amberAccent)
                                        }
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(LiquidGlassTheme.primaryAccent.opacity(0.12))
                                        .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(8)
                    .background(LiquidGlassTheme.primaryAccent.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(14)

            Divider().opacity(0.12)

            // Items List
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(filteredVaultItems) { item in
                        vaultItemSelectorRow(item)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
            }
        }
    }

    private func vaultItemSelectorRow(_ item: VaultItem) -> some View {
        let isSelected = selectedItemIds.contains(item.id)
        let isPrimary = effectivePrimaryItem?.id == item.id
        let role = SmartCredentialUnderstander.shared.classifyRole(item)
        let addValidation = CredentialCombinerService.shared.canAddItem(item, to: selectedItemsList)
        let isDisabled = !isSelected && !addValidation.isAllowed
        let smartMatch = (!isSelected && !isDisabled)
            ? CredentialCombinerService.shared.smartMatchSuggestion(for: item, against: selectedItemsList)
            : nil

        return Button(action: {
            guard isSelected || addValidation.isAllowed else { return }
            withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                if isSelected {
                    selectedItemIds.remove(item.id)
                    if primaryTargetId == item.id {
                        let nextPrimary = selectedItemsList.first(where: { SmartCredentialUnderstander.shared.classifyRole($0) == .login })
                            ?? selectedItemsList.first
                        primaryTargetId = nextPrimary?.id
                        if let next = nextPrimary {
                            customTitleText = BrandTitleService.cleanTitle(next.title, url: next.urls.first)
                        } else {
                            customTitleText = ""
                        }
                    }
                } else {
                    selectedItemIds.insert(item.id)
                    let currentPrimaryRole = effectivePrimaryItem.map { SmartCredentialUnderstander.shared.classifyRole($0) }
                    if primaryTargetId == nil || (role == .login && currentPrimaryRole != .login) {
                        primaryTargetId = item.id
                        customTitleText = BrandTitleService.cleanTitle(item.title, url: item.urls.first)
                    }
                }
            }
        }) {
            HStack(spacing: 10) {
                // Checkbox / Locked indicator
                Image(systemName: isSelected ? "checkmark.circle.fill" : (isDisabled ? "slash.circle" : "circle"))
                    .font(.system(size: 14))
                    .foregroundColor(
                        isSelected ? LiquidGlassTheme.primaryAccent :
                        (isDisabled ? .secondary.opacity(0.35) : .secondary.opacity(0.5))
                    )

                // Favicon
                FaviconView(
                    urls: item.urls,
                    title: item.title,
                    oauthProvider: item.oauth?.provider,
                    itemType: item.type,
                    size: 26
                )

                // Info
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(item.title)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(isDisabled ? .secondary : .primary)
                            .lineLimit(1)

                        if isPrimary && isSelected {
                            Text("Primary")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(LiquidGlassTheme.primaryAccent.opacity(0.15))
                                .clipShape(Capsule())
                        } else if let sm = smartMatch {
                            Text("✨ \(sm.reason)")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(LiquidGlassTheme.emeraldAccent.opacity(0.14))
                                .clipShape(Capsule())
                                .lineLimit(1)
                        }
                    }

                    HStack(spacing: 6) {
                        if let u = item.username, !u.isEmpty {
                            Text(u)
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        } else if role == .recoveryCode || item.isRecoveryCode {
                            Text("\(item.recoveryCodesList.count) codes")
                                .font(.system(size: 10))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        } else {
                            Text(item.type.displayName)
                                .font(.system(size: 10))
                                .foregroundColor(.secondary.opacity(0.7))
                        }

                        // Component badge
                        itemTypeBadge(item)

                        if isDisabled {
                            Text(!role.isCombinable ? "Not combinable" : "Same type")
                                .font(.system(size: 8, weight: .semibold))
                                .foregroundColor(.secondary.opacity(0.8))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(Color.white.opacity(0.06))
                                .clipShape(Capsule())
                        }
                    }
                }

                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                isSelected ? LiquidGlassTheme.primaryAccent.opacity(0.12) :
                (smartMatch != nil ? LiquidGlassTheme.emeraldAccent.opacity(0.06) : Color.white.opacity(0.03))
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(
                        isSelected ? LiquidGlassTheme.primaryAccent.opacity(0.35) :
                        (smartMatch != nil ? LiquidGlassTheme.emeraldAccent.opacity(0.28) : Color.clear),
                        lineWidth: 1
                    )
            )
            .opacity(isDisabled ? 0.45 : 1.0)
        }
        .disabled(isDisabled)
        .buttonStyle(.plain)
        .help(addValidation.reason ?? (smartMatch?.reason ?? ""))
    }

    private func itemTypeBadge(_ item: VaultItem) -> some View {
        let role = SmartCredentialUnderstander.shared.classifyRole(item)
        return Group {
            switch role {
            case .recoveryCode:
                Text("Recovery")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                    .clipShape(Capsule())
            case .authenticator:
                Text("2FA")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(LiquidGlassTheme.primaryAccent.opacity(0.12))
                    .clipShape(Capsule())
            case .login:
                Text(SmartCredentialUnderstander.shared.hasAuthenticatorCapability(item) ? "Login + 2FA" : "Login")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.amberAccent)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(LiquidGlassTheme.amberAccent.opacity(0.12))
                    .clipShape(Capsule())
            case .other:
                EmptyView()
            }
        }
    }

    // MARK: - Right Merge Studio Column

    private var rightMergeStudioColumn: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Status Alert Banner
                if let status = statusMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        Text(status)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.primary)
                        Spacer()
                        if let lastId = lastCombinedItemId {
                            Button(action: {
                                onSelectCombinedItem?(lastId)
                            }) {
                                HStack(spacing: 4) {
                                    Text("View in Vault")
                                        .font(.system(size: 11, weight: .semibold))
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 10, weight: .semibold))
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(LiquidGlassTheme.emeraldAccent.opacity(0.2))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            .buttonStyle(.plain)
                        }
                        Button(action: {
                            statusMessage = nil
                            lastCombinedItemId = nil
                        }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                if selectedItemsList.isEmpty {
                    smartRecommenderDashboard
                } else if selectedItemsList.count == 1, let singleItem = selectedItemsList.first {
                    singleSelectionRecommenderView(for: singleItem)
                } else if let preview = unifiedPreviewItem {
                    activeMergeStudio(preview: preview)
                } else if let errorReason = selectionValidation.reason {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(LiquidGlassTheme.amberAccent)
                        Text("Cannot Combine Same Credential Type")
                            .font(.system(size: 15, weight: .bold))
                        Text(errorReason)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(24)
                    .frame(maxWidth: .infinity)
                    .background(LiquidGlassTheme.amberAccent.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(24)
        }
    }

    @ViewBuilder
    private var smartRecommenderDashboard: some View {
        let recs = CredentialCombinerService.shared.findRecommendedCombinations(in: items)
        let strongRecs = recs.filter { $0.tier == .strong }

        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(LiquidGlassTheme.primaryAccent.opacity(0.14))
                        .frame(width: 42, height: 42)
                    Image(systemName: "sparkles")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text("Smart Recommender")
                            .font(.system(size: 18, weight: .bold))
                        if !recs.isEmpty {
                            Text("\(recs.count) Suggested")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                                .clipShape(Capsule())
                        }
                    }
                    Text("Auto-discovers different credential types (Login + Authenticator / Recovery Code) that belong together.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }

                Spacer()

                if !strongRecs.isEmpty {
                    Button(action: {
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) {
                            let count = VaultStore.shared.combineAllCredentialGroups()
                            items = VaultStore.shared.items
                            statusMessage = "✓ Auto-combined \(count) strong recommendation(s) into unified credentials!"
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "wand.and.stars")
                                .font(.system(size: 11, weight: .bold))
                            Text("Combine Strong (\(strongRecs.count))")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(LiquidGlassTheme.emeraldAccent)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }

            if recs.isEmpty {
                emptyStudioState
            } else {
                VStack(spacing: 12) {
                    ForEach(recs) { rec in
                        recommendationCard(rec)
                    }
                }
            }
        }
    }

    private func recommendationCard(_ rec: SmartCombinationRecommendation) -> some View {
        let pct = Int((rec.confidence * 100).rounded())
        let tierColor = rec.tier == .strong ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.amberAccent

        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                FaviconView(
                    urls: rec.group.primaryItem.urls,
                    title: rec.group.title,
                    oauthProvider: rec.group.primaryItem.oauth?.provider,
                    itemType: rec.group.primaryItem.type,
                    size: 32
                )

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text(rec.group.title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.primary)

                        Text("\(pct)% · \(rec.tier.rawValue)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(tierColor)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(tierColor.opacity(0.14))
                            .clipShape(Capsule())
                    }

                    HStack(spacing: 6) {
                        if !rec.group.username.isEmpty {
                            Text(rec.group.username)
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        if let domain = rec.group.domain, !domain.isEmpty {
                            Text(rec.group.username.isEmpty ? domain : "• \(domain)")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary.opacity(0.85))
                        }
                    }
                }

                Spacer()

                HStack(spacing: 6) {
                    if rec.group.hasLogin {
                        rolePill("Login", color: LiquidGlassTheme.amberAccent)
                    }
                    if rec.group.hasAuthenticator {
                        rolePill("2FA", color: LiquidGlassTheme.primaryAccent)
                    }
                    if rec.group.hasRecoveryCodes {
                        rolePill("Recovery", color: LiquidGlassTheme.emeraldAccent)
                    }
                }
            }

            if !rec.reasons.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 10))
                        .foregroundColor(tierColor)
                    Text(rec.reasons.joined(separator: "  •  "))
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                .padding(.horizontal, 9)
                .padding(.vertical, 5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.22))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            VStack(spacing: 5) {
                ForEach(rec.group.allItems) { part in
                    HStack(spacing: 8) {
                        itemTypeBadge(part)
                        Text(part.title)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                        if let u = part.username, !u.isEmpty {
                            Text("(\(u))")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        if part.id == rec.group.primaryItem.id {
                            Text("Primary")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                        } else {
                            Text("Will Merge")
                                .font(.system(size: 9))
                                .foregroundColor(.secondary.opacity(0.8))
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }

            HStack(spacing: 10) {
                Button(action: {
                    loadSuggestedGroup(rec.group)
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "slider.horizontal.3")
                            .font(.system(size: 11))
                        Text("Review & Customize")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(Color.white.opacity(0.08))
                    .foregroundColor(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)

                Button(action: {
                    withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) {
                        let unified = VaultStore.shared.combineSelectedCredentials(
                            primaryId: rec.group.primaryItem.id,
                            items: rec.group.allItems,
                            customTitle: rec.group.title,
                            archiveOthersToTrash: true
                        )
                        items = VaultStore.shared.items
                        onSaveItem?(unified)
                        statusMessage = "✓ Combined \(rec.group.totalItemsCount) credentials into '\(unified.title)'!"
                        lastCombinedItemId = unified.id
                    }
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.triangle.merge")
                            .font(.system(size: 11, weight: .bold))
                        Text("Combine Now")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(LiquidGlassTheme.primaryAccent)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(tierColor.opacity(0.26), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func singleSelectionRecommenderView(for selected: VaultItem) -> some View {
        let companions = CredentialCombinerService.shared.recommendCompanions(for: [selected], in: items)
        let role = SmartCredentialUnderstander.shared.classifyRole(selected)

        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text("SELECTED CREDENTIAL")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                HStack(spacing: 10) {
                    FaviconView(
                        urls: selected.urls,
                        title: selected.title,
                        oauthProvider: selected.oauth?.provider,
                        itemType: selected.type,
                        size: 28
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(selected.title)
                                .font(.system(size: 13, weight: .bold))
                            itemTypeBadge(selected)
                        }
                        if let u = selected.username, !u.isEmpty {
                            Text(u)
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        } else {
                            Text("Role: \(role.displayName)")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                    }
                    Spacer()
                }
                .padding(12)
                .background(LiquidGlassTheme.primaryAccent.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(LiquidGlassTheme.primaryAccent.opacity(0.35), lineWidth: 1)
                )
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    Text("SMART RECOMMENDER — COMPATIBLE COMPANIONS")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                }

                if companions.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("No close service matches found automatically.")
                            .font(.system(size: 12, weight: .semibold))
                        Text("Select any compatible different-type credential from the left panel to combine with '\(selected.title)'. Same-type credentials are disabled.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                } else {
                    ForEach(companions, id: \.item.id) { entry in
                        let companion = entry.item
                        let m = entry.match
                        let pct = Int((m.confidence * 100).rounded())

                        HStack(spacing: 12) {
                            FaviconView(
                                urls: companion.urls,
                                title: companion.title,
                                oauthProvider: companion.oauth?.provider,
                                itemType: companion.type,
                                size: 26
                            )
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 6) {
                                    Text(companion.title)
                                        .font(.system(size: 12, weight: .semibold))
                                    itemTypeBadge(companion)
                                    Text("\(pct)%")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.14))
                                        .clipShape(Capsule())
                                }
                                Text(m.reason)
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Button("Select & Preview") {
                                withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                                    selectedItemIds.insert(companion.id)
                                    if SmartCredentialUnderstander.shared.classifyRole(companion) == .login && role != .login {
                                        primaryTargetId = companion.id
                                        customTitleText = BrandTitleService.cleanTitle(companion.title, url: companion.urls.first)
                                    }
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                        }
                        .padding(12)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(LiquidGlassTheme.emeraldAccent.opacity(0.25), lineWidth: 1)
                        )
                    }
                }
            }
        }
    }

    private func rolePill(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .bold))
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.14))
            .clipShape(Capsule())
    }

    private var emptyStudioState: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.04))
                    .frame(width: 68, height: 68)
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
            }

            Text("No Automatic Combinations Needed")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.primary)

            Text("The Smart Recommender found no unmerged split credentials. You can still manually select two or more credentials of different types on the left.")
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 440)

            // Example Bento Preview illustration
            VStack(alignment: .leading, spacing: 8) {
                Text("ALLOWED DIFFERENT-TYPE COMBINATIONS:")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary.opacity(0.8))

                exampleComboRow(icon: "key.fill", title: "Login", detail: "Username, password, and URLs", color: LiquidGlassTheme.amberAccent)
                exampleComboRow(icon: "timer", title: "Authenticator", detail: "TOTP software token & timer", color: LiquidGlassTheme.primaryAccent)
                exampleComboRow(icon: "key.horizontal.fill", title: "Recovery Codes", detail: "Backup codes & checklist tracker", color: LiquidGlassTheme.emeraldAccent)
            }
            .padding(16)
            .background(Color.white.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
            )
            .frame(maxWidth: 420)
        }
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
    }

    private func exampleComboRow(icon: String, title: String, detail: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundColor(color)
                .frame(width: 18)
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.primary)
            Spacer()
            Text(detail)
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Active Merge Studio (Japanese Bento Box Layout)

    private func activeMergeStudio(preview: VaultItem) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            selectedItemsHeader
            bentoPreviewCard(preview: preview)
            mergeActionButtons(preview: preview)
        }
    }

    private var selectedItemsHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("MERGING \(selectedItemsList.count) CREDENTIALS:")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
                Spacer()
            }

            // Selected items pills
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(selectedItemsList) { item in
                        HStack(spacing: 6) {
                            Image(systemName: item.isRecoveryCode ? "key.horizontal.fill" : (item.isAuthenticator ? "timer" : "key.fill"))
                                .font(.system(size: 10))
                                .foregroundColor(item.isRecoveryCode ? LiquidGlassTheme.emeraldAccent : (item.isAuthenticator ? LiquidGlassTheme.primaryAccent : LiquidGlassTheme.amberAccent))
                            Text(item.title)
                                .font(.system(size: 11, weight: .medium))
                            if let u = item.username, !u.isEmpty {
                                Text("(\(u))")
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                            }
                            Button(action: {
                                withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                                    selectedItemIds.remove(item.id)
                                }
                            }) {
                                Image(systemName: "xmark")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.white.opacity(0.06))
                        .clipShape(Capsule())
                    }
                }
            }

            // Primary Target Selector
            HStack(spacing: 10) {
                Text("Primary Target:")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)

                Picker("", selection: Binding(
                    get: { effectivePrimaryItem?.id ?? "" },
                    set: { newId in
                        primaryTargetId = newId
                        if let chosen = selectedItemsList.first(where: { $0.id == newId }) {
                            customTitleText = BrandTitleService.cleanTitle(chosen.title, url: chosen.urls.first)
                        }
                    }
                )) {
                    ForEach(selectedItemsList) { item in
                        Text("\(item.title) (\(item.type.displayName))").tag(item.id)
                    }
                }
                .labelsHidden()
                .frame(maxWidth: 260)
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func bentoPreviewCard(preview: VaultItem) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 11))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    Text("UNIFIED CREDENTIAL PREVIEW")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("1 Consolidated Item")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
            }

            // Editable Unified Title Field
            VStack(alignment: .leading, spacing: 4) {
                Text("CREDENTIAL TITLE")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.secondary)
                TextField("Credential Title", text: Binding(
                    get: { customTitleText.isEmpty ? preview.title : customTitleText },
                    set: { customTitleText = $0 }
                ))
                .textFieldStyle(.plain)
                .font(.system(size: 15, weight: .bold))
                .padding(8)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            if preview.isAuthenticator {
                bento2FACompartment(preview: preview)
            }

            bentoLoginCompartment(preview: preview)

            if preview.isRecoveryCode {
                bentoRecoveryCompartment(preview: preview)
            }

            if !preview.urls.isEmpty {
                bentoUrlsCompartment(preview: preview)
            }
        }
        .padding(18)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(LiquidGlassTheme.primaryAccent.opacity(0.25), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func bento2FACompartment(preview: VaultItem) -> some View {
        if let secret = preview.totpSecret, !secret.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "timer")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    Text("AUTHENTICATOR (2FA)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("Live TOTP")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                }

                TOTPRingView(secret: secret)
                    .padding(8)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder
    private func bentoLoginCompartment(preview: VaultItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let u = preview.username, !u.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text("USERNAME / EMAIL")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.secondary)
                    Text(u)
                        .font(.system(size: 12, weight: .medium))
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.black.opacity(0.25))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }

            if let p = preview.password, !p.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text("PASSWORD")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.secondary)
                    HStack {
                        if revealPasswordPreview {
                            Text(p)
                                .font(.system(size: 12, design: .monospaced))
                        } else {
                            Text(String(repeating: "•", count: min(16, p.count)))
                                .font(.system(size: 12, weight: .heavy))
                        }
                        Spacer()
                        Button(action: { revealPasswordPreview.toggle() }) {
                            Image(systemName: revealPasswordPreview ? "eye.slash" : "eye")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(8)
                    .background(Color.black.opacity(0.25))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }
        }
    }

    @ViewBuilder
    private func bentoRecoveryCompartment(preview: VaultItem) -> some View {
        let codes = preview.recoveryCodesList
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "key.horizontal.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                Text("RECOVERY CODES (\(codes.count))")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(preview.usedRecoveryCodes.count) / \(codes.count) used")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
            }

            VStack(spacing: 4) {
                ForEach(Array(codes.prefix(2).enumerated()), id: \.offset) { index, code in
                    HStack {
                        Image(systemName: preview.usedRecoveryCodes.contains(index) ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 11))
                            .foregroundColor(preview.usedRecoveryCodes.contains(index) ? LiquidGlassTheme.emeraldAccent : .secondary)
                        Text(code)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.primary)
                        Spacer()
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                if codes.count > 2 {
                    Text("+ \(codes.count - 2) more recovery codes attached")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                        .padding(.top, 2)
                }
            }
            .padding(10)
            .background(Color.black.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    @ViewBuilder
    private func bentoUrlsCompartment(preview: VaultItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("WEBSITES / URLS")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.secondary)
            ForEach(preview.urls, id: \.self) { url in
                HStack(spacing: 6) {
                    Image(systemName: "globe")
                        .font(.system(size: 10))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    Text(url)
                        .font(.system(size: 11))
                        .foregroundColor(.primary)
                    Spacer()
                }
                .padding(6)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }

    private func mergeActionButtons(preview: VaultItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $archiveOthersToTrash) {
                Text("Safely move other source items to Trash after combining")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
            .toggleStyle(.checkbox)

            Button(action: executeCombine) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.merge")
                        .font(.system(size: 13, weight: .bold))
                    Text("Combine \(selectedItemsList.count) Credentials into 1 Unified Record")
                        .font(.system(size: 13, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(selectionValidation.isAllowed ? LiquidGlassTheme.primaryAccent : Color.gray.opacity(0.35))
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .shadow(color: (selectionValidation.isAllowed ? LiquidGlassTheme.primaryAccent : Color.clear).opacity(0.4), radius: 8, x: 0, y: 3)
            }
            .disabled(!selectionValidation.isAllowed)
            .buttonStyle(.plain)
            .keyboardShortcut(.return, modifiers: [.command])
        }
    }

    // MARK: - Actions

    private func loadSuggestedGroup(_ group: CombinableCredentialGroup) {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
            selectedItemIds = Set(group.allItems.map { $0.id })
            primaryTargetId = group.primaryItem.id
            customTitleText = group.title
        }
    }

    private func executeCombine() {
        let validation = CredentialCombinerService.shared.validateCombination(selectedItemsList)
        guard validation.isAllowed, let primary = effectivePrimaryItem, selectedItemsList.count >= 2 else {
            statusMessage = validation.reason ?? "Select 2 or more credentials of different types."
            return
        }

        withAnimation(.spring(response: 0.36, dampingFraction: 0.75)) {
            let unifiedTitle = customTitleText.isEmpty ? primary.title : customTitleText

            let unified = VaultStore.shared.combineSelectedCredentials(
                primaryId: primary.id,
                items: selectedItemsList,
                customTitle: unifiedTitle,
                archiveOthersToTrash: archiveOthersToTrash
            )

            onSaveItem?(unified)
            statusMessage = "✓ Successfully combined \(selectedItemsList.count) credentials into '\(unified.title)'!"
            lastCombinedItemId = unified.id
            selectedItemIds.removeAll()
            primaryTargetId = nil
            customTitleText = ""
        }
    }
}
