import Foundation

/// Represents a recognized domain tree and Single Sign-On (SSO) ecosystem.
public struct WebsiteTree: Identifiable, Sendable {
    public let id: String
    public let displayName: String
    public let rootBrand: String
    public let iconName: String
    public let primaryDomains: [String]
    public let allDomains: Set<String>
    public let appBundleIds: Set<String>
    public let appNames: Set<String>
    public let ssoSupported: Bool
    public let description: String
    public let supportedHighlights: [String]

    public init(
        id: String,
        displayName: String,
        rootBrand: String,
        iconName: String,
        primaryDomains: [String],
        allDomains: Set<String>,
        appBundleIds: Set<String>,
        appNames: Set<String>,
        ssoSupported: Bool = true,
        description: String,
        supportedHighlights: [String]
    ) {
        self.id = id
        self.displayName = displayName
        self.rootBrand = rootBrand
        self.iconName = iconName
        self.primaryDomains = primaryDomains
        self.allDomains = allDomains
        self.appBundleIds = appBundleIds
        self.appNames = appNames
        self.ssoSupported = ssoSupported
        self.description = description
        self.supportedHighlights = supportedHighlights
    }
}

/// The result of a smart domain or app tree match evaluation.
public struct TreeMatchResult: Sendable {
    public let isMatch: Bool
    public let score: Int // 0..100
    public let tree: WebsiteTree?
    public let matchType: MatchType
    public let explanation: String

    public enum MatchType: Sendable {
        case exactHost          // 100: direct match (e.g. accounts.google.com == accounts.google.com)
        case subdomain          // 85:  subdomain / eTLD+1 match (e.g. drive.google.com -> google.com)
        case ecosystemTree      // 80:  SSO tree match (e.g. youtube.com -> google.com credential)
        case nativeAppToWeb     // 75:  desktop app match (e.g. Chrome / Drive app -> google.com credential)
        case none               // 0:   no correlation
    }

    public static let none = TreeMatchResult(
        isMatch: false,
        score: 0,
        tree: nil,
        matchType: .none,
        explanation: "No match"
    )
}

/// Smart Website & App Tree Understander:
/// Resolves domain trees, subdomains, and Single Sign-On (SSO) ecosystems so that a credential
/// saved for one brand automatically inputs and suggests across all related websites and native desktop apps.
public final class DomainTreeService: Sendable {
    public static let shared = DomainTreeService()

    /// Comprehensive registry of technology, media, and enterprise service ecosystems.
    public let registeredTrees: [WebsiteTree]

