import SwiftUI

public struct UnlockView: View {
    @Binding var isUnlocked: Bool
    var onUnlock: (String) async -> Bool
    var onBiometricUnlock: () async -> Bool

    @State private var password: String = ""
    @State private var errorMessage: String?
    @State private var isProcessing: Bool = false
    @State private var pulseGlow: Bool = false

    @FocusState private var isPasswordFocused: Bool
    @State private var showPassword: Bool = false

    public init(
        isUnlocked: Binding<Bool>,
        onUnlock: @escaping (String) async -> Bool,
        onBiometricUnlock: @escaping () async -> Bool
    ) {
        self._isUnlocked = isUnlocked
        self.onUnlock = onUnlock
        self.onBiometricUnlock = onBiometricUnlock
    }

    public var body: some View {
        GlassEffectContainer {
            VStack(spacing: 20) {
                // Official Kloak App Icon with Liquid Halo
                KloakLogoView(size: 76, glow: pulseGlow)
                    .scaleEffect(pulseGlow ? 1.05 : 0.98)
                    .animation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true), value: pulseGlow)
                    .onAppear {
                        pulseGlow = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            isPasswordFocused = true
                        }
                    }

                Text("Kloak")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)

                // Password Entry Glass Panel
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        if showPassword {
                            TextField("Master Password", text: $password)
                                .textFieldStyle(.plain)
                                .font(.system(size: 14))
                                .focused($isPasswordFocused)
                        } else {
                            SecureField("Master Password", text: $password)
                                .textFieldStyle(.plain)
                                .font(.system(size: 14))
                                .focused($isPasswordFocused)
                        }

                        Button(action: { showPassword.toggle() }) {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.black.opacity(0.35))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(isPasswordFocused ? LiquidGlassTheme.primaryAccent : Color.white.opacity(0.15), lineWidth: 1)
                            )
                    )
                    .frame(width: 280)
                    .onSubmit(attemptUnlock)
                    .onChange(of: password) { _, _ in
                        if errorMessage != nil { errorMessage = nil }
                    }

                    HStack(spacing: 8) {
                        Button(action: attemptUnlock) {
                            HStack(spacing: 6) {
                                if isProcessing {
                                    ProgressView()
                                        .controlSize(.small)
                                } else {
                                    Image(systemName: "lock.open.fill")
                                    Text("Unlock")
                                }
                            }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 38)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(
                                        LinearGradient(
                                            colors: [LiquidGlassTheme.primaryAccent, Color.blue],
                                            startPoint: .top,
                                            endPoint: .bottom
                                        )
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .stroke(Color.white.opacity(0.3), lineWidth: 0.75)
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(password.isEmpty || isProcessing)
                        .opacity(password.isEmpty || isProcessing ? 0.6 : 1.0)

                        if BiometricAuth.shared.canAuthenticateWithBiometrics() {
                            Button(action: attemptBiometricUnlock) {
                                Image(systemName: "touchid")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                    .frame(width: 44, height: 38)
                                    .background(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .fill(Color.white.opacity(0.08))
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                    .stroke(Color.white.opacity(0.15), lineWidth: 0.75)
                                            )
                                    )
                            }
                            .buttonStyle(.plain)
                            .disabled(isProcessing)
                            .help("Unlock with Touch ID")
                        }

                        if VaultStore.shared.settings.hardwareKeyEnabled {
                            Button(action: attemptHardwareKeyUnlock) {
                                Image(systemName: "key.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                    .frame(width: 44, height: 38)
                                    .background(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .fill(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                    .stroke(LiquidGlassTheme.emeraldAccent.opacity(0.3), lineWidth: 0.75)
                                            )
                                    )
                            }
                            .buttonStyle(.plain)
                            .disabled(isProcessing)
                            .help("Unlock with Hardware Security Key")
                        }
                    }
                    .frame(width: 280)

                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(LiquidGlassTheme.roseAccent)
                            .multilineTextAlignment(.center)
                            .padding(.top, 2)
                            .transition(.opacity)
                    }
                }
                .padding(18)
                .glassEffect(cornerRadius: 20)

                Button(action: { DevModeManager.shared.showSheet = true }) {
                    HStack(spacing: 5) {
                        Image(systemName: "terminal")
                            .font(.system(size: 11))
                        Text("Dev Mode")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundColor(LiquidGlassTheme.primaryAccent.opacity(0.65))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
                .help("Developer Mode (Immutable Password Required)")
            }
            .padding(32)
        }
        .frame(minWidth: 440, minHeight: 450)
    }

    private func attemptUnlock() {
        guard !password.isEmpty && !isProcessing else { return }
        isProcessing = true
        errorMessage = nil

        Task {
            let success = await onUnlock(password)
            isProcessing = false
            if success {
                isUnlocked = true
            } else {
                errorMessage = "Incorrect master password."
            }
        }
    }

    private func attemptBiometricUnlock() {
        guard !isProcessing else { return }
        isProcessing = true
        errorMessage = nil

        Task {
            let success = await onBiometricUnlock()
            isProcessing = false
            if success {
                isUnlocked = true
            } else {
                if let err = VaultStore.shared.lastError {
                    errorMessage = err
                } else {
                    errorMessage = "Touch ID authentication failed."
                }
            }
        }
    }

    private func attemptHardwareKeyUnlock() {
        guard !isProcessing else { return }
        isProcessing = true
        errorMessage = nil

        Task {
            let connected = HardwareSecurityKeyService.shared.getConnectedKeys()
            if connected.isEmpty {
                isProcessing = false
                errorMessage = "No hardware security key detected on USB or NFC."
                return
            }
            let success = await onBiometricUnlock() || VaultStore.shared.isUnlocked
            isProcessing = false
            if success || VaultStore.shared.isUnlocked {
                isUnlocked = true
            } else {
                errorMessage = "Hardware security key verification failed."
            }
        }
    }
}
