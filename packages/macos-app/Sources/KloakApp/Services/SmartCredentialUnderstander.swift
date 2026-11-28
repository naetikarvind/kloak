import Foundation

/// Canonical credential role used to enforce cross-type combining and smart matching.
public enum CombinableCredentialRole: String, CaseIterable, Codable, Sendable, Hashable {
    case login
    case authenticator
    case recoveryCode
    case other

    public var displayName: String {
        switch self {
        case .login: return "Login"
        case .authenticator: return "Authenticator (2FA)"
        case .recoveryCode: return "Recovery Codes"
        case .other: return "Other"
        }
    }

    public var shortLabel: String {
        switch self {
        case .login: return "Login"
        case .authenticator: return "2FA OTP"
        case .recoveryCode: return "Recovery"
        case .other: return "Note/Other"
        }
    }

    public var isCombinable: Bool {
        self != .other
    }
}

/// Validation result checking whether a set of items may be combined.
public struct CombineValidationResult: Sendable, Equatable {
    public let isAllowed: Bool
    public let reason: String?
    public let roles: [CombinableCredentialRole]

    public init(isAllowed: Bool, reason: String? = nil, roles: [CombinableCredentialRole] = []) {
        self.isAllowed = isAllowed
        self.reason = reason
        self.roles = roles
    }
}

/// Extracted semantic understanding of a credential item.
public struct CredentialUnderstanding: Sendable, Equatable {
    public let itemId: String
    public let role: CombinableCredentialRole
    public let hasAuthenticatorCapability: Bool
    public let hasRecoveryCapability: Bool
    public let primaryServiceKey: String
    public let serviceTokens: [String]
    public let domains: Set<String>
    public let usernameHint: String?
}

/// Confidence score and explanation for matching two credentials of different types.
public struct SmartServiceMatch: Sendable, Equatable {
    public let confidence: Double
    public let reason: String
    public let serviceKey: String
}

/// Result of consolidating cross-type items (e.g. Login + Recovery Codes) during import.
public struct CrossTypeConsolidationResult: Sendable {
    public let items: [VaultItem]
    public let combinedCount: Int
    public let combinedDescriptions: [String]
}

/// Smart Credential Understander that classifies credential roles, enforces strict
/// cross-type combination (`Login` + `Authenticator` / `Recovery Code`), and matches
/// similarly named or related records across titles, URLs, notes, and usernames.
public final class SmartCredentialUnderstander: Sendable {
    public static let shared = SmartCredentialUnderstander()

    private init() {}

    // MARK: - Brand Aliases & Lexicon

    private static let brandAliases: [String: String] = [
        "gmail": "google",
        "googlemail": "google",
        "googledrive": "google",
        "protonmail": "proton",
        "protonme": "proton",
        "protonvpn": "proton",
        "protonpass": "proton",
        "protondrive": "proton",
        "pm": "proton",
        "outlook": "microsoft",
        "hotmail": "microsoft",
        "live": "microsoft",
        "office365": "microsoft",
        "microsoftonline": "microsoft",
        "msn": "microsoft",
        "azure": "microsoft",
        "appleid": "apple",
        "icloud": "apple",
        "amazonaws": "aws",
        "twitter": "twitter",
        "x": "twitter",
        "fb": "facebook",
        "ig": "instagram",
        "chatgpt": "openai",
        "ymail": "yahoo",
        "gh": "github",
        "1password": "onepassword",
        "lastpass": "lastpass",
        "bitwarden": "bitwarden",
        "cloudflare": "cloudflare",
        "discord": "discord",
        "github": "github",
        "gitlab": "gitlab",
        "bitbucket": "bitbucket",
        "digitalocean": "digitalocean",
        "dropbox": "dropbox",
        "linkedin": "linkedin",
        "reddit": "reddit",
        "twitch": "twitch",
        "steam": "steam",
        "epicgames": "epicgames",
        "nintendo": "nintendo",
        "playstation": "playstation",
        "sony": "sony",
        "stripe": "stripe",
        "paypal": "paypal",
        "coinbase": "coinbase",
        "binance": "binance",
        "kraken": "kraken",
        "npm": "npmjs",
        "npmjs": "npmjs",
        "pypi": "pypi",
        "docker": "docker",
        "dockerhub": "docker",
        "vercel": "vercel",
        "netlify": "netlify",
        "heroku": "heroku",
        "supabase": "supabase",
        "firebase": "firebase"
    ]

    private static let knownTLDs: Set<String> = [
        "com", "org", "net", "io", "dev", "app", "co", "ai", "me", "tv",
        "gg", "xyz", "edu", "gov", "info", "biz", "cloud", "tech", "sh",
        "so", "to", "cc", "us", "uk", "ca", "de", "fr", "jp", "in", "au",
        "nl", "ch", "se", "no", "fi", "it", "es", "br", "ru", "kr"
    ]

    private static let compoundSuffixTLDs: Set<String> = [
        "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "co.in", "co.jp", "com.br", "co.nz"
    ]

