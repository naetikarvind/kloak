import SwiftUI
import UniformTypeIdentifiers

public struct SetupView: View {
    @ObservedObject var vaultStore: VaultStore = .shared

    // Navigation & Stage
    @State private var currentStep: OnboardingStep = .cloudAccounts
    @State private var pulseGlow: Bool = false

    // Step 1: Password State
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var showPassword: Bool = false
    @State private var showConfirmPassword: Bool = false
    @State private var enableBiometrics: Bool = true
    @FocusState private var focusedField: SetupField?

    // Step 2: Apple Keychain State
    @State private var isScanningKeychain: Bool = false
    @State private var keychainScanResult: KeychainScanPreview? = nil
    @State private var importedKeychainItems: [VaultItem] = []
    @State private var csvImportCount: Int = 0
    @State private var keychainPasswordInput: String = ""
    @State private var showKeychainPasswordInput: Bool = false
    @State private var importKeychainLogins: Bool = true
    @State private var enableKeychainSync: Bool = false
    @State private var keychainFeedback: String? = nil

    // Step 3: Cloud Accounts State
    @State private var googleConnection = OnboardingAccountConnection(provider: .google)
    @State private var protonConnection = OnboardingAccountConnection(provider: .proton)
    @State private var microsoftConnection = OnboardingAccountConnection(provider: .microsoft)
    @State private var selectedProviderForSheet: CloudProvider? = nil

    // Step 4: Integrations & Completion
    @State private var seedSampleData: Bool = false
    @State private var isProcessing: Bool = false
    @State private var errorMessage: String? = nil

    public init() {}

    enum SetupField: Hashable {
        case password
        case confirmPassword
        case keychainPassword
    }

    private var passwordStrength: PasswordStrength {
        evaluateStrength(password)
    }

    private var canProceedFromPassword: Bool {
        !password.isEmpty && password == confirmPassword && password.count >= 6
    }

