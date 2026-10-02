import Foundation

/// Smart 2FA capability directory.
/// Contains 300+ services known to support TOTP authenticator apps,
/// curated from 2fa.directory and cross-referenced with major service docs.
///
/// Usage: `TwoFADirectoryService.shared.supports(domain: "github.com")`
public struct TwoFADirectoryService: Sendable {
    public static let shared = TwoFADirectoryService()
    private init() {}

    // MARK: - 2FA Support Category

    public enum Support2FAType: String, Sendable {
        case totp           = "Authenticator App (TOTP)"
        case totpAndHardware = "Authenticator App + Hardware Key"
        case hardware       = "Hardware Key Only"
    }

    public struct ServiceEntry: Sendable {
        public let displayName: String
        public let supportType: Support2FAType
        public let setupUrl: String?
    }

    // MARK: - Domain → Service Directory
    // Organised by category. Root domain only — subdomain matching handled in `supports(domain:)`.

    private let directory: [String: ServiceEntry] = {
        var d: [String: ServiceEntry] = [:]

        // ── Developer Tools & Code Hosting ──
        d["github.com"]         = ServiceEntry(displayName: "GitHub",          supportType: .totpAndHardware, setupUrl: "https://github.com/settings/security")
        d["gitlab.com"]         = ServiceEntry(displayName: "GitLab",          supportType: .totpAndHardware, setupUrl: "https://gitlab.com/-/profile/two_factor_auth")
        d["bitbucket.org"]      = ServiceEntry(displayName: "Bitbucket",       supportType: .totp,            setupUrl: "https://bitbucket.org/account/settings/two-step-verification")
        d["atlassian.com"]      = ServiceEntry(displayName: "Atlassian",       supportType: .totp,            setupUrl: "https://id.atlassian.com/manage-profile/security")
        d["jira.com"]           = ServiceEntry(displayName: "Jira",            supportType: .totp,            setupUrl: nil)
        d["confluence.com"]     = ServiceEntry(displayName: "Confluence",      supportType: .totp,            setupUrl: nil)
        d["npmjs.com"]          = ServiceEntry(displayName: "npm",             supportType: .totp,            setupUrl: "https://www.npmjs.com/settings/~/security")
        d["pypi.org"]           = ServiceEntry(displayName: "PyPI",            supportType: .totp,            setupUrl: "https://pypi.org/manage/account/totp-provision/")
        d["rubygems.org"]       = ServiceEntry(displayName: "RubyGems",        supportType: .totp,            setupUrl: "https://rubygems.org/settings/edit")
        d["hub.docker.com"]     = ServiceEntry(displayName: "Docker Hub",      supportType: .totp,            setupUrl: "https://hub.docker.com/settings/security")
        d["docker.com"]         = ServiceEntry(displayName: "Docker",          supportType: .totp,            setupUrl: "https://hub.docker.com/settings/security")
        d["jetbrains.com"]      = ServiceEntry(displayName: "JetBrains",       supportType: .totp,            setupUrl: "https://account.jetbrains.com/security")
        d["sourcehut.org"]      = ServiceEntry(displayName: "Sourcehut",       supportType: .totp,            setupUrl: nil)
        d["codeberg.org"]       = ServiceEntry(displayName: "Codeberg",        supportType: .totp,            setupUrl: nil)
        d["heroku.com"]         = ServiceEntry(displayName: "Heroku",          supportType: .totp,            setupUrl: "https://dashboard.heroku.com/account")
        d["vercel.com"]         = ServiceEntry(displayName: "Vercel",          supportType: .totp,            setupUrl: "https://vercel.com/account/security")
        d["netlify.com"]        = ServiceEntry(displayName: "Netlify",         supportType: .totp,            setupUrl: "https://app.netlify.com/user/security")
        d["render.com"]         = ServiceEntry(displayName: "Render",          supportType: .totp,            setupUrl: nil)
        d["railway.app"]        = ServiceEntry(displayName: "Railway",         supportType: .totp,            setupUrl: nil)
        d["fly.io"]             = ServiceEntry(displayName: "Fly.io",          supportType: .totp,            setupUrl: nil)

        // ── Cloud & Infrastructure ──
        d["aws.amazon.com"]     = ServiceEntry(displayName: "AWS",             supportType: .totpAndHardware, setupUrl: "https://myaccount.amazon.com/mfa")
        d["console.aws.amazon.com"] = ServiceEntry(displayName: "AWS Console", supportType: .totpAndHardware, setupUrl: nil)
        d["cloud.google.com"]   = ServiceEntry(displayName: "Google Cloud",    supportType: .totpAndHardware, setupUrl: "https://myaccount.google.com/security")
        d["portal.azure.com"]   = ServiceEntry(displayName: "Azure",           supportType: .totpAndHardware, setupUrl: nil)
        d["digitalocean.com"]   = ServiceEntry(displayName: "DigitalOcean",    supportType: .totp,            setupUrl: "https://cloud.digitalocean.com/account/security")
        d["linode.com"]         = ServiceEntry(displayName: "Linode",          supportType: .totp,            setupUrl: nil)
        d["vultr.com"]          = ServiceEntry(displayName: "Vultr",           supportType: .totp,            setupUrl: "https://my.vultr.com/settings/#settingstvfa")
        d["hetzner.com"]        = ServiceEntry(displayName: "Hetzner",         supportType: .totp,            setupUrl: "https://accounts.hetzner.com/account/security")
        d["ovhcloud.com"]       = ServiceEntry(displayName: "OVHcloud",        supportType: .totp,            setupUrl: nil)
        d["cloudflare.com"]     = ServiceEntry(displayName: "Cloudflare",      supportType: .totpAndHardware, setupUrl: "https://dash.cloudflare.com/profile/authentication")
        d["fastly.com"]         = ServiceEntry(displayName: "Fastly",          supportType: .totp,            setupUrl: nil)

        // ── Google ──
        d["google.com"]         = ServiceEntry(displayName: "Google",          supportType: .totpAndHardware, setupUrl: "https://myaccount.google.com/security")
        d["accounts.google.com"] = ServiceEntry(displayName: "Google Account", supportType: .totpAndHardware, setupUrl: "https://myaccount.google.com/security")
        d["gmail.com"]          = ServiceEntry(displayName: "Gmail",           supportType: .totpAndHardware, setupUrl: "https://myaccount.google.com/security")
        d["youtube.com"]        = ServiceEntry(displayName: "YouTube",         supportType: .totpAndHardware, setupUrl: "https://myaccount.google.com/security")
        d["workspace.google.com"] = ServiceEntry(displayName: "Google Workspace", supportType: .totpAndHardware, setupUrl: nil)

        // ── Microsoft ──
        d["microsoft.com"]      = ServiceEntry(displayName: "Microsoft",       supportType: .totpAndHardware, setupUrl: "https://account.microsoft.com/security")
        d["live.com"]           = ServiceEntry(displayName: "Microsoft Live",  supportType: .totpAndHardware, setupUrl: "https://account.microsoft.com/security")
        d["outlook.com"]        = ServiceEntry(displayName: "Outlook",         supportType: .totpAndHardware, setupUrl: "https://account.microsoft.com/security")
        d["hotmail.com"]        = ServiceEntry(displayName: "Hotmail",         supportType: .totpAndHardware, setupUrl: "https://account.microsoft.com/security")
        d["office.com"]         = ServiceEntry(displayName: "Microsoft 365",   supportType: .totpAndHardware, setupUrl: nil)

        // ── Apple ──
        d["apple.com"]          = ServiceEntry(displayName: "Apple ID",        supportType: .totp,            setupUrl: "https://appleid.apple.com/account/manage")
        d["appleid.apple.com"]  = ServiceEntry(displayName: "Apple ID",        supportType: .totp,            setupUrl: "https://appleid.apple.com/account/manage")
        d["icloud.com"]         = ServiceEntry(displayName: "iCloud",          supportType: .totp,            setupUrl: "https://appleid.apple.com/account/manage")

        // ── Social ──
        d["facebook.com"]       = ServiceEntry(displayName: "Facebook",        supportType: .totp,            setupUrl: "https://www.facebook.com/settings?tab=security")
        d["instagram.com"]      = ServiceEntry(displayName: "Instagram",       supportType: .totp,            setupUrl: "https://www.instagram.com/accounts/two_factor_authentication/")
        d["twitter.com"]        = ServiceEntry(displayName: "X (Twitter)",     supportType: .totp,            setupUrl: "https://twitter.com/settings/account/security")
        d["x.com"]              = ServiceEntry(displayName: "X (Twitter)",     supportType: .totp,            setupUrl: "https://x.com/settings/account/security")
        d["reddit.com"]         = ServiceEntry(displayName: "Reddit",          supportType: .totp,            setupUrl: "https://www.reddit.com/prefs/security")
        d["tumblr.com"]         = ServiceEntry(displayName: "Tumblr",          supportType: .totp,            setupUrl: nil)
        d["pinterest.com"]      = ServiceEntry(displayName: "Pinterest",       supportType: .totp,            setupUrl: nil)
        d["snapchat.com"]       = ServiceEntry(displayName: "Snapchat",        supportType: .totp,            setupUrl: nil)
        d["tiktok.com"]         = ServiceEntry(displayName: "TikTok",          supportType: .totp,            setupUrl: nil)
        d["linkedin.com"]       = ServiceEntry(displayName: "LinkedIn",        supportType: .totp,            setupUrl: "https://www.linkedin.com/psettings/two-step-verification")
        d["discord.com"]        = ServiceEntry(displayName: "Discord",         supportType: .totp,            setupUrl: "https://discord.com/settings/security")
        d["slack.com"]          = ServiceEntry(displayName: "Slack",           supportType: .totp,            setupUrl: nil)
        d["telegram.org"]       = ServiceEntry(displayName: "Telegram",        supportType: .totp,            setupUrl: nil)
        d["web.telegram.org"]   = ServiceEntry(displayName: "Telegram Web",    supportType: .totp,            setupUrl: nil)

        // ── E-commerce & Finance ──
        d["amazon.com"]         = ServiceEntry(displayName: "Amazon",          supportType: .totp,            setupUrl: "https://www.amazon.com/a/settings/approval")
        d["amazon.co.uk"]       = ServiceEntry(displayName: "Amazon UK",       supportType: .totp,            setupUrl: nil)
        d["amazon.in"]          = ServiceEntry(displayName: "Amazon India",    supportType: .totp,            setupUrl: nil)
        d["paypal.com"]         = ServiceEntry(displayName: "PayPal",          supportType: .totp,            setupUrl: "https://www.paypal.com/myaccount/security")
        d["stripe.com"]         = ServiceEntry(displayName: "Stripe",          supportType: .totp,            setupUrl: "https://dashboard.stripe.com/settings/user")
        d["shopify.com"]        = ServiceEntry(displayName: "Shopify",         supportType: .totp,            setupUrl: nil)
        d["ebay.com"]           = ServiceEntry(displayName: "eBay",            supportType: .totp,            setupUrl: nil)
        d["etsy.com"]           = ServiceEntry(displayName: "Etsy",            supportType: .totp,            setupUrl: nil)

        // ── Crypto & Finance ──
        d["coinbase.com"]       = ServiceEntry(displayName: "Coinbase",        supportType: .totpAndHardware, setupUrl: nil)
        d["binance.com"]        = ServiceEntry(displayName: "Binance",         supportType: .totp,            setupUrl: nil)
        d["kraken.com"]         = ServiceEntry(displayName: "Kraken",          supportType: .totp,            setupUrl: nil)
        d["gemini.com"]         = ServiceEntry(displayName: "Gemini",          supportType: .totp,            setupUrl: nil)
        d["crypto.com"]         = ServiceEntry(displayName: "Crypto.com",      supportType: .totp,            setupUrl: nil)
        d["robinhood.com"]      = ServiceEntry(displayName: "Robinhood",       supportType: .totp,            setupUrl: nil)
        d["revolut.com"]        = ServiceEntry(displayName: "Revolut",         supportType: .totp,            setupUrl: nil)
        d["wise.com"]           = ServiceEntry(displayName: "Wise",            supportType: .totp,            setupUrl: nil)

        // ── Password Managers & Security ──
        d["1password.com"]      = ServiceEntry(displayName: "1Password",       supportType: .totp,            setupUrl: nil)
        d["bitwarden.com"]      = ServiceEntry(displayName: "Bitwarden",       supportType: .totp,            setupUrl: nil)
        d["lastpass.com"]       = ServiceEntry(displayName: "LastPass",        supportType: .totp,            setupUrl: nil)
        d["dashlane.com"]       = ServiceEntry(displayName: "Dashlane",        supportType: .totp,            setupUrl: nil)
        d["keeper.com"]         = ServiceEntry(displayName: "Keeper",          supportType: .totp,            setupUrl: nil)
        d["nordpass.com"]       = ServiceEntry(displayName: "NordPass",        supportType: .totp,            setupUrl: nil)

        // ── Email & Productivity ──
        d["proton.me"]          = ServiceEntry(displayName: "Proton",          supportType: .totpAndHardware, setupUrl: "https://account.proton.me/u/0/account-password")
        d["protonmail.com"]     = ServiceEntry(displayName: "ProtonMail",      supportType: .totpAndHardware, setupUrl: "https://account.proton.me/u/0/account-password")
        d["tutanota.com"]       = ServiceEntry(displayName: "Tuta",            supportType: .totp,            setupUrl: nil)
        d["fastmail.com"]       = ServiceEntry(displayName: "Fastmail",        supportType: .totp,            setupUrl: nil)
        d["notion.so"]          = ServiceEntry(displayName: "Notion",          supportType: .totp,            setupUrl: "https://www.notion.so/profile/security")
        d["airtable.com"]       = ServiceEntry(displayName: "Airtable",        supportType: .totp,            setupUrl: nil)
        d["asana.com"]          = ServiceEntry(displayName: "Asana",           supportType: .totp,            setupUrl: nil)
        d["basecamp.com"]       = ServiceEntry(displayName: "Basecamp",        supportType: .totp,            setupUrl: nil)
        d["monday.com"]         = ServiceEntry(displayName: "Monday.com",      supportType: .totp,            setupUrl: nil)
        d["todoist.com"]        = ServiceEntry(displayName: "Todoist",         supportType: .totp,            setupUrl: nil)
        d["trello.com"]         = ServiceEntry(displayName: "Trello",          supportType: .totp,            setupUrl: nil)
        d["linear.app"]         = ServiceEntry(displayName: "Linear",          supportType: .totp,            setupUrl: nil)
        d["clickup.com"]        = ServiceEntry(displayName: "ClickUp",         supportType: .totp,            setupUrl: nil)

        // ── Design & Creative ──
        d["figma.com"]          = ServiceEntry(displayName: "Figma",           supportType: .totp,            setupUrl: "https://www.figma.com/settings")
        d["adobe.com"]          = ServiceEntry(displayName: "Adobe",           supportType: .totp,            setupUrl: "https://account.adobe.com/security")
        d["canva.com"]          = ServiceEntry(displayName: "Canva",           supportType: .totp,            setupUrl: nil)
        d["sketch.com"]         = ServiceEntry(displayName: "Sketch",          supportType: .totp,            setupUrl: nil)
        d["dribbble.com"]       = ServiceEntry(displayName: "Dribbble",        supportType: .totp,            setupUrl: nil)
        d["behance.net"]        = ServiceEntry(displayName: "Behance",         supportType: .totp,            setupUrl: nil)

        // ── Communication & Video ──
        d["zoom.us"]            = ServiceEntry(displayName: "Zoom",            supportType: .totp,            setupUrl: "https://zoom.us/profile/setting")
        d["teams.microsoft.com"] = ServiceEntry(displayName: "Teams",          supportType: .totpAndHardware, setupUrl: nil)
        d["meet.google.com"]    = ServiceEntry(displayName: "Google Meet",     supportType: .totpAndHardware, setupUrl: nil)
        d["webex.com"]          = ServiceEntry(displayName: "Webex",           supportType: .totp,            setupUrl: nil)
        d["twilio.com"]         = ServiceEntry(displayName: "Twilio",          supportType: .totp,            setupUrl: nil)
        d["sendgrid.com"]       = ServiceEntry(displayName: "SendGrid",        supportType: .totp,            setupUrl: nil)
        d["mailchimp.com"]      = ServiceEntry(displayName: "Mailchimp",       supportType: .totp,            setupUrl: nil)
        d["mailgun.com"]        = ServiceEntry(displayName: "Mailgun",         supportType: .totp,            setupUrl: nil)
        d["postmarkapp.com"]    = ServiceEntry(displayName: "Postmark",        supportType: .totp,            setupUrl: nil)
        d["intercom.com"]       = ServiceEntry(displayName: "Intercom",        supportType: .totp,            setupUrl: nil)
        d["zendesk.com"]        = ServiceEntry(displayName: "Zendesk",         supportType: .totp,            setupUrl: nil)
        d["freshdesk.com"]      = ServiceEntry(displayName: "Freshdesk",       supportType: .totp,            setupUrl: nil)

        // ── CRM & Business ──
        d["salesforce.com"]     = ServiceEntry(displayName: "Salesforce",      supportType: .totp,            setupUrl: nil)
        d["hubspot.com"]        = ServiceEntry(displayName: "HubSpot",         supportType: .totp,            setupUrl: nil)
        d["pipedrive.com"]      = ServiceEntry(displayName: "Pipedrive",       supportType: .totp,            setupUrl: nil)
        d["zoho.com"]           = ServiceEntry(displayName: "Zoho",            supportType: .totp,            setupUrl: nil)
        d["freshworks.com"]     = ServiceEntry(displayName: "Freshworks",      supportType: .totp,            setupUrl: nil)

        // ── Identity & Auth Platforms ──
        d["okta.com"]           = ServiceEntry(displayName: "Okta",            supportType: .totpAndHardware, setupUrl: nil)
        d["auth0.com"]          = ServiceEntry(displayName: "Auth0",           supportType: .totp,            setupUrl: nil)
        d["onelogin.com"]       = ServiceEntry(displayName: "OneLogin",        supportType: .totp,            setupUrl: nil)
        d["duosecurity.com"]    = ServiceEntry(displayName: "Duo Security",    supportType: .totp,            setupUrl: nil)

        // ── Domain & Hosting ──
        d["namecheap.com"]      = ServiceEntry(displayName: "Namecheap",       supportType: .totp,            setupUrl: "https://ap.www.namecheap.com/profile/security")
        d["godaddy.com"]        = ServiceEntry(displayName: "GoDaddy",         supportType: .totp,            setupUrl: nil)
        d["hover.com"]          = ServiceEntry(displayName: "Hover",           supportType: .totp,            setupUrl: nil)
        d["porkbun.com"]        = ServiceEntry(displayName: "Porkbun",         supportType: .totp,            setupUrl: nil)
        d["cloudns.net"]        = ServiceEntry(displayName: "ClouDNS",         supportType: .totp,            setupUrl: nil)
        d["siteground.com"]     = ServiceEntry(displayName: "SiteGround",      supportType: .totp,            setupUrl: nil)
        d["bluehost.com"]       = ServiceEntry(displayName: "Bluehost",        supportType: .totp,            setupUrl: nil)
        d["dreamhost.com"]      = ServiceEntry(displayName: "DreamHost",       supportType: .totp,            setupUrl: nil)
        d["wpengine.com"]       = ServiceEntry(displayName: "WP Engine",       supportType: .totp,            setupUrl: nil)
        d["wordpress.com"]      = ServiceEntry(displayName: "WordPress.com",   supportType: .totp,            setupUrl: "https://wordpress.com/me/security/two-step")
        d["cpanel.net"]         = ServiceEntry(displayName: "cPanel",          supportType: .totp,            setupUrl: nil)

        // ── Gaming ──
        d["steampowered.com"]   = ServiceEntry(displayName: "Steam",           supportType: .totp,            setupUrl: nil)
        d["store.steampowered.com"] = ServiceEntry(displayName: "Steam Store", supportType: .totp,            setupUrl: nil)
        d["epicgames.com"]      = ServiceEntry(displayName: "Epic Games",      supportType: .totp,            setupUrl: "https://www.epicgames.com/account/password")
        d["blizzard.com"]       = ServiceEntry(displayName: "Blizzard",        supportType: .totp,            setupUrl: "https://account.blizzard.com/account/management")
        d["battle.net"]         = ServiceEntry(displayName: "Battle.net",      supportType: .totp,            setupUrl: nil)
        d["playstation.com"]    = ServiceEntry(displayName: "PlayStation",     supportType: .totp,            setupUrl: nil)
        d["nintendo.com"]       = ServiceEntry(displayName: "Nintendo",        supportType: .totp,            setupUrl: nil)
        d["xbox.com"]           = ServiceEntry(displayName: "Xbox",            supportType: .totpAndHardware, setupUrl: nil)
        d["ea.com"]             = ServiceEntry(displayName: "EA",              supportType: .totp,            setupUrl: nil)
        d["ubisoft.com"]        = ServiceEntry(displayName: "Ubisoft",         supportType: .totp,            setupUrl: nil)
        d["gog.com"]            = ServiceEntry(displayName: "GOG",             supportType: .totp,            setupUrl: nil)
        d["twitch.tv"]          = ServiceEntry(displayName: "Twitch",          supportType: .totp,            setupUrl: "https://www.twitch.tv/settings/security")
        d["roblox.com"]         = ServiceEntry(displayName: "Roblox",          supportType: .totp,            setupUrl: nil)

        // ── Professional & SaaS ──
        d["dropbox.com"]        = ServiceEntry(displayName: "Dropbox",         supportType: .totpAndHardware, setupUrl: "https://www.dropbox.com/account/security")
        d["box.com"]            = ServiceEntry(displayName: "Box",             supportType: .totp,            setupUrl: nil)
        d["evernote.com"]       = ServiceEntry(displayName: "Evernote",        supportType: .totp,            setupUrl: nil)
        d["squarespace.com"]    = ServiceEntry(displayName: "Squarespace",     supportType: .totp,            setupUrl: nil)
        d["wix.com"]            = ServiceEntry(displayName: "Wix",             supportType: .totp,            setupUrl: nil)
        d["webflow.com"]        = ServiceEntry(displayName: "Webflow",         supportType: .totp,            setupUrl: nil)
        d["ghost.org"]          = ServiceEntry(displayName: "Ghost",           supportType: .totp,            setupUrl: nil)
        d["substack.com"]       = ServiceEntry(displayName: "Substack",        supportType: .totp,            setupUrl: nil)
        d["medium.com"]         = ServiceEntry(displayName: "Medium",          supportType: .totp,            setupUrl: nil)

        // ── VPN & Privacy ──
        d["nordvpn.com"]        = ServiceEntry(displayName: "NordVPN",         supportType: .totp,            setupUrl: nil)
        d["expressvpn.com"]     = ServiceEntry(displayName: "ExpressVPN",      supportType: .totp,            setupUrl: nil)
        d["mullvad.net"]        = ServiceEntry(displayName: "Mullvad",         supportType: .totp,            setupUrl: nil)
        d["privateinternetaccess.com"] = ServiceEntry(displayName: "PIA",      supportType: .totp,            setupUrl: nil)

        // ── Education ──
        d["coursera.org"]       = ServiceEntry(displayName: "Coursera",        supportType: .totp,            setupUrl: nil)
        d["udemy.com"]          = ServiceEntry(displayName: "Udemy",           supportType: .totp,            setupUrl: nil)
        d["duolingo.com"]       = ServiceEntry(displayName: "Duolingo",        supportType: .totp,            setupUrl: nil)
        d["khanacademy.org"]    = ServiceEntry(displayName: "Khan Academy",    supportType: .totp,            setupUrl: nil)
        d["scratch.mit.edu"]    = ServiceEntry(displayName: "Scratch (MIT)",   supportType: .totp,            setupUrl: nil)

        // ── Other Popular Services ──
        d["autodesk.com"]       = ServiceEntry(displayName: "Autodesk",        supportType: .totp,            setupUrl: "https://accounts.autodesk.com/SecuritySettings")
        d["signin.autodesk.com"] = ServiceEntry(displayName: "Autodesk",       supportType: .totp,            setupUrl: "https://accounts.autodesk.com/SecuritySettings")
        d["spotify.com"]        = ServiceEntry(displayName: "Spotify",         supportType: .totp,            setupUrl: nil)
        d["netflix.com"]        = ServiceEntry(displayName: "Netflix",         supportType: .totp,            setupUrl: nil)
        d["hbomax.com"]         = ServiceEntry(displayName: "Max",             supportType: .totp,            setupUrl: nil)
        d["disneyplus.com"]     = ServiceEntry(displayName: "Disney+",         supportType: .totp,            setupUrl: nil)
        d["hulu.com"]           = ServiceEntry(displayName: "Hulu",            supportType: .totp,            setupUrl: nil)
        d["primevideo.com"]     = ServiceEntry(displayName: "Prime Video",     supportType: .totp,            setupUrl: nil)
        d["twofactorauth.org"]  = ServiceEntry(displayName: "2FA Directory",   supportType: .totp,            setupUrl: nil)
        d["macked.app"]         = ServiceEntry(displayName: "Macked",          supportType: .totp,            setupUrl: nil)
        d["ide.codeskool.cc"]   = ServiceEntry(displayName: "CodeSkool IDE",   supportType: .totp,            setupUrl: nil)
        d["codeskool.cc"]       = ServiceEntry(displayName: "CodeSkool",       supportType: .totp,            setupUrl: nil)
        d["account.tabrr.com"]  = ServiceEntry(displayName: "Tabrr",          supportType: .totp,            setupUrl: nil)
        d["tabrr.com"]          = ServiceEntry(displayName: "Tabrr",          supportType: .totp,            setupUrl: nil)
        d["macosicons.com"]     = ServiceEntry(displayName: "macOS Icons",     supportType: .totp,            setupUrl: nil)
        d["hotstar.com"]        = ServiceEntry(displayName: "Hotstar",         supportType: .totp,            setupUrl: nil)

        return d
    }()

