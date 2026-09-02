import Foundation
import AppKit
import SwiftUI

/// High-resolution logo and icon resolution engine for Kloak.
/// Employs a multi-tier fallback pipeline:
/// 1. Domain / Brand inference from URLs, OAuth providers, and item titles
/// 2. Vector / High-Res Brand Clearbit API (256x256+)
/// 3. Unavatar HD Multi-Service Aggregator (Apple Touch, Clearbit, DuckDuckGo)
/// 4. Direct Apple Touch Icon (180x180 / 192x192 PNG hosted on target website)
/// 5. Google High-DPI Favicon proxy (sz=256)
/// 6. DuckDuckGo Icon proxy
/// 7. In-memory NSCache with Swift 6 Actor isolation for thread-safety and zero duplicate requests
public actor LogoService {
    public static let shared = LogoService()

    private let cache = NSCache<NSString, NSImage>()
    private var inFlightTasks: [String: Task<NSImage?, Never>] = [:]
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 4.0
        config.timeoutIntervalForResource = 8.0
        config.requestCachePolicy = .returnCacheDataElseLoad
        self.session = URLSession(configuration: config)
        self.cache.countLimit = 500
    }

    /// Check memory cache
    public func cachedImage(forKey key: String) -> NSImage? {
        return cache.object(forKey: key as NSString)
    }

    /// Retrieve high-res logo asynchronously through the multi-tier waterfall
    public func fetchLogo(
        urls: [String] = [],
        title: String = "",
        oauthProvider: String? = nil,
        itemType: ItemType = .login
    ) async -> NSImage? {
        let domainCandidates = resolveDomains(urls: urls, title: title, oauthProvider: oauthProvider)
        guard !domainCandidates.isEmpty else { return nil }

        let cacheKey = domainCandidates.joined(separator: "|")
        if let existing = cache.object(forKey: cacheKey as NSString) {
            return existing
        }

        // Deduplicate in-flight requests for the same domain
        if let current = inFlightTasks[cacheKey] {
            return await current.value
        }

        let newTask = Task<NSImage?, Never> { [weak self] in
            guard let self = self else { return nil }
            return await self.performWaterfallFetch(domains: domainCandidates, cacheKey: cacheKey)
        }

        inFlightTasks[cacheKey] = newTask
        let result = await newTask.value
        inFlightTasks.removeValue(forKey: cacheKey)

        return result
    }

    // MARK: - Multi-Tier Waterfall Loader

    private func performWaterfallFetch(domains: [String], cacheKey: String) async -> NSImage? {
        for domain in domains {
            let candidateUrls = buildCandidateUrls(for: domain)
            for url in candidateUrls {
                if let image = await downloadAndValidateImage(from: url) {
                    cache.setObject(image, forKey: cacheKey as NSString)
                    return image
                }
            }
        }
        return nil
    }

    private func buildCandidateUrls(for domain: String) -> [URL] {
        var urls: [URL] = []

        // Tier 1: Clearbit High-Res Brand Logo (Vector / 256px+ PNG)
        if let u = URL(string: "https://logo.clearbit.com/\(domain)?size=256") {
            urls.append(u)
        }

        // Tier 2: Unavatar Multi-Service High-Res Aggregator
        if let u = URL(string: "https://unavatar.io/\(domain)?fallback=false") {
            urls.append(u)
        }

        // Tier 3: Direct Apple Touch Icon from target domain root
        if let u = URL(string: "https://\(domain)/apple-touch-icon.png") {
            urls.append(u)
        }
        if let u = URL(string: "https://\(domain)/apple-touch-icon-precomposed.png") {
            urls.append(u)
        }

        // Tier 4: Google High-DPI Favicon (Request sz=256 for largest available raster)
        if let u = URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=256") {
            urls.append(u)
        }

        // Tier 5: DuckDuckGo Icon
        if let u = URL(string: "https://icons.duckduckgo.com/ip3/\(domain).ico") {
            urls.append(u)
        }

        return urls
    }

    private func downloadAndValidateImage(from url: URL) async -> NSImage? {
        do {
            var request = URLRequest(url: url)
            request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
            request.setValue("image/png,image/svg+xml,image/*;q=0.8", forHTTPHeaderField: "Accept")

            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode),
                  !data.isEmpty else {
                return nil
            }

            // Verify content type is an image if present
            if let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type")?.lowercased(),
               !contentType.contains("image") && !contentType.contains("octet-stream") && !contentType.contains("svg") {
                return nil
            }

            guard let image = NSImage(data: data), image.isValid else { return nil }

            // Filter out 1x1 transparent dummy fallback GIFs/PNGs
            if image.size.width <= 2 || image.size.height <= 2 {
                return nil
            }

            return image
        } catch {
            return nil
        }
    }

    // MARK: - Domain & Brand Extraction

    public nonisolated func resolveDomains(urls: [String], title: String, oauthProvider: String?) -> [String] {
        var domains: [String] = []

        // 1. From OAuth Provider
        if let provider = oauthProvider?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines), !provider.isEmpty {
            switch provider {
            case "google": domains.append("google.com")
            case "apple": domains.append("apple.com")
            case "github": domains.append("github.com")
            case "microsoft": domains.append("microsoft.com")
            case "gitlab": domains.append("gitlab.com")
            case "slack": domains.append("slack.com")
            default: break
            }
        }

        // 2. From URLs
        for urlStr in urls {
            let cleaned = urlStr.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { continue }

            var host: String?
            if let url = URL(string: cleaned), let h = url.host {
                host = h
            } else if let url = URL(string: "https://" + cleaned), let h = url.host {
                host = h
            }

            if let h = host?.lowercased() {
                let cleanHost = cleanDomainHost(h)
                if !domains.contains(cleanHost) {
                    domains.append(cleanHost)
                }
                // Also add full host if it had subdomains (e.g. mail.proton.me)
                if cleanHost != h && !domains.contains(h) {
                    domains.append(h)
                }
            }
        }

        // 3. From Title (Brand Name Recognition)
        let matchedBrandDomain = inferDomainFromTitle(title)
        if let brand = matchedBrandDomain, !domains.contains(brand) {
            domains.append(brand)
        }

        return domains
    }

    private nonisolated func cleanDomainHost(_ host: String) -> String {
        var domain = host.lowercased()
        let commonPrefixes = ["www.", "app.", "mail.", "accounts.", "login.", "signin.", "auth.", "m.", "dashboard.", "portal.", "api.", "sso.", "my.", "web."]
        for prefix in commonPrefixes {
            if domain.hasPrefix(prefix) {
                domain = String(domain.dropFirst(prefix.count))
                break
            }
        }
        return domain
    }

    private nonisolated func inferDomainFromTitle(_ title: String) -> String? {
        let lower = title.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        let brandMap: [String: String] = [
            "github": "github.com",
            "copilot": "github.com",
            "cursor": "cursor.com",
            "gemini": "gemini.google.com",
            "google gemini": "gemini.google.com",
            "deepmind": "deepmind.google",
            "proton": "proton.me",
            "protonmail": "proton.me",
            "proton mail": "proton.me",
            "google": "google.com",
            "gmail": "google.com",
            "google workspace": "google.com",
            "apple": "apple.com",
            "icloud": "apple.com",
            "apple card": "apple.com",
            "amazon": "amazon.com",
            "aws": "aws.amazon.com",
            "netflix": "netflix.com",
            "spotify": "spotify.com",
            "discord": "discord.com",
            "slack": "slack.com",
            "notion": "notion.so",
            "figma": "figma.com",
            "dropbox": "dropbox.com",
            "openai": "openai.com",
            "chatgpt": "openai.com",
            "claude": "anthropic.com",
            "anthropic": "anthropic.com",
            "huggingface": "huggingface.co",
            "replicate": "replicate.com",
            "midjourney": "midjourney.com",
            "perplexity": "perplexity.ai",
            "twitter": "x.com",
            "x.com": "x.com",
            "reddit": "reddit.com",
            "linkedin": "linkedin.com",
            "facebook": "facebook.com",
            "meta": "meta.com",
            "instagram": "instagram.com",
            "gitlab": "gitlab.com",
            "bitbucket": "bitbucket.org",
            "atlassian": "atlassian.com",
            "stripe": "stripe.com",
            "paypal": "paypal.com",
            "linear": "linear.app",
            "vercel": "vercel.com",
            "supabase": "supabase.com",
            "tailscale": "tailscale.com",
            "docker": "docker.com",
            "cloudflare": "cloudflare.com",
            "digitalocean": "digitalocean.com",
            "heroku": "heroku.com",
            "zoom": "zoom.us",
            "uber": "uber.com",
            "airbnb": "airbnb.com",
            "pinterest": "pinterest.com",
            "twitch": "twitch.tv",
            "steam": "steampowered.com",
            "epic games": "epicgames.com",
            "playstation": "playstation.com",
            "xbox": "xbox.com",
            "nintendo": "nintendo.com",
            "ebay": "ebay.com",
            "adobe": "adobe.com",
            "shopify": "shopify.com",
            "whatsapp": "whatsapp.com",
            "telegram": "telegram.org",
            "signal": "signal.org",
            "1password": "1password.com",
            "bitwarden": "bitwarden.com",
            "chase": "chase.com",
            "bank of america": "bankofamerica.com",
            "wells fargo": "wellsfargo.com",
            "citi": "citi.com",
            "american express": "americanexpress.com",
            "amex": "americanexpress.com",
            "mastercard": "mastercard.com",
            "visa": "visa.com"
        ]

        for (name, domain) in brandMap {
            if lower == name || lower.contains(name) {
                return domain
            }
        }
        return nil
    }
}
