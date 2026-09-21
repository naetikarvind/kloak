import Foundation
import SwiftUI
import Combine

@MainActor
public final class DevModeManager: ObservableObject {
    public static let shared = DevModeManager()

    // MARK: - Immutable Developer Master Passwords
    // These passwords cannot be changed or overridden by settings or vault password updates.
    public static let immutableMasterPassword: String = "KloakDev2026!"
    public static let alternativePassword: String = "kloakdev"

    // MARK: - Published State
    @Published public var isUnlocked: Bool = false
    @Published public var showSheet: Bool = false
    @Published public var authError: String? = nil

    private init() {}

    // MARK: - Authentication
    @discardableResult
    public func authenticate(password: String) -> Bool {
        let trimmed = password.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed == Self.immutableMasterPassword || trimmed == Self.alternativePassword {
            isUnlocked = true
            authError = nil
            return true
        } else {
            authError = "Incorrect Developer Master Password."
            return false
        }
    }

    public func lock() {
        isUnlocked = false
        authError = nil
    }

    // MARK: - Start Fresh Onboarding (Reset Vault)
    public func startFreshOnboarding() {
        // Reset the vault state completely
        VaultStore.shared.resetVault()
        
        // Lock developer mode
        lock()
        
        // Close the developer sheet
        showSheet = false
        
        // Resize window to setup onboarding dimensions
        WindowSizeManager.shared.resize(to: .setup)
    }

    // MARK: - Diagnostics
    public func getDiagnostics() -> [String: String] {
        var info: [String: String] = [:]
        info["Vault Path"] = VaultStore.vaultFileURL.path
        info["Vault Exists"] = FileManager.default.fileExists(atPath: VaultStore.vaultFileURL.path) ? "Yes" : "No"
        
        if let attrs = try? FileManager.default.attributesOfItem(atPath: VaultStore.vaultFileURL.path),
           let size = attrs[.size] as? Int64 {
            info["Vault File Size"] = ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
        } else {
            info["Vault File Size"] = "N/A"
        }

        let store = VaultStore.shared
        info["Active Items"] = "\(store.items.count)"
        info["Active Folders"] = "\(store.folders.count)"
        info["Vault Unlocked"] = store.isUnlocked ? "Yes" : "No"
        info["IPC Port"] = "\(IPCServer.defaultPort)"
        info["IPC Socket"] = VaultStore.vaultDirectoryURL.appendingPathComponent("kloak.sock").path
        info["Touch ID Available"] = BiometricAuth.shared.canAuthenticateWithBiometrics() ? "Yes" : "No"
        info["macOS Version"] = ProcessInfo.processInfo.operatingSystemVersionString
        
        return info
    }

    public func formattedDiagnosticsText() -> String {
        let diag = getDiagnostics()
        var text = "=== KLOAK DEVELOPER DIAGNOSTICS ===\n"
        text += "Generated: \(ISO8601DateFormatter().string(from: Date()))\n\n"
        for key in diag.keys.sorted() {
            text += "\(key): \(diag[key] ?? "")\n"
        }
        return text
    }
}