    private static let authSubdomains: Set<String> = [
        "www", "login", "signin", "sign-in", "auth", "oauth", "sso", "id",
        "account", "accounts", "myaccount", "app", "portal", "web", "mail",
        "gist", "console", "dash", "dashboard", "cloud", "api", "secure", "m", "mobile"
    ]

    /// Noise/role words removed anywhere in a title or filename when discovering the underlying service.
    private static let noiseWords: Set<String> = [
        "recovery", "recover", "code", "codes", "backup", "backups",
        "authenticator", "auth", "2fa", "mfa", "totp", "otp", "hotp",
        "u2f", "fido", "fido2", "passkey", "passkeys",
        "token", "tokens", "key", "keys", "kit", "kits",
        "emergency", "rescue", "scratch", "onetime", "singleuse", "offline",
        "security", "verification", "verify", "verified",
        "secret", "secrets", "phrase", "phrases", "seed", "mnemonic",
        "note", "notes", "secure", "login", "logins", "account", "accounts",
        "password", "passwords", "pass", "cred", "creds", "credential", "credentials",
        "vault", "export", "exported", "import", "imported",
        "txt", "text", "md", "markdown", "csv", "json", "xml", "kdbx", "1pux",
        "file", "sheet", "list", "copy", "for", "of", "the", "my", "and", "or",
        "to", "on", "in", "at", "with", "from", "your", "user", "username", "email",
        "step", "factor", "app", "portal", "signin", "sso", "website", "service",
        "generated", "saved", "downloaded", "personal", "work", "primary", "main", "old", "new"
    ]

    /// Concatenated suffixes on a single token (e.g. `githubrecoverycodes` -> `github`).
    private static let concatenatedRoleSuffixes: [String] = [
        "recoverycodes", "recoverycode", "recoverykeys", "recoverykey",
        "backupcodes", "backupcode", "scratchcodes", "scratchcode",
        "authenticator", "twofactor", "recovery", "backup", "codes", "tokens", "2fa", "mfa", "totp", "otp"
    ]

    private static let fileExtensions: [String] = [
        ".txt", ".text", ".md", ".markdown", ".note", ".json", ".csv", ".xml", ".kdbx", ".1pux", ".key"
    ]

    // MARK: - Role & Capability Classification

    /// Classifies an item into a strictly combinable role (`login`, `authenticator`, `recoveryCode`, or `other`).
    public func classifyRole(_ item: VaultItem) -> CombinableCredentialRole {
        let hasPassword = !trimmedNonEmpty(item.password).isEmpty
        let hasTotp = !trimmedNonEmpty(item.totpSecret).isEmpty
        let hasRecovery = isRecoveryArtifact(item)

        if item.type == .authenticator {
            return .authenticator
        }

        if item.type == .secureNote {
            if hasRecovery {
                return .recoveryCode
            }
            if hasTotp {
                return .authenticator
            }
            return .other
        }

        if item.type == .login {
            // Standalone recovery code entries imported as `.login` (e.g. from CSV/Bitwarden/manual notes)
            if !hasPassword && !hasTotp && hasRecovery {
                return .recoveryCode
            }
            // Standalone TOTP entries imported as `.login` without a password
            if !hasPassword && hasTotp && !hasRecovery {
                return .authenticator
            }
            return .login
        }

        return .other
    }

    public func hasAuthenticatorCapability(_ item: VaultItem) -> Bool {
        item.type == .authenticator || !trimmedNonEmpty(item.totpSecret).isEmpty
    }

    public func hasRecoveryCapability(_ item: VaultItem) -> Bool {
        if item.type == .secureNote && isRecoveryArtifact(item) {
            return true
        }
        return !item.usedRecoveryCodes.isEmpty ||
            item.tags.contains(where: { $0.caseInsensitiveCompare("Recovery Codes") == .orderedSame || $0.caseInsensitiveCompare("Recovery") == .orderedSame }) ||
            (!item.recoveryCodesList.isEmpty && isRecoveryArtifact(item))
    }

