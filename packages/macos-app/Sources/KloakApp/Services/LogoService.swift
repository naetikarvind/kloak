import Foundation
import AppKit
import SwiftUI

// MARK: - JEV AI Rendering Classification

/// JEV AI (Just-Enough Vision) rendering mode for a favicon.
///
/// The on-device pixel classifier (`LogoService.classifyRenderingStyle`) inspects
/// the fetched image's corner and ring pixels to produce one of five modes:
///
/// - **standard**: White backing plate + 78 % inset + subtle border stroke.
///   For logos on transparent or pure-white backgrounds.
///
/// - **fullBleed**: Logo clipped edge-to-edge to the squircle shape, no plate.
///   For logos that fill their entire canvas (e.g. the Microsoft 4-colour grid).
///
/// - **coloredSquircle**: Squircle filled with a background colour sampled from
///   the icon's own corner pixels, then the logo rendered full-size on top.
///   For icons that have a solid dominant background (e.g. Spotify black, Zoom blue).
///
/// - **circleAdapted**: White circle (50 % corner radius) backing + full-size icon.
///   For circular icons on a plain white background (e.g. Dribbble, Roblox, BandLab)
///   — the circle clip matches the icon's own boundary so no border gap appears.
///
/// - **brandPlate**: Coloured squircle plate (sampled from the icon's edge colour)
///   + 78 % inset icon + a subtle matching border stroke.
///   For logos whose own squircle background does NOT fully bleed to every corner
///   (e.g. LinkedIn blue, GitHub dark) — the strip colour mirrors the icon's brand
///   colour instead of being plain white, creating a cohesive look.
public enum LogoRenderingStyle {
    case standard
    case fullBleed
    case coloredSquircle(red: Double, green: Double, blue: Double)
    case circleAdapted
    /// Coloured backing plate whose fill matches the icon's own brand background colour.
    /// The icon is inset to 78 % of the container size (same as `.standard`).
    case brandPlate(red: Double, green: Double, blue: Double)
}

extension LogoRenderingStyle: Equatable {
    public static func == (lhs: LogoRenderingStyle, rhs: LogoRenderingStyle) -> Bool {
        switch (lhs, rhs) {
        case (.standard, .standard), (.fullBleed, .fullBleed), (.circleAdapted, .circleAdapted):
            return true
        case let (.coloredSquircle(r1, g1, b1), .coloredSquircle(r2, g2, b2)):
            return abs(r1 - r2) < 0.01 && abs(g1 - g2) < 0.01 && abs(b1 - b2) < 0.01
        case let (.brandPlate(r1, g1, b1), .brandPlate(r2, g2, b2)):
            return abs(r1 - r2) < 0.01 && abs(g1 - g2) < 0.01 && abs(b1 - b2) < 0.01
        default:
            return false
        }
    }
}

/// High-resolution logo and icon resolution engine for Kloak.
/// Employs a multi-tier fallback pipeline:
/// 1. Domain / Brand inference from URLs, OAuth providers, and item titles
/// 2. Apple Touch Icon (direct from domain, 180x180 PNG)
/// 3. Google High-DPI Favicon V2 (t2.gstatic.com, 128x128 PNG)
/// 4. DuckDuckGo Icon proxy (icons.duckduckgo.com, .ico/PNG)
/// 5. Google S2 High-DPI Favicon proxy (sz=128)
/// 6. Persistent local disk cache (~/.kloak/favicons/<domain>.png)
/// 7. In-memory NSCache with thread-safe access and zero duplicate requests
///
/// After fetching, runs the JEV AI pixel classifier (`classifyRenderingStyle`) to
/// determine the correct rendering mode for `FaviconView`.
public final class LogoService: @unchecked Sendable {
    public static let shared = LogoService()

