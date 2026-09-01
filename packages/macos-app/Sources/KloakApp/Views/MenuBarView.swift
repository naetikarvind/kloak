import SwiftUI
import AppKit

public struct MenuBarView: View {
    @ObservedObject var vaultStore: VaultStore = .shared

    @State private var searchText: String = ""
    @State private var selectedFilter: MenuBarFilter = .suggestions
    @State private var selectedItemId: String? = nil
    @State private var copiedFeedback: String? = nil

    // Smart context detection state
    @State private var activeContext: ActiveContext? = nil
    @State private var smartSuggestions: [VaultItem] = []

    // Unlock states
    @State private var unlockPassword: String = ""
    @State private var isUnlocking: Bool = false
    @State private var unlockErrorMessage: String? = nil
    @State private var showUnlockPassword: Bool = false
    @FocusState private var isPasswordFocused: Bool

    // Quick Generator states
    @State private var genLength: Double = 20
    @State private var generatedPassword: String = ""

    public init(vaultStore: VaultStore = .shared) {
        self.vaultStore = vaultStore
    }

    public enum MenuBarFilter: String, CaseIterable, Identifiable {
        case suggestions = "✨ Suggested"
        case all = "All"
        case logins = "Logins"
        case totp = "2FA"
        case generator = "Generator"

        public var id: String { rawValue }
    }

    private var filteredItems: [VaultItem] {
        var base = vaultStore.items.filter { !$0.trashed }

        switch selectedFilter {
        case .suggestions:
            if !smartSuggestions.isEmpty {
                return smartSuggestions
            }
            return base
        case .all:
            break
        case .logins:
            base = base.filter { $0.type == .login || $0.type == .oauth }
        case .totp:
            base = base.filter { $0.totpSecret != nil && !($0.totpSecret?.isEmpty ?? true) }
        case .generator:
            return []
        }

        if !searchText.isEmpty {
            let q = searchText.lowercased()
            return base.filter {
                $0.title.lowercased().contains(q) ||
                ($0.username?.lowercased().contains(q) ?? false) ||
                ($0.oauth?.accountEmail?.lowercased().contains(q) ?? false) ||
                $0.urls.contains { $0.lowercased().contains(q) }
            }
        }
        return base
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header Bar
            HStack(spacing: 10) {
                KloakLogoView(size: 22)

                VStack(alignment: .leading, spacing: 1) {
                    Text("Kloak")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)
                    Text(vaultStore.isUnlocked ? "Vault Unlocked" : "Locked")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }

                Spacer()

                if vaultStore.isUnlocked {
                    Button(action: {
                        vaultStore.lock()
                    }) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                            .padding(6)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .help("Lock Vault")
                }

                Button(action: openMainWindow) {
                    Image(systemName: "arrow.up.forward.app")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .padding(6)
                        .background(Color.white.opacity(0.08))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .help("Open Main Kloak Window")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.black.opacity(0.25))

            Divider().opacity(0.15)

            if !vaultStore.hasVault {
                // Setup prompt
                VStack(spacing: 12) {
                    Spacer()
                    KloakLogoView(size: 48, glow: true)
                    Text("Welcome to Kloak")
                        .font(.system(size: 14, weight: .bold))
                    Text("Please open the main window to initialize your master password and encrypted vault.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                    Button("Open Setup", action: openMainWindow)
                        .buttonStyle(GlassCapsuleButton(isPrimary: true))
                    Spacer()
                }
                .padding()
            } else if !vaultStore.isUnlocked {
                // Locked Quick Unlock Form
                VStack(spacing: 14) {
                    Spacer()

                    KloakLogoView(size: 60, glow: true)

                    Text("Unlock Kloak")
                        .font(.system(size: 14, weight: .bold))

                    VStack(spacing: 10) {
                        HStack(spacing: 6) {
                            if showUnlockPassword {
                                TextField("Master Password", text: $unlockPassword)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 12))
                                    .focused($isPasswordFocused)
                            } else {
                                SecureField("Master Password", text: $unlockPassword)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 12))
                                    .focused($isPasswordFocused)
                            }

                            Button(action: { showUnlockPassword.toggle() }) {
                                Image(systemName: showUnlockPassword ? "eye.slash" : "eye")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.black.opacity(0.3))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(isPasswordFocused ? LiquidGlassTheme.primaryAccent : Color.white.opacity(0.15), lineWidth: 1)
                                )
                        )
                        .onSubmit(attemptMenuBarUnlock)

