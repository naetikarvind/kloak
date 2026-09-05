import Foundation

public struct ThreatAnalysisResult: Codable, Sendable {
    public var isSuspicious: Bool
    public var riskScore: Int // 0 - 100
    public var targetDomain: String?
    public var reasons: [String]
    public var suggestedAction: String // "mask_email", "block_autofill", "safe"
    public var suggestedAliasEmail: String?
}

public struct KnownBrandItem: Sendable {
    public let name: String
    public let legitDomains: [String]

    public init(name: String, legitDomains: [String]) {
        self.name = name
        self.legitDomains = legitDomains
    }
}

public final class ThreatDetectorService: Sendable {
    public static let shared = ThreatDetectorService()

    private let highProfileDomains: [String] = [
        "google.com", "accounts.google.com", "apple.com", "icloud.com",
        "microsoft.com", "live.com", "outlook.com", "office.com", "login.microsoftonline.com",
        "amazon.com", "paypal.com", "github.com", "netflix.com",
        "spotify.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
        "proton.me", "protonmail.com", "chase.com", "bankofamerica.com",
        "wellsfargo.com", "citi.com", "coinbase.com", "binance.com",
        "dropbox.com", "slack.com", "notion.so", "figma.com",
        "openai.com", "chatgpt.com", "anthropic.com", "claude.ai", "discord.com",
        "gemini.com", "youtube.com", "gmail.com", "kloak.app"
    ]

