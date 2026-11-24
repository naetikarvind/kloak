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
        case notes = "Notes & Recovery"

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

    private var filteredVaultItems: [VaultItem] {
        let base: [VaultItem]
        switch filterType {
        case .all:
            base = nonTrashedItems
        case .logins:
            base = nonTrashedItems.filter { $0.type == .login }
        case .twoFA:
            base = nonTrashedItems.filter { $0.is2FA }
        case .notes:
            base = nonTrashedItems.filter { $0.type == .secureNote || $0.isRecoveryCode }
        }

        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return base }

        return base.filter { item in
            item.title.lowercased().contains(query) ||
            (item.username?.lowercased().contains(query) ?? false) ||
            item.urls.contains { $0.lowercased().contains(query) } ||
            (item.notes?.lowercased().contains(query) ?? false)
        }
    }

    private var selectedItemsList: [VaultItem] {
        nonTrashedItems.filter { selectedItemIds.contains($0.id) }
    }

    private var effectivePrimaryItem: VaultItem? {
        if let pid = primaryTargetId, let item = selectedItemsList.first(where: { $0.id == pid }) {
            return item
        }
        return selectedItemsList.first(where: { $0.type == .login }) ?? selectedItemsList.first
    }

    private var unifiedPreviewItem: VaultItem? {
        guard selectedItemsList.count >= 2 else { return nil }
        return CredentialCombinerService.shared.generatePreview(
            primaryId: effectivePrimaryItem?.id,
            items: selectedItemsList,
            customTitle: customTitleText.isEmpty ? nil : customTitleText
        )
    }

    private var suggestedMatches: [CombinableCredentialGroup] {
        CredentialCombinerService.shared.findCombinableGroups(in: items)
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
            if !preselectedItemIds.isEmpty {
                selectedItemIds = preselectedItemIds
                if let firstId = preselectedItemIds.first,
                   let item = nonTrashedItems.first(where: { $0.id == firstId }) {
                    primaryTargetId = item.id
                    customTitleText = BrandTitleService.cleanTitle(item.title, url: item.urls.first)
                }
            }
        }
        .onChange(of: preselectedItemIds) { _, newIds in
            if !newIds.isEmpty {
                selectedItemIds.formUnion(newIds)
                if primaryTargetId == nil, let first = newIds.first {
                    primaryTargetId = first
                }
            }
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

                Text("Choose 2 or more credentials to combine logins, 2FA tokens, and recovery codes.")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)

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

                // Optional Suggestions Shortcut Banner
                if !suggestedMatches.isEmpty && selectedItemIds.isEmpty {
                    Button(action: {
                        if let firstGroup = suggestedMatches.first {
                            loadSuggestedGroup(firstGroup)
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 10))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                            Text("Suggested: Combine \(suggestedMatches.first?.title ?? "") items")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.primary)
                                .lineLimit(1)
                            Spacer()
                            Text("Load")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(LiquidGlassTheme.primaryAccent.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
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

        return Button(action: {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                if isSelected {
                    selectedItemIds.remove(item.id)
                    if primaryTargetId == item.id {
                        primaryTargetId = selectedItemsList.first?.id
                    }
                } else {
                    selectedItemIds.insert(item.id)
                    if primaryTargetId == nil {
                        primaryTargetId = item.id
                        customTitleText = BrandTitleService.cleanTitle(item.title, url: item.urls.first)
                    }
                }
            }
        }) {
            HStack(spacing: 10) {
                // Checkbox
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 14))
                    .foregroundColor(isSelected ? LiquidGlassTheme.primaryAccent : .secondary.opacity(0.5))

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
                            .foregroundColor(.primary)
                            .lineLimit(1)

                        if isPrimary && isSelected {
                            Text("Primary")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(LiquidGlassTheme.primaryAccent.opacity(0.15))
                                .clipShape(Capsule())
                        }
                    }

                    HStack(spacing: 6) {
                        if let u = item.username, !u.isEmpty {
                            Text(u)
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        } else if item.isRecoveryCode {
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
                    }
                }

                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(isSelected ? LiquidGlassTheme.primaryAccent.opacity(0.12) : Color.white.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? LiquidGlassTheme.primaryAccent.opacity(0.35) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func itemTypeBadge(_ item: VaultItem) -> some View {
        Group {
            if item.isRecoveryCode {
                Text("Codes")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                    .clipShape(Capsule())
            } else if item.isAuthenticator {
                Text("2FA")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(LiquidGlassTheme.primaryAccent.opacity(0.12))
                    .clipShape(Capsule())
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

                if selectedItemsList.count < 2 {
                    emptyStudioState
                } else if let preview = unifiedPreviewItem {
                    activeMergeStudio(preview: preview)
                }
            }
            .padding(24)
        }
    }

    private var emptyStudioState: some View {
        VStack(spacing: 16) {
            Spacer().frame(height: 50)

            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.04))
                    .frame(width: 80, height: 80)
                Image(systemName: "arrow.triangle.merge")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
            }

            Text("Select Credentials to Combine")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.primary)

            Text("Select two or more credentials on the left (such as a Login, an Authenticator, and a Recovery Codes note) to combine their contents into a unified credential.")
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 440)

            // Example Bento Preview illustration
            VStack(alignment: .leading, spacing: 8) {
                Text("WHAT YOU CAN COMBINE:")
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

            Spacer().frame(height: 50)
        }
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
                .background(LiquidGlassTheme.primaryAccent)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .shadow(color: LiquidGlassTheme.primaryAccent.opacity(0.4), radius: 8, x: 0, y: 3)
            }
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
        guard let primary = effectivePrimaryItem, selectedItemsList.count >= 2 else { return }

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
