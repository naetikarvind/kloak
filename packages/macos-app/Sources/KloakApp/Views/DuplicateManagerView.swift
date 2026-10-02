import SwiftUI

public struct DuplicateManagerView: View {
    @Binding var items: [VaultItem]
    var onSaveItem: ((VaultItem) -> Void)?
    var onDeleteItem: ((String) -> Void)?
    var onMergeGroup: ((DuplicateAccountGroup) -> Void)?
    var onAutoMergeAll: (() -> Int)?

    @State private var searchText: String = ""
    @State private var revealedPasswordIds: Set<String> = []
    @State private var copiedItemId: String? = nil
    @State private var statusMessage: String? = nil

    private var duplicateGroups: [DuplicateAccountGroup] {
        let all = DuplicateDetectorService.shared.findDuplicateAccounts(in: items)
        if searchText.isEmpty { return all }
        let q = searchText.lowercased()
        return all.filter { group in
            group.title.lowercased().contains(q) ||
            group.username.lowercased().contains(q) ||
            group.items.contains { $0.urls.contains { $0.lowercased().contains(q) } }
        }
    }

    private var exactDuplicatesCount: Int {
        DuplicateDetectorService.shared.findDuplicateAccounts(in: items).filter { $0.isExactMatch }.count
    }

    private var conflictingDuplicatesCount: Int {
        DuplicateDetectorService.shared.findDuplicateAccounts(in: items).filter { !$0.isExactMatch }.count
    }

