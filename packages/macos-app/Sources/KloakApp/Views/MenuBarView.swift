import SwiftUI
import AppKit

public struct MenuBarView: View {
    @ObservedObject var vaultStore: VaultStore = .shared

    @State private var searchText: String = ""
    @State private var selectedFilter: MenuBarFilter = .all
    @State private var selectedItemId: String? = nil
    @State private var copiedFeedback: String? = nil

    // Smart context detection state
    @State private var activeContext: ActiveContext? = nil
    @State private var smartSuggestions: [VaultItem] = []

    // Live browser context pushed from extension
    @State private var liveBrowserUrl: String? = nil
    @State private var liveBrowserTabId: Int = -1
    @State private var liveBrowserSuggestions: [VaultItem] = []

    // Unlock states
    @State private var unlockPassword: String = ""
    @State private var isUnlocking: Bool = false
    @State private var unlockErrorMessage: String? = nil
    @State private var showUnlockPassword: Bool = false
    @FocusState private var isPasswordFocused: Bool

    // Complete Generator states
    @State private var genMode: Int = 0 // 0: Password, 1: Passphrase
    @State private var genLength: Double = 20
    @State private var genWordsCount: Double = 4
    @State private var genUseUpper: Bool = true
    @State private var genUseLower: Bool = true
    @State private var genUseNumbers: Bool = true
    @State private var genUseSymbols: Bool = true
    @State private var genAvoidAmbiguous: Bool = false
    @State private var generatedPassword: String = ""

    private var genStrengthScore: Int {
        if genMode == 1 {
            if genWordsCount >= 5 { return 4 }
            if genWordsCount >= 4 { return 3 }
            return 2
        }
        var score = 0
        if genLength >= 22 { score += 2 }
        else if genLength >= 14 { score += 1 }

        var variety = 0
        if genUseUpper { variety += 1 }
        if genUseLower { variety += 1 }
        if genUseNumbers { variety += 1 }
        if genUseSymbols { variety += 1 }
        if variety >= 3 { score += 2 }
        else if variety >= 2 { score += 1 }

        return min(4, max(1, score))
    }

    private var genStrengthColor: Color {
        switch genStrengthScore {
        case 4: return LiquidGlassTheme.emeraldAccent
        case 3: return LiquidGlassTheme.primaryAccent
        case 2: return LiquidGlassTheme.amberAccent
        default: return LiquidGlassTheme.roseAccent
        }
    }

    private var genStrengthLabel: String {
        switch genStrengthScore {
        case 4: return "Very Strong"
        case 3: return "Strong"
        case 2: return "Moderate"
        default: return "Weak"
        }
    }

    public init(vaultStore: VaultStore = .shared) {
        self.vaultStore = vaultStore
    }

    public enum MenuBarFilter: String, CaseIterable, Identifiable {
        case suggestions = "✨ Suggested"
        case all = "All"
        case logins = "Logins"
        case totp = "Authenticator"
        case generator = "Generator"

        public var id: String { rawValue }
    }

