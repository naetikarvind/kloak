import SwiftUI

public struct SetupView: View {
    @ObservedObject var vaultStore: VaultStore = .shared

    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var enableBiometrics: Bool = false
    @State private var seedSampleData: Bool = true
    @State private var isProcessing: Bool = false
    @State private var errorMessage: String? = nil
    @State private var pulseGlow: Bool = false

    public init() {}

    private var passwordStrength: PasswordStrength {
        evaluateStrength(password)
    }

    private var canSubmit: Bool {
        !password.isEmpty && password == confirmPassword && password.count >= 6 && !isProcessing
    }

    enum SetupField: Hashable {
        case password
        case confirmPassword
    }

    @FocusState private var focusedField: SetupField?
    @State private var showPassword: Bool = false
    @State private var showConfirmPassword: Bool = false

    public var body: some View {
        GlassEffectContainer {
            VStack(spacing: 24) {
                // Official Kloak App Icon with Liquid Halo
                KloakLogoView(size: 80, glow: pulseGlow)
                    .scaleEffect(pulseGlow ? 1.05 : 0.98)
                    .animation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true), value: pulseGlow)
                    .onAppear {
                        pulseGlow = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            focusedField = .password
                        }
                    }

                VStack(spacing: 6) {
                    Text("Welcome to Kloak")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)

                    Text("Create your master password to initialize your encrypted vault")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 360)
                }

                // Setup Glass Panel
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            if showPassword {
                                TextField("Master Password (min 6 chars)", text: $password)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13))
                                    .focused($focusedField, equals: .password)
                            } else {
                                SecureField("Master Password (min 6 chars)", text: $password)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13))
                                    .focused($focusedField, equals: .password)
                            }

                            Button(action: { showPassword.toggle() }) {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .font(.system(size: 13))
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.black.opacity(0.35))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(focusedField == .password ? LiquidGlassTheme.primaryAccent : Color.white.opacity(0.15), lineWidth: 1)
                                )
                        )

                        // Strength indicator
                        if !password.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(Color.white.opacity(0.1))
                                            .frame(height: 4)

                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(passwordStrength.color)
                                            .frame(width: geo.size.width * passwordStrength.progress, height: 4)
                                            .animation(.easeInOut(duration: 0.2), value: passwordStrength.progress)
                                    }
                                }
                                .frame(height: 4)

                                HStack {
                                    Text(passwordStrength.label)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundColor(passwordStrength.color)
                                    Spacer()
                                }
                            }
                            .padding(.top, 2)
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            if showConfirmPassword {
                                TextField("Confirm Master Password", text: $confirmPassword)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13))
                                    .focused($focusedField, equals: .confirmPassword)
                            } else {
                                SecureField("Confirm Master Password", text: $confirmPassword)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13))
                                    .focused($focusedField, equals: .confirmPassword)
                            }

                            Button(action: { showConfirmPassword.toggle() }) {
                                Image(systemName: showConfirmPassword ? "eye.slash" : "eye")
                                    .font(.system(size: 13))
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.black.opacity(0.35))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(
                                            !confirmPassword.isEmpty && confirmPassword != password
                                            ? LiquidGlassTheme.roseAccent.opacity(0.6)
                                            : (focusedField == .confirmPassword ? LiquidGlassTheme.primaryAccent : Color.white.opacity(0.15)),
                                            lineWidth: 1
                                        )
                                )
                        )
                    }

                    VStack(spacing: 8) {
                        Toggle(isOn: $enableBiometrics) {
                            HStack {
                                Image(systemName: "touchid")
                                    .font(.system(size: 14))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                Text("Enable Touch ID / Biometrics")
                                    .font(.system(size: 12, weight: .medium))
                            }
                        }
                        .toggleStyle(.checkbox)
                        .frame(maxWidth: .infinity, alignment: .leading)

                        Toggle(isOn: $seedSampleData) {
                            HStack {
                                Image(systemName: "sparkles")
                                    .font(.system(size: 14))
                                    .foregroundColor(LiquidGlassTheme.amberAccent)
                                Text("Include sample accounts & logos")
                                    .font(.system(size: 12, weight: .medium))
                            }
                        }
                        .toggleStyle(.checkbox)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.top, 4)

                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(LiquidGlassTheme.roseAccent)
                            .multilineTextAlignment(.center)
                    }

                    Button(action: handleCreateVault) {
                        if isProcessing {
                            ProgressView()
                                .controlSize(.small)
                                .frame(maxWidth: .infinity)
                        } else {
                            Label("Create Encrypted Vault", systemImage: "lock.shield.fill")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(GlassCapsuleButton(isPrimary: true))
                    .disabled(!canSubmit)
                    .padding(.top, 6)
                }
                .padding(24)
                .frame(width: 380)
                .glassEffect(cornerRadius: 20)
            }
            .padding(32)
        }
        .frame(minWidth: 500, minHeight: 560)
    }

    private func handleCreateVault() {
        guard canSubmit else {
            if password != confirmPassword {
                errorMessage = "Passwords do not match."
            } else if password.count < 6 {
                errorMessage = "Password must be at least 6 characters."
            }
            return
        }

        isProcessing = true
        errorMessage = nil

        Task {
            do {
                try await vaultStore.createVault(
                    masterPassword: password,
                    enableBiometrics: enableBiometrics,
                    seedSampleData: seedSampleData
                )
            } catch {
                errorMessage = error.localizedDescription
            }
            isProcessing = false
        }
    }

    private func evaluateStrength(_ pass: String) -> PasswordStrength {
        if pass.isEmpty { return .empty }
        if pass.count < 6 { return .weak }

        var score = 0
        if pass.count >= 10 { score += 1 }
        if pass.count >= 14 { score += 1 }
        if pass.rangeOfCharacter(from: .uppercaseLetters) != nil { score += 1 }
        if pass.rangeOfCharacter(from: .decimalDigits) != nil { score += 1 }
        if pass.rangeOfCharacter(from: CharacterSet(charactersIn: "!@#$%^&*()_+-=[]{}|;:,.<>?")) != nil { score += 1 }

        if score <= 1 {
            return .weak
        } else if score <= 3 {
            return .medium
        } else if score <= 4 {
            return .strong
        } else {
            return .shielded
        }
    }
}

public enum PasswordStrength {
    case empty
    case weak
    case medium
    case strong
    case shielded

    public var label: String {
        switch self {
        case .empty: return ""
        case .weak: return "Weak"
        case .medium: return "Moderate"
        case .strong: return "Strong"
        case .shielded: return "Shielded"
        }
    }

    public var progress: CGFloat {
        switch self {
        case .empty: return 0.0
        case .weak: return 0.25
        case .medium: return 0.55
        case .strong: return 0.8
        case .shielded: return 1.0
        }
    }

    public var color: Color {
        switch self {
        case .empty: return .clear
        case .weak: return LiquidGlassTheme.roseAccent
        case .medium: return LiquidGlassTheme.amberAccent
        case .strong: return LiquidGlassTheme.emeraldAccent
        case .shielded: return LiquidGlassTheme.primaryAccent
        }
    }
}
