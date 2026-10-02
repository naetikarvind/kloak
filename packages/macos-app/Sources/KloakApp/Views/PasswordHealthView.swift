import SwiftUI

public struct PasswordHealthView: View {
    @Binding var items: [VaultItem]
    var onSaveItem: ((VaultItem) -> Void)?
    var onSelectItem: ((String) -> Void)?

    @State private var selectedFilter: Int = 0 // 0: All, 1: Reused, 2: Weak, 3: Missing 2FA
    @State private var searchText: String = ""
    @State private var revealedPasswordIds: Set<String> = []
    @State private var updatedItemId: String? = nil
    @State private var statusMessage: String? = nil

    private var reusedGroups: [ReusedPasswordGroup] {
        let all = DuplicateDetectorService.shared.findReusedPasswords(in: items)
        if searchText.isEmpty { return all }
        let q = searchText.lowercased()
        return all.filter { group in
            group.items.contains {
                $0.title.lowercased().contains(q) ||
                ($0.username?.lowercased().contains(q) ?? false) ||
                $0.urls.contains { $0.lowercased().contains(q) }
            }
        }
    }

    private var weakPasswords: [WeakPasswordItem] {
        let all = DuplicateDetectorService.shared.findWeakPasswords(in: items)
        if searchText.isEmpty { return all }
        let q = searchText.lowercased()
        return all.filter {
            $0.item.title.lowercased().contains(q) ||
            ($0.item.username?.lowercased().contains(q) ?? false) ||
            $0.item.urls.contains { $0.lowercased().contains(q) }
        }
    }

    private var missing2FA: [Missing2FAItem] {
        let all = DuplicateDetectorService.shared.findMissing2FA(in: items)
        if searchText.isEmpty { return all }
        let q = searchText.lowercased()
        return all.filter {
            $0.item.title.lowercased().contains(q) ||
            ($0.item.username?.lowercased().contains(q) ?? false) ||
            $0.item.urls.contains { $0.lowercased().contains(q) }
        }
    }

