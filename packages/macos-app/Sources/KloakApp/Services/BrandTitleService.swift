import Foundation

/// Intelligent brand and title formatting service that converts raw domain names,
/// hostnames, and URLs into clean, human-readable, official brand titles (e.g. "account.live.com" -> "Microsoft").
public final class BrandTitleService: @unchecked Sendable {
    public static let shared = BrandTitleService()

    /// Curated canonical brand names for common web services and domains
    public static let canonicalBrands: [String: String] = [
        // Microsoft Ecosystem
        "account.live.com": "Microsoft",
        "login.live.com": "Microsoft",
        "live.com": "Microsoft",
        "microsoft.com": "Microsoft",
        "login.microsoftonline.com": "Microsoft",
        "microsoftonline.com": "Microsoft",
        "office.com": "Microsoft Office",
        "office365.com": "Microsoft 365",
        "outlook.com": "Microsoft Outlook",
        "outlook.office.com": "Microsoft Outlook",
        "hotmail.com": "Microsoft Hotmail",
        "xbox.com": "Xbox",
        "account.xbox.com": "Xbox",
        "skype.com": "Skype",
        "azure.com": "Microsoft Azure",
        "portal.azure.com": "Microsoft Azure",
        "teams.microsoft.com": "Microsoft Teams",
        "onedrive.com": "OneDrive",

        // Google Ecosystem
        "google.com": "Google",
        "accounts.google.com": "Google",
        "myaccount.google.com": "Google",
        "gmail.com": "Gmail",
        "mail.google.com": "Gmail",
        "youtube.com": "YouTube",
        "drive.google.com": "Google Drive",
        "docs.google.com": "Google Docs",
        "gemini.google.com": "Google Gemini",
        "deepmind.google": "Google DeepMind",

        // Apple Ecosystem
        "apple.com": "Apple",
        "icloud.com": "Apple iCloud",
        "appleid.apple.com": "Apple ID",

        // Developer & Tech Services
        "github.com": "GitHub",
        "gist.github.com": "GitHub Gist",
        "gitlab.com": "GitLab",
        "bitbucket.org": "Bitbucket",
        "stackoverflow.com": "Stack Overflow",
        "stackexchange.com": "Stack Exchange",
        "autodesk.com": "Autodesk",
        "signin.autodesk.com": "Autodesk",
        "figma.com": "Figma",
        "notion.so": "Notion",
        "notion.com": "Notion",
        "linear.app": "Linear",
        "vercel.com": "Vercel",
        "supabase.com": "Supabase",
        "tailscale.com": "Tailscale",
        "cloudflare.com": "Cloudflare",
        "digitalocean.com": "DigitalOcean",
        "heroku.com": "Heroku",
        "docker.com": "Docker",
        "cursor.com": "Cursor",
        "replicate.com": "Replicate",
        "huggingface.co": "Hugging Face",
        "openai.com": "OpenAI",
        "chatgpt.com": "ChatGPT",
        "claude.ai": "Claude",
        "anthropic.com": "Anthropic",
        "perplexity.ai": "Perplexity",
        "midjourney.com": "Midjourney",

        // Creative, Design, Audio
        "dribbble.com": "Dribbble",
        "behance.net": "Behance",
        "bandlab.com": "BandLab",
        "www.bandlab.com": "BandLab",
        "soundcloud.com": "SoundCloud",
        "spotify.com": "Spotify",
        "accounts.spotify.com": "Spotify",
        "open.spotify.com": "Spotify",
        "canva.com": "Canva",
        "adobe.com": "Adobe",

        // Education & Reference
        "scratch.mit.edu": "Scratch",
        "mit.edu": "MIT",
        "coursera.org": "Coursera",
        "edx.org": "edX",
        "khanacademy.org": "Khan Academy",
        "duolingo.com": "Duolingo",
        "wikipedia.org": "Wikipedia",

        // Social & Communication
        "linkedin.com": "LinkedIn",
        "www.linkedin.com": "LinkedIn",
        "zoom.us": "Zoom",
        "zoom.com": "Zoom",
        "discord.com": "Discord",
        "discordapp.com": "Discord",
        "discord.gg": "Discord",
        "slack.com": "Slack",
        "twitter.com": "X (Twitter)",
        "x.com": "X",
        "reddit.com": "Reddit",
        "facebook.com": "Facebook",
        "meta.com": "Meta",
        "instagram.com": "Instagram",
        "threads.net": "Threads",
        "whatsapp.com": "WhatsApp",
        "telegram.org": "Telegram",
        "signal.org": "Signal",
        "pinterest.com": "Pinterest",
        "quora.com": "Quora",
        "medium.com": "Medium",
        "tumblr.com": "Tumblr",
        "twitch.tv": "Twitch",
        "tiktok.com": "TikTok",
        "snapchat.com": "Snapchat",

        // Gaming
        "roblox.com": "Roblox",
        "steampowered.com": "Steam",
        "steamcommunity.com": "Steam",
        "epicgames.com": "Epic Games",
        "playstation.com": "PlayStation",
        "nintendo.com": "Nintendo",

        // Entertainment & Streaming
        "netflix.com": "Netflix",
        "disneyplus.com": "Disney+",
        "hotstar.com": "Disney+ Hotstar",
        "hulu.com": "Hulu",
        "primevideo.com": "Amazon Prime Video",
        "amazon.com": "Amazon",
        "max.com": "Max",
        "vimeo.com": "Vimeo",

        // Custom & Notable Apps in User Vault
        "webbites.io": "Webbites",
        "entrar.in": "Entrar",
        "tabrr.com": "Tabrr",
        "codeskool.cc": "CodeSkool",
        "macked.app": "Macked",

        // E-commerce & Finance
        "ebay.com": "eBay",
        "shopify.com": "Shopify",
        "stripe.com": "Stripe",
        "paypal.com": "PayPal",
        "chase.com": "Chase",
        "bankofamerica.com": "Bank of America",
        "wellsfargo.com": "Wells Fargo",
        "citi.com": "Citi",
        "americanexpress.com": "American Express",
        "capitalone.com": "Capital One",
        "fidelity.com": "Fidelity",
        "vanguard.com": "Vanguard",
        "schwab.com": "Charles Schwab",
        "robinhood.com": "Robinhood",
        "coinbase.com": "Coinbase",
        "binance.com": "Binance",
        "kraken.com": "Kraken",
        "uber.com": "Uber",
        "airbnb.com": "Airbnb",
        "dropbox.com": "Dropbox",
        "proton.me": "Proton",
        "protonmail.com": "Proton Mail"
    ]