    private func isRecoveryArtifact(_ item: VaultItem) -> Bool {
        if item.isRecoveryCode {
            return true
        }
        let lowerTitle = item.title.lowercased()
        let titleSignals = [
            "recovery", "backup code", "backup key", "scratch code",
            "one-time code", "onetime code", "emergency", "rescue code"
        ]
        if titleSignals.contains(where: { lowerTitle.contains($0) }) {
            return !item.recoveryCodesList.isEmpty || !(item.notes ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return false
    }

    // MARK: - Strict Cross-Type Combination Rules

    /// Validates that all items can be combined:
    /// - At least 2 items
    /// - Only combinable roles (`login`, `authenticator`, `recoveryCode`)
    /// - Strictly distinct roles (e.g. Login + Login is forbidden)
    /// - No duplicate 2FA TOTP or duplicate Recovery Code capabilities
    public func validateCombination(_ items: [VaultItem]) -> CombineValidationResult {
        let roles = items.map(classifyRole)
        guard items.count >= 2 else {
            return CombineValidationResult(
                isAllowed: false,
                reason: "Select at least 2 credentials of different types (e.g. Login + Authenticator / Recovery Code).",
                roles: roles
            )
        }

        if let unsupportedIndex = roles.firstIndex(of: .other) {
            let title = items[unsupportedIndex].title.isEmpty ? "Selected item" : items[unsupportedIndex].title
            return CombineValidationResult(
                isAllowed: false,
                reason: "\"\(title)\" cannot be combined — only Logins, Authenticators & Recovery Codes are combinable.",
                roles: roles
            )
        }

        var seenRoles: Set<CombinableCredentialRole> = []
        for role in roles {
            if seenRoles.contains(role) {
                return CombineValidationResult(
                    isAllowed: false,
                    reason: "Cannot combine multiple \(role.displayName) credentials — only different types (Login + Authenticator / Recovery Code) can be combined.",
                    roles: roles
                )
            }
            seenRoles.insert(role)
        }

        let totpOwners = items.filter { hasAuthenticatorCapability($0) }
        if totpOwners.count > 1 {
            return CombineValidationResult(
                isAllowed: false,
                reason: "Cannot combine — more than one selected credential already contains an Authenticator (2FA) secret.",
                roles: roles
            )
        }

        let recoveryOwners = items.filter { hasRecoveryCapability($0) }
        if recoveryOwners.count > 1 {
            return CombineValidationResult(
                isAllowed: false,
                reason: "Cannot combine — more than one selected credential already contains Recovery Codes.",
                roles: roles
            )
        }

        return CombineValidationResult(isAllowed: true, reason: nil, roles: roles)
    }

    /// Checks whether toggling/adding `candidate` to `currentSelection` would remain valid.
    public func canAddItem(_ candidate: VaultItem, to currentSelection: [VaultItem]) -> CombineValidationResult {
        if currentSelection.contains(where: { $0.id == candidate.id }) {
            return CombineValidationResult(isAllowed: true, reason: nil, roles: currentSelection.map(classifyRole))
        }
        let role = classifyRole(candidate)
        if !role.isCombinable {
            return CombineValidationResult(
                isAllowed: false,
                reason: "Not combinable — only Logins, Authenticators & Recovery Codes are supported.",
                roles: [role]
            )
        }
        if currentSelection.isEmpty {
            return CombineValidationResult(isAllowed: true, reason: nil, roles: [role])
        }
        return validateCombination(currentSelection + [candidate])
    }

    // MARK: - Semantic Service Extraction & Matching

    public func understand(_ item: VaultItem) -> CredentialUnderstanding {
        let role = classifyRole(item)
        var domains: Set<String> = []

        for url in item.urls {
            if let d = normalizeDomain(url) {
                domains.insert(d)
            }
        }

        let noteLines = (item.notes ?? "")
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        // Inspect header/comment lines & URLs inside notes for service context
        var noteHeaderParts: [String] = []
        for line in noteLines.prefix(10) {
            for urlStr in extractUrls(from: line) {
                if let d = normalizeDomain(urlStr) {
                    domains.insert(d)
                }
            }
            if looksLikeHeaderOrMetadataLine(line) {
                noteHeaderParts.append(line)
            }
        }

        for urlStr in extractUrls(from: item.title) {
            if let d = normalizeDomain(urlStr) {
                domains.insert(d)
            }
        }

        let usernameHint = extractUsernameHint(from: item, noteLines: noteLines)

        // Build ordered tokens: title tokens -> domain brand tokens -> note header tokens
        var tokens: [String] = extractServiceTokens(from: item.title, excludingEmail: usernameHint)

        let domainTokens = domains
            .sorted()
            .compactMap { brandFromDomain($0) }
        for tok in domainTokens where !tokens.contains(tok) {
            tokens.append(tok)
        }

        if tokens.isEmpty && !noteHeaderParts.isEmpty {
            for line in noteHeaderParts {
                let lineTokens = extractServiceTokens(from: line, excludingEmail: usernameHint)
                for tok in lineTokens where !tokens.contains(tok) {
                    tokens.append(tok)
                }
            }
        } else if !noteHeaderParts.isEmpty {
            for line in noteHeaderParts.prefix(4) {
                let lineTokens = extractServiceTokens(from: line, excludingEmail: usernameHint)
                for tok in lineTokens where !tokens.contains(tok) {
                    tokens.append(tok)
                }
            }
        }

        let primaryServiceKey: String
        if let first = tokens.first {
            primaryServiceKey = canonicalBrand(first)
        } else if let firstDomainBrand = domainTokens.first {
            primaryServiceKey = firstDomainBrand
        } else {
            primaryServiceKey = ""
        }

        return CredentialUnderstanding(
            itemId: item.id,
            role: role,
            hasAuthenticatorCapability: hasAuthenticatorCapability(item),
            hasRecoveryCapability: hasRecoveryCapability(item),
            primaryServiceKey: primaryServiceKey,
            serviceTokens: tokens,
            domains: domains,
            usernameHint: usernameHint
        )
    }

    public func extractServiceKey(from item: VaultItem) -> String {
        understand(item).primaryServiceKey
    }

    private static let publicEmailProviders: Set<String> = [
        "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com",
        "hotmail.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
        "mac.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "mail.com", "zoho.com"
    ]

    /// Evaluates whether two different-type credentials belong to the same service & compatible account.
    /// Returns nil when they cannot combine (same type or capability collision), usernames actively conflict,
    /// or service similarity is below `minimumConfidence`.
    public func match(
        _ a: VaultItem,
        _ b: VaultItem,
        requireCompatibleUsernames: Bool = true,
        minimumConfidence: Double = 0.80
    ) -> SmartServiceMatch? {
        guard a.id != b.id else { return nil }
        let validation = validateCombination([a, b])
        guard validation.isAllowed else { return nil }

        let uA = understand(a)
        let uB = understand(b)

        if requireCompatibleUsernames && !areUsernamesCompatible(uA.usernameHint, uB.usernameHint) {
            return nil
        }

        let sameUser = bothNonEmptyAndEqual(uA.usernameHint, uB.usernameHint)

        let domainIntersection = uA.domains.intersection(uB.domains)
        if !domainIntersection.isEmpty {
            let domainName = domainIntersection.sorted().first ?? uA.primaryServiceKey
            let userBonus = sameUser ? 0.01 : 0.0
            let confidence = min(1.0, 0.98 + userBonus)
            return confidence >= minimumConfidence ? SmartServiceMatch(
                confidence: confidence,
                reason: "Same domain (\(domainName))",
                serviceKey: !uA.primaryServiceKey.isEmpty ? uA.primaryServiceKey : (brandFromDomain(domainName) ?? domainName)
            ) : nil
        }

        let keyA = uA.primaryServiceKey
        let keyB = uB.primaryServiceKey

        // Dedicated email-provider or corporate email domain brand cross-match (e.g. `user@proton.me` or `dev@company.io`)
        if let emailBrand = sharedBrandedEmailEcosystem(uA, uB, keyA: keyA, keyB: keyB) {
            let confidence = sameUser ? 0.88 : 0.83
            if confidence >= minimumConfidence {
                let display = emailBrand.prefix(1).uppercased() + emailBrand.dropFirst()
                return SmartServiceMatch(
                    confidence: confidence,
                    reason: sameUser ? "Same \(display) account email" : "Matched \(display) account ecosystem",
                    serviceKey: emailBrand
                )
            }
        }

        guard !keyA.isEmpty || !uA.serviceTokens.isEmpty,
              !keyB.isEmpty || !uB.serviceTokens.isEmpty else {
            return nil
        }

        let exactKey = !keyA.isEmpty && keyA == keyB
        let sameTokenOverlap = Set(uA.serviceTokens.map(canonicalBrand))
            .intersection(Set(uB.serviceTokens.map(canonicalBrand)))

        if exactKey || !sameTokenOverlap.isEmpty {
            let sharedKey = exactKey ? keyA : (sameTokenOverlap.sorted().first ?? keyA)
            let boost = sameUser ? 0.03 : 0.0
            let confidence = min(0.99, (exactKey ? 0.95 : 0.90) + boost)
            guard confidence >= minimumConfidence else { return nil }
            let display = displayServiceName(from: uA, fallback: uB, defaultKey: sharedKey)
            let reason = sameUser
                ? "Matched \(display) + account"
                : "Smart match: \(display)"
            return SmartServiceMatch(confidence: confidence, reason: reason, serviceKey: sharedKey)
        }

        // Prefix / compound containment & fuzzy similarity on service tokens (handles e.g. `githb` <-> `github`, `proton` <-> `protonmail`)
        var bestScore = 0.0
        var bestKey = keyA.isEmpty ? (uA.serviceTokens.first ?? "") : keyA

        let candidatesA = Set(([keyA] + uA.serviceTokens).filter { !$0.isEmpty }.map(canonicalBrand))
        let candidatesB = Set(([keyB] + uB.serviceTokens).filter { !$0.isEmpty }.map(canonicalBrand))

        for tA in candidatesA {
            for tB in candidatesB {
                if tA.count >= 4 && tB.count >= 4 {
                    if tA.contains(tB) || tB.contains(tA) {
                        let shorter = min(tA.count, tB.count)
                        let longer = max(tA.count, tB.count)
                        let ratio = Double(shorter) / Double(longer)
                        if ratio >= 0.55 {
                            let score = 0.80 + (0.14 * ratio) + (sameUser ? 0.04 : 0.0)
                            if score > bestScore {
                                bestScore = score
                                bestKey = tA.count <= tB.count ? tA : tB
                            }
                        }
                    }
                    let sim = levenshteinSimilarity(tA, tB)
                    if sim >= 0.72 && min(tA.count, tB.count) >= 4 {
                        let score = 0.72 + (0.20 * sim) + (sameUser ? 0.04 : 0.0)
                        if score > bestScore {
                            bestScore = score
                            bestKey = tA.count >= tB.count ? tA : tB
                        }
                    }
                } else if sameUser && min(tA.count, tB.count) >= 3 && (tA.hasPrefix(tB.prefix(3)) || tB.hasPrefix(tA.prefix(3))) {
                    let score = 0.75
                    if score > bestScore {
                        bestScore = score
                        bestKey = tA.count >= tB.count ? tA : tB
                    }
                }
            }
        }

        if bestScore >= minimumConfidence {
            let display = bestKey.prefix(1).uppercased() + bestKey.dropFirst()
            return SmartServiceMatch(
                confidence: min(0.95, bestScore),
                reason: sameUser ? "Similar name (\(display)) + same account" : "Similar service name (\(display))",
                serviceKey: bestKey
            )
        }

        return nil
    }

    private func sharedBrandedEmailEcosystem(
        _ uA: CredentialUnderstanding,
        _ uB: CredentialUnderstanding,
        keyA: String,
        keyB: String
    ) -> String? {
        func extractEmailBrand(_ hint: String?) -> (brand: String, domain: String)? {
            guard let h = hint, let atIdx = h.firstIndex(of: "@") else { return nil }
            let dom = String(h[h.index(after: atIdx)...]).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !dom.isEmpty, let brand = brandFromDomain(dom) else { return nil }
            return (canonicalBrand(brand), dom)
        }

        let bA = extractEmailBrand(uA.usernameHint)
        let bB = extractEmailBrand(uB.usernameHint)

        // If both share an exact branded/non-free-webmail domain (or proton/icloud ecosystem when paired with a title/domain match)
        if let a = bA, uB.primaryServiceKey == a.brand || uB.domains.contains(a.domain) {
            if !Self.publicEmailProviders.contains(a.domain) || a.brand == "proton" || a.brand == "apple" {
                return a.brand
            }
        }
        if let b = bB, uA.primaryServiceKey == b.brand || uA.domains.contains(b.domain) {
            if !Self.publicEmailProviders.contains(b.domain) || b.brand == "proton" || b.brand == "apple" {
                return b.brand
            }
        }
        if let a = bA, let b = bB, a.domain == b.domain && !Self.publicEmailProviders.contains(a.domain) {
            return keyA.isEmpty ? (keyB.isEmpty ? a.brand : keyB) : keyA
        }
        return nil
    }

    /// Computes a best match score between a candidate item and an active manual selection.
    /// Does not reject differing usernames so users in the manual combiner still see helpful suggestions,
    /// though matching usernames rank higher.
    public func suggestionMatch(for candidate: VaultItem, against selection: [VaultItem]) -> SmartServiceMatch? {
        guard !selection.isEmpty else { return nil }
        guard canAddItem(candidate, to: selection).isAllowed else { return nil }
        var best: SmartServiceMatch?
        for selected in selection {
            if let m = match(selected, candidate, requireCompatibleUsernames: false, minimumConfidence: 0.65) {
                if best == nil || m.confidence > best!.confidence {
                    best = m
                }
            }
        }
        return best
    }

    /// Returns ranked different-type companion items that the Smart Recommender suggests combining
    /// with the current selection.
    public func recommendCompanions(
        for selection: [VaultItem],
        in allItems: [VaultItem],
        minimumConfidence: Double = 0.65
    ) -> [(item: VaultItem, match: SmartServiceMatch)] {
        guard !selection.isEmpty else { return [] }
        let selectedIds = Set(selection.map(\.id))
        var results: [(item: VaultItem, match: SmartServiceMatch)] = []

        for candidate in allItems where !candidate.trashed && !selectedIds.contains(candidate.id) {
            guard canAddItem(candidate, to: selection).isAllowed else { continue }
            var bestMatch: SmartServiceMatch?
            for selected in selection {
                if let m = match(selected, candidate, requireCompatibleUsernames: false, minimumConfidence: minimumConfidence) {
                    if bestMatch == nil || m.confidence > bestMatch!.confidence {
                        bestMatch = m
                    }
                }
            }
            if let m = bestMatch {
                results.append((candidate, m))
            }
        }

        return results.sorted {
            if abs($0.match.confidence - $1.match.confidence) > 0.001 {
                return $0.match.confidence > $1.match.confidence
            }
            return $0.item.title.localizedCaseInsensitiveCompare($1.item.title) == .orderedAscending
        }
    }

    // MARK: - Import Cross-Type Consolidation

    /// Finds the best existing cross-type vault match (if any) for an imported file item.
    public func findBestExistingMatch(for fileItem: VaultItem, in vaultItems: [VaultItem]) -> (item: VaultItem, match: SmartServiceMatch)? {
        let activeItems = vaultItems.filter { !$0.trashed }
        var bestCandidate: (VaultItem, SmartServiceMatch)?
        for existing in activeItems {
            guard let m = match(existing, fileItem, requireCompatibleUsernames: true),
                  m.confidence >= 0.82 else {
                continue
            }
            if bestCandidate == nil || m.confidence > bestCandidate!.1.confidence {
                bestCandidate = (existing, m)
            }
        }
        return bestCandidate
    }

    /// Checks if `candidate` is a redundant duplicate of `existing` (for example, importing or leaving
    /// a separate recovery/2FA entry whose recovery codes or TOTP secret are already stored inside `existing`).
    public func isRedundantDuplicate(of existing: VaultItem, candidate: VaultItem) -> Bool {
        guard !existing.trashed, !candidate.trashed, existing.id != candidate.id else { return false }

        let uE = understand(existing)
        let uC = understand(candidate)

        let sameServiceKey = !uE.primaryServiceKey.isEmpty && uE.primaryServiceKey == uC.primaryServiceKey
        let sharedDomain = !uE.domains.intersection(uC.domains).isEmpty
        guard sameServiceKey || sharedDomain else { return false }
        guard areUsernamesCompatible(uE.usernameHint, uC.usernameHint) else { return false }

        let candCodes = Set(candidate.recoveryCodesList)
        let existCodes = Set(existing.recoveryCodesList)
        let hasIdenticalOrSubsetRecovery = !candCodes.isEmpty && !existCodes.isEmpty && candCodes.isSubset(of: existCodes)

        let candPass = trimmedNonEmpty(candidate.password)
        let existPass = trimmedNonEmpty(existing.password)
        let candTotp = trimmedNonEmpty(candidate.totpSecret)
        let existTotp = trimmedNonEmpty(existing.totpSecret)

        let addsNoNewPassword = candPass.isEmpty || candPass == existPass
        let addsNoNewTotp = candTotp.isEmpty || candTotp == existTotp

        if hasIdenticalOrSubsetRecovery && addsNoNewPassword && addsNoNewTotp {
            return true
        }

        if !candTotp.isEmpty && candTotp == existTotp && addsNoNewPassword && candCodes.isSubset(of: existCodes) {
            return true
        }

        return false
    }

    /// Finds an existing vault item that already contains all security material of `fileItem`.
    public func findRedundantDuplicateTarget(for fileItem: VaultItem, in vaultItems: [VaultItem]) -> VaultItem? {
        vaultItems.first { isRedundantDuplicate(of: $0, candidate: fileItem) }
    }

    /// Automatically consolidates cross-type items (e.g. `GitHub` Login + `github recovery code`)
    /// among a batch of newly imported items before adding them to the vault.
    public func consolidateIncomingBatch(
        _ incomingItems: [VaultItem],
        combiner: (String, [VaultItem]) -> VaultItem
    ) -> CrossTypeConsolidationResult {
        guard incomingItems.count >= 2 else {
            return CrossTypeConsolidationResult(items: incomingItems, combinedCount: 0, combinedDescriptions: [])
        }

        let working = incomingItems
        var consumedIds: Set<String> = []
        var output: [VaultItem] = []
        var combinedCount = 0
        var descriptions: [String] = []

        // Prefer logins first, then authenticators, then recovery codes as anchors
        let sortedIndices = working.indices.sorted { i, j in
            rolePriority(classifyRole(working[i])) < rolePriority(classifyRole(working[j]))
        }

        for anchorIdx in sortedIndices {
            let anchor = working[anchorIdx]
            if consumedIds.contains(anchor.id) { continue }

            let anchorRole = classifyRole(anchor)
            guard anchorRole.isCombinable else { continue }

            var cluster: [VaultItem] = [anchor]
            var clusterReasonParts: [String] = []

            for candIdx in sortedIndices {
                let candidate = working[candIdx]
                if candidate.id == anchor.id || consumedIds.contains(candidate.id) { continue }
                guard canAddItem(candidate, to: cluster).isAllowed else { continue }

                // Must smart-match the primary anchor cleanly
                if let m = match(anchor, candidate, requireCompatibleUsernames: true), m.confidence >= 0.82 {
                    cluster.append(candidate)
                    clusterReasonParts.append(classifyRole(candidate).shortLabel)
                }
            }

            if cluster.count >= 2 {
                let primary = pickPrimaryItem(from: cluster)
                let merged = combiner(primary.id, cluster)
                output.append(merged)
                for c in cluster {
                    consumedIds.insert(c.id)
                }
                combinedCount += cluster.count - 1
                let label = ([classifyRole(primary).shortLabel] + clusterReasonParts).joined(separator: " + ")
                descriptions.append("\(merged.title) (\(label))")
            }
        }

        for item in working where !consumedIds.contains(item.id) {
            output.append(item)
        }

        return CrossTypeConsolidationResult(
            items: output,
            combinedCount: combinedCount,
            combinedDescriptions: descriptions
        )
    }

    /// Chooses the cleanest primary item when combining cross-type items (prefers Login > Authenticator > Recovery).
    public func pickPrimaryItem(from cluster: [VaultItem]) -> VaultItem {
        cluster.min { a, b in
            let pA = rolePriority(classifyRole(a))
            let pB = rolePriority(classifyRole(b))
            if pA != pB { return pA < pB }
            return a.title.count <= b.title.count
        } ?? cluster[0]
    }

    private func rolePriority(_ role: CombinableCredentialRole) -> Int {
        switch role {
        case .login: return 0
        case .authenticator: return 1
        case .recoveryCode: return 2
        case .other: return 3
        }
    }

    // MARK: - Internal Tokenization & Normalization Helpers

    public func extractServiceTokens(from rawText: String, excludingEmail: String? = nil) -> [String] {
        var text = rawText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !text.isEmpty else { return [] }

        for ext in Self.fileExtensions {
            if text.hasSuffix(ext) {
                text = String(text.dropLast(ext.count))
                break
            }
        }

        if let email = excludingEmail?.lowercased(), !email.isEmpty {
            text = text.replacingOccurrences(of: email, with: " ")
        }

        // Remove inline email addresses (so `john@gmail.com` doesn't pollute `"GitHub (john@gmail.com)"` with `"gmail"`)
        text = stripPattern(#"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}"#, in: text)

        // Replace common multi-word role phrases before tokenization
        let multiWordNoise = [
            "two-factor", "two factor", "two-step", "two step",
            "one-time", "one time", "single-use", "single use",
            "recovery codes", "recovery code", "recovery keys", "recovery key",
            "backup codes", "backup code", "emergency kit", "emergency codes",
            "scratch codes", "scratch code"
        ]
        for phrase in multiWordNoise {
            text = text.replacingOccurrences(of: phrase, with: " ")
        }

        // Split on whitespace and non-dot punctuation first so domain tokens remain intact for TLD extraction
        let rawChunks = text.components(separatedBy: CharacterSet(charactersIn: " \t\n\r_-/:()[]{},|\"'<>!?#"))
            .filter { !$0.isEmpty }

        var result: [String] = []
        for chunk in rawChunks {
            if let domainBrand = extractDomainBrandIfHostLike(chunk) {
                let canonical = canonicalBrand(domainBrand)
                if !canonical.isEmpty && !Self.noiseWords.contains(canonical) && !result.contains(canonical) {
                    result.append(canonical)
                }
                continue
            }

            let dotParts = chunk.components(separatedBy: ".").filter { !$0.isEmpty }
            for part in dotParts {
                var token = part.trimmingCharacters(in: .punctuationCharacters)
                guard !token.isEmpty else { continue }
                token = stripConcatenatedRoleSuffix(token)
                guard !token.isEmpty else { continue }
                if Self.noiseWords.contains(token) { continue }
                if token.count == 1 && token != "x" { continue }
                if token.allSatisfy({ $0.isNumber }) { continue }

                let canonical = canonicalBrand(token)
                if !Self.noiseWords.contains(canonical) && !result.contains(canonical) {
                    result.append(canonical)
                }
            }
        }

        return result
    }

    private func stripConcatenatedRoleSuffix(_ token: String) -> String {
        var current = token
        for suffix in Self.concatenatedRoleSuffixes {
            if current.count > suffix.count + 2 && current.hasSuffix(suffix) {
                current = String(current.dropLast(suffix.count))
                break
            }
        }
        return current
    }

    private func extractDomainBrandIfHostLike(_ chunk: String) -> String? {
        let cleaned = chunk.trimmingCharacters(in: CharacterSet(charactersIn: ".:/"))
        guard cleaned.contains(".") else { return nil }
        let parts = cleaned.components(separatedBy: ".").filter { !$0.isEmpty }
        guard parts.count >= 2, let last = parts.last, Self.knownTLDs.contains(last) else {
            return nil
        }
        return brandFromDomain(cleaned)
    }

    public func normalizeDomain(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return nil }

        let withScheme = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard let url = URL(string: withScheme), var host = url.host?.lowercased(), !host.isEmpty else {
            return nil
        }
        if host.hasPrefix("www.") {
            host = String(host.dropFirst(4))
        }
        let parts = host.components(separatedBy: ".").filter { !$0.isEmpty }
        guard parts.count >= 2 else { return nil }

        if parts.count >= 3 {
            let lastTwo = "\(parts[parts.count - 2]).\(parts[parts.count - 1])"
            if Self.compoundSuffixTLDs.contains(lastTwo) {
                return "\(parts[parts.count - 3]).\(lastTwo)"
            }
        }

        // Preserve meaningful root + TLD
        return "\(parts[parts.count - 2]).\(parts[parts.count - 1])"
    }

    public func brandFromDomain(_ domain: String) -> String? {
        let parts = domain.lowercased().components(separatedBy: ".").filter { !$0.isEmpty }
        guard parts.count >= 2 else { return nil }

        var meaningful = parts
        // Drop ccTLD/TLD tail
        if meaningful.count >= 3 {
            let lastTwo = "\(meaningful[meaningful.count - 2]).\(meaningful[meaningful.count - 1])"
            if Self.compoundSuffixTLDs.contains(lastTwo) {
                meaningful.removeLast(2)
            } else {
                meaningful.removeLast()
            }
        } else {
            meaningful.removeLast()
        }

        while meaningful.count > 1 && Self.authSubdomains.contains(meaningful[0]) {
            meaningful.removeFirst()
        }

        guard let label = meaningful.last else { return nil }
        let aliased = canonicalBrand(label)
        return Self.noiseWords.contains(aliased) ? nil : aliased
    }

    public func canonicalBrand(_ token: String) -> String {
        let lower = token.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        return Self.brandAliases[lower] ?? lower
    }

    private func looksLikeHeaderOrMetadataLine(_ line: String) -> Bool {
        if line.hasPrefix("#") || line.hasPrefix("//") { return true }
        let lower = line.lowercased()
        if lower.contains("://") || lower.contains("recovery") || lower.contains("backup") ||
           lower.contains("account") || lower.contains("user") || lower.contains("service") ||
           lower.contains("issuer") {
            return true
        }
        // Not a standalone hex/alnum code line if it contains spaces + letters
        return line.contains(" ") && line.rangeOfCharacter(from: .letters) != nil
    }

    private func extractUsernameHint(from item: VaultItem, noteLines: [String]) -> String? {
        if let u = item.username?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !u.isEmpty {
            return u
        }

        // Check parenthetical email/username in title: e.g. `GitHub Backup Codes (naetik@gmail.com)`
        if let titleEmail = firstMatch(pattern: #"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"#, in: item.title) {
            return titleEmail.lowercased()
        }

        for line in noteLines.prefix(10) {
            let lower = line.lowercased()
            let prefixes = ["username:", "user:", "account:", "email:", "login:", "# username:", "# account:", "# email:"]
            for prefix in prefixes {
                if let range = lower.range(of: prefix) {
                    let value = String(line[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !value.isEmpty {
                        return value.lowercased()
                    }
                }
            }
            if let email = firstMatch(pattern: #"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"#, in: line) {
                return email.lowercased()
            }
        }

        return nil
    }

    private func areUsernamesCompatible(_ u1: String?, _ u2: String?) -> Bool {
        let a = u1?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let b = u2?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if a.isEmpty || b.isEmpty {
            return true
        }
        if a == b { return true }
        // Match local-part if one is bare username and other is email (`naetik` vs `naetik@gmail.com`)
        let localA = a.components(separatedBy: "@").first ?? a
        let localB = b.components(separatedBy: "@").first ?? b
        if !a.contains("@") || !b.contains("@") {
            return !localA.isEmpty && localA == localB
        }
        return false
    }

    private func bothNonEmptyAndEqual(_ u1: String?, _ u2: String?) -> Bool {
        guard let a = u1?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              let b = u2?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !a.isEmpty, !b.isEmpty else {
            return false
        }
        return a == b
    }

    private func displayServiceName(from a: CredentialUnderstanding, fallback b: CredentialUnderstanding, defaultKey: String) -> String {
        let key = !a.primaryServiceKey.isEmpty ? a.primaryServiceKey : (!b.primaryServiceKey.isEmpty ? b.primaryServiceKey : defaultKey)
        return key.prefix(1).uppercased() + key.dropFirst()
    }

    private func trimmedNonEmpty(_ s: String?) -> String {
        s?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private func extractUrls(from text: String) -> [String] {
        let pattern = #"https?://[^\s\)\]>\"']+"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return []
        }
        let range = NSRange(text.startIndex..., in: text)
        return regex.matches(in: text, range: range).compactMap { match in
            guard let r = Range(match.range, in: text) else { return nil }
            return String(text[r])
        }
    }

    private func firstMatch(pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let m = regex.firstMatch(in: text, range: range),
              let r = Range(m.range, in: text) else {
            return nil
        }
        return String(text[r])
    }

    private func stripPattern(_ pattern: String, in text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return text
        }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(in: text, range: range, withTemplate: " ")
    }

    private func levenshteinSimilarity(_ s1: String, _ s2: String) -> Double {
        let a = Array(s1)
        let b = Array(s2)
        let m = a.count
        let n = b.count
        if m == 0 && n == 0 { return 1.0 }
        if m == 0 || n == 0 { return 0.0 }

        var dp = Array(0...n)
        for i in 1...m {
            var prev = dp[0]
            dp[0] = i
            for j in 1...n {
                let temp = dp[j]
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                dp[j] = min(
                    dp[j] + 1,
                    min(dp[j - 1] + 1, prev + cost)
                )
                prev = temp
            }
        }
        let maxLen = max(m, n)
        return 1.0 - (Double(dp[n]) / Double(maxLen))
    }
}