    private let memoryCache = NSCache<NSString, NSImage>()
    /// In-memory cache of JEV AI rendering-style classifications (keyed by cacheKey).
    private let renderingCache = NSCache<NSString, RenderingStyleBox>()
    private let lock = NSLock()
    private var inFlightTasks: [String: Task<NSImage?, Never>] = [:]
    private let session: URLSession

    /// Thread-safe box for `LogoRenderingStyle` (NSCache requires reference types).
    private final class RenderingStyleBox {
        let style: LogoRenderingStyle
        init(_ style: LogoRenderingStyle) { self.style = style }
    }

    private static let diskCacheDirectory: URL = {
        let dir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".kloak", isDirectory: true)
            .appendingPathComponent("favicons", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    // MARK: - Comprehensive Parent-Brand Domain Map
    // Maps service/subdomain domains to their canonical parent brand domain
    // so that favicon lookups always resolve the highest-quality logo.

    private static let parentBrandMap: [String: String] = [
        // ── Microsoft ecosystem ──
        "live.com": "microsoft.com",
        "microsoftonline.com": "microsoft.com",
        "outlook.com": "microsoft.com",
        "outlook.live.com": "microsoft.com",
        "hotmail.com": "microsoft.com",
        "office.com": "microsoft.com",
        "office365.com": "microsoft.com",
        "onedrive.com": "microsoft.com",
        "onedrive.live.com": "microsoft.com",
        "sharepoint.com": "microsoft.com",
        "teams.microsoft.com": "microsoft.com",
        "azure.com": "microsoft.com",
        "portal.azure.com": "microsoft.com",
        "dev.azure.com": "microsoft.com",
        "visualstudio.com": "microsoft.com",
        "msn.com": "microsoft.com",
        "bing.com": "microsoft.com",
        "xbox.com": "xbox.com",         // Xbox has its own strong brand icon
        "skype.com": "skype.com",        // Skype has its own strong brand icon

        // ── Google ecosystem ──
        "gmail.com": "google.com",
        "googlemail.com": "google.com",
        "google.co.in": "google.com",
        "google.co.uk": "google.com",
        "google.co.jp": "google.com",
        "accounts.google.com": "google.com",
        "myaccount.google.com": "google.com",
        "drive.google.com": "google.com",
        "docs.google.com": "google.com",
        "sheets.google.com": "google.com",
        "slides.google.com": "google.com",
        "meet.google.com": "google.com",
        "chat.google.com": "google.com",
        "calendar.google.com": "google.com",
        "photos.google.com": "google.com",
        "maps.google.com": "google.com",
        "translate.google.com": "google.com",
        "cloud.google.com": "google.com",
        "console.cloud.google.com": "google.com",
        "play.google.com": "google.com",
        "firebase.google.com": "google.com",
        "analytics.google.com": "google.com",
        "ads.google.com": "google.com",
        "gemini.google.com": "google.com",
        "colab.research.google.com": "google.com",
        "youtube.com": "youtube.com",    // YouTube has its own strong brand icon

        // ── Apple ecosystem ──
        "icloud.com": "apple.com",
        "appleid.apple.com": "apple.com",
        "developer.apple.com": "apple.com",
        "music.apple.com": "apple.com",
        "tv.apple.com": "apple.com",
        "support.apple.com": "apple.com",

        // ── Meta ecosystem ──
        "facebook.com": "facebook.com",
        "fb.com": "facebook.com",
        "messenger.com": "facebook.com",
        "instagram.com": "instagram.com", // Instagram has its own strong icon
        "threads.net": "instagram.com",
        "whatsapp.com": "whatsapp.com",   // WhatsApp has its own strong icon
        "oculus.com": "meta.com",

        // ── Amazon ecosystem ──
        "aws.amazon.com": "amazon.com",
        "console.aws.amazon.com": "amazon.com",
        "primevideo.com": "amazon.com",
        "kindle.com": "amazon.com",
        "audible.com": "audible.com",     // Audible has its own brand
        "twitch.tv": "twitch.tv",         // Twitch has its own brand

        // ── GitHub / Microsoft Dev ──
        "gist.github.com": "github.com",
        "copilot.github.com": "github.com",
        "github.dev": "github.com",
        "npmjs.com": "npmjs.com",

        // ── Atlassian ecosystem ──
        "bitbucket.org": "bitbucket.org",
        "trello.com": "trello.com",
        "jira.atlassian.com": "atlassian.com",
        "confluence.atlassian.com": "atlassian.com",
        "id.atlassian.com": "atlassian.com",

        // ── Salesforce ecosystem ──
        "salesforce.com": "salesforce.com",
        "force.com": "salesforce.com",
        "heroku.com": "heroku.com",

        // ── Adobe ecosystem ──
        "creativecloud.adobe.com": "adobe.com",
        "behance.net": "behance.net",

        // ── Proton ecosystem ──
        "protonmail.com": "proton.me",
        "protonvpn.com": "proton.me",
        "proton.me": "proton.me",
    ]

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 3.0
        config.timeoutIntervalForResource = 5.0
        config.requestCachePolicy = .returnCacheDataElseLoad
        self.session = URLSession(configuration: config)
        self.memoryCache.countLimit = 500
        self.renderingCache.countLimit = 500
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
                // Run JEV AI classification and cache the result
                let style = Self.classifyRenderingStyle(disk, domain: domain)
                renderingCache.setObject(RenderingStyleBox(style), forKey: cacheKey as NSString)
                return disk
            }