    private static let commonSubdomains: Set<String> = [
        "www", "login", "signin", "sign-in", "auth", "accounts", "account",
        "myaccount", "my", "id", "identity", "secure", "sso", "portal",
        "app", "web", "mobile", "api", "client", "member", "members", "dashboard"
    ]

    private static let multiPartTLDs: Set<String> = [
        "co.uk", "co.in", "co.jp", "co.kr", "co.nz", "co.za",
        "org.uk", "org.in", "ac.uk", "gov.uk", "com.au", "net.au",
        "com.br", "com.mx", "com.sg", "com.hk", "com.tw", "com.ar"
    ]

    /// Formats a raw title (which may be a domain, hostname, or URL) into a clean, human-readable brand name.
    public static func cleanTitle(_ raw: String, url: String? = nil) -> String {
        var str = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let separators = CharacterSet(charactersIn: "-—–: \t\r\n")

        while true {
            let lower = str.lowercased()
            if lower.hasPrefix("kloakapp") {
                str = String(str.dropFirst(8)).trimmingCharacters(in: separators)
                continue
            } else if lower.hasPrefix("kloak") {
                str = String(str.dropFirst(5)).trimmingCharacters(in: separators)
                continue
            }
            break
        }

        if str.isEmpty {
            if let u = url, !u.isEmpty {
                return formatDomainToBrand(u)
            }
            return raw.isEmpty ? "Untitled" : raw
        }

        // If the title is literally "Imported Credential", "login", or "Untitled", try to derive from the URL
        let lower = str.lowercased()
        if (lower == "imported credential" || lower == "login" || lower == "untitled" || lower == "password"),
           let u = url, !u.isEmpty {
            return formatDomainToBrand(u)
        }

        // If it looks like a domain name, hostname, or URL, convert it to a brand name
        if isDomainOrUrl(str) {
            return formatDomainToBrand(str)
        }

        // If the title contains hyphens or underscores (like a slug, filename, or recovery code note),
        // or contains redundant "2fa" strings, sanitize it into clean human-readable title
        if str.contains("-") || str.contains("_") || str.lowercased().contains("2fa") {
            let cleaned = cleanFilenameOrSlugTitle(str)
            if !cleaned.isEmpty {
                return cleaned
            }
        }

        // Otherwise, it's already a custom human title (e.g. "Work Account", "Chase Checking")
        return str
    }