    private var totalDuplicateItemsCount: Int {
        DuplicateDetectorService.shared.findDuplicateAccounts(in: items).reduce(0) { $0 + $1.items.count }
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header & Equal-Width Stats
                headerSection

                // Controls: Search & Auto-Merge Button
                controlsBar

                if let status = statusMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        Text(status)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.primary)
                        Spacer()
                        Button(action: { statusMessage = nil }) {
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
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(LiquidGlassTheme.emeraldAccent.opacity(0.3), lineWidth: 1)
                    )
                }

                // Duplicate Account Groups List
                duplicateAccountsList
            }
            .padding(24)
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Duplicate Accounts")
                    .font(.system(size: 20, weight: .bold))
                Text("Detect redundant accounts, resolve conflicting logins, and consolidate identical credentials.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }

            // Quick Stats Row (Strictly Equal-Width Containers)
            HStack(spacing: 12) {
                statCard(
                    title: "Exact Duplicates",
                    value: "\(exactDuplicatesCount)",
                    subtitle: "Safe to auto-merge",
                    color: LiquidGlassTheme.emeraldAccent,
                    icon: "doc.on.doc.fill"
                )

                statCard(
                    title: "Conflicting Accounts",
                    value: "\(conflictingDuplicatesCount)",
                    subtitle: "Different passwords or 2FA",
                    color: LiquidGlassTheme.amberAccent,
                    icon: "exclamationmark.triangle.fill"
                )

                statCard(
                    title: "Total Duplicate Items",
                    value: "\(totalDuplicateItemsCount)",
                    subtitle: "Redundant vault records",
                    color: LiquidGlassTheme.primaryAccent,
                    icon: "tray.full.fill"
                )
            }
        }
    }

    private func statCard(title: String, value: String, subtitle: String, color: Color, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundColor(color)
                .frame(width: 36, height: 36)
                .background(color.opacity(0.15))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.system(size: 15, weight: .bold))
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary.opacity(0.7))
                    .lineLimit(1)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    // MARK: - Controls Bar

    private var controlsBar: some View {
        HStack(spacing: 14) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                    .font(.system(size: 11))
                TextField("Search duplicate accounts...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))

                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                            .font(.system(size: 11))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.black.opacity(0.2))
            .clipShape(RoundedRectangle(cornerRadius: 8))

            Spacer()

            if exactDuplicatesCount > 0 {
                Button(action: handleAutoMergeAll) {
                    Label("Auto-Merge All Identical (\(exactDuplicatesCount))", systemImage: "sparkles")
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
            }
        }
    }

    // MARK: - Duplicate Accounts List

    @ViewBuilder
    private var duplicateAccountsList: some View {
        if duplicateGroups.isEmpty {
            emptyStateView(
                title: "No Duplicate Accounts Found",
                subtitle: "Your vault is clean. All login accounts have unique service and username mappings.",
                icon: "checkmark.shield.fill"
            )
        } else {
            VStack(spacing: 16) {
                ForEach(duplicateGroups) { group in
                    duplicateGroupCard(group)
                }
            }
        }
    }

    private func duplicateGroupCard(_ group: DuplicateAccountGroup) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            // Group Top Bar
            HStack(alignment: .center) {
                HStack(spacing: 8) {
                    FaviconView(
                        urls: group.items.flatMap { $0.urls },
                        title: group.title,
                        itemType: .login,
                        size: 26
                    )

                    Text(group.title)
                        .font(.system(size: 14, weight: .bold))

                    if !group.username.isEmpty {
                        Text("(\(group.username))")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Status Badge
                if group.isExactMatch {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 9, weight: .bold))
                        Text("Exact Match (\(group.items.count))")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                    .clipShape(Capsule())
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 9))
                        Text("Conflicting (\(group.items.count))")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundColor(LiquidGlassTheme.amberAccent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(LiquidGlassTheme.amberAccent.opacity(0.15))
                    .clipShape(Capsule())
                }

                Button(action: {
                    onMergeGroup?(group)
                    statusMessage = "Merged \(group.items.count) entries for \"\(group.title)\" into a single complete login."
                }) {
                    Label("Merge Entries", systemImage: "arrow.triangle.merge")
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: group.isExactMatch))
            }

            Divider().opacity(0.1)

            // Items breakdown
            VStack(spacing: 8) {
                ForEach(group.items) { item in
                    duplicateItemRow(item, inGroup: group)
                }
            }
        }
        .padding(16)
        .glassEffect(cornerRadius: 14)
    }

    private func duplicateItemRow(_ item: VaultItem, inGroup: DuplicateAccountGroup) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(item.title)
                        .font(.system(size: 12, weight: .semibold))

                    if let url = item.urls.first, !url.isEmpty {
                        Text("• \(url)")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }

                HStack(spacing: 12) {
                    // Password display
                    HStack(spacing: 6) {
                        Text("Password:")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)

                        if let pass = item.password, !pass.isEmpty {
                            if revealedPasswordIds.contains(item.id) {
                                Text(pass)
                                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                            } else {
                                Text("••••••••")
                                    .font(.system(size: 10, design: .monospaced))
                            }

                            Button(action: {
                                if revealedPasswordIds.contains(item.id) {
                                    revealedPasswordIds.remove(item.id)
                                } else {
                                    revealedPasswordIds.insert(item.id)
                                }
                            }) {
                                Image(systemName: revealedPasswordIds.contains(item.id) ? "eye.slash" : "eye")
                                    .font(.system(size: 9))
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)

                            Button(action: {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(pass, forType: .string)
                                copiedItemId = item.id
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                    if copiedItemId == item.id { copiedItemId = nil }
                                }
                            }) {
                                Image(systemName: copiedItemId == item.id ? "checkmark" : "doc.on.doc")
                                    .font(.system(size: 9))
                                    .foregroundColor(copiedItemId == item.id ? LiquidGlassTheme.emeraldAccent : .secondary)
                            }
                            .buttonStyle(.plain)
                        } else {
                            Text("(None)")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary.opacity(0.6))
                        }
                    }

                    // 2FA TOTP status
                    if let totp = item.totpSecret, !totp.isEmpty {
                        HStack(spacing: 3) {
                            Image(systemName: "clock.badge.checkmark.fill")
                                .font(.system(size: 9))
                            Text("2FA TOTP")
                                .font(.system(size: 9, weight: .semibold))
                        }
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    }

                    // Modified Date
                    Text("Updated: \(formatDate(item.updatedAt))")
                        .font(.system(size: 9))
                        .foregroundColor(.secondary.opacity(0.6))
                }
            }

            Spacer()

            // Trash button for individual redundant entry
            Button(action: {
                onDeleteItem?(item.id)
                statusMessage = "Moved duplicate entry \"\(item.title)\" to trash."
            }) {
                Image(systemName: "trash")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .help("Move this duplicate copy to trash")
        }
        .padding(10)
        .background(Color.black.opacity(0.2))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Actions

    private func handleAutoMergeAll() {
        if let count = onAutoMergeAll?(), count > 0 {
            statusMessage = "Successfully auto-merged \(count) identical duplicate account groups!"
        }
    }

    private func emptyStateView(title: String, subtitle: String, icon: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 38))
                .foregroundColor(LiquidGlassTheme.emeraldAccent)

            Text(title)
                .font(.system(size: 15, weight: .bold))

            Text(subtitle)
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .glassEffect(cornerRadius: 14)
    }

    private func formatDate(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: isoString) else { return isoString }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .none
        return out.string(from: date)
    }
}