    private init() {
        // ── 1. Google Ecosystem ─────────────────────────────────────────────
        let googleDomains: Set<String> = [
            "google.com", "accounts.google.com", "myaccount.google.com", "mail.google.com",
            "drive.google.com", "docs.google.com", "meet.google.com", "maps.google.com",
            "calendar.google.com", "photos.google.com", "contacts.google.com", "play.google.com",
            "gemini.google.com", "deepmind.google", "google.dev", "android.com",
            "youtube.com", "youtubekids.com", "music.youtube.com", "studio.youtube.com",
            "gmail.com", "googlemail.com", "blogger.com", "blogspot.com", "waze.com",
            "googleusercontent.com", "gstatic.com", "googleapis.com",
            // International country-code Google domains
            "google.co.uk", "google.ca", "google.co.in", "google.de", "google.fr",
            "google.co.jp", "google.com.au", "google.es", "google.it", "google.nl",
            "google.br", "google.ch", "google.se", "google.pl", "google.co.nz"
        ]
        let googleApps: Set<String> = [
            "com.google.chrome", "com.google.chrome.canary", "com.google.drivefs",
            "com.google.googleearthpro", "com.google.android.studio", "com.google.meet",
            "com.google.chat"
        ]
        let googleAppNames: Set<String> = [
            "google chrome", "chrome", "google drive", "drive", "youtube", "gmail",
            "google meet", "google chat", "android studio"
        ]
        let googleTree = WebsiteTree(
            id: "google",
            displayName: "Google Ecosystem",
            rootBrand: "Google",
            iconName: "globe",
            primaryDomains: ["google.com", "youtube.com", "gmail.com", "drive.google.com"],
            allDomains: googleDomains,
            appBundleIds: googleApps,
            appNames: googleAppNames,
            description: "Single Sign-On across Google, YouTube, Gmail, Google Drive, Meet, and Google apps.",
            supportedHighlights: ["google.com", "youtube.com", "gmail.com", "Google Drive", "Chrome"]
        )

        // ── 2. Microsoft Ecosystem ──────────────────────────────────────────
        let msDomains: Set<String> = [
            "microsoft.com", "live.com", "login.live.com", "account.live.com",
            "microsoftonline.com", "login.microsoftonline.com", "office.com", "office365.com",
            "outlook.com", "outlook.office.com", "hotmail.com", "msn.com", "bing.com",
            "xbox.com", "account.xbox.com", "skype.com", "sharepoint.com", "onedrive.com",
            "teams.microsoft.com", "azure.com", "portal.azure.com", "visualstudio.com"
        ]
        let msApps: Set<String> = [
            "com.microsoft.teams", "com.microsoft.teams2", "com.microsoft.outlook",
            "com.microsoft.word", "com.microsoft.excel", "com.microsoft.powerpoint",
            "com.microsoft.onedrive", "com.microsoft.vscode", "com.microsoft.edgemac",
            "com.skype.skype"
        ]
        let msAppNames: Set<String> = [
            "microsoft teams", "teams", "microsoft outlook", "outlook", "microsoft word",
            "word", "microsoft excel", "excel", "microsoft powerpoint", "onedrive",
            "visual studio code", "vs code", "microsoft edge", "edge", "skype"
        ]
        let msTree = WebsiteTree(
            id: "microsoft",
            displayName: "Microsoft Ecosystem",
            rootBrand: "Microsoft",
            iconName: "window.badge.magnifyingglass",
            primaryDomains: ["microsoft.com", "login.live.com", "office.com", "xbox.com", "outlook.com"],
            allDomains: msDomains,
            appBundleIds: msApps,
            appNames: msAppNames,
            description: "Unified Microsoft Account & Entra ID login for Office, Xbox, Outlook, Teams, and OneDrive.",
            supportedHighlights: ["microsoft.com", "office.com", "xbox.com", "Outlook", "Teams"]
        )

        // ── 3. Apple Ecosystem ──────────────────────────────────────────────
        let appleDomains: Set<String> = [
            "apple.com", "icloud.com", "appleid.apple.com", "idmsa.apple.com",
            "me.com", "mac.com", "itunes.com", "testflight.apple.com", "developer.apple.com"
        ]
        let appleApps: Set<String> = [
            "com.apple.safari", "com.apple.music", "com.apple.tv", "com.apple.appstore",
            "com.apple.icloud", "com.apple.mail", "com.apple.dt.xcode"
        ]
        let appleAppNames: Set<String> = [
            "safari", "apple music", "music", "apple tv", "tv", "app store", "mail", "xcode"
        ]
        let appleTree = WebsiteTree(
            id: "apple",
            displayName: "Apple Ecosystem",
            rootBrand: "Apple",
            iconName: "applelogo",
            primaryDomains: ["apple.com", "icloud.com", "appleid.apple.com"],
            allDomains: appleDomains,
            appBundleIds: appleApps,
            appNames: appleAppNames,
            description: "Apple ID & iCloud login for Apple services, Safari, App Store, and Music.",
            supportedHighlights: ["apple.com", "icloud.com", "Apple Music", "Safari"]
        )

        // ── 4. Meta / Facebook Ecosystem ────────────────────────────────────
        let metaDomains: Set<String> = [
            "facebook.com", "fb.com", "instagram.com", "threads.net", "messenger.com",
            "whatsapp.com", "web.whatsapp.com", "meta.com", "oculus.com"
        ]
        let metaApps: Set<String> = [
            "com.facebook.archon", "net.whatsapp.whatsapp", "com.facebook.messenger"
        ]
        let metaAppNames: Set<String> = [
            "whatsapp", "instagram", "messenger", "facebook", "threads"
        ]
        let metaTree = WebsiteTree(
            id: "meta",
            displayName: "Meta Ecosystem",
            rootBrand: "Meta",
            iconName: "person.2.fill",
            primaryDomains: ["facebook.com", "instagram.com", "threads.net", "whatsapp.com"],
            allDomains: metaDomains,
            appBundleIds: metaApps,
            appNames: metaAppNames,
            description: "Meta Accounts Center login across Facebook, Instagram, Threads, and WhatsApp.",
            supportedHighlights: ["facebook.com", "instagram.com", "threads.net", "WhatsApp"]
        )

        // ── 5. Amazon Ecosystem ─────────────────────────────────────────────
        let amazonDomains: Set<String> = [
            "amazon.com", "amazon.co.uk", "amazon.in", "amazon.de", "amazon.co.jp",
            "amazon.ca", "amazon.es", "amazon.fr", "amazon.it", "primevideo.com",
            "audible.com", "twitch.tv", "imdb.com", "aws.amazon.com", "a.co"
        ]
        let amazonApps: Set<String> = [
            "com.amazon.kindle", "com.amazon.amazon-music", "com.amazon.primevideo"
        ]
        let amazonAppNames: Set<String> = [
            "amazon", "kindle", "audible", "twitch", "prime video"
        ]
        let amazonTree = WebsiteTree(
            id: "amazon",
            displayName: "Amazon Ecosystem",
            rootBrand: "Amazon",
            iconName: "cart.fill",
            primaryDomains: ["amazon.com", "primevideo.com", "audible.com", "twitch.tv"],
            allDomains: amazonDomains,
            appBundleIds: amazonApps,
            appNames: amazonAppNames,
            description: "Single login for Amazon shopping, Prime Video, Audible, Twitch, and AWS.",
            supportedHighlights: ["amazon.com", "primevideo.com", "Audible", "Twitch"]
        )

        // ── 6. GitHub ───────────────────────────────────────────────────────
        let githubTree = WebsiteTree(
            id: "github",
            displayName: "GitHub Ecosystem",
            rootBrand: "GitHub",
            iconName: "chevron.left.forwardslash.chevron.right",
            primaryDomains: ["github.com", "gist.github.com"],
            allDomains: ["github.com", "gist.github.com", "github.io", "githubassets.com"],
            appBundleIds: ["com.github.githubclient"],
            appNames: ["github desktop", "github"],
            description: "GitHub login across web, Gist, and GitHub Desktop.",
            supportedHighlights: ["github.com", "gist.github.com", "GitHub Desktop"]
        )

        // ── 7. Discord ──────────────────────────────────────────────────────
        let discordTree = WebsiteTree(
            id: "discord",
            displayName: "Discord Ecosystem",
            rootBrand: "Discord",
            iconName: "bubble.left.and.bubble.right.fill",
            primaryDomains: ["discord.com"],
            allDomains: ["discord.com", "discordapp.com", "discord.gg"],
            appBundleIds: ["com.hnc.discord", "com.discord"],
            appNames: ["discord"],
            description: "Discord credentials shared between web browser, server invites, and the desktop client.",
            supportedHighlights: ["discord.com", "discord.gg", "Discord App"]
        )

        // ── 8. Spotify ──────────────────────────────────────────────────────
        let spotifyTree = WebsiteTree(
            id: "spotify",
            displayName: "Spotify Ecosystem",
            rootBrand: "Spotify",
            iconName: "music.note",
            primaryDomains: ["spotify.com", "accounts.spotify.com"],
            allDomains: ["spotify.com", "accounts.spotify.com", "open.spotify.com"],
            appBundleIds: ["com.spotify.client"],
            appNames: ["spotify"],
            description: "Spotify account authentication across web player, account settings, and desktop player.",
            supportedHighlights: ["spotify.com", "accounts.spotify.com", "Spotify App"]
        )

        // ── 9. Slack ────────────────────────────────────────────────────────
        let slackTree = WebsiteTree(
            id: "slack",
            displayName: "Slack Ecosystem",
            rootBrand: "Slack",
            iconName: "number",
            primaryDomains: ["slack.com"],
            allDomains: ["slack.com"],
            appBundleIds: ["com.tinyspeck.slackmacgap"],
            appNames: ["slack"],
            description: "Slack authentication across workspace subdomains and the desktop client.",
            supportedHighlights: ["slack.com", "workspace subdomains", "Slack App"]
        )

        // ── 10. Twitter / X ─────────────────────────────────────────────────
        let twitterTree = WebsiteTree(
            id: "twitter",
            displayName: "X / Twitter Ecosystem",
            rootBrand: "X",
            iconName: "bubble.right.fill",
            primaryDomains: ["x.com", "twitter.com"],
            allDomains: ["x.com", "twitter.com", "t.co", "tweetdeck.com", "pro.twitter.com"],
            appBundleIds: ["com.atebits.tweetie2"],
            appNames: ["twitter", "x"],
            description: "Unified credentials across x.com, twitter.com, and TweetDeck.",
            supportedHighlights: ["x.com", "twitter.com", "TweetDeck"]
        )

        // ── 11. Proton ──────────────────────────────────────────────────────
        let protonTree = WebsiteTree(
            id: "proton",
            displayName: "Proton Ecosystem",
            rootBrand: "Proton",
            iconName: "lock.shield.fill",
            primaryDomains: ["proton.me", "protonmail.com"],
            allDomains: ["proton.me", "protonmail.com", "protonmail.ch", "protonvpn.com", "account.proton.me"],
            appBundleIds: ["ch.protonmail.desktop", "ch.protonvpn.mac"],
            appNames: ["proton mail", "proton vpn", "proton pass"],
            description: "Encrypted Proton account login across Proton Mail, Drive, Calendar, and VPN.",
            supportedHighlights: ["proton.me", "protonmail.com", "Proton VPN"]
        )

        // ── 12. Zoom ────────────────────────────────────────────────────────
        let zoomTree = WebsiteTree(
            id: "zoom",
            displayName: "Zoom Ecosystem",
            rootBrand: "Zoom",
            iconName: "video.fill",
            primaryDomains: ["zoom.us"],
            allDomains: ["zoom.us"],
            appBundleIds: ["us.zoom.xos"],
            appNames: ["zoom", "zoom.us"],
            description: "Zoom authentication for web meetings, vanity URLs, and the Zoom desktop app.",
            supportedHighlights: ["zoom.us", "Zoom Meeting App"]
        )

        // ── 13. Roblox ──────────────────────────────────────────────────────
        let robloxTree = WebsiteTree(
            id: "roblox",
            displayName: "Roblox Ecosystem",
            rootBrand: "Roblox",
            iconName: "gamecontroller.fill",
            primaryDomains: ["roblox.com"],
            allDomains: ["roblox.com"],
            appBundleIds: ["com.roblox.robloxplayer"],
            appNames: ["roblox", "roblox player"],
            description: "Roblox credentials shared between roblox.com and the native game client.",
            supportedHighlights: ["roblox.com", "Roblox Player"]
        )

        // ── 14. Reddit ──────────────────────────────────────────────────────
        let redditTree = WebsiteTree(
            id: "reddit",
            displayName: "Reddit Ecosystem",
            rootBrand: "Reddit",
            iconName: "bubble.left.fill",
            primaryDomains: ["reddit.com"],
            allDomains: ["reddit.com", "redd.it"],
            appBundleIds: [],
            appNames: ["reddit"],
            description: "Reddit account login across desktop and mobile web.",
            supportedHighlights: ["reddit.com", "redd.it"]
        )

        // ── 15. LinkedIn ────────────────────────────────────────────────────
        let linkedinTree = WebsiteTree(
            id: "linkedin",
            displayName: "LinkedIn Ecosystem",
            rootBrand: "LinkedIn",
            iconName: "person.crop.square.fill",
            primaryDomains: ["linkedin.com"],
            allDomains: ["linkedin.com", "licdn.com"],
            appBundleIds: [],
            appNames: ["linkedin"],
            description: "LinkedIn authentication across learning and networking portals.",
            supportedHighlights: ["linkedin.com", "learning.linkedin.com"]
        )

        // ── 16. Dropbox ─────────────────────────────────────────────────────
        let dropboxTree = WebsiteTree(
            id: "dropbox",
            displayName: "Dropbox Ecosystem",
            rootBrand: "Dropbox",
            iconName: "archivebox.fill",
            primaryDomains: ["dropbox.com"],
            allDomains: ["dropbox.com", "paper.dropbox.com"],
            appBundleIds: ["com.getdropbox.dropbox"],
            appNames: ["dropbox"],
            description: "Dropbox credentials for cloud storage, Paper, and the desktop sync client.",
            supportedHighlights: ["dropbox.com", "paper.dropbox.com", "Dropbox Desktop"]
        )

        self.registeredTrees = [
            googleTree,
            msTree,
            appleTree,
            metaTree,
            amazonTree,
            githubTree,
            discordTree,
            spotifyTree,
            slackTree,
            twitterTree,
            protonTree,
            zoomTree,
            robloxTree,
            redditTree,
            linkedinTree,
            dropboxTree
        ]
    }