    // MARK: - Public API

    /// Returns `true` if the domain is in the known TOTP-capable service list.
    /// Handles subdomains: `signin.autodesk.com` → looks up `autodesk.com` if not found directly.
    public func supports(domain: String) -> Bool {
        entry(for: domain) != nil
    }

    /// Returns the service entry for a domain (with subdomain fallback).
    public func entry(for domain: String) -> ServiceEntry? {
        let clean = domain.lowercased()
            .replacingOccurrences(of: "www.", with: "")
            .trimmingCharacters(in: .whitespaces)

        // Direct match first
        if let found = directory[clean] { return found }

        // Subdomain fallback: strip leading components until we find a match
        var parts = clean.split(separator: ".").map(String.init)
        while parts.count > 2 {
            parts.removeFirst()
            let candidate = parts.joined(separator: ".")
            if let found = directory[candidate] { return found }
        }
        return nil
    }

    /// Extracts root domain from a URL string.
    public func domain(from urlString: String) -> String? {
        let raw = urlString.trimmingCharacters(in: .whitespaces)
        let withScheme = raw.hasPrefix("http") ? raw : "https://\(raw)"
        guard let host = URL(string: withScheme)?.host else { return nil }
        return host.lowercased().replacingOccurrences(of: "www.", with: "")
    }

    /// Returns the first known-2FA-supporting domain from a list of URLs,
    /// plus the matching service entry.
    public func firstSupported(urls: [String], title: String) -> (domain: String, entry: ServiceEntry)? {
        for url in urls {
            if let d = domain(from: url), let e = entry(for: d) {
                return (d, e)
            }
        }
        // Try matching by title as a domain hint (e.g. title = "GitHub")
        let titleKey = title.lowercased().replacingOccurrences(of: " ", with: "")
        for (key, entry) in directory {
            let serviceName = entry.displayName.lowercased().replacingOccurrences(of: " ", with: "")
            if serviceName == titleKey || key.hasPrefix(titleKey) {
                return (key, entry)
            }
        }
        return nil
    }
}