    private var totalReusedLogins: Int {
        DuplicateDetectorService.shared.findReusedPasswords(in: items).reduce(0) { $0 + $1.items.count }
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header & Equal-Width Stats
                headerSection

                // Filter & Search Controls
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

                // Main Content
                if reusedGroups.isEmpty && weakPasswords.isEmpty && (selectedFilter == 3 ? missing2FA.isEmpty : true) {
                    emptyHealthStateView
                } else {
                    healthIssuesContent
                }
            }
            .padding(24)
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Password Security & Health")
                    .font(.system(size: 20, weight: .bold))
                Text("Audit vault security, detect reused or weak passwords, and strengthen vulnerable logins.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }

            // Quick Stats Row (Strictly Equal-Width Containers)
            HStack(spacing: 12) {
                statCard(
                    title: "Reused Passwords",
                    value: "\(reusedGroups.count) groups",
                    subtitle: "\(totalReusedLogins) affected logins",
                    color: Color.red.opacity(0.85),
                    icon: "shield.slash.fill"
                )

                statCard(
                    title: "Weak Passwords",
                    value: "\(weakPasswords.count)",
                    subtitle: "Short or simple patterns",
                    color: LiquidGlassTheme.amberAccent,
                    icon: "exclamationmark.shield.fill"
                )

                statCard(
                    title: "Missing 2FA",
                    value: "\(missing2FA.count)",
                    subtitle: "Logins without TOTP",
                    color: Color.purple.opacity(0.85),
                    icon: "clock.badge.exclamationmark.fill"
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
            Picker("", selection: $selectedFilter) {
                Text("All Issues").tag(0)
                Text("Reused (\(reusedGroups.count))").tag(1)
                Text("Weak (\(weakPasswords.count))").tag(2)
                Text("No 2FA (\(missing2FA.count))").tag(3)
            }
            .pickerStyle(.segmented)
            .frame(width: 340)

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                    .font(.system(size: 11))
                TextField("Search security audit...", text: $searchText)
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
        }
    }

    // MARK: - Issues Content

    @ViewBuilder
    private var healthIssuesContent: some View {
        VStack(spacing: 20) {
            // Reused Passwords
            if (selectedFilter == 0 || selectedFilter == 1) && !reusedGroups.isEmpty {
                reusedPasswordsSection
            }

            // Weak Passwords
            if (selectedFilter == 0 || selectedFilter == 2) && !weakPasswords.isEmpty {
                weakPasswordsSection
            }

            // Missing 2FA
            if (selectedFilter == 3) && !missing2FA.isEmpty {
                missing2FASection
            }
        }
    }

    // MARK: - Reused Passwords Section

    private var reusedPasswordsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "exclamationmark.shield.fill")
                    .font(.system(size: 20))
                    .foregroundColor(Color.red.opacity(0.85))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Critical Security Risk: Reused Passwords")
                        .font(.system(size: 12, weight: .bold))
                    Text("If one website suffers a data breach, attackers will attempt using this same password on your other accounts. Generate unique passwords for each service.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
            }
            .padding(14)
            .background(Color.red.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.red.opacity(0.25), lineWidth: 1)
            )

            ForEach(reusedGroups) { group in
                reusedGroupCard(group)
            }
        }
    }

    private func reusedGroupCard(_ group: ReusedPasswordGroup) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundColor(LiquidGlassTheme.amberAccent)

                    Text("Shared across \(group.items.count) Logins")
                        .font(.system(size: 13, weight: .bold))
                }

                Spacer()

                HStack(spacing: 6) {
                    if revealedPasswordIds.contains(group.id) {
                        Text(group.password)
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                    } else {
                        Text("••••••••••••")
                            .font(.system(size: 11, design: .monospaced))
                    }

                    Button(action: {
                        if revealedPasswordIds.contains(group.id) {
                            revealedPasswordIds.remove(group.id)
                        } else {
                            revealedPasswordIds.insert(group.id)
                        }
                    }) {
                        Image(systemName: revealedPasswordIds.contains(group.id) ? "eye.slash" : "eye")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            Divider().opacity(0.1)

            VStack(spacing: 8) {
                ForEach(group.items) { item in
                    HStack(spacing: 12) {
                        FaviconView(
                            urls: item.urls,
                            title: item.title,
                            itemType: item.type,
                            size: 26
                        )

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                                .font(.system(size: 12, weight: .semibold))

                            HStack(spacing: 6) {
                                if let user = item.username, !user.isEmpty {
                                    Text(user)
                                        .font(.system(size: 10))
                                        .foregroundColor(.secondary)
                                }
                                if let url = item.urls.first, !url.isEmpty {
                                    Text("• \(url)")
                                        .font(.system(size: 10))
                                        .foregroundColor(.secondary.opacity(0.7))
                                        .lineLimit(1)
                                }
                            }
                        }

                        Spacer()

                        if updatedItemId == item.id {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Updated!")
                            }
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                        } else {
                            Button(action: {
                                handleGenerateNewPassword(for: item)
                            }) {
                                Label("Generate New Password", systemImage: "sparkles")
                            }
                            .buttonStyle(GlassCapsuleButton(isPrimary: true))
                        }
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(16)
        .glassEffect(cornerRadius: 14)
    }

    // MARK: - Weak Passwords Section

    private var weakPasswordsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(LiquidGlassTheme.amberAccent)
                    .font(.system(size: 13))
                Text("WEAK & SHORT PASSWORDS")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
            }

            VStack(spacing: 8) {
                ForEach(weakPasswords) { weakItem in
                    HStack(spacing: 12) {
                        FaviconView(
                            urls: weakItem.item.urls,
                            title: weakItem.item.title,
                            itemType: weakItem.item.type,
                            size: 26
                        )

                        VStack(alignment: .leading, spacing: 2) {
                            Text(weakItem.item.title)
                                .font(.system(size: 12, weight: .semibold))

                            HStack(spacing: 6) {
                                if let user = weakItem.item.username, !user.isEmpty {
                                    Text(user)
                                        .font(.system(size: 10))
                                        .foregroundColor(.secondary)
                                }
                                Text("• \(weakItem.reason)")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(LiquidGlassTheme.amberAccent)
                            }
                        }

                        Spacer()

                        if updatedItemId == weakItem.id {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Strengthened!")
                            }
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                        } else {
                            Button(action: {
                                handleGenerateNewPassword(for: weakItem.item)
                            }) {
                                Label("Strengthen Password", systemImage: "bolt.shield.fill")
                            }
                            .buttonStyle(GlassCapsuleButton(isPrimary: true))
                        }
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(16)
        .glassEffect(cornerRadius: 14)
    }

    // MARK: - Missing 2FA Section

    private var missing2FASection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "clock.badge.exclamationmark.fill")
                    .foregroundColor(Color.purple.opacity(0.85))
                    .font(.system(size: 13))
                Text("LOGINS MISSING TWO-FACTOR AUTHENTICATION")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
            }

            VStack(spacing: 8) {
                ForEach(missing2FA) { item2fa in
                    HStack(spacing: 12) {
                        FaviconView(
                            urls: item2fa.item.urls,
                            title: item2fa.item.title,
                            itemType: item2fa.item.type,
                            size: 26
                        )

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item2fa.item.title)
                                .font(.system(size: 12, weight: .semibold))

                            if let user = item2fa.item.username, !user.isEmpty {
                                Text(user)
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()

                        Text("No TOTP attached")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary.opacity(0.7))
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(16)
        .glassEffect(cornerRadius: 14)
    }

    // MARK: - Actions

    private func handleGenerateNewPassword(for item: VaultItem) {
        var updated = item
        let newPass = DuplicateDetectorService.shared.generateSecurePassword(length: 22)
        updated.password = newPass
        updated.updatedAt = ISO8601DateFormatter().string(from: Date())
        onSaveItem?(updated)

        updatedItemId = item.id
        statusMessage = "Generated strong, unique 22-character password for \"\(item.title)\"!"

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            if updatedItemId == item.id {
                updatedItemId = nil
            }
        }
    }

    private var emptyHealthStateView: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 42))
                .foregroundColor(LiquidGlassTheme.emeraldAccent)

            Text("Your Vault is in Great Health!")
                .font(.system(size: 16, weight: .bold))

            Text("No reused or weak passwords detected. All your accounts use strong, unique credentials.")
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 400)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .glassEffect(cornerRadius: 14)
    }
}
