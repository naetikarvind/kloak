import SwiftUI
import AppKit

/// Displays a high-resolution, vector/HD website brand logo or icon.
/// Uses `LogoService` to query high-res Clearbit, Unavatar, Apple Touch Icons, and HD Favicons,
/// falling back to a category-tinted SF Symbol.
public struct FaviconView: View {
    let urls: [String]
    let title: String
    let oauthProvider: String?
    let itemType: ItemType
    let size: CGFloat

    @State private var loadedImage: NSImage?
    @State private var isLoading: Bool = false

    public init(
        urls: [String] = [],
        title: String = "",
        oauthProvider: String? = nil,
        itemType: ItemType = .login,
        size: CGFloat = 30
    ) {
        self.urls = urls
        self.title = title
        self.oauthProvider = oauthProvider
        self.itemType = itemType
        self.size = size
    }

    private var fallbackColor: Color {
        switch itemType {
        case .login: return LiquidGlassTheme.primaryAccent
        case .secureNote: return LiquidGlassTheme.amberAccent
        case .card: return LiquidGlassTheme.emeraldAccent
        case .identity: return Color.cyan
        case .emailAlias: return Color(red: 0.0, green: 0.82, blue: 0.71)
        case .authenticator: return LiquidGlassTheme.emeraldAccent
        }
    }

    public var body: some View {
        ZStack {
            if let img = loadedImage {
                ZStack {
                    // Subtle backdrop plate to give transparent logos great contrast
                    RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                        .fill(Color.white.opacity(0.95))
                        .overlay(
                            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                                .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
                        )

                    Image(nsImage: img)
                        .resizable()
                        .interpolation(.high)
                        .antialiased(true)
                        .aspectRatio(contentMode: .fit)
                        .padding(size * 0.12)
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
                .shadow(color: Color.black.opacity(0.15), radius: 2, x: 0, y: 1)
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
            } else {
                fallbackIcon
            }
        }
        .task(id: "\(title)_\(urls.joined())_\(oauthProvider ?? "")") {
            await loadLogo()
        }
    }

    private var fallbackIcon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(fallbackColor.opacity(0.15))
                .frame(width: size, height: size)
                .overlay(
                    RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                        .stroke(fallbackColor.opacity(0.25), lineWidth: 0.5)
                )

            Image(systemName: itemType.iconName)
                .font(.system(size: size * 0.45, weight: .medium))
                .foregroundColor(fallbackColor)
        }
    }

    private func loadLogo() async {
        // Fast synchronous check in cache
        let domains = LogoService.shared.resolveDomains(urls: urls, title: title, oauthProvider: oauthProvider)
        let cacheKey = domains.joined(separator: "|")
        if let cached = await LogoService.shared.cachedImage(forKey: cacheKey) {
            self.loadedImage = cached
            return
        }

        // Asynchronous multi-tier fetch
        let fetched = await LogoService.shared.fetchLogo(
            urls: urls,
            title: title,
            oauthProvider: oauthProvider,
            itemType: itemType
        )

        if let img = fetched {
            withAnimation(.easeOut(duration: 0.18)) {
                self.loadedImage = img
            }
        }
    }
}
