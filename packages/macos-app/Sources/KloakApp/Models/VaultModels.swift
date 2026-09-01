import Foundation

public enum ItemType: String, Codable, CaseIterable, Identifiable, Sendable {
    case login
    case secureNote = "secure_note"
    case card
    case identity
    case emailAlias = "email_alias"
    case authenticator

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .login: return "Login"
        case .secureNote: return "Secure Note"
        case .card: return "Payment Card"
        case .identity: return "Identity"
        case .emailAlias: return "Email Alias"
        case .authenticator: return "Authenticator"
        }
    }

    public var iconName: String {
        switch self {
        case .login: return "key.fill"
        case .secureNote: return "note.text"
        case .card: return "creditcard.fill"
        case .identity: return "person.text.rectangle.fill"
        case .emailAlias: return "envelope.badge.shield.half.filled.fill"
        case .authenticator: return "lock.shield.fill"
        }
    }
}

// MARK: - OAuth Details (Legacy / Attached to Logins)

public struct OAuthDetails: Codable, Hashable, Sendable {
    public var provider: String
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

// MARK: - Card Details

public struct CardDetails: Codable, Hashable, Sendable {
    public var cardholderName: String?
    public var number: String?
    public var brand: String?      // visa, mastercard, amex, discover, other
    public var expMonth: String?
    public var expYear: String?
    public var cvv: String?
    public var billingAddress: String?

    public init(
        cardholderName: String? = nil,
        number: String? = nil,
        brand: String? = "visa",
        expMonth: String? = nil,
        expYear: String? = nil,
        cvv: String? = nil,
        billingAddress: String? = nil
    ) {
        self.cardholderName = cardholderName
        self.number = number
        self.brand = brand
        self.expMonth = expMonth
        self.expYear = expYear
        self.cvv = cvv
        self.billingAddress = billingAddress
    }
}

// MARK: - Identity Details

public struct IdentityDetails: Codable, Hashable, Sendable {
    public var firstName: String?
    public var lastName: String?
    public var email: String?
    public var phone: String?
    public var address1: String?
    public var city: String?
    public var state: String?
    public var zip: String?
    public var country: String?
    public var dateOfBirth: String?
    public var passportNumber: String?
    public var ssn: String?

    public init(
        firstName: String? = nil,
        lastName: String? = nil,
        email: String? = nil,
        phone: String? = nil,
        address1: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zip: String? = nil,
        country: String? = nil,
        dateOfBirth: String? = nil,
        passportNumber: String? = nil,
        ssn: String? = nil
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.phone = phone
        self.address1 = address1
        self.city = city
        self.state = state
        self.zip = zip
        self.country = country
        self.dateOfBirth = dateOfBirth
        self.passportNumber = passportNumber
        self.ssn = ssn
    }

    public var fullName: String? {
        let parts = [firstName, lastName].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }

    public var fullAddress: String? {
        let parts = [address1, city, state, zip, country].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }
}

// MARK: - Email Alias Details

public struct AliasDetails: Codable, Hashable, Sendable {
    public var aliasEmail: String?
    public var forwardTo: String?
    public var provider: String?   // DuckDuckGo, SimpleLogin, Firefox Relay, iCloud, Custom

    public init(
        aliasEmail: String? = nil,
        forwardTo: String? = nil,
        provider: String? = nil
    ) {
        self.aliasEmail = aliasEmail
        self.forwardTo = forwardTo
        self.provider = provider
    }
}

// MARK: - Authenticator Details

public struct AuthenticatorDetails: Codable, Hashable, Sendable {
    public var issuer: String?
    public var algorithm: String?  // TOTP, HOTP
    public var digits: Int?        // 6 or 8
    public var period: Int?        // 30 or 60

    public init(
        issuer: String? = nil,
        algorithm: String? = "TOTP",
        digits: Int? = 6,
        period: Int? = 30
    ) {
        self.issuer = issuer
        self.algorithm = algorithm
        self.digits = digits
        self.period = period
    }
}

// MARK: - Custom Field

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

// MARK: - Vault Item

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
    public var card: CardDetails?
    public var identity: IdentityDetails?
    public var alias: AliasDetails?
    public var authenticatorDetails: AuthenticatorDetails?
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
        card: CardDetails? = nil,
        identity: IdentityDetails? = nil,
        alias: AliasDetails? = nil,
        authenticatorDetails: AuthenticatorDetails? = nil,
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
        self.card = card
        self.identity = identity
        self.alias = alias
        self.authenticatorDetails = authenticatorDetails
        self.customFields = customFields
        self.tags = tags
        self.favorite = favorite
        self.trashed = trashed
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Vault Folder

public struct VaultFolder: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var name: String

    public init(id: String = UUID().uuidString, name: String) {
        self.id = id
        self.name = name
    }
}

// MARK: - Vault Settings

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

// MARK: - Vault Payload

public struct VaultPayload: Codable, Sendable {
    public var version: Int
    public var items: [VaultItem]
    public var folders: [VaultFolder]
    public var settings: VaultSettings
    public var updatedAt: String
}
