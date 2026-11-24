import SwiftUI

public struct CombineCredentialsView: View {
    @Binding var items: [VaultItem]
    var onCombineGroup: ((CombinableCredentialGroup) -> Void)?
    var onCombineAll: (() -> Int)?

    @State private var searchText: String = ""
    @State private var statusMessage: String? = nil

    private var combinableGroups: [CombinableCredentialGroup] {
        let all = CredentialCombinerService.shared.findCombinableGroups(in: items)
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if trimmed.isEmpty { return all }
        return all.filter { group in
            group.title.lowercased().contains(trimmed) ||
            group.username.lowercased().contains(trimmed) ||
            (group.domain?.lowercased().contains(trimmed) ?? false) ||
            group.serviceKey.contains(trimmed)
        }
    }

    private var totalItemsInGroups: Int {
        combinableGroups.reduce(0) { $0 + $1.totalItemsCount }
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header & Quick Stats
                headerSection

                // Controls: Search & Combine All Button
                controlsBar

                // Status Message Banner
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

                // Groups List or Empty State
                if combinableGroups.isEmpty {
                    emptyStateView
                } else {
                    groupsListView
                }
            }
            .padding(24)
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.merge")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    Text("Combine Credentials")
                        .font(.system(size: 20, weight: .bold))
                }
                Text("Detect separate Logins, Authenticator (2FA) tokens, and Recovery Codes for the same service, and combine them into unified credentials.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }

            // Quick Stats Row
            HStack(spacing: 12) {
                statCard(
                    title: "Combinable Groups",
                    count: combinableGroups.count,
                    subtitle: "Services with split records",
                    color: LiquidGlassTheme.primaryAccent,
                    icon: "arrow.triangle.merge"
                )

                statCard(
                    title: "Separate Items",
                    count: totalItemsInGroups,
                    subtitle: "Logins, 2FA & recovery notes",
                    color: LiquidGlassTheme.amberAccent,
                    icon: "square.stack.3d.down.right.fill"
                )

                statCard(
                    title: "Unified Credentials",
                    count: combinableGroups.count,
                    subtitle: "Consolidated credentials result",
                    color: LiquidGlassTheme.emeraldAccent,
                    icon: "shield.lefthalf.filled.badge.checkmark"
                )
            }
        }
    }

    private func statCard(title: String, count: Int, subtitle: String, color: Color, icon: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.14))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(color)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(count)")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)
                    Text(title)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.secondary)
                }
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary.opacity(0.7))
            }

            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    // MARK: - Controls Bar

    private var controlsBar: some View {
        HStack(spacing: 12) {
            // Search Input
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                TextField("Filter services, accounts, domains...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )

            Spacer()

            // Combine All Button
            if !combinableGroups.isEmpty {
                Button(action: {
                    handleCombineAll()
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 11, weight: .bold))
                        Text("Combine All (\(combinableGroups.count))")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(LiquidGlassTheme.primaryAccent)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Groups List

    private var groupsListView: some View {
        VStack(spacing: 16) {
            ForEach(combinableGroups) { group in
                combinableGroupCard(group)
            }
        }
    }

    private func combinableGroupCard(_ group: CombinableCredentialGroup) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            // Card Header
            HStack(spacing: 12) {
                FaviconView(
                    urls: group.primaryItem.urls,
                    title: group.title,
                    oauthProvider: group.primaryItem.oauth?.provider,
                    itemType: group.primaryItem.type,
                    size: 32
                )

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(group.title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.primary)

                        if let dom = group.domain, !dom.isEmpty {
                            Text(dom)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.white.opacity(0.05))
                                .clipShape(Capsule())
                        }
                    }

                    if !group.username.isEmpty {
                        Text(group.username)
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Badges for included components
                HStack(spacing: 6) {
                    if group.hasLogin {
                        pillBadge(text: "Login", icon: "key.fill", color: LiquidGlassTheme.amberAccent)
                    }
                    if group.hasAuthenticator {
                        pillBadge(text: "2FA OTP", icon: "timer", color: LiquidGlassTheme.primaryAccent)
                    }
                    if group.hasRecoveryCodes {
                        pillBadge(text: "\(group.totalRecoveryCodes) Codes", icon: "key.horizontal.fill", color: LiquidGlassTheme.emeraldAccent)
                    }
                }

                // Combine Button
                Button(action: {
                    handleCombineGroup(group)
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.triangle.merge")
                            .font(.system(size: 10, weight: .bold))
                        Text("Combine")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(LiquidGlassTheme.primaryAccent.opacity(0.18))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(LiquidGlassTheme.primaryAccent.opacity(0.4), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }

            Divider().opacity(0.12)

            // Items breakdown: Japanese Bento style compartments
            VStack(alignment: .leading, spacing: 8) {
                Text("ITEMS TO CONSOLIDATE (\(group.allItems.count)):")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary.opacity(0.8))

                ForEach(group.allItems) { item in
                    HStack(spacing: 10) {
                        Image(systemName: itemIconName(for: item))
                            .font(.system(size: 11))
                            .foregroundColor(itemColor(for: item))
                            .frame(width: 18)

                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.title)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.primary)

                            HStack(spacing: 6) {
                                if let u = item.username, !u.isEmpty {
                                    Text(u)
                                        .font(.system(size: 10))
                                        .foregroundColor(.secondary)
                                }
                                if item.isRecoveryCode {
                                    Text("• \(item.recoveryCodesList.count) recovery codes")
                                        .font(.system(size: 10))
                                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                } else if item.isAuthenticator {
                                    Text("• TOTP Authenticator")
                                        .font(.system(size: 10))
                                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                                }
                            }
                        }

                        Spacer()

                        if item.id == group.primaryItem.id {
                            Text("Primary Target")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(LiquidGlassTheme.primaryAccent.opacity(0.12))
                                .clipShape(Capsule())
                        } else {
                            Text("Will Merge & Archive")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(.secondary.opacity(0.6))
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.025))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func pillBadge(text: String, icon: String, color: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 8, weight: .bold))
            Text(text)
                .font(.system(size: 9, weight: .semibold))
        }
        .foregroundColor(color)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(color.opacity(0.12))
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(color.opacity(0.25), lineWidth: 0.75)
        )
    }

    private func itemIconName(for item: VaultItem) -> String {
        if item.isRecoveryCode { return "key.horizontal.fill" }
        if item.isAuthenticator { return "timer" }
        return "key.fill"
    }

    private func itemColor(for item: VaultItem) -> Color {
        if item.isRecoveryCode { return LiquidGlassTheme.emeraldAccent }
        if item.isAuthenticator { return LiquidGlassTheme.primaryAccent }
        return LiquidGlassTheme.amberAccent
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 14) {
            Spacer().frame(height: 40)
            ZStack {
                Circle()
                    .fill(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                    .frame(width: 72, height: 72)
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 34))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
            }

            Text("All Credentials Are Unified")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.primary)

            Text("No split logins, authenticators, or recovery codes found for the same service.\nYour vault credentials and 2FA are fully consolidated.")
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)

            Spacer().frame(height: 40)
        }
        .frame(maxWidth: .infinity)
        .padding(32)
        .background(Color.white.opacity(0.02))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
        )
    }

    // MARK: - Actions

    private func handleCombineGroup(_ group: CombinableCredentialGroup) {
        withAnimation(.spring(response: 0.36, dampingFraction: 0.75)) {
            if let onCombine = onCombineGroup {
                onCombine(group)
            } else {
                VaultStore.shared.combineCredentialGroup(group)
            }
            statusMessage = "Combined \(group.title) into a unified credential."
        }
    }

    private func handleCombineAll() {
        withAnimation(.spring(response: 0.36, dampingFraction: 0.75)) {
            let count: Int
            if let onAll = onCombineAll {
                count = onAll()
            } else {
                count = VaultStore.shared.combineAllCredentialGroups()
            }
            statusMessage = "Successfully combined \(count) credential groups into unified items."
        }
    }
}
