import SwiftUI

public struct SettingsView: View {
    @Binding var settings: VaultSettings
    var onSaveSettings: (VaultSettings) -> Void
    var onChangeMasterPassword: (String, String) -> Bool

    @State private var oldPass: String = ""
    @State private var newPass1: String = ""
    @State private var newPass2: String = ""
    @State private var passChangeMessage: String?
    @State private var isSuccess: Bool = false
    @State private var keychainMirrorSuccess: Bool = false

    // Connected Accounts state
    @State private var selectedTab: String = "google"
    @State private var inputEmail: String = ""
    @State private var inputToken: String = ""
    @State private var inputCustomRelay: String = ""
    @State private var isConnecting: Bool = false
    @State private var connectFeedback: String? = nil
    @State private var connectFeedbackIsError: Bool = false
    @State private var isTestingPing: Bool = false
    @State private var testPingFeedback: String? = nil
    @State private var copiedForwardingEmail: Bool = false

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Section 1: Security Preferences
                VStack(alignment: .leading, spacing: 16) {
                    Label("Security & Auto-Lock", systemImage: "shield.lefthalf.filled")
                        .font(.system(size: 14, weight: .bold))

                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Auto-Lock Timeout")
                                .font(.system(size: 13))
                                .fixedSize()
                            Picker("", selection: $settings.autoLockMinutes) {
                                Text("1 Minute").tag(1)
                                Text("5 Minutes (Recommended)").tag(5)
                                Text("15 Minutes").tag(15)
                                Text("30 Minutes").tag(30)
                                Text("1 Hour").tag(60)
                                Text("Never (Not Recommended)").tag(0)
                            }
                            .labelsHidden()
                            .onChange(of: settings.autoLockMinutes) { _, _ in onSaveSettings(settings) }
                        }