    // MARK: - Tree Lookup

    /// Normalizes a host or domain string.
    public func cleanHost(_ raw: String) -> String {
        var str = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let url = URL(string: str), let host = url.host {
            str = host.lowercased()
        } else if let schemeIdx = str.range(of: "://") {
            str = String(str[schemeIdx.upperBound...])
            if let slashIdx = str.firstIndex(of: "/") {
                str = String(str[..<slashIdx])
            }
        }
        if str.hasPrefix("www.") {
            str = String(str.dropFirst(4))
        }
        if let colonIdx = str.firstIndex(of: ":") {
            str = String(str[..<colonIdx])
        }
        return str
    }

    /// Resolves any domain or host string (e.g. "youtube.com", "accounts.google.com", "google.co.in")
    /// to its corresponding ecosystem tree, if one exists.
    public func treeFor(domainOrHost: String) -> WebsiteTree? {
        let host = cleanHost(domainOrHost)
        guard !host.isEmpty else { return nil }

        // 1. Direct match against tree domain sets
        for tree in registeredTrees {
            if tree.allDomains.contains(host) {
                return tree
            }
        }

        // 2. Registrable domain (eTLD+1) check
        if let rd = registrableDomain(from: "https://\(host)") {
            for tree in registeredTrees {
                if tree.allDomains.contains(rd) {
                    return tree
                }
            }
        }

        // 3. Subdomain prefix check (e.g. "something.slack.com" -> Slack tree)
        for tree in registeredTrees {
            for primary in tree.primaryDomains {
                if host == primary || host.hasSuffix(".\(primary)") {
                    return tree
                }
            }
        }

        return nil
    }

