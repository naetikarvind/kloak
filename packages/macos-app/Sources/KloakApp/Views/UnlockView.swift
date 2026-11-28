import SwiftUI
import AppKit

private struct UnlockGlassBackdrop: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .popover
        view.blendingMode = .withinWindow
        view.state = .active
        view.appearance = NSAppearance(named: .darkAqua)
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = .popover
        nsView.blendingMode = .withinWindow
        nsView.state = .active
    }
}

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

    private let islandCornerRadius: CGFloat = 30

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
            ZStack {
                // Soft ambient aurora positioned around the lower half so the glass fade pops visibly
                VStack {
                    Spacer()
                    HStack(spacing: 36) {
                        Circle()
                            .fill(LiquidGlassTheme.purpleAccent.opacity(0.26))
                            .frame(width: 210, height: 210)
                            .blur(radius: 65)

                        Circle()
                            .fill(LiquidGlassTheme.primaryAccent.opacity(0.22))
                            .frame(width: 190, height: 190)
                            .blur(radius: 65)
                    }
                    .offset(y: -30)
                    Spacer()
                }
                .ignoresSafeArea()

                ZStack {
                    UnlockGlassBackdrop()

                    // Seamless linear fade from pure OLED Black above down into clear frosted glass below
                    LinearGradient(
                        stops: [
                            .init(color: .black, location: 0.0),
                            .init(color: .black, location: 0.50),
                            .init(color: Color.black.opacity(0.06), location: 1.0)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )

                    VStack(spacing: 16) {
                        // Top Dynamic Island Crown Header (no divider cut)
                        VStack(spacing: 10) {
                            Capsule()
                                .fill(Color.white.opacity(0.16))
                                .frame(width: 42, height: 3.5)
                                .padding(.top, 9)

                            HStack(spacing: 13) {
                                KloakLogoView(size: 50, glow: pulseGlow)
                                    .scaleEffect(pulseGlow ? 1.03 : 0.98)
                                    .animation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true), value: pulseGlow)

                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Kloak")
                                        .font(.system(size: 20, weight: .bold, design: .rounded))
                                        .foregroundColor(.white)

                                    HStack(spacing: 6) {
                                        Circle()
                                            .fill(VaultStore.shared.settings.hardwareKeyEnabled
                                                  ? LiquidGlassTheme.emeraldAccent
                                                  : LiquidGlassTheme.primaryAccent)
                                            .frame(width: 6, height: 6)

                                        Text(statusSubtitle)
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(Color.white.opacity(0.62))
                                            .lineLimit(1)
                                    }
                                }

                                Spacer()

                                HStack(spacing: 4) {
                                    Image(systemName: "lock.fill")
                                        .font(.system(size: 9.5, weight: .bold))
                                    Text("LOCKED")
                                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                }
                                .foregroundColor(Color.white.opacity(0.72))
                                .padding(.horizontal, 9)
                                .padding(.vertical, 5)
                                .background(Color.white.opacity(0.10))
                                .clipShape(Capsule())
                            }
                        }

                        // Master Password Input Pill
                        HStack(spacing: 10) {
                            Image(systemName: "key.fill")
                                .font(.system(size: 13))
                                .foregroundColor(isPasswordFocused ? LiquidGlassTheme.primaryAccent : Color.white.opacity(0.55))

                            Group {
                                if showPassword {
                                    TextField("Master Password", text: $password)
                                } else {
                                    SecureField("Master Password", text: $password)
                                }
                            }
                            .textFieldStyle(.plain)
                            .font(.system(size: 14))
                            .foregroundColor(.white)
                            .focused($isPasswordFocused)

                            Button(action: { showPassword.toggle() }) {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .font(.system(size: 13))
                                    .foregroundColor(.white.opacity(0.60))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .fill(Color.white.opacity(0.08))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                                        .stroke(
                                            isPasswordFocused ? LiquidGlassTheme.primaryAccent.opacity(0.85) : Color.white.opacity(0.16),
                                            lineWidth: isPasswordFocused ? 1.25 : 0.9
                                        )
                                )
                        )
                        .onSubmit(attemptUnlock)
                        .onChange(of: password) { _, _ in
                            if errorMessage != nil { errorMessage = nil }
                        }

                        // Primary Unlock + Touch ID + Hardware Key Row
                        HStack(spacing: 8) {
                            Button(action: attemptUnlock) {
                                HStack(spacing: 6) {
                                    if isProcessing {
                                        ProgressView()
                                            .controlSize(.small)
                                    } else {
                                        Image(systemName: "lock.open.fill")
                                        Text("Unlock Vault")
                                    }
                                }
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 40)
                                .background(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(
                                            LinearGradient(
                                                colors: [LiquidGlassTheme.purpleAccent, LiquidGlassTheme.primaryAccent],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .stroke(Color.white.opacity(0.28), lineWidth: 0.75)
                                        )
                                )
                            }
                            .buttonStyle(.plain)
                            .disabled(password.isEmpty || isProcessing)
                            .opacity(password.isEmpty || isProcessing ? 0.65 : 1.0)

                            if BiometricAuth.shared.canAuthenticateWithBiometrics() {
                                Button(action: attemptBiometricUnlock) {
                                    Image(systemName: "touchid")
                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundColor(.white)
                                        .frame(width: 44, height: 40)
                                        .background(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .fill(Color.white.opacity(0.12))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                        .stroke(Color.white.opacity(0.22), lineWidth: 0.8)
                                                )
                                        )
                                }
                                .buttonStyle(.plain)
                                .disabled(isProcessing)
                                .help("Unlock with Touch ID")
                            }

                            if VaultStore.shared.settings.hardwareKeyEnabled {
                                Button(action: attemptHardwareKeyUnlock) {
                                    Image(systemName: "key.radiowaves.forward.fill")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                        .frame(width: 44, height: 40)
                                        .background(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .fill(LiquidGlassTheme.emeraldAccent.opacity(0.16))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                        .stroke(LiquidGlassTheme.emeraldAccent.opacity(0.40), lineWidth: 0.8)
                                                )
                                        )
                                }
                                .buttonStyle(.plain)
                                .disabled(isProcessing)
                                .help("Unlock with Hardware Security Key")
                            }
                        }

                        if let error = errorMessage {
                            HStack(spacing: 6) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 11))
                                Text(error)
                                    .font(.system(size: 11.5, weight: .medium))
                            }
                            .foregroundColor(LiquidGlassTheme.roseAccent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .padding(.horizontal, 10)
                            .background(LiquidGlassTheme.roseAccent.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                            .transition(.opacity)
                        }

                        // Subtle Bottom Glass Footer
                        HStack {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.shield.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(LiquidGlassTheme.emeraldAccent.opacity(0.9))
                                Text("Local AES-256-GCM")
                                    .font(.system(size: 10.5, weight: .medium))
                                    .foregroundColor(.white.opacity(0.70))
                            }
                            .shadow(color: .black.opacity(0.5), radius: 2, y: 1)

                            Spacer()

                            Button(action: { DevModeManager.shared.showSheet = true }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "terminal")
                                        .font(.system(size: 10))
                                    Text("Dev Mode")
                                        .font(.system(size: 10.5, weight: .semibold))
                                }
                                .foregroundColor(.white.opacity(0.85))
                                .padding(.horizontal, 9)
                                .padding(.vertical, 4)
                                .background(Color.white.opacity(0.14))
                                .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                            .help("Developer Mode (Immutable Password Required)")
                        }
                        .padding(.top, 2)
                    }
                    .padding(.horizontal, 22)
                    .padding(.bottom, 18)
                }
                .frame(width: 380)
                .fixedSize(horizontal: false, vertical: true)
                .clipShape(RoundedRectangle(cornerRadius: islandCornerRadius, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: islandCornerRadius, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.18),
                                    Color.white.opacity(0.08),
                                    Color.white.opacity(0.30)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 0.9
                        )
                )
                .shadow(color: Color.black.opacity(0.58), radius: 34, x: 0, y: 18)
                .onAppear {
                    pulseGlow = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        isPasswordFocused = true
                    }
                }
            }
            .padding(24)
        }
        .frame(minWidth: 440, minHeight: 450)
    }

    private var statusSubtitle: String {
        if VaultStore.shared.settings.hardwareKeyEnabled {
            return "Vault · Hardware Key"
        }
        if BiometricAuth.shared.canAuthenticateWithBiometrics() {
            return "Vault · Touch ID"
        }
        return "Zero-Knowledge Vault"
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