            let candidateUrls = buildCandidateUrls(for: domain)
            for url in candidateUrls {
                if let image = await downloadAndValidateImage(from: url) {
                    memoryCache.setObject(image, forKey: cacheKey as NSString)
                    // Run JEV AI classification and cache the result
                    let style = Self.classifyRenderingStyle(image, domain: domain)
                    renderingCache.setObject(RenderingStyleBox(style), forKey: cacheKey as NSString)
                    saveToDisk(image: image, for: domain)
                    return image
                }
            }
        }
        return nil
    }

    private func buildCandidateUrls(for domain: String) -> [URL] {
        var urls: [URL] = []

        // Tier 0: Apple Touch Icon (direct from domain — highest quality, 180x180)
        if let u = URL(string: "https://\(domain)/apple-touch-icon.png") {
            urls.append(u)
        }

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

            // Reject very small images (< 32px) from apple-touch-icon attempts that
            // return a tiny default or redirect placeholder
            if url.path.contains("apple-touch-icon"), image.size.width < 32 || image.size.height < 32 {
                return nil
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

    /// Clear cached favicon for a domain so it gets re-fetched next time.
    public func invalidateCache(forDomain domain: String) {
        let filename = sanitizeDomainForFilename(domain) + ".png"
        let fileURL = Self.diskCacheDirectory.appendingPathComponent(filename)
        try? FileManager.default.removeItem(at: fileURL)
        memoryCache.removeObject(forKey: domain as NSString)
    }

    // MARK: - JEV AI — Pixel-Based Rendering Classifier

    /// **JEV AI Domain Override Map** — explicit rendering modes for known brand icons
    /// that have distinctive brand backgrounds or require exact styling.
    private static let renderingStyleOverrides: [String: LogoRenderingStyle] = [
        // LinkedIn — deep brand blue (#0077B5 / #0073B2 -> 0.0, 0.451, 0.698)
        "linkedin.com":          .coloredSquircle(red: 0.0, green: 0.451, blue: 0.698),
        "www.linkedin.com":      .coloredSquircle(red: 0.0, green: 0.451, blue: 0.698),
        "learning.linkedin.com": .coloredSquircle(red: 0.0, green: 0.451, blue: 0.698),

        // Zoom — brand video blue
        "zoom.us":               .coloredSquircle(red: 0.059, green: 0.373, blue: 0.996),

        // Spotify — dark background (#121212) so transparent sound waves render as crisp black on the green circle
        "spotify.com":           .coloredSquircle(red: 0.07, green: 0.07, blue: 0.07),
        "www.spotify.com":       .coloredSquircle(red: 0.07, green: 0.07, blue: 0.07),
        "accounts.spotify.com":  .coloredSquircle(red: 0.07, green: 0.07, blue: 0.07),
        "open.spotify.com":      .coloredSquircle(red: 0.07, green: 0.07, blue: 0.07),

        // Microsoft — full bleed 4-color grid
        "microsoft.com":         .fullBleed,
        "live.com":              .fullBleed,
        "account.live.com":      .fullBleed,
    ]

    /// **JEV AI** (Just-Enough Vision) on-device favicon rendering classifier.
    ///
    /// Inspects the 64×64 RGBA pixel grid to classify the image into one of:
    /// - `.standard`: White squircle plate + 78% inset logo + subtle border (creates a clean white strip around the logo).
    ///   Applied to logos on white backgrounds (GitHub, MacOSIcons) and isolated glyphs on transparent backgrounds (Google "G", Scratch "S", Entrar bird).
    /// - `.coloredSquircle(r, g, b)`: Squircle plate filled with brand colour + logo on top (the white strip is replaced by the brand color, and outer edges are rounded to fit squircle).
    ///   Applied to solid-background icons (LinkedIn blue, Zoom blue, Spotify green, Roblox dark, Tabrr purple).
    /// - `.fullBleed`: Multi-coloured icons that bleed to the edge (Microsoft 4-colour grid, BandLab red, Hotstar).
    public static func classifyRenderingStyle(_ image: NSImage, domain: String? = nil) -> LogoRenderingStyle {
        // 0. Domain override check
        if let domain = domain {
            let key = domain.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            if let override = renderingStyleOverrides[key] {
                return override
            }
            let stripped = key.hasPrefix("www.") ? String(key.dropFirst(4)) : key
            if let override = renderingStyleOverrides[stripped] {
                return override
            }
            let cleaned = shared.cleanDomainHost(key)
            if let override = renderingStyleOverrides[cleaned] {
                return override
            }
        }

        let dim = 64
        let cSz = 10          // corner sample region (10×10 px each)
        let αFade: UInt8 = 40       // below → transparent
        let whiteLow: UInt8 = 210   // R,G,B all above → white-ish

        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return .standard
        }

        var pixels = [UInt8](repeating: 0, count: dim * dim * 4)
        let cs = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: &pixels,
            width: dim, height: dim,
            bitsPerComponent: 8, bytesPerRow: dim * 4,
            space: cs,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return .standard }

        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: dim, height: dim))

        /// Pixel accessor — returns (R, G, B, A) for a coordinate.
        func px(_ x: Int, _ y: Int) -> (UInt8, UInt8, UInt8, UInt8) {
            let i = (y * dim + x) * 4
            return (pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
        }

        // ── Sample four corner regions ──────────────────────────────────────────
        let cornerOrigins: [(Int, Int)] = [
            (0, 0), (dim - cSz, 0), (0, dim - cSz), (dim - cSz, dim - cSz)
        ]

        var nTransparent = 0, nWhite = 0, nTotal = 0
        var coloredR = [Double](), coloredG = [Double](), coloredB = [Double]()

        for (cx, cy) in cornerOrigins {
            for dy in 0..<cSz {
                for dx in 0..<cSz {
                    let (r, g, b, a) = px(cx + dx, cy + dy)
                    nTotal += 1
                    if a < αFade {
                        nTransparent += 1
                    } else if r > whiteLow && g > whiteLow && b > whiteLow {
                        nWhite += 1
                    } else {
                        coloredR.append(Double(r) / 255)
                        coloredG.append(Double(g) / 255)
                        coloredB.append(Double(b) / 255)
                    }
                }
            }
        }

        guard nTotal > 0 else { return .standard }

        let transpRatio  = Double(nTransparent) / Double(nTotal)
        let whiteRatio   = Double(nWhite)        / Double(nTotal)
        let coloredRatio = Double(coloredR.count) / Double(nTotal)

        // ── Rule 1: Predominantly white corners (≥50%) ─────────────────────────
        // Logos on white backgrounds or white circular containers (GitHub, MacOSIcons, Webbites).
        // Render on a clean white squircle plate with a 78% inset logo (creating a white strip).
        if whiteRatio >= 0.50 {
            return .standard
        }

        // ── Rule 2: Colored corners (≥40%) with uniform solid background ────────
        // Solid-background icons (Roblox, BandLab, Spotify, etc.)
        if coloredRatio >= 0.40 && !coloredR.isEmpty {
            let n = Double(coloredR.count)
            let avgR = coloredR.reduce(0, +) / n
            let avgG = coloredG.reduce(0, +) / n
            let avgB = coloredB.reduce(0, +) / n

            let varR = coloredR.map { ($0 - avgR) * ($0 - avgR) }.reduce(0, +) / n
            let varG = coloredG.map { ($0 - avgG) * ($0 - avgG) }.reduce(0, +) / n
            let varB = coloredB.map { ($0 - avgB) * ($0 - avgB) }.reduce(0, +) / n
            let totalVariance = varR + varG + varB

            if totalVariance < 0.05 {
                let midSamples = sampleMidEdgeColors(pixels: pixels, dim: dim, αFade: αFade, whiteLow: whiteLow)
                let bgR = midSamples?.r ?? avgR
                let bgG = midSamples?.g ?? avgG
                let bgB = midSamples?.b ?? avgB
                return .coloredSquircle(red: bgR, green: bgG, blue: bgB)
            } else {
                return .fullBleed
            }
        }

        // ── Rule 3: Transparent corners (≥50%) ─────────────────────────────────
        // Differentiate between:
        // (a) Solid rounded rectangle card (e.g. Zoom, LinkedIn, Tabrr) -> .coloredSquircle
        // (b) Isolated glyph or symbol (e.g. Google "G", Scratch "S", Entrar bird) -> .standard (white strip)
        if transpRatio >= 0.50 {
            let insets = [(dim / 2, 6), (dim / 2, dim - 7), (6, dim / 2), (dim - 7, dim / 2)]
            var midOpaque = 0
            var midR = [Double](), midG = [Double](), midB = [Double]()
            for (x, y) in insets {
                let (r, g, b, a) = px(x, y)
                if a > αFade {
                    midOpaque += 1
                    if !(r > whiteLow && g > whiteLow && b > whiteLow) {
                        midR.append(Double(r) / 255)
                        midG.append(Double(g) / 255)
                        midB.append(Double(b) / 255)
                    }
                }
            }

            var totalOpaque = 0
            for y in 0..<dim {
                for x in 0..<dim {
                    let (_, _, _, a) = px(x, y)
                    if a > αFade { totalOpaque += 1 }
                }
            }
            let opRatio = Double(totalOpaque) / Double(dim * dim)

            // If mid-edges are consistently colored and overall opacity is high (≥70%),
            // it's a solid colored card with rounded corners:
            if midOpaque == 4 && midR.count == 4 && opRatio >= 0.70 {
                let avgR = midR.reduce(0, +) / 4
                let avgG = midG.reduce(0, +) / 4
                let avgB = midB.reduce(0, +) / 4
                let varR = midR.map { ($0 - avgR) * ($0 - avgR) }.reduce(0, +) / 4
                let varG = midG.map { ($0 - avgG) * ($0 - avgG) }.reduce(0, +) / 4
                let varB = midB.map { ($0 - avgB) * ($0 - avgB) }.reduce(0, +) / 4
                if (varR + varG + varB) < 0.05 {
                    return .coloredSquircle(red: avgR, green: avgG, blue: avgB)
                }
            }

            // Otherwise, it is an isolated symbol on transparent canvas -> .standard (white strip)
            return .standard
        }

        return .standard
    }

    /// Helper: sample mid-points of all four edges and return the average non-white colour.
    /// Returns `nil` if no suitable samples are found.
    private static func sampleMidEdgeColors(
        pixels: [UInt8], dim: Int, αFade: UInt8, whiteLow: UInt8
    ) -> (r: Double, g: Double, b: Double)? {
        let strip = 3  // px wide strip at each edge midpoint
        let mid = dim / 2
        var sumR = 0.0, sumG = 0.0, sumB = 0.0, count = 0

        func add(_ x: Int, _ y: Int) {
            guard x >= 0 && x < dim && y >= 0 && y < dim else { return }
            let i = (y * dim + x) * 4
            let r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3]
            if a > αFade && !(r > whiteLow && g > whiteLow && b > whiteLow) {
                sumR += Double(r) / 255; sumG += Double(g) / 255; sumB += Double(b) / 255
                count += 1
            }
        }

        for d in -strip...strip {
            add(d + mid, 0)         // top edge
            add(d + mid, dim - 1)   // bottom edge
            add(0, d + mid)         // left edge
            add(dim - 1, d + mid)   // right edge
        }

        guard count > 0 else { return nil }
        return (sumR / Double(count), sumG / Double(count), sumB / Double(count))
    }

    // MARK: - Rendering Style Cache API

    /// Retrieve cached JEV AI rendering style for a set of domain candidates.
    /// Returns `nil` if not yet classified (FaviconView should call `classifyRenderingStyle` directly).
    public func cachedRenderingStyle(
        urls: [String] = [],
        title: String = "",
        oauthProvider: String? = nil
    ) -> LogoRenderingStyle? {
        let domainCandidates = resolveDomains(urls: urls, title: title, oauthProvider: oauthProvider)
        guard !domainCandidates.isEmpty else { return nil }
        let cacheKey = domainCandidates.joined(separator: "|")
        return renderingCache.object(forKey: cacheKey as NSString)?.style
    }

    /// Store a JEV AI classification result in the in-memory cache.
    public func cacheRenderingStyle(
        _ style: LogoRenderingStyle,
        urls: [String] = [],
        title: String = "",
        oauthProvider: String? = nil
    ) {
        let domainCandidates = resolveDomains(urls: urls, title: title, oauthProvider: oauthProvider)
        guard !domainCandidates.isEmpty else { return }
        let cacheKey = domainCandidates.joined(separator: "|")
        renderingCache.setObject(RenderingStyleBox(style), forKey: cacheKey as NSString)
    }

    // MARK: - Domain & Brand Extraction

    public func resolveDomains(urls: [String], title: String, oauthProvider: String?) -> [String] {
        var domains: [String] = []

        func addDomain(_ d: String) {
            let trimmed = d.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !trimmed.isEmpty, !domains.contains(trimmed) else { return }
            domains.append(trimmed)
        }

        /// Resolve a domain through the parent brand map and add both the
        /// parent brand (first, for best favicon) and the original domain.
        func addDomainWithBrandResolution(_ rawDomain: String) {
            let clean = cleanDomainHost(rawDomain)
            // Check full original host first (e.g. "outlook.live.com")
            if let parentBrand = Self.parentBrandMap[rawDomain.lowercased()] {
                addDomain(parentBrand)
            }
            // Then check cleaned host (e.g. "live.com")
            if let parentBrand = Self.parentBrandMap[clean] {
                addDomain(parentBrand)
            }
            // Also add the cleaned domain itself as a fallback
            addDomain(clean)
            if clean != rawDomain.lowercased() {
                addDomain(rawDomain.lowercased())
            }
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

        // 2. From URLs — with comprehensive parent-brand resolution
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
                addDomainWithBrandResolution(h)
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
                    addDomainWithBrandResolution(h)
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
            "visa": "visa.com",
            "roblox": "roblox.com",
            "bandlab": "bandlab.com",
            "dribbble": "dribbble.com",
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
