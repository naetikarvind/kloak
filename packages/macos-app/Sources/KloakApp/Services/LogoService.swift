import Foundation
import AppKit
import SwiftUI

/// High-resolution logo and icon resolution engine for Kloak.
/// Employs a multi-tier fallback pipeline:
/// 1. Domain / Brand inference from URLs, OAuth providers, and item titles
/// 2. Google High-DPI Favicon V2 (t2.gstatic.com, 128x128 PNG)
/// 3. DuckDuckGo Icon proxy (icons.duckduckgo.com, .ico/PNG)
/// 4. Google S2 High-DPI Favicon proxy (sz=128)
/// 5. Persistent local disk cache (~/.kloak/favicons/<domain>.png)
/// 6. In-memory NSCache with thread-safe access and zero duplicate requests
public final class LogoService: @unchecked Sendable {
    public static let shared = LogoService()

    private let memoryCache = NSCache<NSString, NSImage>()
    private let lock = NSLock()
    private var inFlightTasks: [String: Task<NSImage?, Never>] = [:]
    private let session: URLSession

    private static let diskCacheDirectory: URL = {
        let dir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".kloak", isDirectory: true)
            .appendingPathComponent("favicons", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 3.0
        config.timeoutIntervalForResource = 5.0
        config.requestCachePolicy = .returnCacheDataElseLoad
        self.session = URLSession(configuration: config)
        self.memoryCache.countLimit = 500
    }

    /// Check memory cache by key
    public func cachedImage(forKey key: String) -> NSImage? {
        return memoryCache.object(forKey: key as NSString)
    }

    /// Synchronously check memory and disk cache for any resolved domain.
    /// Can be called synchronously from view initializers (e.g. FaviconView.init) for frame-0 rendering.
    public func cachedImageSync(
        urls: [String] = [],
        title: String = "",
        oauthProvider: String? = nil
    ) -> NSImage? {
        let domainCandidates = resolveDomains(urls: urls, title: title, oauthProvider: oauthProvider)
        guard !domainCandidates.isEmpty else { return nil }

        let cacheKey = domainCandidates.joined(separator: "|")
        if let mem = memoryCache.object(forKey: cacheKey as NSString) {
            return mem
        }

        for domain in domainCandidates {
            if let diskImg = loadFromDisk(for: domain) {
                memoryCache.setObject(diskImg, forKey: cacheKey as NSString)
                return diskImg
            }
        }

        return nil
    }

    /// Synchronously check cache for a specific domain.
    public func cachedImageSync(forDomain domain: String) -> NSImage? {
        let clean = cleanDomainHost(domain)
        if let mem = memoryCache.object(forKey: clean as NSString) {
            return mem
        }
        if let diskImg = loadFromDisk(for: clean) {
            memoryCache.setObject(diskImg, forKey: clean as NSString)
            return diskImg
        }
        return nil
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
        if let existing = cachedImageSync(urls: urls, title: title, oauthProvider: oauthProvider) {
            return existing
        }

        // Deduplicate in-flight requests for the same domain
        lock.lock()
        if let current = inFlightTasks[cacheKey] {
            lock.unlock()
            return await current.value
        }

        let newTask = Task<NSImage?, Never> {
            return await self.performWaterfallFetch(domains: domainCandidates, cacheKey: cacheKey)
        }

        inFlightTasks[cacheKey] = newTask
        lock.unlock()

        let result = await newTask.value

        lock.lock()
        inFlightTasks.removeValue(forKey: cacheKey)
        lock.unlock()

        return result
    }

    /// Prefetch logos for a batch of vault items in background
    public func prefetchLogos(for items: [VaultItem]) {
        Task.detached(priority: .background) { [weak self] in
            guard let self = self else { return }
            for item in items {
                if item.trashed { continue }
                _ = await self.fetchLogo(
                    urls: item.urls,
                    title: item.title,
                    oauthProvider: item.oauth?.provider,
                    itemType: item.type
                )
            }
        }
    }