    public var body: some View {
        GlassEffectContainer {
            VStack(spacing: 20) {
                // Top Brand & Step Indicator
                topHeaderSection

                // Main Step Content
                VStack {
                    switch currentStep {
                    case .vaultPassword:
                        step1PasswordView
                    case .appleKeychain:
                        step2KeychainView
                    case .cloudAccounts:
                        step3CloudAccountsView
                    case .ecosystem:
                        step4EcosystemView
                    case .complete:
                        step5CompleteView
                    }
                }
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .move(edge: .trailing)),
                    removal: .opacity.combined(with: .move(edge: .leading))
                ))
            }
            .padding(28)
            .sheet(item: $selectedProviderForSheet) { provider in
                OnboardingAccountConnectSheet(
                    provider: provider,
                    connection: binding(for: provider),
                    onSave: { updatedConn, newItems in
                        updateConnection(provider: provider, with: updatedConn)
                        if !newItems.isEmpty {
                            var existingKeys = Set(importedKeychainItems.map { "\($0.title)_\($0.username ?? "")" })
                            var addedCount = 0
                            for item in newItems {
                                let key = "\(item.title)_\(item.username ?? "")"
                                if !existingKeys.contains(key) {
                                    importedKeychainItems.append(item)
                                    existingKeys.insert(key)
                                    addedCount += 1
                                }
                            }
                            importKeychainLogins = true
                            keychainFeedback = "Successfully staged \(importedKeychainItems.count) credential(s) (\(addedCount) from \(provider.displayName)) for vault creation."
                        }
                        selectedProviderForSheet = nil
                    },
                    onCancel: {
                        selectedProviderForSheet = nil
                    }
                )
            }
        }
        .frame(minWidth: 620, minHeight: 680)
        .onAppear {
            pulseGlow = true
            focusedField = .password
        }
    }

    // MARK: - Top Header & Step Progress Bar

    private var topHeaderSection: some View {
        VStack(spacing: 14) {
            HStack(spacing: 12) {
                KloakLogoView(size: 40, glow: pulseGlow)
                    .scaleEffect(pulseGlow ? 1.04 : 0.98)
                    .animation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true), value: pulseGlow)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Kloak Setup")
                        .font(.system(size: 19, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)

                    Text(currentStep.subtitle)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Step Counter Pill
                Text("Step \(currentStep.rawValue + 1) of \(OnboardingStep.allCases.count)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(LiquidGlassTheme.primaryAccent.opacity(0.14))
                    .clipShape(Capsule())
            }

            // Step Indicator Dots / Bars
            HStack(spacing: 6) {
                ForEach(OnboardingStep.allCases) { step in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(
                                step.rawValue <= currentStep.rawValue
                                ? LiquidGlassTheme.primaryAccent
                                : Color.white.opacity(0.15)
                            )
                            .frame(width: 7, height: 7)

                        if step != .complete {
                            RoundedRectangle(cornerRadius: 1)
                                .fill(
                                    step.rawValue < currentStep.rawValue
                                    ? LiquidGlassTheme.primaryAccent
                                    : Color.white.opacity(0.1)
                                )
                                .frame(height: 2)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Step 1: Master Password & Security

    private var step1PasswordView: some View {
        VStack(spacing: 18) {
            VStack(spacing: 4) {
                Text("Create Master Password")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.primary)

                Text("Your master password encrypts your vault with Argon2id / AES-256-GCM. It is never stored or transmitted anywhere.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 460)
            }
            .padding(.top, 6)

            VStack(spacing: 14) {
                // Password field
                VStack(alignment: .leading, spacing: 6) {
                    Text("MASTER PASSWORD (MINIMUM 6 CHARACTERS)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)

                    HStack(spacing: 8) {
                        if showPassword {
                            TextField("Enter strong master password", text: $password)
                                .textFieldStyle(.plain)
                                .font(.system(size: 13))
                                .focused($focusedField, equals: .password)
                        } else {
                            SecureField("Enter strong master password", text: $password)
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

                    // Strength indicator bar
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

                // Confirm Password field
                VStack(alignment: .leading, spacing: 6) {
                    Text("CONFIRM MASTER PASSWORD")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)

                    HStack(spacing: 8) {
                        if showConfirmPassword {
                            TextField("Re-enter master password", text: $confirmPassword)
                                .textFieldStyle(.plain)
                                .font(.system(size: 13))
                                .focused($focusedField, equals: .confirmPassword)
                        } else {
                            SecureField("Re-enter master password", text: $confirmPassword)
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
                                        ? LiquidGlassTheme.roseAccent.opacity(0.7)
                                        : (focusedField == .confirmPassword ? LiquidGlassTheme.primaryAccent : Color.white.opacity(0.15)),
                                        lineWidth: 1
                                    )
                            )
                    )
                }

                // Biometrics toggle
                Toggle(isOn: $enableBiometrics) {
                    HStack(spacing: 8) {
                        Image(systemName: "touchid")
                            .font(.system(size: 15))
                            .foregroundColor(LiquidGlassTheme.primaryAccent)

                        VStack(alignment: .leading, spacing: 1) {
                            Text("Enable Touch ID / Secure Enclave")
                                .font(.system(size: 12, weight: .semibold))
                            Text("Unlock your vault instantly using Mac biometric sensors")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .toggleStyle(.checkbox)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)
            }
            .padding(20)
            .glassEffect(cornerRadius: 16)

            Spacer()

            // Navigation buttons
            HStack {
                Button("Back") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .appleKeychain
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Spacer()

                Button(action: {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .ecosystem
                    }
                }) {
                    HStack(spacing: 8) {
                        Text("Continue to Integrations")
                        Image(systemName: "arrow.right")
                    }
                    .frame(minWidth: 190)
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
                .disabled(!canProceedFromPassword)
            }
        }
    }

    // MARK: - Step 2: Apple Keychain Integration

    private var step2KeychainView: some View {
        VStack(spacing: 18) {
            VStack(spacing: 4) {
                Text("Connect Apple Keychain")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.primary)

                Text("Import your existing Safari and macOS passwords directly into Kloak with zero cloud transmission.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 460)
            }
            .padding(.top, 6)

            VStack(alignment: .leading, spacing: 14) {
                // Option A: iCloud Passwords Export CSV Import
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(LiquidGlassTheme.primaryAccent.opacity(0.18))
                                .frame(width: 44, height: 44)

                            Image(systemName: "icloud.and.arrow.down.fill")
                                .font(.system(size: 20))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("iCloud Passwords / Safari Export (.csv)")
                                .font(.system(size: 14, weight: .bold))

                            Text("Import all Safari and iCloud credentials via exported CSV")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        Button(action: handleSelectApplePasswordsCSV) {
                            HStack(spacing: 6) {
                                Image(systemName: "doc.badge.plus")
                                Text("Import Passwords.csv")
                            }
                            .font(.system(size: 11, weight: .semibold))
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: true))
                    }

                    // How to export instructions
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(LiquidGlassTheme.tealAccent)

                        Text("Tip: In macOS System Settings → Passwords, click '...' → 'Export All Passwords...', then select that file here.")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                    if csvImportCount > 0 {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                .font(.system(size: 12))

                            Text("\(csvImportCount) credential(s) loaded from Passwords.csv")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
                .padding(12)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                // Option B: Local Keychain Direct Scan
                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(LiquidGlassTheme.amberAccent.opacity(0.18))
                            .frame(width: 40, height: 40)

                        Image(systemName: "key.horizontal.fill")
                            .font(.system(size: 18))
                            .foregroundColor(LiquidGlassTheme.amberAccent)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("macOS System Keychain Scan")
                            .font(.system(size: 13, weight: .bold))

                        if let result = keychainScanResult {
                            Text("\(result.totalCount) items found (\(result.internetPasswordsCount) web logins, \(result.genericPasswordsCount) app keys)")
                                .font(.system(size: 11))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        } else {
                            Text("Scan local unencrypted keychain items")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                    }

                    Spacer()

                    Button(action: handleScanKeychain) {
                        if isScanningKeychain {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label(keychainScanResult == nil ? "Scan Local" : "Re-scan", systemImage: "arrow.triangle.2.circlepath")
                                .font(.system(size: 10, weight: .semibold))
                        }
                    }
                    .buttonStyle(GlassCapsuleButton(isPrimary: false))
                    .disabled(isScanningKeychain)
                }
                .padding(12)
                .background(Color.black.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                // Options
                VStack(alignment: .leading, spacing: 8) {
                    Toggle(isOn: $importKeychainLogins) {
                        HStack(spacing: 6) {
                            Image(systemName: "square.and.arrow.down.fill")
                                .font(.system(size: 12))
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                            Text("Import all detected passwords into Kloak upon creation")
                                .font(.system(size: 12, weight: .medium))
                        }
                    }
                    .toggleStyle(.checkbox)
                    .onChange(of: importKeychainLogins) { isEnabled in
                        if isEnabled && importedKeychainItems.isEmpty {
                            handleScanKeychain()
                        }
                    }

                    Toggle(isOn: $enableKeychainSync) {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.system(size: 12))
                                .foregroundColor(LiquidGlassTheme.tealAccent)
                            Text("Enable continuous two-way sync with Apple Keychain")
                                .font(.system(size: 12, weight: .medium))
                        }
                    }
                    .toggleStyle(.checkbox)
                }

                if let feedback = keychainFeedback {
                    Text(feedback)
                        .font(.system(size: 11))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
            }
            .padding(20)
            .glassEffect(cornerRadius: 16)
            .onAppear {
                if keychainScanResult == nil {
                    handleScanKeychain()
                }
            }

            Spacer()

            // Navigation buttons
            HStack {
                Button("Back") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .cloudAccounts
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Spacer()

                Button("Skip") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .vaultPassword
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Button("Continue") {
                    if importKeychainLogins && importedKeychainItems.isEmpty {
                        let items = KeychainManager.shared.importFromKeychain()
                        importedKeychainItems = items
                    }
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .vaultPassword
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
            }
        }
    }

    // MARK: - Step 3: Cloud Accounts (Google, Proton, Microsoft)

    private var step3CloudAccountsView: some View {
        VStack(spacing: 16) {
            VStack(spacing: 4) {
                Text("Connect Cloud & Identity Accounts")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.primary)

                Text("Connect Google, Proton, or Microsoft to enable smart email forwarding aliases, passkey sync, and cross-browser credentials.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 480)
            }
            .padding(.top, 4)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    providerCard(for: googleConnection, provider: .google)
                    providerCard(for: protonConnection, provider: .proton)
                    providerCard(for: microsoftConnection, provider: .microsoft)
                }
                .padding(.vertical, 4)
            }
            .frame(maxHeight: 330)

            Spacer()

            // Navigation buttons
            HStack {
                Spacer()

                Button("Skip Accounts") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .appleKeychain
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Button("Continue to Keychain") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .appleKeychain
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
            }
        }
    }

    private func providerCard(for conn: OnboardingAccountConnection, provider: CloudProvider) -> some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(provider.accentColor.opacity(0.18))
                    .frame(width: 44, height: 44)

                Image(systemName: provider.iconName)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(provider.accentColor)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(provider.displayName)
                        .font(.system(size: 14, weight: .bold))

                    if conn.isConnected {
                        HStack(spacing: 3) {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Connected")
                        }
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    }
                }

                if conn.isConnected && !conn.email.isEmpty {
                    Text(conn.email)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.primary)
                } else {
                    Text(provider.description)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                // Feature pills
                HStack(spacing: 4) {
                    if conn.importedCount > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: "checkmark")
                            Text("\(conn.importedCount) Logins")
                        }
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                        .clipShape(Capsule())
                    }

                    ForEach(provider.featureBadges, id: \.self) { badge in
                        Text(badge)
                            .font(.system(size: 9, weight: .medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.06))
                            .clipShape(Capsule())
                    }
                }
                .padding(.top, 2)
            }

            Spacer()

            Button(action: {
                selectedProviderForSheet = provider
            }) {
                Text(conn.isConnected ? "Manage" : "Connect")
                    .font(.system(size: 11, weight: .semibold))
            }
            .buttonStyle(GlassCapsuleButton(isPrimary: !conn.isConnected))
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(conn.isConnected ? provider.accentColor.opacity(0.1) : Color.black.opacity(0.25))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(conn.isConnected ? provider.accentColor.opacity(0.4) : Color.white.opacity(0.1), lineWidth: 1)
                )
        )
    }

    // MARK: - Step 4: Ecosystem & Integrations

    private var step4EcosystemView: some View {
        VStack(spacing: 18) {
            VStack(spacing: 4) {
                Text("Ecosystem & Integrations")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.primary)

                Text("Kloak seamlessly integrates with your browser and Raycast for instant keyboard-driven workflow.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 460)
            }
            .padding(.top, 6)

            VStack(spacing: 12) {
                // Browser Extension Card
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(LiquidGlassTheme.primaryAccent.opacity(0.18))
                            .frame(width: 40, height: 40)
                        Image(systemName: "globe")
                            .font(.system(size: 18))
                            .foregroundColor(LiquidGlassTheme.primaryAccent)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Chrome & Browser Extension")
                            .font(.system(size: 13, weight: .bold))
                        Text("Native Messaging Host bridge (`app.kloak.native`) active")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
                .padding(12)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                // Raycast Extension Card
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(LiquidGlassTheme.roseAccent.opacity(0.18))
                            .frame(width: 40, height: 40)
                        Image(systemName: "command")
                            .font(.system(size: 18))
                            .foregroundColor(LiquidGlassTheme.roseAccent)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Raycast Extension")
                            .font(.system(size: 13, weight: .bold))
                        Text("Instant hotkey credential lookup and password generation")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
                .padding(12)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(18)
            .glassEffect(cornerRadius: 16)

            Spacer()

            // Navigation buttons
            HStack {
                Button("Back") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .vaultPassword
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Spacer()

                Button("Continue to Review") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .complete
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
            }
        }
    }

    // MARK: - Step 5: Complete & Launch

    private var step5CompleteView: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                    .frame(width: 72, height: 72)

                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 38))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
            }
            .padding(.top, 10)

            VStack(spacing: 4) {
                Text("Ready to Initialize Vault")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.primary)

                Text("Your configuration is complete. Click below to securely generate your AES-256-GCM encrypted vault envelope.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 440)
            }

            // Summary Card
            VStack(alignment: .leading, spacing: 10) {
                Text("CONFIGURATION SUMMARY")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                HStack {
                    Label("Master Password", systemImage: "lock.fill")
                    Spacer()
                    Text("Configured (Argon2id)")
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
                .font(.system(size: 12))

                HStack {
                    Label("Touch ID Unlock", systemImage: "touchid")
                    Spacer()
                    Text(enableBiometrics ? "Enabled" : "Disabled")
                        .foregroundColor(enableBiometrics ? LiquidGlassTheme.emeraldAccent : .secondary)
                }
                .font(.system(size: 12))

                HStack {
                    Label("Apple Keychain", systemImage: "key.horizontal.fill")
                    Spacer()
                    let count = importKeychainLogins ? importedKeychainItems.count : 0
                    Text("\(count) items ready to import")
                        .foregroundColor(count > 0 ? LiquidGlassTheme.emeraldAccent : .secondary)
                }
                .font(.system(size: 12))

                HStack {
                    Label("Connected Accounts", systemImage: "cloud.fill")
                    Spacer()
                    let connectedCount = [googleConnection, protonConnection, microsoftConnection].filter { $0.isConnected }.count
                    Text(connectedCount > 0 ? "\(connectedCount) Account(s) Connected" : "None (Local Only)")
                        .foregroundColor(connectedCount > 0 ? LiquidGlassTheme.emeraldAccent : .secondary)
                }
                .font(.system(size: 12))
            }
            .padding(16)
            .background(Color.black.opacity(0.25))
            .clipShape(RoundedRectangle(cornerRadius: 14))

            if let error = errorMessage {
                Text(error)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(LiquidGlassTheme.roseAccent)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            // Launch Action
            HStack(spacing: 12) {
                Button("Back") {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        currentStep = .ecosystem
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Spacer()

                Button(action: handleCreateVault) {
                    if isProcessing {
                        ProgressView()
                            .controlSize(.small)
                            .frame(maxWidth: .infinity)
                    } else {
                        HStack(spacing: 8) {
                            Image(systemName: "sparkles")
                            Text("Launch Kloak")
                        }
                        .font(.system(size: 14, weight: .bold))
                        .frame(minWidth: 160)
                    }
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
                .disabled(isProcessing)
            }
        }
    }

    // MARK: - Actions & Helpers

    private func handleScanKeychain() {
        isScanningKeychain = true
        keychainFeedback = nil

        Task {
            let scan = KeychainManager.shared.scanKeychainSummary()
            let items = importKeychainLogins ? KeychainManager.shared.importFromKeychain() : []

            await MainActor.run {
                self.keychainScanResult = scan
                if self.importKeychainLogins {
                    var existingKeys = Set(self.importedKeychainItems.map { "\($0.title)_\($0.username ?? "")" })
                    for var item in items {
                        if !item.tags.contains("Imported") {
                            item.tags.append("Imported")
                        }
                        let key = "\(item.title)_\(item.username ?? "")"
                        if !existingKeys.contains(key) {
                            self.importedKeychainItems.append(item)
                            existingKeys.insert(key)
                        }
                    }
                }
                self.isScanningKeychain = false
                if self.importedKeychainItems.count > 0 {
                    self.keychainFeedback = "Successfully staged \(self.importedKeychainItems.count) credential(s) ready for vault creation."
                } else if scan.totalCount > 0 {
                    self.keychainFeedback = "Scan complete. \(scan.totalCount) password(s) found in macOS Keychain."
                } else {
                    self.keychainFeedback = "No website logins found in local Keychain (system & developer tokens excluded)."
                }
            }
        }
    }

    private func handleSelectApplePasswordsCSV() {
        let panel = NSOpenPanel()
        panel.title = "Select Apple Passwords CSV Export"
        panel.prompt = "Import Passwords"
        panel.allowedContentTypes = [.commaSeparatedText, .plainText]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canCreateDirectories = false

        if panel.runModal() == .OK, let url = panel.url {
            do {
                let content = try String(contentsOf: url, encoding: .utf8)
                let items = KeychainManager.shared.importFromApplePasswordsCSV(content)
                if !items.isEmpty {
                    var existingKeys = Set(importedKeychainItems.map { "\($0.title)_\($0.username ?? "")" })
                    var addedCount = 0
                    for item in items {
                        let key = "\(item.title)_\(item.username ?? "")"
                        if !existingKeys.contains(key) {
                            importedKeychainItems.append(item)
                            existingKeys.insert(key)
                            addedCount += 1
                        } else if let idx = importedKeychainItems.firstIndex(where: { "\($0.title)_\($0.username ?? "")" == key }) {
                            if let newPass = item.password, !newPass.isEmpty {
                                importedKeychainItems[idx].password = newPass
                            }
                            if let newTotp = item.totpSecret, !newTotp.isEmpty {
                                importedKeychainItems[idx].totpSecret = newTotp
                            }
                            if !item.urls.isEmpty {
                                importedKeychainItems[idx].urls = item.urls
                            }
                            addedCount += 1
                        }
                    }
                    csvImportCount = items.count
                    importKeychainLogins = true
                    keychainFeedback = "Successfully imported \(items.count) password(s) from \(url.lastPathComponent) (Total staged: \(importedKeychainItems.count))!"
                } else {
                    keychainFeedback = "No passwords found in \(url.lastPathComponent). Please ensure it is an exported CSV from Apple Passwords or Safari."
                }
            } catch {
                keychainFeedback = "Failed to read CSV file: \(error.localizedDescription)"
            }
        }
    }

    private func binding(for provider: CloudProvider) -> Binding<OnboardingAccountConnection> {
        switch provider {
        case .google: return $googleConnection
        case .proton: return $protonConnection
        case .microsoft: return $microsoftConnection
        }
    }

    private func updateConnection(provider: CloudProvider, with conn: OnboardingAccountConnection) {
        switch provider {
        case .google: googleConnection = conn
        case .proton: protonConnection = conn
        case .microsoft: microsoftConnection = conn
        }
    }

    private func handleCreateVault() {
        guard canProceedFromPassword else {
            errorMessage = "Invalid master password."
            return
        }

        isProcessing = true
        errorMessage = nil

        let activeConnections = [googleConnection, protonConnection, microsoftConnection].filter { $0.isConnected }
        var itemsToImport = importKeychainLogins ? importedKeychainItems : []
        if importKeychainLogins && itemsToImport.isEmpty {
            itemsToImport = KeychainManager.shared.importFromKeychain()
            importedKeychainItems = itemsToImport
        }

        Task {
            do {
                try await vaultStore.createVault(
                    masterPassword: password,
                    enableBiometrics: enableBiometrics,
                    seedSampleData: seedSampleData,
                    importedItems: itemsToImport,
                    connectedAccounts: activeConnections,
                    keychainSyncEnabled: enableKeychainSync
                )
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isProcessing = false
                }
            }
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