    /// Resolves a native macOS application bundle ID or localized name to an ecosystem tree.
    public func treeFor(appBundleOrName: String) -> WebsiteTree? {
        let lower = appBundleOrName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            .replacingOccurrences(of: ".app", with: "")
        guard !lower.isEmpty else { return nil }

        for tree in registeredTrees {
            if tree.appBundleIds.contains(lower) {
                return tree
            }
            if tree.appNames.contains(lower) || lower.contains(tree.rootBrand.lowercased()) {
                return tree
            }
            for bundle in tree.appBundleIds {
                if lower.hasPrefix(bundle) || bundle.hasPrefix(lower) {
                    return tree
                }
            }
        }

        return nil
    }

    /// Identifies the ecosystem tree that a given vault item belongs to, based on its URLs and title.
    public func connectedTree(for item: VaultItem) -> WebsiteTree? {
        // Check URLs first
        for u in item.urls {
            if let t = treeFor(domainOrHost: u) {
                return t
            }
        }

        // Check item title (e.g. "Google", "YouTube", "Microsoft", "Spotify")
        let cleanTitle = item.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let t = treeFor(domainOrHost: cleanTitle) {
            return t
        }
        if let t = treeFor(appBundleOrName: cleanTitle) {
            return t
        }

        for tree in registeredTrees {
            if cleanTitle == tree.rootBrand.lowercased() || cleanTitle.contains(tree.rootBrand.lowercased()) {
                return tree
            }
        }

        return nil
    }