                        if let err = unlockErrorMessage {
                            Text(err)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(LiquidGlassTheme.roseAccent)
                        }

                        HStack(spacing: 8) {
                            Button(action: attemptMenuBarUnlock) {
                                if isUnlocking {
                                    ProgressView().controlSize(.small)
                                } else {
                                    Text("Unlock")
                                }
                            }
                            .buttonStyle(GlassCapsuleButton(isPrimary: true))
                            .disabled(unlockPassword.isEmpty || isUnlocking)

                            if BiometricAuth.shared.canAuthenticateWithBiometrics() {
                                Button(action: attemptBiometricUnlock) {
                                    Image(systemName: "touchid")
                                        .font(.system(size: 14))
                                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                                }
                                .buttonStyle(GlassCapsuleButton(isPrimary: false))
                                .help("Unlock with Touch ID")
                            }
                        }
                    }
                    .padding(.horizontal, 24)

                    Spacer()
                }
                .padding(.vertical, 16)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        isPasswordFocused = true
                    }
                }
            } else {
                // Unlocked View
                VStack(spacing: 0) {
                    // Search & Segmented Filter
                    VStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.secondary)
                                .font(.system(size: 11))

                            TextField("Search credentials...", text: $searchText)
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
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.black.opacity(0.3))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.white.opacity(0.1), lineWidth: 0.75)
                                )
                        )

                        // Filter Chips
                        HStack(spacing: 4) {
                            ForEach(MenuBarFilter.allCases) { filter in
                                Button(action: { selectedFilter = filter }) {
                                    Text(filter.rawValue)
                                        .font(.system(size: 10, weight: selectedFilter == filter ? .bold : .medium))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(
                                            selectedFilter == filter
                                            ? LiquidGlassTheme.primaryAccent.opacity(0.25)
                                            : Color.white.opacity(0.05)
                                        )
                                        .foregroundColor(selectedFilter == filter ? .white : .secondary)
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                            Spacer()
                        }
                    }
                    .padding(10)

                    Divider().opacity(0.12)

                    // Content Section
                    if selectedFilter == .generator {
                        // Quick Generator Inside Menu Bar
                        VStack(spacing: 12) {
                            HStack {
                                Text(generatedPassword.isEmpty ? "Click Generate" : generatedPassword)
                                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                                    .lineLimit(2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .fixedSize(horizontal: false, vertical: true)

                                Button(action: {
                                    copyString(generatedPassword, label: "password")
                                }) {
                                    Label(copiedFeedback == "password" ? "Copied" : "Copy", systemImage: copiedFeedback == "password" ? "checkmark" : "doc.on.doc")
                                }
                                .buttonStyle(GlassCapsuleButton(isPrimary: true))
                                .disabled(generatedPassword.isEmpty)
                            }
                            .padding(10)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("Length: \(Int(genLength))")
                                        .font(.system(size: 11, weight: .medium))
                                    Spacer()
                                    Button("Regenerate", action: generateQuickPassword)
                                        .font(.system(size: 11, weight: .bold))
                                        .buttonStyle(.plain)
                                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                                }
                                Slider(value: $genLength, in: 8...40, step: 1)
                                    .onChange(of: genLength) { _, _ in generateQuickPassword() }
                            }
                            Spacer()
                        }
                        .padding(14)
                        .onAppear { generateQuickPassword() }
                    } else {
                        // Item List with Smart Suggestions Hero
                        ScrollView {
                            LazyVStack(spacing: 6) {
                                // Smart Suggestion Hero Card when matching context exists
                                if let ctx = activeContext, !smartSuggestions.isEmpty && searchText.isEmpty && selectedFilter == .suggestions {
                                    VStack(alignment: .leading, spacing: 6) {
                                        HStack(spacing: 5) {
                                            Image(systemName: "sparkles")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                                            Text(ctx.isBrowser && ctx.activeDomain != nil ? "Suggested for \(ctx.activeDomain!)" : "Suggested for \(ctx.appName)")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundColor(.secondary)
                                                .textCase(.uppercase)
                                            Spacer()
                                        }
                                        .padding(.horizontal, 4)

                                        ForEach(smartSuggestions.prefix(2)) { item in
                                            SuggestedHeroRow(
                                                item: item,
                                                copiedFeedback: copiedFeedback,
                                                onCopyUsername: {
                                                    if let u = item.username ?? item.oauth?.accountEmail {
                                                        copyString(u, label: "user_\(item.id)")
                                                    }
                                                },
                                                onCopyPassword: {
                                                    if let p = item.password {
                                                        copyString(p, label: "pass_\(item.id)")
                                                    }
                                                },
                                                onCopyTotp: {
                                                    if let secret = item.totpSecret,
                                                       let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                                                        copyString(totp.token, label: "totp_\(item.id)")
                                                    }
                                                }
                                            )
                                        }
                                    }
                                    .padding(8)
                                    .background(Color.white.opacity(0.04))
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(LiquidGlassTheme.primaryAccent.opacity(0.3), lineWidth: 1)
                                    )
                                    .padding(.horizontal, 8)
                                    .padding(.top, 4)
                                }

                                if filteredItems.isEmpty {
                                    VStack(spacing: 8) {
                                        Spacer()
                                        Image(systemName: "magnifyingglass")
                                            .font(.system(size: 24))
                                            .foregroundColor(.secondary.opacity(0.4))
                                        Text(searchText.isEmpty ? "No items found" : "No matches")
                                            .font(.system(size: 11))
                                            .foregroundColor(.secondary)
                                        Spacer()
                                    }
                                    .frame(maxWidth: .infinity, minHeight: 120)
                                } else {
                                    ForEach(filteredItems) { item in
                                        MenuBarItemRow(
                                            item: item,
                                            isSelected: selectedItemId == item.id,
                                            copiedFeedback: copiedFeedback,
                                            onSelect: {
                                                if selectedItemId == item.id {
                                                    selectedItemId = nil
                                                } else {
                                                    selectedItemId = item.id
                                                }
                                            },
                                            onCopyUsername: {
                                                if let u = item.username ?? item.oauth?.accountEmail {
                                                    copyString(u, label: "user_\(item.id)")
                                                }
                                            },
                                            onCopyPassword: {
                                                if let p = item.password {
                                                    copyString(p, label: "pass_\(item.id)")
                                                }
                                            },
                                            onCopyTotp: {
                                                if let secret = item.totpSecret,
                                                   let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                                                    copyString(totp.token, label: "totp_\(item.id)")
                                                }
                                            }
                                        )
                                    }
                                    .padding(.horizontal, 8)
                                }
                            }
                            .padding(.vertical, 6)
                        }
                    }

                    Divider().opacity(0.12)

                    // Footer Status
                    HStack {
                        Text("\(vaultStore.items.filter { !$0.trashed }.count) credentials")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)

                        Spacer()

                        if copiedFeedback != nil {
                            Text("Copied to clipboard")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                .transition(.opacity)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.2))
                }
            }
        }
        .frame(width: 350, height: 460)
        .background(.ultraThinMaterial)
        .onAppear {
            refreshContext()
        }
    }

    private func refreshContext() {
        let ctx = ActiveContextService.shared.getActiveContext()
        self.activeContext = ctx
        let suggestions = ActiveContextService.shared.findSmartSuggestions(in: vaultStore.items, context: ctx)
        self.smartSuggestions = suggestions
        if !suggestions.isEmpty && ctx.activeDomain != nil {
            self.selectedFilter = .suggestions
        }
    }

    private func attemptMenuBarUnlock() {
        guard !unlockPassword.isEmpty && !isUnlocking else { return }
        isUnlocking = true
        unlockErrorMessage = nil

        Task {
            let success = await vaultStore.unlock(password: unlockPassword)
            isUnlocking = false
            if success {
                unlockPassword = ""
                refreshContext()
            } else {
                unlockErrorMessage = "Incorrect master password."
            }
        }
    }

    private func attemptBiometricUnlock() {
        Task {
            let success = await vaultStore.unlockWithBiometrics()
            if success {
                refreshContext()
            } else if let err = vaultStore.lastError {
                unlockErrorMessage = err
            }
        }
    }

    private func openMainWindow() {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        if let window = NSApp.windows.first(where: { $0.canBecomeKey }) {
            window.makeKeyAndOrderFront(nil)
        }
    }

    private func copyString(_ text: String, label: String) {
        guard !text.isEmpty else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        copiedFeedback = label

        let clearSec = vaultStore.settings.clearClipboardSeconds
        if clearSec > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(clearSec)) {
                if NSPasteboard.general.string(forType: .string) == text {
                    NSPasteboard.general.clearContents()
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if copiedFeedback == label {
                copiedFeedback = nil
            }
        }
    }

    private func generateQuickPassword() {
        let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
        var res = ""
        for _ in 0..<Int(genLength) {
            if let ch = pool.randomElement() {
                res.append(ch)
            }
        }
        generatedPassword = res
    }
}