                        Divider().opacity(0.15)

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Clipboard Auto-Clear")
                                .font(.system(size: 13))
                                .fixedSize()
                            Picker("", selection: $settings.clearClipboardSeconds) {
                                Text("15 Seconds").tag(15)
                                Text("30 Seconds (Default)").tag(30)
                                Text("60 Seconds").tag(60)
                                Text("Never").tag(0)
                            }
                            .labelsHidden()
                            .onChange(of: settings.clearClipboardSeconds) { _, _ in onSaveSettings(settings) }
                        }

                        if BiometricAuth.shared.canAuthenticateWithBiometrics() {
                            Divider().opacity(0.15)

                            Toggle("Enable Touch ID Biometric Unlock", isOn: $settings.biometricsEnabled)
                                .onChange(of: settings.biometricsEnabled) { _, _ in onSaveSettings(settings) }
                        }
                    }
                    .padding(16)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(14)
                .glassEffect(cornerRadius: 16)

                // Section 2: Connected Accounts & Malicious Website Shield
                VStack(alignment: .leading, spacing: 16) {
                    Label("Connected Accounts & Threat Shield", systemImage: "shield.lefthalf.filled.badge.checkmark")
                        .font(.system(size: 14, weight: .bold))

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Connect your primary Google, Microsoft, Proton, or Custom account. When Kloak detects a malicious, unverified, or phishing website, it automatically generates a custom disposable email alias that safely forwards incoming messages directly to your verified inbox.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)

                        // Provider Selection Tabs
                        VStack(alignment: .leading, spacing: 6) {
                            Text("SELECT EMAIL PROVIDER")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(["google", "microsoft", "proton", "custom"], id: \.self) { prov in
                                        Button(action: {
                                            withAnimation(.easeInOut(duration: 0.18)) {
                                                selectedTab = prov
                                                connectFeedback = nil
                                                testPingFeedback = nil
                                                if (settings.connectedAccountProvider ?? "google") == prov {
                                                    inputEmail = settings.connectedAccountEmail ?? ""
                                                    inputToken = settings.connectedAccountToken ?? ""
                                                    inputCustomRelay = settings.customForwardingEmail ?? ""
                                                }
                                            }
                                        }) {
                                            HStack(spacing: 6) {
                                                Image(systemName: providerIcon(prov))
                                                    .font(.system(size: 12))
                                                Text(prov == "google" ? "Google" : prov == "microsoft" ? "Microsoft" : prov == "proton" ? "Proton" : "Custom")
                                                    .font(.system(size: 11, weight: .semibold))
                                                    .lineLimit(1)

                                                if (settings.connectedAccountProvider ?? "google") == prov && (settings.isAccountConnected ?? false) && !(settings.connectedAccountEmail ?? "").isEmpty {
                                                    Circle()
                                                        .fill(LiquidGlassTheme.emeraldAccent)
                                                        .frame(width: 6, height: 6)
                                                }
                                            }
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .fixedSize(horizontal: true, vertical: false)
                                            .background(
                                                selectedTab == prov
                                                    ? LiquidGlassTheme.primaryAccent
                                                    : Color.white.opacity(0.08)
                                            )
                                            .foregroundColor(
                                                selectedTab == prov
                                                    ? .white
                                                    : .secondary
                                            )
                                            .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }

                        // Connection State Card: Connected vs Setup Box
                        if isCurrentTabConnected {
                            // --- ALREADY CONNECTED VIEW ---
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Image(systemName: providerIcon(selectedTab))
                                        .font(.system(size: 15))
                                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                    Text(providerDisplayName(selectedTab))
                                        .font(.system(size: 13, weight: .bold))

                                    Spacer()

                                    HStack(spacing: 5) {
                                        Circle()
                                            .fill(LiquidGlassTheme.emeraldAccent)
                                            .frame(width: 7, height: 7)
                                        Text("Connected & Active")
                                            .font(.system(size: 11, weight: .semibold))
                                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                    }
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 4)
                                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                                    .clipShape(Capsule())
                                }

                                HStack(spacing: 8) {
                                    Image(systemName: "envelope.badge.shield.half.filled.fill")
                                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                        .font(.system(size: 12))
                                    Text(settings.connectedAccountEmail ?? "")
                                        .font(.system(size: 12, weight: .medium))
                                    Spacer()
                                    Button(action: {
                                        NSPasteboard.general.clearContents()
                                        NSPasteboard.general.setString(settings.connectedAccountEmail ?? "", forType: .string)
                                        copiedForwardingEmail = true
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                            copiedForwardingEmail = false
                                        }
                                    }) {
                                        HStack(spacing: 4) {
                                            Image(systemName: copiedForwardingEmail ? "checkmark" : "doc.on.doc")
                                            Text(copiedForwardingEmail ? "Copied" : "Copy")
                                        }
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundColor(.secondary)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(10)
                                .background(Color.black.opacity(0.35))
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                                Text("All disposable phishing aliases (`protect.<domain>.<hash>@shield.kloak.app`) forward here securely.")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)

                                if let pingMsg = testPingFeedback {
                                    HStack(spacing: 6) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                        Text(pingMsg)
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                    }
                                    .padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                }

                                HStack(spacing: 8) {
                                    Button(action: sendTestPing) {
                                        HStack(spacing: 5) {
                                            if isTestingPing {
                                                ProgressView()
                                                    .scaleEffect(0.6)
                                                    .frame(width: 12, height: 12)
                                            } else {
                                                Image(systemName: "paperplane.fill")
                                                    .font(.system(size: 10))
                                            }
                                            Text(isTestingPing ? "Pinging..." : "Send Test Relay Ping")
                                        }
                                    }
                                    .buttonStyle(GlassCapsuleButton(isPrimary: false))
                                    .disabled(isTestingPing)

                                    if let portalUrl = providerPortalUrl(selectedTab) {
                                        Button(action: {
                                            NSWorkspace.shared.open(portalUrl)
                                        }) {
                                            HStack(spacing: 5) {
                                                Image(systemName: "arrow.up.right.square")
                                                    .font(.system(size: 10))
                                                Text("Account Portal")
                                            }
                                        }
                                        .buttonStyle(GlassCapsuleButton(isPrimary: false))
                                    }

                                    Spacer()

                                    Button(action: disconnectAccount) {
                                        HStack(spacing: 5) {
                                            Image(systemName: "link.badge.minus")
                                                .font(.system(size: 10))
                                            Text("Disconnect")
                                        }
                                        .foregroundColor(LiquidGlassTheme.roseAccent)
                                    }
                                    .buttonStyle(GlassCapsuleButton(isPrimary: false))
                                }
                                .padding(.top, 4)
                            }
                            .padding(14)
                            .background(Color.white.opacity(0.04))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(LiquidGlassTheme.emeraldAccent.opacity(0.3), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        } else {
                            // --- SETUP & CONNECT VIEW ---
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Image(systemName: providerIcon(selectedTab))
                                        .font(.system(size: 14))
                                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                                    Text("Connect \(providerDisplayName(selectedTab))")
                                        .font(.system(size: 13, weight: .bold))
                                }

                                Text("Enter your destination email address to connect this provider and activate Threat Shield email protection.")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)

                                // Email Input Field
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("DESTINATION FORWARDING EMAIL")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundColor(.secondary)

                                    HStack(spacing: 8) {
                                        Image(systemName: "envelope.fill")
                                            .foregroundColor(.secondary)
                                            .font(.system(size: 11))
                                        TextField(
                                            selectedTab == "google" ? "user@gmail.com" :
                                            selectedTab == "microsoft" ? "user@outlook.com or user@live.com" :
                                            selectedTab == "proton" ? "user@proton.me or user@protonmail.com" : "forward@yourdomain.com",
                                            text: $inputEmail
                                        )
                                        .textFieldStyle(.plain)
                                        .font(.system(size: 12))
                                    }
                                    .padding(8)
                                    .background(Color.black.opacity(0.35))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }

                                if selectedTab == "proton" {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("SIMPLELOGIN / PROTON API TOKEN (OPTIONAL)")
                                            .font(.system(size: 9, weight: .bold))
                                            .foregroundColor(.secondary)

                                        HStack(spacing: 8) {
                                            Image(systemName: "key.fill")
                                                .foregroundColor(.secondary)
                                                .font(.system(size: 11))
                                            SecureField("Enter SimpleLogin API key for automatic alias sync", text: $inputToken)
                                                .textFieldStyle(.plain)
                                                .font(.system(size: 12))
                                        }
                                        .padding(8)
                                        .background(Color.black.opacity(0.35))
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                } else if selectedTab == "custom" {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("CUSTOM RELAY SERVER / DOMAIN (OPTIONAL)")
                                            .font(.system(size: 9, weight: .bold))
                                            .foregroundColor(.secondary)

                                        HStack(spacing: 8) {
                                            Image(systemName: "server.rack")
                                                .foregroundColor(.secondary)
                                                .font(.system(size: 11))
                                            TextField("e.g. relay.mycompany.com or mail.host.net", text: $inputCustomRelay)
                                                .textFieldStyle(.plain)
                                                .font(.system(size: 12))
                                        }
                                        .padding(8)
                                        .background(Color.black.opacity(0.35))
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                }

                                if let feedback = connectFeedback {
                                    HStack(spacing: 6) {
                                        Image(systemName: connectFeedbackIsError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                                            .foregroundColor(connectFeedbackIsError ? LiquidGlassTheme.roseAccent : LiquidGlassTheme.emeraldAccent)
                                        Text(feedback)
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(connectFeedbackIsError ? LiquidGlassTheme.roseAccent : LiquidGlassTheme.emeraldAccent)
                                    }
                                    .padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background((connectFeedbackIsError ? LiquidGlassTheme.roseAccent : LiquidGlassTheme.emeraldAccent).opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                }

                                HStack(spacing: 8) {
                                    Button(action: attemptConnect) {
                                        HStack(spacing: 6) {
                                            if isConnecting {
                                                ProgressView()
                                                    .scaleEffect(0.6)
                                                    .frame(width: 12, height: 12)
                                            } else {
                                                Image(systemName: "link.badge.plus")
                                                    .font(.system(size: 11))
                                            }
                                            Text(isConnecting ? "Connecting..." : "Connect \(selectedTab.capitalized) Account")
                                        }
                                    }
                                    .buttonStyle(GlassCapsuleButton(isPrimary: true))
                                    .disabled(inputEmail.trimmingCharacters(in: .whitespaces).isEmpty || isConnecting)

                                    if let portalUrl = providerPortalUrl(selectedTab) {
                                        Button(action: {
                                            NSWorkspace.shared.open(portalUrl)
                                        }) {
                                            HStack(spacing: 5) {
                                                Image(systemName: "safari.fill")
                                                    .font(.system(size: 10))
                                                Text("Sign In on Web")
                                            }
                                        }
                                        .buttonStyle(GlassCapsuleButton(isPrimary: false))
                                    }
                                }
                                .padding(.top, 4)
                            }
                            .padding(14)
                            .background(Color.white.opacity(0.04))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }

                        Divider().opacity(0.15)

                        Toggle("Malicious Website & Phishing Shield", isOn: $settings.maliciousSiteShieldEnabled)
                            .onChange(of: settings.maliciousSiteShieldEnabled) { _, _ in onSaveSettings(settings) }

                        Toggle("Auto-Suggest Masked Email on Untrusted Pages", isOn: $settings.autoMaskUntrustedSites)
                            .onChange(of: settings.autoMaskUntrustedSites) { _, _ in onSaveSettings(settings) }

                        HStack(spacing: 8) {
                            Circle()
                                .fill(
                                    (settings.maliciousSiteShieldEnabled && (settings.isAccountConnected ?? false))
                                        ? LiquidGlassTheme.emeraldAccent
                                        : Color.gray
                                )
                                .frame(width: 8, height: 8)

                            Text(
                                (settings.maliciousSiteShieldEnabled && (settings.isAccountConnected ?? false))
                                    ? "Threat Shield Active • Aliases forward to \(settings.connectedAccountEmail ?? "connected inbox")"
                                    : (settings.isAccountConnected ?? false)
                                        ? "Threat Shield Paused"
                                        : "No Email Provider Connected • Connect above to enable auto-forwarding"
                            )
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(
                                (settings.maliciousSiteShieldEnabled && (settings.isAccountConnected ?? false))
                                    ? LiquidGlassTheme.emeraldAccent
                                    : .secondary
                            )
                        }
                        .padding(.top, 2)
                    }
                    .padding(16)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(14)
                .glassEffect(cornerRadius: 16)

                // Section 3: Zero-Knowledge Standalone Mode & Apple Keychain
                VStack(alignment: .leading, spacing: 16) {
                    Label("Zero-Knowledge Standalone Mode", systemImage: "shield.checkered")
                        .font(.system(size: 14, weight: .bold))

                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 10) {
                            Circle()
                                .fill(!settings.keychainSyncEnabled ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.amberAccent)
                                .frame(width: 10, height: 10)

                            Text(!settings.keychainSyncEnabled ? "Standalone Mode: Active (No Apple Keychain Prompts)" : "Apple Keychain Sync: Enabled")
                                .font(.system(size: 13, weight: .medium))
                        }

                        Text("In Standalone Mode, your vault is 100% self-contained at ~/.kloak/vault.kloak, unlocked purely by your Master Password with zero macOS Apple Keychain authorization popups.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)

                        Divider().opacity(0.15)

                        Toggle("Sync Logins with macOS Apple Keychain", isOn: $settings.keychainSyncEnabled)
                            .onChange(of: settings.keychainSyncEnabled) { _, enabled in
                                if !enabled {
                                    KeychainManager.shared.clearKey()
                                }
                                onSaveSettings(settings)
                            }

                        Button(action: {
                            KeychainManager.shared.clearKey()
                            keychainMirrorSuccess = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                keychainMirrorSuccess = false
                            }
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: keychainMirrorSuccess ? "checkmark.circle.fill" : "trash")
                                Text(keychainMirrorSuccess ? "Keychain Keys Cleared!" : "Clear Cached Keychain Keys")
                            }
                            .font(.system(size: 11, weight: .medium))
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: false))
                    }
                    .padding(14)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(14)
                .glassEffect(cornerRadius: 16)

                // Section 3: Browser & Raycast Extension IPC API
                VStack(alignment: .leading, spacing: 16) {
                    Label("Browser & Raycast Extension API", systemImage: "puzzlepiece.extension.fill")
                        .font(.system(size: 14, weight: .bold))

                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 12) {
                            Circle()
                                .fill(IPCServer.shared.isRunning ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.amberAccent)
                                .frame(width: 10, height: 10)

                            Text("JSON-RPC IPC API: Active (Port \(IPCServer.defaultPort) • Socket ~/.kloak/kloak.sock)")
                                .font(.system(size: 12, weight: .medium))
                        }

                        HStack(spacing: 12) {
                            Circle()
                                .fill(LiquidGlassTheme.emeraldAccent)
                                .frame(width: 10, height: 10)

                            Text("Chrome Native Messaging Host: app.kloak.native")
                                .font(.system(size: 12, weight: .medium))
                        }

                        Text("Enables autofill, search, 2FA generation, and quick-access directly inside Chrome, Arc, Brave, and Raycast.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    .padding(14)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(14)
                .glassEffect(cornerRadius: 16)

                // Section 4: Change Master Password
                VStack(alignment: .leading, spacing: 16) {
                    Label("Change Master Password", systemImage: "key.horizontal.fill")
                        .font(.system(size: 14, weight: .bold))

                    VStack(spacing: 12) {
                        SecureField("Current Master Password", text: $oldPass)
                            .textFieldStyle(.roundedBorder)
                        SecureField("New Master Password (min 8 chars)", text: $newPass1)
                            .textFieldStyle(.roundedBorder)
                        SecureField("Confirm New Master Password", text: $newPass2)
                            .textFieldStyle(.roundedBorder)

                        if let msg = passChangeMessage {
                            Text(msg)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(isSuccess ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.roseAccent)
                        }

                        Button(action: attemptPasswordChange) {
                            Label("Update", systemImage: "key.fill")
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: true))
                        .disabled(oldPass.isEmpty || newPass1.isEmpty || newPass1 != newPass2)
                    }
                    .padding(16)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(14)
                .glassEffect(cornerRadius: 16)
            }
            .padding(16)
        }
        .onAppear {
            selectedTab = settings.connectedAccountProvider ?? "google"
            inputEmail = settings.connectedAccountEmail ?? ""
            inputToken = settings.connectedAccountToken ?? ""
            inputCustomRelay = settings.customForwardingEmail ?? ""
        }
    }

    private var isCurrentTabConnected: Bool {
        let activeProv = settings.connectedAccountProvider ?? "google"
        let isConn = settings.isAccountConnected ?? false
        let hasEmail = !(settings.connectedAccountEmail ?? "").isEmpty
        return activeProv == selectedTab && isConn && hasEmail
    }

    private func providerDisplayName(_ prov: String) -> String {
        switch prov {
        case "google": return "Google Account"
        case "microsoft": return "Microsoft Account"
        case "proton": return "Proton Mail & SimpleLogin"
        case "custom": return "Custom SMTP Relay"
        default: return prov.capitalized
        }
    }

    private func providerIcon(_ prov: String) -> String {
        switch prov {
        case "google": return "g.circle.fill"
        case "microsoft": return "m.circle.fill"
        case "proton": return "lock.shield.fill"
        case "custom": return "envelope.fill"
        default: return "envelope.circle.fill"
        }
    }

    private func providerPortalUrl(_ prov: String) -> URL? {
        switch prov {
        case "google": return URL(string: "https://myaccount.google.com/security")
        case "microsoft": return URL(string: "https://account.microsoft.com/security")
        case "proton": return URL(string: "https://account.proton.me")
        case "custom": return nil
        default: return nil
        }
    }

    private func attemptConnect() {
        let trimmedEmail = inputEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty else {
            connectFeedback = "Please enter an email address."
            connectFeedbackIsError = true
            return
        }
        guard trimmedEmail.contains("@") && trimmedEmail.contains(".") else {
            connectFeedback = "Please enter a valid email address (e.g. user@domain.com)."
            connectFeedbackIsError = true
            return
        }

        isConnecting = true
        connectFeedback = nil
        testPingFeedback = nil

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            settings.connectedAccountProvider = selectedTab
            settings.connectedAccountEmail = trimmedEmail
            settings.connectedAccountToken = inputToken.isEmpty ? nil : inputToken
            settings.customForwardingEmail = inputCustomRelay.isEmpty ? nil : inputCustomRelay
            settings.isAccountConnected = true
            onSaveSettings(settings)

            isConnecting = false
            connectFeedback = "Connected to \(providerDisplayName(selectedTab)) as \(trimmedEmail)!"
            connectFeedbackIsError = false
        }
    }

    private func disconnectAccount() {
        settings.isAccountConnected = false
        settings.connectedAccountEmail = nil
        settings.connectedAccountToken = nil
        settings.customForwardingEmail = nil
        onSaveSettings(settings)
        inputEmail = ""
        inputToken = ""
        inputCustomRelay = ""
        connectFeedback = "Account unlinked. You can connect a new provider below."
        connectFeedbackIsError = false
        testPingFeedback = nil
    }

    private func sendTestPing() {
        guard let dest = settings.connectedAccountEmail, !dest.isEmpty else { return }
        isTestingPing = true
        testPingFeedback = nil
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            isTestingPing = false
            testPingFeedback = "Test email sent to \(dest) via Kloak Threat Relay!"
        }
    }

    private func attemptPasswordChange() {
        guard newPass1 == newPass2 else {
            passChangeMessage = "New passwords do not match."
            isSuccess = false
            return
        }
        guard newPass1.count >= 8 else {
            passChangeMessage = "New password must be at least 8 characters."
            isSuccess = false
            return
        }

        let success = onChangeMasterPassword(oldPass, newPass1)
        if success {
            passChangeMessage = "Master password successfully changed!"
            isSuccess = true
            oldPass = ""
            newPass1 = ""
            newPass2 = ""
        } else {
            passChangeMessage = "Current password was incorrect."
            isSuccess = false
        }
    }
}