    /// Cleans an imported filename, slug, or note title (e.g. "github-recovery-codes" -> "GitHub Recovery Codes",
    /// "proton_2FA_recovery_codes" -> "Proton Recovery Codes") by replacing hyphens and underscores with spaces,
    /// removing redundant/unnecessary words like "2fa", and applying proper brand capitalization.
    public static func cleanFilenameOrSlugTitle(_ input: String) -> String {
        var str = input.trimmingCharacters(in: .whitespacesAndNewlines)

        // 1. Strip file extension if present (.txt, .md, .note, etc.)
        let knownExtensions = ["txt", "text", "md", "markdown", "note", "csv", "json", "xml", "bak", "backup", "codes", "keys"]
        for ext in knownExtensions {
            if str.lowercased().hasSuffix("." + ext) {
                str = String(str.dropLast(ext.count + 1))
                break
            }
        }

        // 2. Strip standard prefixes like "kloak — ", "kloakapp", etc.
        let separators = CharacterSet(charactersIn: "-—–: \t\r\n")
        while true {
            let lower = str.lowercased()
            if lower.hasPrefix("kloakapp") {
                str = String(str.dropFirst(8)).trimmingCharacters(in: separators)
                continue
            } else if lower.hasPrefix("kloak") {
                str = String(str.dropFirst(5)).trimmingCharacters(in: separators)
                continue
            }
            break
        }

        // 3. Replace hyphens and underscores with spaces
        str = str.replacingOccurrences(of: "_", with: " ")
                 .replacingOccurrences(of: "-", with: " ")

        // 4. Split into words
        var words = str.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        guard !words.isEmpty else { return input }

        // 5. Remove redundant/unnecessary 2FA words like "2fa", "2-fa", "totp", "mfa"
        // But only remove them if other words remain (so a title isn't left empty)
        let redundantWords = Set(["2fa", "2-fa", "totp", "mfa", "two-factor", "twofactor"])
        let filteredWords = words.filter { !redundantWords.contains($0.lowercased()) }
        if !filteredWords.isEmpty {
            words = filteredWords
        }

        // 6. Recognize brand names and properly format words
        var formattedWords: [String] = []
        for word in words {
            let lower = word.lowercased()
            if let brand = canonicalBrands[lower] ?? canonicalBrands["\(lower).com"] {
                formattedWords.append(brand)
            } else if lower == "codes" || lower == "code" {
                formattedWords.append("Codes")
            } else if lower == "recovery" {
                formattedWords.append("Recovery")
            } else if lower == "backup" {
                formattedWords.append("Backup")
            } else if lower == "key" || lower == "keys" {
                formattedWords.append("Keys")
            } else if lower == "secret" || lower == "secrets" {
                formattedWords.append("Secret")
            } else if lower == "note" || lower == "notes" {
                formattedWords.append("Notes")
            } else if lower == "emergency" {
                formattedWords.append("Emergency")
            } else if lower == "kit" {
                formattedWords.append("Kit")
            } else if lower == "token" || lower == "tokens" {
                formattedWords.append("Token")
            } else {
                formattedWords.append(formatBrandWord(word))
            }
        }

        return formattedWords.joined(separator: " ")
    }

    /// Determines if a string appears to be a domain name, hostname, or URL.
    public static func isDomainOrUrl(_ input: String) -> Bool {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()

        if lower.hasPrefix("http://") || lower.hasPrefix("https://") || lower.hasPrefix("www.") {
            return true
        }

        // If it has spaces, it's almost certainly not a raw domain name
        if trimmed.contains(" ") {
            return false
        }

        // Must contain at least one dot
        guard trimmed.contains(".") else { return false }

        // Check if ends with or contains a common TLD
        let tlds = [
            ".com", ".org", ".net", ".io", ".in", ".us", ".co", ".ai", ".app",
            ".dev", ".me", ".tv", ".cc", ".edu", ".gov", ".xyz", ".info", ".biz",
            ".online", ".tech", ".site", ".store", ".live", ".so", ".to", ".gg",
            ".uk", ".ca", ".de", ".fr", ".au", ".jp", ".nl", ".se", ".ch", ".eu"
        ]

        for tld in tlds {
            if lower.hasSuffix(tld) || lower.contains("\(tld)/") || lower.contains("\(tld):") {
                return true
            }
        }

        return false
    }