public struct SuggestedHeroRow: View {
    let item: VaultItem
    let copiedFeedback: String?
    var onCopyUsername: () -> Void
    var onCopyPassword: () -> Void
    var onCopyTotp: () -> Void

    public var body: some View {
        HStack(spacing: 8) {
            FaviconView(
                urls: item.urls,
                title: item.title,
                oauthProvider: item.oauth?.provider,
                itemType: item.type,
                size: 26
            )

            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: 12, weight: .bold))
                    .lineLimit(1)
                Text(item.username ?? item.oauth?.accountEmail ?? item.type.displayName)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 4) {
                if item.totpSecret != nil {
                    Button(action: onCopyTotp) {
                        HStack(spacing: 3) {
                            Image(systemName: copiedFeedback == "totp_\(item.id)" ? "checkmark" : "timer")
                            Text("2FA")
                        }
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(copiedFeedback == "totp_\(item.id)" ? LiquidGlassTheme.emeraldAccent : .primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                    .help("Copy 2FA Token")
                }

                if item.password != nil {
                    Button(action: onCopyPassword) {
                        HStack(spacing: 3) {
                            Image(systemName: copiedFeedback == "pass_\(item.id)" ? "checkmark" : "key.fill")
                            Text("Copy Pass")
                        }
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(LiquidGlassTheme.primaryAccent)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                    .help("Copy Password")
                }
            }
        }
        .padding(8)
        .background(Color.black.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

public struct MenuBarItemRow: View {
    let item: VaultItem
    let isSelected: Bool
    let copiedFeedback: String?
    var onSelect: () -> Void
    var onCopyUsername: () -> Void
    var onCopyPassword: () -> Void
    var onCopyTotp: () -> Void

    @State private var isHovered: Bool = false

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                FaviconView(
                    urls: item.urls,
                    title: item.title,
                    oauthProvider: item.oauth?.provider,
                    itemType: item.type,
                    size: 24
                )

                VStack(alignment: .leading, spacing: 1) {
                    Text(item.title)
                        .font(.system(size: 11, weight: .semibold))
                        .lineLimit(1)
                    Text(item.username ?? item.oauth?.accountEmail ?? item.type.displayName)
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Quick Action Copy Buttons
                HStack(spacing: 4) {
                    if item.totpSecret != nil {
                        Button(action: onCopyTotp) {
                            Image(systemName: copiedFeedback == "totp_\(item.id)" ? "checkmark" : "timer")
                                .font(.system(size: 10))
                                .foregroundColor(copiedFeedback == "totp_\(item.id)" ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.emeraldAccent.opacity(0.8))
                                .padding(4)
                                .background(Color.white.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                        .buttonStyle(.plain)
                        .help("Copy 2FA TOTP Token")
                    }

                    if item.username != nil || item.oauth?.accountEmail != nil {
                        Button(action: onCopyUsername) {
                            Image(systemName: copiedFeedback == "user_\(item.id)" ? "checkmark" : "person.fill")
                                .font(.system(size: 10))
                                .foregroundColor(copiedFeedback == "user_\(item.id)" ? LiquidGlassTheme.emeraldAccent : .secondary)
                                .padding(4)
                                .background(Color.white.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                        .buttonStyle(.plain)
                        .help("Copy Username / Email")
                    }

                    if item.password != nil {
                        Button(action: onCopyPassword) {
                            Image(systemName: copiedFeedback == "pass_\(item.id)" ? "checkmark" : "key.fill")
                                .font(.system(size: 10))
                                .foregroundColor(copiedFeedback == "pass_\(item.id)" ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.primaryAccent)
                                .padding(4)
                                .background(Color.white.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                        .buttonStyle(.plain)
                        .help("Copy Password")
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? Color.white.opacity(0.1) : (isHovered ? Color.white.opacity(0.05) : Color.clear))
            )
            .contentShape(Rectangle())
            .onTapGesture(perform: onSelect)
            .onHover { isHovered = $0 }

            // Expanded Detail View when tapped
            if isSelected {
                VStack(alignment: .leading, spacing: 6) {
                    if let totp = item.totpSecret, !totp.isEmpty {
                        HStack {
                            TOTPRingView(secret: totp)
                            Spacer()
                        }
                    }

                    if let notes = item.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                            .padding(6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.black.opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 6)
            }
        }
    }
}