    // MARK: - Smart Matching Engine

    /// Determines whether a vault credential matches a target browser page URL or native app.
    public func match(
        targetUrl: String? = nil,
        targetAppBundle: String? = nil,
        targetAppName: String? = nil,
        item: VaultItem
    ) -> TreeMatchResult {
        guard !item.trashed else { return .none }

        let itemTree = connectedTree(for: item)

        // ── 1. Target is a Browser Page URL ──
        if let rawTarget = targetUrl, !rawTarget.isEmpty {
            let targetHost = cleanHost(rawTarget)
            let targetRD = registrableDomain(from: "https://\(targetHost)")

            // Check each item URL
            for itemUrl in item.urls {
                let itemHost = cleanHost(itemUrl)
                let itemRD = registrableDomain(from: "https://\(itemHost)")

                // A. Exact Host Match
                if !targetHost.isEmpty && targetHost == itemHost {
                    return TreeMatchResult(
                        isMatch: true,
                        score: 100,
                        tree: itemTree,
                        matchType: .exactHost,
                        explanation: "Exact host match: \(targetHost)"
                    )
                }

                // B. Subdomain / eTLD+1 Match (e.g. login.github.com -> github.com)
                if let trd = targetRD, let ird = itemRD, trd == ird {
                    return TreeMatchResult(
                        isMatch: true,
                        score: 85,
                        tree: itemTree,
                        matchType: .subdomain,
                        explanation: "Subdomain match on \(trd)"
                    )
                }
            }

            // C. Ecosystem Tree Match (e.g. target is youtube.com, item is google.com or titled Google)
            let targetTree = treeFor(domainOrHost: targetHost)
            if let tt = targetTree, let it = itemTree, tt.id == it.id {
                return TreeMatchResult(
                    isMatch: true,
                    score: 80,
                    tree: tt,
                    matchType: .ecosystemTree,
                    explanation: "Matched via \(tt.displayName) for \(targetHost)"
                )
            }
        }

        // ── 2. Target is a Native Desktop App ──
        let appBundle = targetAppBundle?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let appName = targetAppName?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ".app", with: "")