    /// Transforms a URL or domain string into a clean, capitalized Brand Title.
    public static func formatDomainToBrand(_ input: String) -> String {
        var str = input.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        // 1. Strip protocol
        if str.hasPrefix("https://") { str = String(str.dropFirst(8)) }
        else if str.hasPrefix("http://") { str = String(str.dropFirst(7)) }

        // 2. Strip path, query, hash, port
        if let slashIdx = str.firstIndex(of: "/") { str = String(str[..<slashIdx]) }
        if let qIdx = str.firstIndex(of: "?") { str = String(str[..<qIdx]) }
        if let hIdx = str.firstIndex(of: "#") { str = String(str[..<hIdx]) }
        if let colonIdx = str.firstIndex(of: ":") { str = String(str[..<colonIdx]) }

        let fullHost = str.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !fullHost.isEmpty else { return input }

        // 3. Exact full host lookup in canonical brands (e.g. "account.live.com" -> "Microsoft")
        if let exact = canonicalBrands[fullHost] {
            return exact
        }

        // 4. Check DomainTreeService SSO ecosystem
        if let tree = DomainTreeService.shared.treeFor(domainOrHost: fullHost) {
            return tree.rootBrand
        }

        // 5. Strip common subdomains (e.g. "www.bandlab.com" -> "bandlab.com", "signin.autodesk.com" -> "autodesk.com")
        var baseHost = fullHost
        let parts = baseHost.components(separatedBy: ".")
        if parts.count >= 3 {
            if let first = parts.first, commonSubdomains.contains(first) {
                baseHost = parts.dropFirst().joined(separator: ".")
            }
        }

        // Check canonical brands on baseHost
        if let exact = canonicalBrands[baseHost] {
            return exact
        }

        // Check DomainTreeService on baseHost
        if let tree = DomainTreeService.shared.treeFor(domainOrHost: baseHost) {
            return tree.rootBrand
        }

        // 6. Algorithmic fallback: strip TLD and format the root domain
        var rootWord = baseHost
        for multi in multiPartTLDs {
            if rootWord.hasSuffix("." + multi) {
                rootWord = String(rootWord.dropLast(multi.count + 1))
                break
            }
        }
        if rootWord == baseHost {
            if let lastDot = rootWord.lastIndex(of: ".") {
                rootWord = String(rootWord[..<lastDot])
            }
        }

        // If subdomains remain (e.g. "scratch.mit"), check if rightmost or leftmost makes sense
        let subParts = rootWord.components(separatedBy: ".").filter { !commonSubdomains.contains($0) }
        let targetWord = subParts.first ?? rootWord

        // Format target word (e.g. "bandlab" -> "BandLab", "webbites" -> "Webbites", "entrar" -> "Entrar")
        return formatBrandWord(targetWord)
    }

    /// Capitalizes and cleans an extracted domain root word.
    public static func formatBrandWord(_ word: String) -> String {
        guard !word.isEmpty else { return "" }

        // Specific well-known casing
        let specialCasing: [String: String] = [
            "github": "GitHub",
            "gitlab": "GitLab",
            "bandlab": "BandLab",
            "linkedin": "LinkedIn",
            "youtube": "YouTube",
            "paypal": "PayPal",
            "soundcloud": "SoundCloud",
            "webbites": "Webbites",
            "entrar": "Entrar",
            "dribbble": "Dribbble",
            "roblox": "Roblox",
            "autodesk": "Autodesk",
            "spotify": "Spotify",
            "codeskool": "CodeSkool",
            "openai": "OpenAI",
            "chatgpt": "ChatGPT",
            "devpost": "Devpost",
            "proton": "Proton",
            "protonmail": "Proton Mail",
            "protonpass": "Proton Pass",
            "aws": "AWS",
            "google": "Google",
            "apple": "Apple",
            "microsoft": "Microsoft",
            "discord": "Discord",
            "bitbucket": "Bitbucket",
            "binance": "Binance",
            "coinbase": "Coinbase",
            "kraken": "Kraken",
            "steam": "Steam",
            "facebook": "Facebook",
            "twitter": "Twitter",
            "reddit": "Reddit",
            "netflix": "Netflix",
            "dropbox": "Dropbox",
            "stripe": "Stripe",
            "notion": "Notion",
            "linear": "Linear",
            "figma": "Figma",
            "slack": "Slack",
            "1password": "1Password",
            "bitwarden": "Bitwarden"
        ]

        if let special = specialCasing[word.lowercased()] {
            return special
        }

        // Split by hyphens or underscores
        let segments = word.components(separatedBy: CharacterSet(charactersIn: "-_")).filter { !$0.isEmpty }
        if segments.count > 1 {
            return segments.map { $0.capitalized }.joined(separator: " ")
        }

        return word.capitalized
    }
}
