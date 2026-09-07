import SwiftUI

public struct OnboardingAccountConnectSheet: View {
    let provider: CloudProvider
    @Binding var connection: OnboardingAccountConnection
    var onSave: (OnboardingAccountConnection) -> Void
    var onCancel: () -> Void

    @State private var email: String = ""
    @State private var tokenOrPass: String = ""
    @State private var showSecret: Bool = false
    @State private var syncLogins: Bool = true
    @State private var syncAliases: Bool = true
    @State private var enableThreatShield: Bool = true
    @State private var isAuthenticating: Bool = false
    @State private var errorMessage: String? = nil
    @State private var successPulse: Bool = false

    public init(
        provider: CloudProvider,
        connection: Binding<OnboardingAccountConnection>,
        onSave: @escaping (OnboardingAccountConnection) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.provider = provider
        self._connection = connection
        self.onSave = onSave
        self.onCancel = onCancel
    }

    private var defaultDomain: String {
        switch provider {
        case .google: return "@gmail.com"
        case .proton: return "@proton.me"
        case .microsoft: return "@outlook.com"
        }
    }

    public var body: some View {
        GlassEffectContainer {
            VStack(spacing: 20) {
                // Header with Provider Badge
                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(provider.accentColor.opacity(0.18))
                            .frame(width: 48, height: 48)

                        Image(systemName: provider.iconName)
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundColor(provider.accentColor)
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text("Connect \(provider.displayName) Account")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(.primary)

                        Text(provider.description)
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }

                    Spacer()
                }
                .padding(.horizontal, 4)

                Divider().opacity(0.15)

                // Form Inputs
                VStack(alignment: .leading, spacing: 14) {
                    // Email input
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(provider.displayName.uppercased()) EMAIL / USERNAME")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.secondary)

                        HStack(spacing: 8) {
                            Image(systemName: "envelope.fill")
                                .font(.system(size: 12))
                                .foregroundColor(provider.accentColor)

                            TextField("e.g. user\(defaultDomain)", text: $email)
                                .textFieldStyle(.plain)
                                .font(.system(size: 13))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.black.opacity(0.35))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.white.opacity(0.15), lineWidth: 1)
                                )
                        )
                    }

                    // Password / Auth Token input
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(provider == .proton ? "APP PASSWORD / BRIDGE KEY" : "APP PASSWORD / AUTH TOKEN")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("Optional")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary.opacity(0.8))
                        }

                        HStack(spacing: 8) {
                            Image(systemName: "key.fill")
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)

                            if showSecret {
                                TextField("App Password or Token", text: $tokenOrPass)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13))
                            } else {
                                SecureField("App Password or Token", text: $tokenOrPass)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13))
                            }

                            Button(action: { showSecret.toggle() }) {
                                Image(systemName: showSecret ? "eye.slash" : "eye")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.black.opacity(0.35))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.white.opacity(0.15), lineWidth: 1)
                                )
                        )
                    }

                    // Feature Toggles
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ACCOUNT INTEGRATION OPTIONS")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.secondary)
                            .padding(.top, 4)

                        Toggle(isOn: $syncLogins) {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .font(.system(size: 11))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                Text("Sync and import existing credentials")
                                    .font(.system(size: 12))
                            }
                        }
                        .toggleStyle(.checkbox)

                        Toggle(isOn: $syncAliases) {
                            HStack(spacing: 6) {
                                Image(systemName: "envelope.badge.shield.half.filled.fill")
                                    .font(.system(size: 11))
                                    .foregroundColor(LiquidGlassTheme.tealAccent)
                                Text("Enable disposable email forwarding aliases")
                                    .font(.system(size: 12))
                            }
                        }
                        .toggleStyle(.checkbox)

                        Toggle(isOn: $enableThreatShield) {
                            HStack(spacing: 6) {
                                Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                                    .font(.system(size: 11))
                                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                Text("Protect with Kloak AI Phishing Shield")
                                    .font(.system(size: 12))
                            }
                        }
                        .toggleStyle(.checkbox)
                    }
                }

                if let err = errorMessage {
                    Text(err)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(LiquidGlassTheme.roseAccent)
                        .multilineTextAlignment(.center)
                }

                // Action Buttons
                HStack(spacing: 12) {
                    Button("Cancel", action: onCancel)
                        .buttonStyle(GlassCapsuleButton(isPrimary: false))

                    Button(action: handleConnect) {
                        if isAuthenticating {
                            ProgressView()
                                .controlSize(.small)
                                .frame(width: 140)
                        } else {
                            HStack(spacing: 6) {
                                Image(systemName: "link.badge.plus")
                                Text("Connect \(provider.displayName)")
                            }
                            .frame(width: 160)
                        }
                    }
                    .buttonStyle(GlassCapsuleButton(isPrimary: true))
                    .disabled(email.trimmingCharacters(in: .whitespaces).isEmpty || isAuthenticating)
                }
                .padding(.top, 8)
            }
            .padding(24)
            .frame(width: 440)
            .onAppear {
                email = connection.email
                tokenOrPass = connection.token ?? ""
                syncLogins = connection.syncLogins
                syncAliases = connection.syncAliases
                enableThreatShield = connection.enableThreatShield
            }
        }
    }

    private func handleConnect() {
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard !trimmedEmail.isEmpty else {
            errorMessage = "Please enter an email address."
            return
        }

        if !trimmedEmail.contains("@") {
            errorMessage = "Please enter a valid email address."
            return
        }

        isAuthenticating = true
        errorMessage = nil

        // Simulate fast secure verification
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            isAuthenticating = false
            var updated = connection
            updated.isConnected = true
            updated.email = trimmedEmail
            updated.token = tokenOrPass.isEmpty ? nil : tokenOrPass
            updated.syncLogins = syncLogins
            updated.syncAliases = syncAliases
            updated.enableThreatShield = enableThreatShield

            onSave(updated)
        }
    }
}
