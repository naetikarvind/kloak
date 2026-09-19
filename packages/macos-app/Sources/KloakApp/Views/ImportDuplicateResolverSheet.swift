import SwiftUI

public struct ImportDuplicateResolverSheet: View {
    public let comparison: FileImportComparisonResult
    public var onConfirm: (ImportDuplicateStrategy, [String: ImportDuplicateStrategy]) -> Void
    public var onCancel: () -> Void

    @State private var globalStrategy: ImportDuplicateStrategy = .updateExisting
    @State private var overrides: [String: ImportDuplicateStrategy] = [:]
    @State private var selectedFilter: FileImportItemStatus? = nil // nil = All
    @State private var searchText: String = ""
    @State private var revealedItemIds: Set<String> = []

    private var filteredItems: [FileImportComparisonItem] {
        var list = comparison.items
        if let filter = selectedFilter {
            list = list.filter { $0.status == filter }
        }
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            list = list.filter {
                $0.fileItem.title.lowercased().contains(q) ||
                ($0.fileItem.username?.lowercased().contains(q) ?? false) ||
                $0.fileItem.urls.contains { $0.lowercased().contains(q) }
            }
        }
        return list
    }

    private var willImportCount: Int {
        comparison.items.filter { item in
            let strat = overrides[item.id] ?? globalStrategy
            switch item.status {
            case .new:
                return true
            case .exactMatch:
                return strat != .skipDuplicate
            case .conflict:
                return strat != .skipDuplicate
            }
        }.count
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            headerBar

            Divider().opacity(0.15)

            // Main Content Area
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // Global Strategy Selector Card
                    globalStrategyCard

                    // Filter & Search Controls
                    filterBar

                    // Items List
                    itemsListView
                }
                .padding(20)
            }

            Divider().opacity(0.15)

            // Bottom Action Bar
            footerBar
        }
        .frame(width: 680, height: 580)
        .background(.ultraThinMaterial)
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.merge")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)

                    Text("Review & Resolve Import")
                        .font(.system(size: 16, weight: .bold))
                }

                Text("Detected \(comparison.items.count) item(s) from \(comparison.fileName ?? "file"). Resolve duplicate entries before saving to your vault.")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: onCancel) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Global Strategy Card

    private var globalStrategyCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("DEFAULT DUPLICATE RESOLUTION")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                Spacer()
            }

            HStack(spacing: 10) {
                ForEach(ImportDuplicateStrategy.allCases) { strategy in
                    Button(action: {
                        globalStrategy = strategy
                    }) {
                        HStack(spacing: 8) {
                            Image(systemName: strategy.iconName)
                                .font(.system(size: 13))
                                .foregroundColor(globalStrategy == strategy ? LiquidGlassTheme.primaryAccent : .secondary)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(strategy.title)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(globalStrategy == strategy ? .primary : .secondary)
                                Text(strategy.description)
                                    .font(.system(size: 9))
                                    .foregroundColor(.secondary.opacity(0.8))
                                    .lineLimit(2)
                            }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(globalStrategy == strategy ? Color.white.opacity(0.08) : Color.black.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(globalStrategy == strategy ? LiquidGlassTheme.primaryAccent.opacity(0.5) : Color.white.opacity(0.05), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        HStack(spacing: 10) {
            // Filter Pills
            filterPill(title: "All (\(comparison.items.count))", status: nil)
            filterPill(title: "New (\(comparison.newCount))", status: .new)
            filterPill(title: "Conflicts (\(comparison.conflictCount))", status: .conflict)
            filterPill(title: "Exact (\(comparison.exactMatchCount))", status: .exactMatch)

            Spacer()

            // Search
            HStack {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                TextField("Filter items...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color.black.opacity(0.25))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .frame(width: 170)
        }
    }

    private func filterPill(title: String, status: FileImportItemStatus?) -> some View {
        Button(action: {
            selectedFilter = status
        }) {
            Text(title)
                .font(.system(size: 11, weight: selectedFilter == status ? .bold : .medium))
                .foregroundColor(selectedFilter == status ? .primary : .secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(selectedFilter == status ? Color.white.opacity(0.12) : Color.black.opacity(0.2))
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(selectedFilter == status ? Color.white.opacity(0.2) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Items List View

    @ViewBuilder
    private var itemsListView: some View {
        if filteredItems.isEmpty {
            VStack(spacing: 8) {
                Text("No matching items")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 32)
        } else {
            VStack(spacing: 10) {
                ForEach(filteredItems) { item in
                    itemRow(item)
                }
            }
        }
    }

    private func itemRow(_ item: FileImportComparisonItem) -> some View {
        let effectiveStrategy = overrides[item.id] ?? globalStrategy

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text(item.fileItem.title)
                            .font(.system(size: 13, weight: .bold))

                        statusBadge(item.status)
                    }

                    HStack(spacing: 8) {
                        if let user = item.fileItem.username, !user.isEmpty {
                            Text(user)
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }

                        if let url = item.fileItem.urls.first, !url.isEmpty {
                            Text("• \(url)")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary.opacity(0.8))
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()

                // Resolution Override Menu
                if item.status != .new {
                    Menu {
                        ForEach(ImportDuplicateStrategy.allCases) { strat in
                            Button(action: {
                                overrides[item.id] = strat
                            }) {
                                HStack {
                                    Text(strat.title)
                                    if effectiveStrategy == strat {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(effectiveStrategy.title)
                                .font(.system(size: 11, weight: .semibold))
                            Image(systemName: "chevron.down")
                                .font(.system(size: 8))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()
                }
            }

            // Conflict Diff Preview
            if item.status == .conflict, let matched = item.matchedVaultItem {
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("IN FILE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.secondary)
                        HStack(spacing: 4) {
                            Text("Password:")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                            Text(revealedItemIds.contains(item.id) ? (item.fileItem.password ?? "(None)") : "••••••••")
                                .font(.system(size: 10, design: .monospaced))
                        }
                    }

                    Divider().frame(height: 24).opacity(0.2)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("IN VAULT")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.secondary)
                        HStack(spacing: 4) {
                            Text("Password:")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                            Text(revealedItemIds.contains(item.id) ? (matched.password ?? "(None)") : "••••••••")
                                .font(.system(size: 10, design: .monospaced))
                        }
                    }

                    Spacer()

                    Button(action: {
                        if revealedItemIds.contains(item.id) {
                            revealedItemIds.remove(item.id)
                        } else {
                            revealedItemIds.insert(item.id)
                        }
                    }) {
                        Image(systemName: revealedItemIds.contains(item.id) ? "eye.slash" : "eye")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("Toggle password visibility")
                }
                .padding(8)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(item.status == .conflict ? LiquidGlassTheme.amberAccent.opacity(0.3) : Color.white.opacity(0.05), lineWidth: 1)
        )
    }

    private func statusBadge(_ status: FileImportItemStatus) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(
                    status == .new ? LiquidGlassTheme.emeraldAccent :
                    status == .exactMatch ? LiquidGlassTheme.primaryAccent :
                    LiquidGlassTheme.amberAccent
                )
                .frame(width: 6, height: 6)

            Text(status.displayName)
                .font(.system(size: 9, weight: .bold))
        }
        .foregroundColor(
            status == .new ? LiquidGlassTheme.emeraldAccent :
            status == .exactMatch ? LiquidGlassTheme.primaryAccent :
            LiquidGlassTheme.amberAccent
        )
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(
            (status == .new ? LiquidGlassTheme.emeraldAccent :
             status == .exactMatch ? LiquidGlassTheme.primaryAccent :
             LiquidGlassTheme.amberAccent).opacity(0.12)
        )
        .clipShape(Capsule())
    }

    // MARK: - Footer Bar

    private var footerBar: some View {
        HStack {
            Text("Ready to import \(willImportCount) item(s)")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)

            Spacer()

            Button("Cancel", action: onCancel)
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

            Button(action: {
                onConfirm(globalStrategy, overrides)
            }) {
                Label("Confirm & Import", systemImage: "arrow.down.doc.fill")
            }
            .buttonStyle(GlassCapsuleButton(isPrimary: true))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }
}
