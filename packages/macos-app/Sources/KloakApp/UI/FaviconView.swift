import SwiftUI
import AppKit

/// Displays a high-resolution, vector/HD website brand logo or icon.
/// Uses `LogoService` to query high-res Favicons, Clearbit, and Apple Touch Icons.
/// For logins without a logo, displays a beautiful deterministic monogram avatar with brand gradient.
/// For non-login items, displays a modern glass-styled category squircle.
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
        size: CGFloat = 32
    ) {
        self.urls = urls
        self.title = title
        self.oauthProvider = oauthProvider
        self.itemType = itemType
        self.size = size

        let initial = LogoService.shared.cachedImageSync(
            urls: urls,
            title: title,
            oauthProvider: oauthProvider
        )
        _loadedImage = State(initialValue: initial)
    }

    private var squircleRadius: CGFloat {
        // Standard Apple squircle curvature ratio: ~0.2237 * size
        max(4.0, size * 0.2237)
    }

    public var body: some View {
        ZStack {
            if let img = loadedImage {
                ZStack {
                    // Solid white background — ensures favicons always look crisp
                    // regardless of row highlight/selection state. Also handles logos
                    // with transparent backgrounds (e.g. Autodesk, LinkedIn dark variants).
                    RoundedRectangle(cornerRadius: squircleRadius, style: .continuous)
                        .fill(Color.white)

                    Image(nsImage: img)
                        .resizable()
                        .interpolation(.high)
                        .antialiased(true)
                        .aspectRatio(contentMode: .fit)
                        // Inset to 78% — logos that don't bleed to the edge
                        // sit on a clean white plate instead of showing dark transparency.
                        .frame(width: size * 0.78, height: size * 0.78)
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: squircleRadius, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: squircleRadius, style: .continuous)
                        .stroke(Color.black.opacity(0.09), lineWidth: 0.75)
                )
                .shadow(color: Color.black.opacity(0.22), radius: 2, x: 0, y: 1)
                .transition(.opacity)
            } else {
                fallbackAvatar
            }
        }
        .frame(width: size, height: size)
        .aspectRatio(1, contentMode: .fit)
        .task(id: "\(title)_\(urls.joined())_\(oauthProvider ?? "")") {
            await loadLogo()
        }
        .onAppear {
            if loadedImage == nil {
                Task { @MainActor in
                    await loadLogo()
                }
            }
        }
    }

    // MARK: - Advanced Fallback System

    @ViewBuilder
    private var fallbackAvatar: some View {
        if itemType == .login {
            // High-fidelity monogram avatar with deterministic brand gradient
            let monogram = monogramLetters(from: title, urls: urls)
            let (c1, c2) = brandGradientColors(for: title, urls: urls)

            ZStack {
                LinearGradient(
                    colors: [c1, c2],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                Text(monogram)
                    .font(.system(size: max(9, size * 0.42), weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .shadow(color: Color.black.opacity(0.3), radius: 1, x: 0, y: 0.5)
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: squircleRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: squircleRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 0.75)
            )
            .shadow(color: Color.black.opacity(0.15), radius: 2, x: 0, y: 1)
        } else {
            // Category-styled squircle
            ZStack {
                RoundedRectangle(cornerRadius: squircleRadius, style: .continuous)
                    .fill(categoryColor.opacity(0.16))

                Image(systemName: itemType.iconName)
                    .font(.system(size: size * 0.44, weight: .semibold))
                    .foregroundColor(categoryColor)
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: squircleRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: squircleRadius, style: .continuous)
                    .stroke(categoryColor.opacity(0.3), lineWidth: 0.75)
            )
        }
    }

    private var categoryColor: Color {
        switch itemType {
        case .login: return LiquidGlassTheme.primaryAccent
        case .secureNote: return LiquidGlassTheme.amberAccent
        case .card: return LiquidGlassTheme.emeraldAccent
        case .identity: return Color.cyan
        case .emailAlias: return Color(red: 0.0, green: 0.82, blue: 0.71)
        case .authenticator: return Color.purple
        }
    }

    // MARK: - Monogram & Gradient Math

    private func monogramLetters(from title: String, urls: [String]) -> String {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cleanTitle.isEmpty {
            // If title contains domain (e.g. google.com), take service name
            if cleanTitle.contains(".") {
                let parts = cleanTitle.split(separator: ".")
                if let first = parts.first, !first.isEmpty {
                    return String(first.prefix(2)).uppercased()
                }
            }
            let words = cleanTitle.split(separator: " ").filter { !$0.isEmpty }
            if words.count >= 2 {
                let f = words[0].prefix(1)
                let s = words[1].prefix(1)
                return "\(f)\(s)".uppercased()
            }
            return String(cleanTitle.prefix(min(2, cleanTitle.count))).uppercased()
        }

        if let firstUrl = urls.first, let host = URL(string: firstUrl)?.host ?? URL(string: "https://\(firstUrl)")?.host {
            let clean = host.replacingOccurrences(of: "www.", with: "")
            let parts = clean.split(separator: ".")
            if let first = parts.first, !first.isEmpty {
                return String(first.prefix(2)).uppercased()
            }
        }

        return "K"
    }

    private func brandGradientColors(for title: String, urls: [String]) -> (Color, Color) {
        let key = (urls.first ?? title).lowercased()
        let hash = abs(key.hashValue)

        let palette: [(Color, Color)] = [
            (Color(red: 0.26, green: 0.22, blue: 0.79), Color(red: 0.49, green: 0.23, blue: 0.93)), // Indigo -> Violet
            (Color(red: 0.02, green: 0.59, blue: 0.41), Color(red: 0.06, green: 0.73, blue: 0.51)), // Emerald -> Teal
            (Color(red: 0.01, green: 0.52, blue: 0.78), Color(red: 0.22, green: 0.74, blue: 0.97)), // Ocean -> Sky
            (Color(red: 0.75, green: 0.07, blue: 0.24), Color(red: 0.96, green: 0.25, blue: 0.37)), // Crimson -> Rose
            (Color(red: 0.85, green: 0.47, blue: 0.02), Color(red: 0.96, green: 0.62, blue: 0.11)), // Amber -> Tangerine
            (Color(red: 0.43, green: 0.16, blue: 0.85), Color(red: 0.75, green: 0.15, blue: 0.83)), // Violet -> Fuchsia
            (Color(red: 0.05, green: 0.58, blue: 0.53), Color(red: 0.02, green: 0.71, blue: 0.83)), // Teal -> Cyan
            (Color(red: 0.11, green: 0.31, blue: 0.85), Color(red: 0.39, green: 0.40, blue: 0.95)), // Royal -> Indigo
            (Color(red: 0.92, green: 0.35, blue: 0.05), Color(red: 0.98, green: 0.57, blue: 0.24)), // Orange -> Coral
            (Color(red: 0.86, green: 0.15, blue: 0.47), Color(red: 0.98, green: 0.44, blue: 0.52)), // Pink -> Rose
            (Color(red: 0.08, green: 0.50, blue: 0.24), Color(red: 0.20, green: 0.83, blue: 0.60)), // Forest -> Emerald
            (Color(red: 0.20, green: 0.25, blue: 0.33), Color(red: 0.39, green: 0.45, blue: 0.55))  // Slate -> Zinc
        ]

        let index = hash % palette.count
        return palette[index]
    }

    // MARK: - Logo Loading

    @MainActor
    private func loadLogo() async {
        let domains = LogoService.shared.resolveDomains(urls: urls, title: title, oauthProvider: oauthProvider)
        guard !domains.isEmpty else {
            if loadedImage != nil {
                withAnimation(.easeOut(duration: 0.15)) {
                    self.loadedImage = nil
                }
            }
            return
        }

        if let cached = LogoService.shared.cachedImageSync(urls: urls, title: title, oauthProvider: oauthProvider) {
            if self.loadedImage !== cached {
                self.loadedImage = cached
            }
            return
        }

        let fetched = await LogoService.shared.fetchLogo(
            urls: urls,
            title: title,
            oauthProvider: oauthProvider,
            itemType: itemType
        )

        if let fetched = fetched {
            withAnimation(.easeOut(duration: 0.18)) {
                self.loadedImage = fetched
            }
        }
    }
}
