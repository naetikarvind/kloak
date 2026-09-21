import SwiftUI
import AppKit

public struct DevModeSheet: View {
    @ObservedObject private var devManager = DevModeManager.shared
    @Environment(\.dismiss) private var dismiss
    
    @State private var inputPassword: String = ""
    @State private var showResetConfirm: Bool = false
    @State private var copiedDiagnostics: Bool = false

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Header Bar
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    Text("Developer Mode")
                        .font(.system(size: 14, weight: .bold))
                }

                Spacer()

                if devManager.isUnlocked {
                    HStack(spacing: 5) {
                        Circle()
                            .fill(LiquidGlassTheme.emeraldAccent)
                            .frame(width: 7, height: 7)
                        Text("Active")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                    .clipShape(Capsule())
                }

                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(Color.black.opacity(0.25))

            Divider().opacity(0.15)

            ScrollView {
                VStack(spacing: 20) {
                    if !devManager.isUnlocked {
                        lockedChallengeView
                    } else {
                        unlockedDashboardView
                    }
                }
                .padding(24)
            }
        }
        .frame(width: 520, height: 500)
        .background(Color(red: 0.08, green: 0.07, blue: 0.12))
    }

    // MARK: - Locked Challenge View
    private var lockedChallengeView: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(LiquidGlassTheme.primaryAccent.opacity(0.15))
                    .frame(width: 64, height: 64)
                Image(systemName: "lock.laptopcomputer")
                    .font(.system(size: 28))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
            }
            .padding(.top, 10)

            VStack(spacing: 6) {
                Text("Developer Authentication")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)

                Text("Enter the immutable Developer Master Password to access developer utilities and vault reset controls.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
            }

            VStack(spacing: 12) {
                SecureField("Developer Master Password", text: $inputPassword)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 13))
                    .onSubmit {
                        attemptUnlock()
                    }

                if let error = devManager.authError {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 11))
                        Text(error)
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundColor(LiquidGlassTheme.roseAccent)
                }

                Button(action: attemptUnlock) {
                    HStack(spacing: 6) {
                        Image(systemName: "key.fill")
                        Text("Unlock Dev Mode")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
                .disabled(inputPassword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(18)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            // Notice about immutability
            HStack(spacing: 8) {
                Image(systemName: "info.circle")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                Text("This master password is built into the application core and cannot be changed or overridden by vault settings.")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 10)
        }
    }

    // MARK: - Unlocked Dashboard View
    private var unlockedDashboardView: some View {
        VStack(spacing: 18) {
            // Section 1: Start Fresh Onboarding (Primary Developer Action)
            VStack(alignment: .leading, spacing: 12) {
                Label("Vault Lifecycle & Onboarding", systemImage: "sparkles")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)

                Text("Wipe the current local vault and immediately re-launch the clean first-time onboarding wizard. Ideal for testing import pipelines and setup flows.")
                    .font(.system(size: 11.5))
                    .foregroundColor(.secondary)

                Button(action: { showResetConfirm = true }) {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.counterclockwise.circle.fill")
                            .font(.system(size: 14))
                        Text("Start Fresh Onboarding / Reset Vault")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))
                .foregroundColor(LiquidGlassTheme.roseAccent)
                .alert("Reset Vault & Start Fresh Onboarding?", isPresented: $showResetConfirm) {
                    Button("Cancel", role: .cancel) {}
                    Button("Reset & Launch Setup", role: .destructive) {
                        devManager.startFreshOnboarding()
                        dismiss()
                    }
                } message: {
                    Text("This will permanently remove the local vault file (~/.kloak/vault.kloak) and open the initial setup wizard. Make sure you have exported your credentials if you need them.")
                }
            }
            .padding(16)
            .background(Color.red.opacity(0.06))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(LiquidGlassTheme.roseAccent.opacity(0.25), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))

            // Section 2: Vault & System Diagnostics
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Environment Diagnostics", systemImage: "info.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                    
                    Spacer()

                    Button(action: copyDiagnostics) {
                        HStack(spacing: 4) {
                            Image(systemName: copiedDiagnostics ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 10))
                            Text(copiedDiagnostics ? "Copied!" : "Copy")
                                .font(.system(size: 10, weight: .medium))
                        }
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.secondary)
                }

                VStack(spacing: 8) {
                    ForEach(devManager.getDiagnostics().sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                        HStack {
                            Text(key)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.secondary)
                            Spacer()
                            Text(value)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        Divider().opacity(0.1)
                    }
                }

                HStack(spacing: 10) {
                    Button(action: revealVaultInFinder) {
                        HStack(spacing: 6) {
                            Image(systemName: "folder.fill")
                            Text("Reveal ~/.kloak in Finder")
                        }
                        .font(.system(size: 11, weight: .medium))
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(LiquidGlassTheme.primaryAccent)

                    Spacer()

                    Button(action: { devManager.lock() }) {
                        HStack(spacing: 5) {
                            Image(systemName: "lock.fill")
                            Text("Lock Dev Mode")
                        }
                        .font(.system(size: 11, weight: .medium))
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.secondary)
                }
                .padding(.top, 4)
            }
            .padding(16)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Actions
    private func attemptUnlock() {
        if devManager.authenticate(password: inputPassword) {
            inputPassword = ""
        }
    }

    private func revealVaultInFinder() {
        let dir = VaultStore.vaultDirectoryURL
        NSWorkspace.shared.selectFile(VaultStore.vaultFileURL.path, inFileViewerRootedAtPath: dir.path)
    }

    private func copyDiagnostics() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(devManager.formattedDiagnosticsText(), forType: .string)
        copiedDiagnostics = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            copiedDiagnostics = false
        }
    }
}
