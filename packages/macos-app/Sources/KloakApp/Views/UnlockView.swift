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
            VStack(spacing: 28) {
                // Official Kloak App Icon with Liquid Halo
                KloakLogoView(size: 88, glow: pulseGlow)
                    .scaleEffect(pulseGlow ? 1.05 : 0.98)
                    .animation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true), value: pulseGlow)
                    .onAppear {
                        pulseGlow = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            isPasswordFocused = true
                        }
                    }

                VStack(spacing: 8) {
                    Text("Kloak")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)

                    Text("Zero-Knowledge • Local-First")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.secondary)
                }

                // Password Entry Glass Panel
                VStack(spacing: 16) {
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
                    .padding(.vertical, 12)
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

                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(LiquidGlassTheme.roseAccent)
                            .transition(.opacity)
                    }

                    HStack(spacing: 12) {
                        Button(action: attemptUnlock) {
                            if isProcessing {
                                ProgressView()
                                    .controlSize(.small)
                                    .frame(maxWidth: .infinity)
                            } else {
                                Label("Unlock", systemImage: "lock.open.fill")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: true))
                        .frame(width: 180)
                        .disabled(password.isEmpty || isProcessing)

                        if BiometricAuth.shared.canAuthenticateWithBiometrics() {
                            Button(action: attemptBiometricUnlock) {
                                Image(systemName: "touchid")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                    .frame(width: 40, height: 36)
                            }
                            .buttonStyle(GlassCapsuleButton(isPrimary: false))
                            .disabled(isProcessing)
                            .help("Unlock with Touch ID")
                        }
                    }
                }
                .padding(24)
                .glassEffect(cornerRadius: 20)
            }
            .padding(40)
        }
        .frame(minWidth: 460, minHeight: 480)
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
}
