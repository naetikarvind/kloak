import Foundation

public enum ItemType: String, Codable, CaseIterable, Identifiable, Sendable {
    case login
    case oauth
    case secureNote = "secure_note"
    case card
    case identity

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .login: return "Login"
        case .oauth: return "OAuth Account"
        case .secureNote: return "Secure Note"
        case .card: return "Payment Card"
        case .identity: return "Identity"
        }
    }

    public var iconName: String {
        switch self {
        case .login: return "key.fill"
        case .oauth: return "link.badge.plus"
        case .secureNote: return "note.text"
        case .card: return "creditcard.fill"
        case .identity: return "person.text.rectangle.fill"
        }
    }
}

public struct OAuthDetails: Codable, Hashable, Sendable {
    public var provider: String // Google, Apple, GitHub, Microsoft, GitLab, Slack, Custom
    public var providerDisplayName: String?
    public var accountEmail: String?
    public var clientId: String?
    public var clientSecret: String?
    public var scopes: [String]?
    public var accessToken: String?
    public var refreshToken: String?
    public var expiresAt: String?

    public init(
        provider: String = "Google",
        providerDisplayName: String? = nil,
        accountEmail: String? = nil,
        clientId: String? = nil,
        clientSecret: String? = nil,
        scopes: [String]? = nil,
        accessToken: String? = nil,
        refreshToken: String? = nil,
        expiresAt: String? = nil
    ) {
        self.provider = provider
        self.providerDisplayName = providerDisplayName ?? provider
        self.accountEmail = accountEmail
        self.clientId = clientId
        self.clientSecret = clientSecret
        self.scopes = scopes
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }
}

public struct CustomField: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var value: String
    public var type: String // text, hidden, boolean, url

    public init(id: String = UUID().uuidString, name: String, value: String, type: String = "text") {
        self.id = id
        self.name = name
        self.value = value
        self.type = type
    }
}

public struct VaultItem: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var type: ItemType
    public var title: String
    public var username: String?
    public var password: String?
    public var urls: [String]
    public var notes: String?
    public var totpSecret: String?
    public var oauth: OAuthDetails?
    public var customFields: [CustomField]?
    public var tags: [String]
    public var favorite: Bool
    public var trashed: Bool
    public var createdAt: String
    public var updatedAt: String

    public init(
        id: String = UUID().uuidString,
        type: ItemType = .login,
        title: String,
        username: String? = nil,
        password: String? = nil,
        urls: [String] = [],
        notes: String? = nil,
        totpSecret: String? = nil,
        oauth: OAuthDetails? = nil,
        customFields: [CustomField]? = nil,
        tags: [String] = [],
        favorite: Bool = false,
        trashed: Bool = false,
        createdAt: String = ISO8601DateFormatter().string(from: Date()),
        updatedAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.username = username
        self.password = password
        self.urls = urls
        self.notes = notes
        self.totpSecret = totpSecret
        self.oauth = oauth
        self.customFields = customFields
        self.tags = tags
        self.favorite = favorite
        self.trashed = trashed
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct VaultFolder: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var name: String

    public init(id: String = UUID().uuidString, name: String) {
        self.id = id
        self.name = name
    }
}

public struct VaultSettings: Codable, Hashable, Sendable {
    public var autoLockMinutes: Int
    public var clearClipboardSeconds: Int
    public var biometricsEnabled: Bool
    public var defaultPasswordLength: Int
    public var keychainSyncEnabled: Bool

    public static let `default` = VaultSettings(
        autoLockMinutes: 5,
        clearClipboardSeconds: 30,
        biometricsEnabled: false,
        defaultPasswordLength: 20,
        keychainSyncEnabled: false
    )

    public init(
        autoLockMinutes: Int = 5,
        clearClipboardSeconds: Int = 30,
        biometricsEnabled: Bool = false,
        defaultPasswordLength: Int = 20,
        keychainSyncEnabled: Bool = false
    ) {
        self.autoLockMinutes = autoLockMinutes
        self.clearClipboardSeconds = clearClipboardSeconds
        self.biometricsEnabled = biometricsEnabled
        self.defaultPasswordLength = defaultPasswordLength
        self.keychainSyncEnabled = keychainSyncEnabled
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.autoLockMinutes = try container.decodeIfPresent(Int.self, forKey: .autoLockMinutes) ?? 5
        self.clearClipboardSeconds = try container.decodeIfPresent(Int.self, forKey: .clearClipboardSeconds) ?? 30
        self.biometricsEnabled = try container.decodeIfPresent(Bool.self, forKey: .biometricsEnabled) ?? false
        self.defaultPasswordLength = try container.decodeIfPresent(Int.self, forKey: .defaultPasswordLength) ?? 20
        self.keychainSyncEnabled = try container.decodeIfPresent(Bool.self, forKey: .keychainSyncEnabled) ?? false
    }
}

public struct VaultPayload: Codable, Sendable {
    public var version: Int
    public var items: [VaultItem]
    public var folders: [VaultFolder]
    public var settings: VaultSettings
    public var updatedAt: String
}
