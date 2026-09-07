import SwiftUI
import Foundation

// MARK: - Onboarding Step Enum

public enum OnboardingStep: Int, CaseIterable, Identifiable, Sendable {
    case cloudAccounts = 0
    case appleKeychain = 1
    case vaultPassword = 2
    case ecosystem = 3
    case complete = 4

    public var id: Int { rawValue }

    public var title: String {
        switch self {
        case .cloudAccounts: return "Cloud Accounts"
        case .appleKeychain: return "Apple Keychain"
        case .vaultPassword: return "Master Password"
        case .ecosystem: return "Integrations"
        case .complete: return "Ready"
        }
    }

    public var subtitle: String {
        switch self {
        case .cloudAccounts: return "Connect Google, Proton, or Microsoft"
        case .appleKeychain: return "Link Apple Keychain & Safari credentials"
        case .vaultPassword: return "Initialize local vault encryption"
        case .ecosystem: return "Browser & Raycast native bridges"
        case .complete: return "Your vault is ready"
        }
    }

    public var icon: String {
        switch self {
        case .cloudAccounts: return "cloud.fill"
        case .appleKeychain: return "key.horizontal.fill"
        case .vaultPassword: return "lock.shield.fill"
        case .ecosystem: return "puzzlepiece.extension.fill"
        case .complete: return "checkmark.seal.fill"
        }
    }
}

// MARK: - Cloud Account Provider Enum

public enum CloudProvider: String, CaseIterable, Identifiable, Sendable, Codable {
    case google = "google"
    case proton = "proton"
    case microsoft = "microsoft"

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .google: return "Google"
        case .proton: return "Proton"
        case .microsoft: return "Microsoft"
        }
    }

    public var iconName: String {
        switch self {
        case .google: return "g.circle.fill"
        case .proton: return "shield.fill"
        case .microsoft: return "window.shade.closed"
        }
    }

    public var accentColor: Color {
        switch self {
        case .google: return Color(red: 0.26, green: 0.52, blue: 0.96) // Google Blue
        case .proton: return Color(red: 0.43, green: 0.29, blue: 1.00) // Proton Purple
        case .microsoft: return Color(red: 0.00, green: 0.65, blue: 0.92) // Microsoft Cyan
        }
    }

    public var description: String {
        switch self {
        case .google:
            return "Sync Google Passkeys, Chrome saved logins, and Google Drive encrypted backups."
        case .proton:
            return "Import Proton Pass credentials, SimpleLogin email aliases, and PGP keys."
        case .microsoft:
            return "Connect Microsoft Edge credentials, Authenticator 2FA tokens, and Outlook shield."
        }
    }

    public var featureBadges: [String] {
        switch self {
        case .google:
            return ["Chrome Logins", "Google Passkeys", "Threat Shield"]
        case .proton:
            return ["Proton Pass", "SimpleLogin Aliases", "Encrypted Vault"]
        case .microsoft:
            return ["Edge Passwords", "MS Authenticator", "OneDrive Backup"]
        }
    }
}

// MARK: - Authentication Method Enum

public enum AuthMethod: String, Codable, CaseIterable, Sendable {
    case oauth = "oauth"
    case appPassword = "app_password"
    case manualToken = "manual_token"

    public var displayName: String {
        switch self {
        case .oauth: return "OAuth 2.0 Web Sign-In"
        case .appPassword: return "App Password"
        case .manualToken: return "API Token / Key"
        }
    }
}

// MARK: - Onboarding Account Connection State

public struct OnboardingAccountConnection: Identifiable, Hashable, Sendable, Codable {
    public var id: String { provider.rawValue }
    public var provider: CloudProvider
    public var isConnected: Bool
    public var email: String
    public var token: String?
    public var userName: String?
    public var avatarUrl: String?
    public var accessToken: String?
    public var refreshToken: String?
    public var idToken: String?
    public var tokenExpirationDate: Date?
    public var authMethod: AuthMethod
    public var syncLogins: Bool
    public var syncAliases: Bool
    public var enableThreatShield: Bool

    public init(
        provider: CloudProvider,
        isConnected: Bool = false,
        email: String = "",
        token: String? = nil,
        userName: String? = nil,
        avatarUrl: String? = nil,
        accessToken: String? = nil,
        refreshToken: String? = nil,
        idToken: String? = nil,
        tokenExpirationDate: Date? = nil,
        authMethod: AuthMethod = .oauth,
        syncLogins: Bool = true,
        syncAliases: Bool = true,
        enableThreatShield: Bool = true
    ) {
        self.provider = provider
        self.isConnected = isConnected
        self.email = email
        self.token = token
        self.userName = userName
        self.avatarUrl = avatarUrl
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.idToken = idToken
        self.tokenExpirationDate = tokenExpirationDate
        self.authMethod = authMethod
        self.syncLogins = syncLogins
        self.syncAliases = syncAliases
        self.enableThreatShield = enableThreatShield
    }
}

// MARK: - Keychain Scan Preview

public struct KeychainScanPreview: Sendable {
    public var internetPasswordsCount: Int
    public var genericPasswordsCount: Int
    public var totalCount: Int { internetPasswordsCount + genericPasswordsCount }
    public var isAuthorized: Bool
    public var error: String?

    public init(
        internetPasswordsCount: Int = 0,
        genericPasswordsCount: Int = 0,
        isAuthorized: Bool = false,
        error: String? = nil
    ) {
        self.internetPasswordsCount = internetPasswordsCount
        self.genericPasswordsCount = genericPasswordsCount
        self.isAuthorized = isAuthorized
        self.error = error
    }
}

// MARK: - Password Strength Model

public enum PasswordStrength: Sendable {
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
