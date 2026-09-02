import Foundation

public struct ThreatAnalysisResult: Codable, Sendable {
    public var isSuspicious: Bool
    public var riskScore: Int // 0 - 100
    public var targetDomain: String?
    public var reasons: [String]
    public var suggestedAction: String // "mask_email", "block_autofill", "safe"
    public var suggestedAliasEmail: String?
}

public final class ThreatDetectorService: Sendable {
    public static let shared = ThreatDetectorService()

    private let highProfileDomains: [String] = [
        "google.com", "accounts.google.com", "apple.com", "icloud.com",
        "microsoft.com", "live.com", "outlook.com", "login.microsoftonline.com",
        "amazon.com", "paypal.com", "github.com", "netflix.com",
        "spotify.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
        "proton.me", "protonmail.com", "chase.com", "bankofamerica.com",
        "wellsfargo.com", "citi.com", "coinbase.com", "binance.com",
        "dropbox.com", "slack.com", "notion.so", "figma.com",
        "openai.com", "chatgpt.com", "anthropic.com", "discord.com"
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

    private init() {}

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

        var riskScore = 0
        var reasons: [String] = []
        var targetedLegitDomain: String? = nil

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

        // 4. Typosquatting / Impersonation Check
        let cleanHost = host.replacingOccurrences(of: "www.", with: "")
        for target in highProfileDomains {
            let targetClean = target.replacingOccurrences(of: "www.", with: "")
            if cleanHost == targetClean {
                // Exact legit match -> score reduced to 0
                return ThreatAnalysisResult(
                    isSuspicious: false,
                    riskScore: 0,
                    targetDomain: targetClean,
                    reasons: [],
                    suggestedAction: "safe",
                    suggestedAliasEmail: nil
                )
            }

            // Subdomain deception (e.g. google.com.phishing-site.xyz or google-login.com)
            if cleanHost.contains(targetClean) && cleanHost != targetClean {
                riskScore += 50
                targetedLegitDomain = targetClean
                reasons.append("Possible brand impersonation of \(targetClean)")
                break
            }

            // Edit Distance / Typosquatting (e.g. g00gle.com, paypa1.com, micros0ft.com)
            let distance = levenshteinDistance(cleanHost, targetClean)
            if distance > 0 && distance <= 2 && abs(cleanHost.count - targetClean.count) <= 2 {
                riskScore += 65
                targetedLegitDomain = targetClean
                reasons.append("Typosquatting detected: resembles official domain '\(targetClean)' (distance: \(distance))")
                break
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