    private var filteredItems: [VaultItem] {
        var base = vaultStore.items.filter { !$0.trashed }

        switch selectedFilter {
        case .suggestions:
            return smartSuggestions
        case .all:
            break
        case .logins:
            base = base.filter { $0.type == .login }
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
                ($0.identity?.fullName?.lowercased().contains(q) ?? false) ||
                ($0.card?.cardholderName?.lowercased().contains(q) ?? false) ||
                ($0.alias?.aliasEmail?.lowercased().contains(q) ?? false) ||
                ($0.authenticatorDetails?.issuer?.lowercased().contains(q) ?? false) ||
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
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(MenuBarFilter.allCases) { filter in
                                    Button(action: { selectedFilter = filter }) {
                                        Text(filter.rawValue)
                                            .font(.system(size: 10.5, weight: selectedFilter == filter ? .bold : .medium))
                                            .lineLimit(1)
                                            .fixedSize(horizontal: true, vertical: false)
                                            .padding(.horizontal, 9)
                                            .padding(.vertical, 4.5)
                                            .background(
                                                selectedFilter == filter
                                                ? LiquidGlassTheme.primaryAccent.opacity(0.28)
                                                : Color.white.opacity(0.06)
                                            )
                                            .foregroundColor(selectedFilter == filter ? .white : .secondary)
                                            .clipShape(Capsule())
                                            .overlay(
                                                Capsule()
                                                    .stroke(
                                                        selectedFilter == filter
                                                        ? LiquidGlassTheme.primaryAccent.opacity(0.6)
                                                        : Color.white.opacity(0.08),
                                                        lineWidth: 0.75
                                                    )
                                            )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 2)
                        }
                    }
                    .padding(10)

                    Divider().opacity(0.12)

                    // Content Section
                    if selectedFilter == .generator {
                        // Complete Generator Inside Menu Bar
                        ScrollView {
                            VStack(spacing: 12) {
                                // Mode Picker
                                Picker("", selection: $genMode) {
                                    Text("Password").tag(0)
                                    Text("Passphrase").tag(1)
                                }
                                .pickerStyle(.segmented)
                                .onChange(of: genMode) { _, _ in generateQuickPassword() }

                                // Output Card
                                VStack(spacing: 8) {
                                    HStack(alignment: .center, spacing: 8) {
                                        Text(generatedPassword.isEmpty ? "Click Generate" : generatedPassword)
                                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                                            .foregroundColor(.primary)
                                            .textSelection(.enabled)
                                            .lineLimit(3)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .fixedSize(horizontal: false, vertical: true)

                                        HStack(spacing: 5) {
                                            Button(action: generateQuickPassword) {
                                                Image(systemName: "arrow.clockwise")
                                                    .font(.system(size: 11, weight: .bold))
                                                    .foregroundColor(.secondary)
                                                    .padding(7)
                                                    .background(Color.white.opacity(0.08))
                                                    .clipShape(Circle())
                                            }
                                            .buttonStyle(.plain)
                                            .help("Regenerate")

                                            Button(action: {
                                                copyString(generatedPassword, label: "password")
                                            }) {
                                                HStack(spacing: 4) {
                                                    Image(systemName: copiedFeedback == "password" ? "checkmark" : "doc.on.doc")
                                                        .font(.system(size: 10.5))
                                                    Text(copiedFeedback == "password" ? "Copied" : "Copy")
                                                        .font(.system(size: 10.5, weight: .semibold))
                                                }
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 9)
                                                .padding(.vertical, 5.5)
                                                .background(LiquidGlassTheme.primaryAccent)
                                                .clipShape(Capsule())
                                            }
                                            .buttonStyle(.plain)
                                            .disabled(generatedPassword.isEmpty)
                                        }
                                    }

                                    // Strength Bar
                                    HStack(spacing: 4) {
                                        ForEach(0..<4) { idx in
                                            Capsule()
                                                .fill(idx < genStrengthScore ? genStrengthColor : Color.white.opacity(0.1))
                                                .frame(height: 3.5)
                                        }
                                        Text(genStrengthLabel)
                                            .font(.system(size: 9.5, weight: .bold))
                                            .foregroundColor(genStrengthColor)
                                            .padding(.leading, 4)
                                    }
                                }
                                .padding(12)
                                .background(Color.black.opacity(0.3))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                                )

                                // Configuration Card
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("CONFIGURATION")
                                        .font(.system(size: 9.5, weight: .bold))
                                        .foregroundColor(.secondary)

                                    if genMode == 0 {
                                        // Length slider
                                        VStack(alignment: .leading, spacing: 4) {
                                            HStack {
                                                Text("Length")
                                                    .font(.system(size: 11.5, weight: .medium))
                                                Spacer()
                                                Text("\(Int(genLength)) chars")
                                                    .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                                    .foregroundColor(genStrengthColor)
                                            }
                                            Slider(value: $genLength, in: 8...64, step: 1)
                                                .tint(LiquidGlassTheme.primaryAccent)
                                                .onChange(of: genLength) { _, _ in generateQuickPassword() }
                                        }

                                        Divider().opacity(0.12)

                                        // Character set toggles
                                        VStack(spacing: 8) {
                                            Toggle("Uppercase Letters (A-Z)", isOn: $genUseUpper)
                                                .font(.system(size: 11))
                                                .onChange(of: genUseUpper) { _, _ in generateQuickPassword() }
                                            Toggle("Lowercase Letters (a-z)", isOn: $genUseLower)
                                                .font(.system(size: 11))
                                                .onChange(of: genUseLower) { _, _ in generateQuickPassword() }
                                            Toggle("Numbers (0-9)", isOn: $genUseNumbers)
                                                .font(.system(size: 11))
                                                .onChange(of: genUseNumbers) { _, _ in generateQuickPassword() }
                                            Toggle("Symbols (!@#$%...)", isOn: $genUseSymbols)
                                                .font(.system(size: 11))
                                                .onChange(of: genUseSymbols) { _, _ in generateQuickPassword() }
                                            Toggle("Avoid Ambiguous (0, O, 1, l, I)", isOn: $genAvoidAmbiguous)
                                                .font(.system(size: 11))
                                                .onChange(of: genAvoidAmbiguous) { _, _ in generateQuickPassword() }
                                        }
                                    } else {
                                        // Passphrase word count slider
                                        VStack(alignment: .leading, spacing: 4) {
                                            HStack {
                                                Text("Word Count")
                                                    .font(.system(size: 11.5, weight: .medium))
                                                Spacer()
                                                Text("\(Int(genWordsCount)) words")
                                                    .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                                    .foregroundColor(genStrengthColor)
                                            }
                                            Slider(value: $genWordsCount, in: 3...10, step: 1)
                                                .tint(LiquidGlassTheme.primaryAccent)
                                                .onChange(of: genWordsCount) { _, _ in generateQuickPassword() }
                                        }

                                        Divider().opacity(0.12)

                                        Text("Generates memorable, multi-word passphrases with high cryptographic entropy separated by hyphens and ended with numbers.")
                                            .font(.system(size: 10))
                                            .foregroundColor(.secondary)
                                            .lineSpacing(2)
                                    }
                                }
                                .padding(12)
                                .background(Color.black.opacity(0.2))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .padding(12)
                        }
                        .onAppear { generateQuickPassword() }
                    } else {
                        // Item List with Smart Suggestions Hero
                        ScrollView {
                            LazyVStack(spacing: 6) {
                                // Smart Suggestion Hero Card when matching context exists
                                if let ctx = activeContext, !smartSuggestions.isEmpty && searchText.isEmpty && selectedFilter == .suggestions {
                                    VStack(alignment: .leading, spacing: 6) {
                                        HStack(spacing: 5) {
                                            // Live browser context indicator
                                            if liveBrowserUrl != nil {
                                                HStack(spacing: 4) {
                                                    Circle()
                                                        .fill(LiquidGlassTheme.emeraldAccent)
                                                        .frame(width: 6, height: 6)
                                                    Image(systemName: "network")
                                                        .font(.system(size: 9, weight: .bold))
                                                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                                }
                                            } else {
                                                Image(systemName: "sparkles")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                            }

                                            if let liveUrl = liveBrowserUrl, let host = URL(string: liveUrl)?.host {
                                                Text("Live · \(host.replacingOccurrences(of: "www.", with: ""))")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                                    .textCase(.uppercase)
                                            } else if ctx.isBrowser, let activeDomain = ctx.activeDomain {
                                                Text("Suggested for \(activeDomain)")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundColor(.secondary)
                                                    .textCase(.uppercase)
                                            } else {
                                                Text("Suggested for \(ctx.appName)")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundColor(.secondary)
                                                    .textCase(.uppercase)
                                            }
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
                                    VStack(spacing: 10) {
                                        Spacer()
                                        if selectedFilter == .suggestions {
                                            Image(systemName: "sparkles")
                                                .font(.system(size: 26))
                                                .foregroundColor(LiquidGlassTheme.primaryAccent.opacity(0.8))

                                            if let ctx = activeContext, !ctx.displayContext.isEmpty && ctx.displayContext != "App" && ctx.displayContext != "Finder" {
                                                Text("No suggestions for \(ctx.displayContext)")
                                                    .font(.system(size: 12, weight: .semibold))
                                                    .foregroundColor(.primary)
                                                Text("No credentials match this application or website.")
                                                    .font(.system(size: 10))
                                                    .foregroundColor(.secondary)
                                                    .multilineTextAlignment(.center)
                                                    .padding(.horizontal, 24)
                                            } else {
                                                Text("No Active Suggestions")
                                                    .font(.system(size: 12, weight: .semibold))
                                                    .foregroundColor(.primary)
                                                Text("Open a supported website or app to see matching logins.")
                                                    .font(.system(size: 10))
                                                    .foregroundColor(.secondary)
                                                    .multilineTextAlignment(.center)
                                                    .padding(.horizontal, 24)
                                            }

                                            Button(action: { selectedFilter = .all }) {
                                                Text("Browse All Credentials")
                                                    .font(.system(size: 11, weight: .semibold))
                                            }
                                            .buttonStyle(GlassCapsuleButton(isPrimary: true))
                                            .padding(.top, 4)
                                        } else {
                                            Image(systemName: liveBrowserUrl != nil ? "key.slash" : "magnifyingglass")
                                                .font(.system(size: 24))
                                                .foregroundColor(.secondary.opacity(0.4))
                                            if let liveUrl = liveBrowserUrl, let host = URL(string: liveUrl)?.host {
                                                Text("No passwords for \(host.replacingOccurrences(of: "www.", with: ""))")
                                                    .font(.system(size: 12, weight: .semibold))
                                                    .foregroundColor(.secondary)
                                                Text("Try searching or add a new login.")
                                                    .font(.system(size: 10))
                                                    .foregroundColor(.secondary.opacity(0.6))
                                            } else {
                                                Text(searchText.isEmpty ? "No items found" : "No matches")
                                                    .font(.system(size: 11))
                                                    .foregroundColor(.secondary)
                                            }
                                        }
                                        Spacer()
                                    }
                                    .frame(maxWidth: .infinity, minHeight: 140)
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
                                                if let u = item.displayAccountName {
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
                                            },
                                            onCopyUrl: { url in
                                                copyString(url, label: "url_\(item.id)")
                                            },
                                            onOpenInApp: {
                                                openMainWindow()
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
        .frame(width: 380, height: 520)
        .background(.ultraThinMaterial)
        .onAppear {
            refreshContext()
        }
        .onReceive(NotificationCenter.default.publisher(for: .kloakBrowserUrlChanged)) { note in
            guard vaultStore.isUnlocked else { return }
            if let url = note.userInfo?["url"] as? String, !url.isEmpty {
                liveBrowserUrl = url
                liveBrowserTabId = note.userInfo?["tabId"] as? Int ?? -1
                // Recompute suggestions using strict URL matching
                let fakeCtx = ActiveContext(
                    appName: "Browser",
                    bundleIdentifier: nil,
                    activeDomain: URL(string: url)?.host,
                    activeUrl: url
                )
                liveBrowserSuggestions = ActiveContextService.shared.findSmartSuggestions(in: vaultStore.items, context: fakeCtx)
                smartSuggestions = liveBrowserSuggestions
                activeContext = fakeCtx
                if selectedFilter != .generator {
                    selectedFilter = .suggestions
                }
            }
        }
    }

    private func refreshContext() {
        let ctx = ActiveContextService.shared.getActiveContext()
        self.activeContext = ctx
        let suggestions = ActiveContextService.shared.findSmartSuggestions(in: vaultStore.items, context: ctx)
        self.smartSuggestions = suggestions
        if !suggestions.isEmpty {
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
        if genMode == 0 {
            var pool = ""
            if genUseUpper { pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ" }
            if genUseLower { pool += "abcdefghijklmnopqrstuvwxyz" }
            if genUseNumbers { pool += "0123456789" }
            if genUseSymbols { pool += "!@#$%^&*()_+-=[]{}|;:,.<>?" }
            if genAvoidAmbiguous {
                pool = pool.filter { !"0O1lI|[]{}()/'\"`~,;:.<>".contains($0) }
            }
            if pool.isEmpty { pool = "abcdefghijklmnopqrstuvwxyz" }

            var res = ""
            for _ in 0..<Int(genLength) {
                if let char = pool.randomElement() {
                    res.append(char)
                }
            }
            generatedPassword = res
        } else {
            let sampleWords = [
                "Quantum", "Obsidian", "Cascade", "Cipher", "Aurora", "Beacon",
                "Vortex", "Horizon", "Nebula", "Sentinel", "Apex", "Echo",
                "Mirage", "Prism", "Solstice", "Eclipse", "Zenith", "Pinnacle",
                "Cosmos", "Starlight", "Timber", "Falcon", "Granite", "River",
                "Summit", "Oasis", "Radiant", "Vanguard", "Catalyst", "Breeze",
                "Shadow", "Crest", "Thunder", "Glacier", "Voyage", "Haven"
            ]
            var words: [String] = []
            for _ in 0..<Int(genWordsCount) {
                words.append(sampleWords.randomElement() ?? "Key")
            }
            words.append("\(Int.random(in: 10...99))")
            generatedPassword = words.joined(separator: "-")
        }
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
                HStack(spacing: 4) {
                    Text(item.title)
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                    if let tree = DomainTreeService.shared.connectedTree(for: item) {
                        Text(tree.rootBrand)
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(LiquidGlassTheme.primaryAccent)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(LiquidGlassTheme.primaryAccent.opacity(0.15))
                            .clipShape(Capsule())
                    }
                }
                Text(item.displaySubtitle)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 4) {
                if let totp = item.totpSecret, !totp.isEmpty {
                    MiniTOTPRowView(secret: totp)
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
    var onCopyUrl: ((String) -> Void)? = nil
    var onOpenInApp: (() -> Void)? = nil

    @State private var isHovered: Bool = false
    @State private var isPasswordRevealed: Bool = false

    private var isPassCopied: Bool { copiedFeedback == "pass_\(item.id)" }
    private var isUserCopied: Bool { copiedFeedback == "user_\(item.id)" }
    private var isTotpCopied: Bool { copiedFeedback == "totp_\(item.id)" }
    private var isUrlCopied: Bool { copiedFeedback == "url_\(item.id)" }

    public var body: some View {
        VStack(spacing: 0) {
            headerRow
                .onTapGesture(perform: onSelect)
                .onHover { isHovered = $0 }

            if isSelected {
                expandedDetailCard
            }
        }
    }

    private var headerRow: some View {
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
                Text(item.displaySubtitle)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Quick Action Copy Buttons
            HStack(spacing: 4) {
                if item.totpSecret != nil {
                    Button(action: onCopyTotp) {
                        Image(systemName: isTotpCopied ? "checkmark" : "timer")
                            .font(.system(size: 10))
                            .foregroundColor(isTotpCopied ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.emeraldAccent.opacity(0.8))
                            .padding(4)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                    .buttonStyle(.plain)
                    .help("Copy 2FA TOTP Token")
                }

                if item.displayAccountName != nil {
                    Button(action: onCopyUsername) {
                        Image(systemName: isUserCopied ? "checkmark" : "person.fill")
                            .font(.system(size: 10))
                            .foregroundColor(isUserCopied ? LiquidGlassTheme.emeraldAccent : .secondary)
                            .padding(4)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                    .buttonStyle(.plain)
                    .help("Copy Username / Name / Email")
                }

                if item.password != nil {
                    Button(action: onCopyPassword) {
                        Image(systemName: isPassCopied ? "checkmark" : "key.fill")
                            .font(.system(size: 10))
                            .foregroundColor(isPassCopied ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.primaryAccent)
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
    }

    private var expandedDetailCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider().opacity(0.12)
                .padding(.vertical, 2)

            accountSection
            passwordSection

            if let firstUrl = item.urls.first, !firstUrl.isEmpty {
                websiteSection(url: firstUrl)
            }

            if let totp = item.totpSecret, !totp.isEmpty {
                totpSection(secret: totp)
            }

            if let notes = item.notes, !notes.isEmpty {
                notesSection(notes: notes)
            }

            openInAppFooter
        }
        .padding(10)
        .background(Color.black.opacity(0.28))
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .stroke(LiquidGlassTheme.primaryAccent.opacity(0.25), lineWidth: 1)
        )
        .padding(.top, 4)
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("USERNAME / ACCOUNT")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.secondary)

            let usernameValue = item.displayAccountName

            HStack(spacing: 6) {
                Image(systemName: "person.fill")
                    .font(.system(size: 10))
                    .foregroundColor(usernameValue != nil ? LiquidGlassTheme.primaryAccent : .secondary.opacity(0.5))

                if let u = usernameValue, !u.isEmpty {
                    Text(u)
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(.primary)
                        .textSelection(.enabled)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Button(action: onCopyUsername) {
                        HStack(spacing: 3) {
                            Image(systemName: isUserCopied ? "checkmark" : "doc.on.doc")
                            if isUserCopied {
                                Text("Copied").font(.system(size: 9.5, weight: .bold))
                            }
                        }
                        .font(.system(size: 10))
                        .foregroundColor(isUserCopied ? LiquidGlassTheme.emeraldAccent : .secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3.5)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                    .help("Copy Username")
                } else {
                    Text("No username saved")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary.opacity(0.6))
                        .italic()
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(8)
            .background(Color.black.opacity(0.25))
            .clipShape(RoundedRectangle(cornerRadius: 7))
        }
    }

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("PASSWORD")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.secondary)

            HStack(spacing: 6) {
                Image(systemName: "key.fill")
                    .font(.system(size: 10))
                    .foregroundColor(item.password != nil ? LiquidGlassTheme.primaryAccent : .secondary.opacity(0.5))

                if let p = item.password, !p.isEmpty {
                    if isPasswordRevealed {
                        Text(p)
                            .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                            .foregroundColor(.primary)
                            .textSelection(.enabled)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Text(String(repeating: "•", count: min(16, max(8, p.count))))
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.primary.opacity(0.8))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            isPasswordRevealed.toggle()
                        }
                    }) {
                        Image(systemName: isPasswordRevealed ? "eye.slash" : "eye")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                            .padding(4)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                    .help(isPasswordRevealed ? "Hide Password" : "Show Password")

                    Button(action: onCopyPassword) {
                        HStack(spacing: 3) {
                            Image(systemName: isPassCopied ? "checkmark" : "doc.on.doc")
                            if isPassCopied {
                                Text("Copied").font(.system(size: 9.5, weight: .bold))
                            }
                        }
                        .font(.system(size: 10))
                        .foregroundColor(isPassCopied ? LiquidGlassTheme.emeraldAccent : .secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3.5)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                    .help("Copy Password")
                } else if let oauth = item.oauth {
                    Text("Signed in with \(oauth.providerDisplayName)")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Text("No password saved")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary.opacity(0.6))
                        .italic()
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(8)
            .background(Color.black.opacity(0.25))
            .clipShape(RoundedRectangle(cornerRadius: 7))
        }
    }

    private func websiteSection(url: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("WEBSITE")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.secondary)

            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.system(size: 10))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)

                Text(url)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button(action: {
                    let target = url.hasPrefix("http://") || url.hasPrefix("https://") ? url : "https://\(url)"
                    if let u = URL(string: target) {
                        NSWorkspace.shared.open(u)
                    }
                }) {
                    Image(systemName: "arrow.up.right.square")
                        .font(.system(size: 10))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                        .padding(4)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 5))
                }
                .buttonStyle(.plain)
                .help("Open in Browser")

                Button(action: { onCopyUrl?(url) }) {
                    HStack(spacing: 3) {
                        Image(systemName: isUrlCopied ? "checkmark" : "doc.on.doc")
                        if isUrlCopied {
                            Text("Copied").font(.system(size: 9.5, weight: .bold))
                        }
                    }
                    .font(.system(size: 10))
                    .foregroundColor(isUrlCopied ? LiquidGlassTheme.emeraldAccent : .secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3.5)
                    .background(Color.white.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                }
                .buttonStyle(.plain)
                .help("Copy Website URL")
            }
            .padding(8)
            .background(Color.black.opacity(0.25))
            .clipShape(RoundedRectangle(cornerRadius: 7))
        }
    }

    private func totpSection(secret: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("TWO-FACTOR AUTHENTICATOR")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.secondary)

            TOTPRingView(secret: secret)
        }
    }

    private func notesSection(notes: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("NOTES")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.secondary)

            Text(notes)
                .font(.system(size: 10.5))
                .foregroundColor(.secondary)
                .textSelection(.enabled)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 7))
        }
    }

    private var openInAppFooter: some View {
        HStack {
            Spacer()
            Button(action: { onOpenInApp?() }) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.forward.app")
                        .font(.system(size: 10))
                    Text("Open in Kloak App")
                        .font(.system(size: 10.5, weight: .medium))
                }
                .foregroundColor(LiquidGlassTheme.primaryAccent)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(LiquidGlassTheme.primaryAccent.opacity(0.12))
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(LiquidGlassTheme.primaryAccent.opacity(0.3), lineWidth: 0.75)
                )
            }
            .buttonStyle(.plain)
            .help("Open and edit this item in the main Kloak window")
        }
        .padding(.top, 2)
    }
}