        let targetAppTree = (appBundle != nil ? treeFor(appBundleOrName: appBundle!) : nil) ??
                            (appName != nil ? treeFor(appBundleOrName: appName!) : nil)

        if let tat = targetAppTree, let it = itemTree, tat.id == it.id {
            return TreeMatchResult(
                isMatch: true,
                score: 75,
                tree: tat,
                matchType: .nativeAppToWeb,
                explanation: "Matched via \(tat.displayName) for \(appName ?? appBundle ?? "app")"
            )
        }

        // Fallback for native app name matching item title directly (e.g. Slack app -> Slack login)
        if let an = appName, !an.isEmpty {
            let itemClean = item.title.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            if an == itemClean || an.contains(itemClean) || itemClean.contains(an) {
                return TreeMatchResult(
                    isMatch: true,
                    score: 65,
                    tree: itemTree,
                    matchType: .nativeAppToWeb,
                    explanation: "Matched desktop app name \(appName!)"
                )
            }
        }

        return .none
    }

    /// Evaluates whether two domains belong to the same tree or registrable domain.
    public func areEquivalent(domainA: String, domainB: String) -> Bool {
        let hostA = cleanHost(domainA)
        let hostB = cleanHost(domainB)
        if hostA == hostB { return true }

        let rdA = registrableDomain(from: "https://\(hostA)")
        let rdB = registrableDomain(from: "https://\(hostB)")
        if let a = rdA, let b = rdB, a == b { return true }

        if let treeA = treeFor(domainOrHost: hostA),
           let treeB = treeFor(domainOrHost: hostB),
           treeA.id == treeB.id {
            return true
        }

        return false
    }
}