    private let knownBrands: [KnownBrandItem] = [
        KnownBrandItem(name: "google", legitDomains: ["google.com", "google.co.uk", "google.ca", "google.co.in", "google.co.jp", "googleapis.com", "gstatic.com", "youtube.com", "gmail.com", "googleusercontent.com", "deepmind.google"]),
        KnownBrandItem(name: "gemini", legitDomains: ["gemini.com", "google.com"]),
        KnownBrandItem(name: "apple", legitDomains: ["apple.com", "icloud.com", "me.com"]),
        KnownBrandItem(name: "microsoft", legitDomains: ["microsoft.com", "live.com", "outlook.com", "office.com", "microsoftonline.com", "azure.com", "bing.com", "msn.com"]),
        KnownBrandItem(name: "paypal", legitDomains: ["paypal.com", "paypal.me"]),
        KnownBrandItem(name: "amazon", legitDomains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.in", "aws.amazon.com"]),
        KnownBrandItem(name: "netflix", legitDomains: ["netflix.com"]),
        KnownBrandItem(name: "spotify", legitDomains: ["spotify.com"]),
        KnownBrandItem(name: "github", legitDomains: ["github.com", "github.io", "githubassets.com"]),
        KnownBrandItem(name: "openai", legitDomains: ["openai.com", "chatgpt.com"]),
        KnownBrandItem(name: "chatgpt", legitDomains: ["openai.com", "chatgpt.com"]),
        KnownBrandItem(name: "claude", legitDomains: ["anthropic.com", "claude.ai"]),
        KnownBrandItem(name: "anthropic", legitDomains: ["anthropic.com", "claude.ai"]),
        KnownBrandItem(name: "coinbase", legitDomains: ["coinbase.com"]),
        KnownBrandItem(name: "binance", legitDomains: ["binance.com"]),
        KnownBrandItem(name: "chase", legitDomains: ["chase.com"]),
        KnownBrandItem(name: "facebook", legitDomains: ["facebook.com", "fb.com", "meta.com"]),
        KnownBrandItem(name: "instagram", legitDomains: ["instagram.com"]),
        KnownBrandItem(name: "discord", legitDomains: ["discord.com", "discord.gg"])
    ]

    private let highRiskTLDs: Set<String> = [
        "tk", "ml", "ga", "cf", "gq", "top", "buzz", "xyz", "click",
        "rest", "cam", "sbs", "cfd", "fit", "icu", "work", "loan", "men",
        "stream", "trade", "bid", "racing", "date", "faith", "review", "zip", "mov"
    ]

    private let phishingKeywords: [String] = [
        "login-", "signin-", "secure-", "verify-", "account-update",
        "auth-", "wallet-connect", "web3-", "security-alert", "confirm-identity",
        "support-", "billing-update", "recover-password", "session-expired"
    ]

    private let multiPartTLDs: Set<String> = [
        "co.uk", "gov.uk", "ac.uk", "org.uk",
        "com.au", "net.au", "org.au", "edu.au",
        "co.jp", "ne.jp", "ac.jp", "go.jp",
        "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in",
        "com.br", "net.br", "gov.br",
        "com.sg", "edu.sg", "gov.sg",
        "com.mx", "edu.mx",
        "co.nz", "net.nz", "org.nz",
        "co.za", "org.za"
    ]

    private init() {}

    public func getBaseDomain(_ hostname: String) -> String {
        let host = hostname.lowercased()
        let parts = host.components(separatedBy: ".")
        if parts.count <= 2 { return host }

        let lastTwo = parts.suffix(2).joined(separator: ".")
        if multiPartTLDs.contains(lastTwo) && parts.count >= 3 {
            return parts.suffix(3).joined(separator: ".")
        }
        return parts.suffix(2).joined(separator: ".")
    }

    public func getSLD(_ baseDomain: String) -> String {
        return baseDomain.components(separatedBy: ".").first ?? baseDomain
    }

    private func isLegitSubdomainOrDomain(host: String, targetDomain: String) -> Bool {
        let cleanTarget = targetDomain.replacingOccurrences(of: "www.", with: "").lowercased()
        return host == cleanTarget || host.hasSuffix("." + cleanTarget)
    }

    public func analyzeUrl(_ urlString: String) -> ThreatAnalysisResult {
        guard let url = URL(string: urlString), let host = url.host?.lowercased() else {
            return ThreatAnalysisResult(
                isSuspicious: false,
                riskScore: 0,
                targetDomain: nil,
                reasons: [],
                suggestedAction: "safe",
                suggestedAliasEmail: nil
            )
        }

        let cleanHost = host.replacingOccurrences(of: "www.", with: "")
        let baseDomain = getBaseDomain(cleanHost)
        let sld = getSLD(baseDomain)

        var riskScore = 0
        var reasons: [String] = []
        var targetedLegitDomain: String? = cleanHost

        // 1. Check IP Host
        if isIPAddress(host) {
            riskScore += 45
            reasons.append("Raw IP address used instead of legitimate domain name")
        }

        // 2. High-Risk TLD
        let parts = host.components(separatedBy: ".")
        if let tld = parts.last, highRiskTLDs.contains(tld) {
            riskScore += 35
            reasons.append("High-risk top-level domain (.\(tld)) frequently associated with phishing campaigns")
        }

        // 3. Phishing Keywords in Hostname/Path
        let fullPath = (host + url.path).lowercased()
        for kw in phishingKeywords {
            if fullPath.contains(kw) {
                riskScore += 25
                reasons.append("Suspicious credential harvesting keyword detected: '\(kw)'")
                break
            }
        }

        // 4. Official Verified Domain & Subdomain Recognition
        var isOfficialDomain = false
        for target in highProfileDomains {
            if isLegitSubdomainOrDomain(host: cleanHost, targetDomain: target) {
                isOfficialDomain = true
                targetedLegitDomain = target.replacingOccurrences(of: "www.", with: "")
                break
            }
        }

        if !isOfficialDomain {
            for brand in knownBrands {
                if brand.legitDomains.contains(where: { isLegitSubdomainOrDomain(host: cleanHost, targetDomain: $0) }) {
                    isOfficialDomain = true
                    targetedLegitDomain = brand.legitDomains.first
                    break
                }
            }
        }

        // If host is confirmed legitimate and official, do not perform impersonation/typosquatting checks
        if !isOfficialDomain {
            var addedReasons = Set<String>()

            for brand in knownBrands {
                let isLegitForThisBrand = brand.legitDomains.contains(where: { isLegitSubdomainOrDomain(host: cleanHost, targetDomain: $0) })
                if isLegitForThisBrand { continue }

                // Check A: Subdomain spoofing
                for ld in brand.legitDomains {
                    if cleanHost.contains(ld + ".") || cleanHost.contains(ld + "-") {
                        riskScore += 65
                        targetedLegitDomain = ld
                        let msg = "Potential brand impersonation of \(ld) via deceptive subdomain"
                        if !addedReasons.contains(msg) {
                            addedReasons.insert(msg)
                            reasons.append(msg)
                        }
                        break
                    }
                }

                // Check B: Base domain contains brand name with hyphens / keywords
                if sld.contains(brand.name) && sld != brand.name {
                    if sld.contains("\(brand.name)-") || sld.contains("-\(brand.name)") || sld.contains("_\(brand.name)") {
                        riskScore += 60
                        targetedLegitDomain = brand.legitDomains.first
                        let msg = "Potential brand hijacking: domain resembles '\(brand.name)' brand (\(brand.legitDomains.first ?? brand.name))"
                        if !addedReasons.contains(msg) {
                            addedReasons.insert(msg)
                            reasons.append(msg)
                        }
                        break
                    }
                }

                // Check C: Typosquatting on SLD
                let brandSLD = brand.name
                if brandSLD.count >= 4 {
                    let distance = levenshteinDistance(sld, brandSLD)
                    if distance > 0 && distance <= 2 && abs(sld.count - brandSLD.count) <= 2 {
                        riskScore += 65
                        targetedLegitDomain = brand.legitDomains.first
                        let msg = "Typosquatting detected: '\(sld)' is a deceptive lookalike of '\(brandSLD)' (\(brand.legitDomains.first ?? brandSLD))"
                        if !addedReasons.contains(msg) {
                            addedReasons.insert(msg)
                            reasons.append(msg)
                        }
                        break
                    }
                }
            }
        }

        // 5. Insecure HTTP login form indicator
        if url.scheme == "http" && (fullPath.contains("login") || fullPath.contains("auth") || fullPath.contains("signin")) {
            riskScore += 40
            reasons.append("Insecure plain HTTP connection submitting credentials")
        }

        let isSuspicious = riskScore >= 40
        let suggestedAction = isSuspicious ? "mask_email" : (riskScore > 20 ? "warn" : "safe")
        let alias = isSuspicious ? generateMaskedAlias(for: host) : nil

        return ThreatAnalysisResult(
            isSuspicious: isSuspicious,
            riskScore: min(100, riskScore),
            targetDomain: targetedLegitDomain ?? host,
            reasons: reasons,
            suggestedAction: suggestedAction,
            suggestedAliasEmail: alias
        )
    }

    public func generateMaskedAlias(for domain: String) -> String {
        let clean = domain.replacingOccurrences(of: "www.", with: "")
            .components(separatedBy: ".").first ?? "site"
        let safeSlug = clean.filter { $0.isLetter || $0.isNumber }.prefix(8)
        let randomHex = UUID().uuidString.prefix(6).lowercased()
        return "protect.\(safeSlug).\(randomHex)@shield.kloak.app"
    }

    private func isIPAddress(_ host: String) -> Bool {
        let parts = host.components(separatedBy: ".")
        guard parts.count == 4 else { return false }
        return parts.allSatisfy { Int($0) != nil && (0...255).contains(Int($0)!) }
    }

    private func levenshteinDistance(_ s1: String, _ s2: String) -> Int {
        let a = Array(s1)
        let b = Array(s2)
        var matrix = Array(repeating: Array(repeating: 0, count: b.count + 1), count: a.count + 1)

        for i in 0...a.count { matrix[i][0] = i }
        for j in 0...b.count { matrix[0][j] = j }

        for i in 1...a.count {
            for j in 1...b.count {
                if a[i - 1] == b[j - 1] {
                    matrix[i][j] = matrix[i - 1][j - 1]
                } else {
                    matrix[i][j] = min(
                        matrix[i - 1][j] + 1,      // deletion
                        matrix[i][j - 1] + 1,      // insertion
                        matrix[i - 1][j - 1] + 1   // substitution
                    )
                }
            }
        }
        return matrix[a.count][b.count]
    }
}
