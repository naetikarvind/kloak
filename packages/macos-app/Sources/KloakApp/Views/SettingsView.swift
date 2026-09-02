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
                        Text("Connect your primary Google, Microsoft, or Proton account. When Kloak detects a malicious, unverified, or phishing website, it automatically generates a custom disposable email alias that safely forwards to your inbox.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)

                        // Provider Selection Pills
                        VStack(alignment: .leading, spacing: 6) {
                            Text("CONNECTED EMAIL PROVIDER")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            HStack(spacing: 8) {
                                ForEach(["google", "microsoft", "proton", "custom"], id: \.self) { prov in
                                    Button(action: {
                                        settings.connectedAccountProvider = prov
                                        onSaveSettings(settings)
                                    }) {
                                        HStack(spacing: 5) {
                                            Image(systemName: prov == "google" ? "g.circle.fill" : prov == "microsoft" ? "m.circle.fill" : prov == "proton" ? "lock.shield.fill" : "envelope.fill")
                                                .font(.system(size: 11))
                                            Text(prov == "google" ? "Google" : prov == "microsoft" ? "Microsoft" : prov == "proton" ? "Proton" : "Custom")
                                                .font(.system(size: 11, weight: .semibold))
                                        }
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(
                                            (settings.connectedAccountProvider ?? "google") == prov
                                                ? LiquidGlassTheme.primaryAccent
                                                : Color.white.opacity(0.08)
                                        )
                                        .foregroundColor(
                                            (settings.connectedAccountProvider ?? "google") == prov
                                                ? .white
                                                : .secondary
                                        )
                                        .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        // Connected Account Email
                        VStack(alignment: .leading, spacing: 6) {
                            Text("FORWARDING DESTINATION EMAIL")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            HStack {
                                Image(systemName: "envelope.badge.shield.half.filled.fill")
                                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                TextField("e.g. user@gmail.com, user@outlook.com", text: Binding(
                                    get: { settings.connectedAccountEmail ?? "" },
                                    set: { settings.connectedAccountEmail = $0; onSaveSettings(settings) }
                                ))
                                .textFieldStyle(.plain)
                                .font(.system(size: 12))
                            }
                            .padding(8)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }

                        Divider().opacity(0.15)

                        Toggle("Malicious Website & Phishing Shield", isOn: $settings.maliciousSiteShieldEnabled)
                            .onChange(of: settings.maliciousSiteShieldEnabled) { _, _ in onSaveSettings(settings) }

                        Toggle("Auto-Suggest Masked Email on Untrusted Pages", isOn: $settings.autoMaskUntrustedSites)
                            .onChange(of: settings.autoMaskUntrustedSites) { _, _ in onSaveSettings(settings) }

                        HStack(spacing: 8) {
                            Circle()
                                .fill(settings.maliciousSiteShieldEnabled ? LiquidGlassTheme.emeraldAccent : Color.gray)
                                .frame(width: 8, height: 8)
                            Text(settings.maliciousSiteShieldEnabled
                                ? "Threat Shield Active • Aliases forward to \(settings.connectedAccountEmail ?? "connected email")"
                                : "Threat Shield Paused")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(settings.maliciousSiteShieldEnabled ? LiquidGlassTheme.emeraldAccent : .secondary)
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