    // MARK: - Multi-Tier Waterfall Loader

    private func performWaterfallFetch(domains: [String], cacheKey: String) async -> NSImage? {
        for domain in domains {
            // Check disk first
            if let disk = loadFromDisk(for: domain) {
                memoryCache.setObject(disk, forKey: cacheKey as NSString)
                return disk
            }

            let candidateUrls = buildCandidateUrls(for: domain)
            for url in candidateUrls {
                if let image = await downloadAndValidateImage(from: url) {
                    memoryCache.setObject(image, forKey: cacheKey as NSString)
                    saveToDisk(image: image, for: domain)
                    return image
                }
            }
        }
        return nil
    }

    private func buildCandidateUrls(for domain: String) -> [URL] {
        var urls: [URL] = []

        // Tier 1: Google Favicon V2 (High quality 128px)
        if let u = URL(string: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://\(domain)&size=128") {
            urls.append(u)
        }

        // Tier 2: DuckDuckGo Icon
        if let u = URL(string: "https://icons.duckduckgo.com/ip3/\(domain).ico") {
            urls.append(u)
        }

        // Tier 3: Google S2 Favicon proxy (sz=128)
        if let u = URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=128") {
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

            // DuckDuckGo fallback missing icon is exactly 1478 bytes
            if let host = url.host?.lowercased(), host.contains("duckduckgo.com"), data.count == 1478 {
                return nil
            }

            guard let image = NSImage(data: data), image.isValid else { return nil }

            // Filter out 1x1 transparent dummy fallback GIFs/PNGs
            if image.size.width <= 2 || image.size.height <= 2 {
                return nil
            }

            // Google fallback missing globe is 16x16 with 426 or 726 bytes
            if let host = url.host?.lowercased(), (host.contains("google") || host.contains("gstatic")) {
                if image.size.width <= 16 && image.size.height <= 16 && (data.count == 426 || data.count == 726) {
                    return nil
                }
            }

            return image
        } catch {
            return nil
        }
    }

    // MARK: - Disk Cache Persistence

    private func sanitizeDomainForFilename(_ domain: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: ".-_"))
        return domain.components(separatedBy: allowed.inverted).joined(separator: "_")
    }

    private func loadFromDisk(for domain: String) -> NSImage? {
        let filename = sanitizeDomainForFilename(domain) + ".png"
        let fileURL = Self.diskCacheDirectory.appendingPathComponent(filename)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        guard let image = NSImage(contentsOf: fileURL), image.isValid else { return nil }
        return image
    }

    private func saveToDisk(image: NSImage, for domain: String) {
        guard let tiffData = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:]) else {
            return
        }
        let filename = sanitizeDomainForFilename(domain) + ".png"
        let fileURL = Self.diskCacheDirectory.appendingPathComponent(filename)
        try? pngData.write(to: fileURL, options: .atomic)
    }

    // MARK: - Domain & Brand Extraction

    public func resolveDomains(urls: [String], title: String, oauthProvider: String?) -> [String] {
        var domains: [String] = []

        func addDomain(_ d: String) {
            let trimmed = d.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !trimmed.isEmpty, !domains.contains(trimmed) else { return }
            domains.append(trimmed)
        }

        // 1. From OAuth Provider
        if let provider = oauthProvider?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines), !provider.isEmpty {
            switch provider {
            case "google": addDomain("google.com")
            case "apple": addDomain("apple.com")
            case "github": addDomain("github.com")
            case "microsoft": addDomain("microsoft.com")
            case "gitlab": addDomain("gitlab.com")
            case "slack": addDomain("slack.com")
            case "facebook": addDomain("facebook.com")
            case "discord": addDomain("discord.com")
            case "twitter", "x": addDomain("x.com")
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
                addDomain(cleanHost)
                if cleanHost != h {
                    addDomain(h)
                }
                if cleanHost == "live.com" || cleanHost == "microsoftonline.com" {
                    addDomain("microsoft.com")
                }
            }
        }

        // 3. From Clean Title if it contains hostname format (e.g. hotstar.com, macked.app, scratch.mit.edu, ide.codeskool.cc)
        let cleanTitle = sanitizeTitle(title)
        if !cleanTitle.isEmpty {
            if cleanTitle.contains(".") && !cleanTitle.contains(" ") {
                var hostCandidate: String?
                if let url = URL(string: "https://" + cleanTitle), let h = url.host {
                    hostCandidate = h
                }
                if let h = hostCandidate?.lowercased() {
                    let cleanHost = cleanDomainHost(h)
                    addDomain(cleanHost)
                    if cleanHost != h {
                        addDomain(h)
                    }
                    if cleanHost == "live.com" {
                        addDomain("microsoft.com")
                    }
                }
            }
        }

        // 4. From Title Brand Recognition
        if let matchedBrandDomain = inferDomainFromTitle(cleanTitle) {
            addDomain(matchedBrandDomain)
        }

        return domains
    }

    public func cleanDomainHost(_ host: String) -> String {
        var domain = host.lowercased()
        let commonPrefixes = [
            "www.", "app.", "mail.", "accounts.", "account.", "login.", "signin.",
            "auth.", "m.", "dashboard.", "portal.", "api.", "sso.", "my.", "web.",
            "id.", "secure.", "identity.", "member.", "user.", "users.", "ide."
        ]
        for prefix in commonPrefixes {
            if domain.hasPrefix(prefix) {
                domain = String(domain.dropFirst(prefix.count))
                break
            }
        }
        return domain
    }

    private func sanitizeTitle(_ title: String) -> String {
        var t = title
        // Strip parenthetical text like (naetik.arvind@gmail.com) and bracketed text like [Work]
        if let regex = try? NSRegularExpression(pattern: "\\s*\\([^)]*\\)|\\s*\\[[^\\]]*\\]") {
            t = regex.stringByReplacingMatches(in: t, range: NSRange(t.startIndex..., in: t), withTemplate: "")
        }
        return t.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func inferDomainFromTitle(_ title: String) -> String? {
        let clean = sanitizeTitle(title)
        let lower = clean.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !lower.isEmpty else { return nil }

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
            "youtube": "youtube.com",
            "hotstar": "hotstar.com",
            "disney": "hotstar.com",
            "disney+": "hotstar.com",
            "disneyplus": "hotstar.com",
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
            "opera": "opera.com",
            "brave": "brave.com",
            "firefox": "firefox.com",
            "huggingface": "huggingface.co",
            "replicate": "replicate.com",
            "midjourney": "midjourney.com",
            "perplexity": "perplexity.ai",
            "twitter": "x.com",
            "x": "x.com",
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
            "live": "live.com",
            "microsoft": "microsoft.com",
            "outlook": "outlook.com",
            "office": "office.com",
            "tabrr": "tabrr.com",
            "codeskool": "codeskool.cc",
            "macked": "macked.app",
            "scratch": "scratch.mit.edu",
            "chase": "chase.com",
            "bank of america": "bankofamerica.com",
            "wells fargo": "wellsfargo.com",
            "citi": "citi.com",
            "american express": "americanexpress.com",
            "amex": "americanexpress.com",
            "mastercard": "mastercard.com",
            "visa": "visa.com"
        ]

        // 1. Exact match
        if let exact = brandMap[lower] {
            return exact
        }

        // 2. Tokenized word match
        let tokens = lower.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }
        for (name, domain) in brandMap {
            if tokens.contains(name) {
                return domain
            }
        }

        // 3. Multi-word phrase matches (e.g. "disney+ hotstar", "google workspace")
        for (name, domain) in brandMap where name.contains(" ") || name.contains("+") {
            if lower.contains(name) {
                return domain
            }
        }

        return nil
    }
}
