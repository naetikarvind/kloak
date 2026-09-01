import SwiftUI
import AppKit

public struct KloakLogoView: View {
    public var size: CGFloat
    public var glow: Bool = false

    private static let iconPath = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/macos-app/Sources/KloakApp/Resources/AppIcon.png"
    private static let cachedImage: NSImage? = {
        if let img = NSImage(contentsOfFile: iconPath) {
            return img
        }
        return nil
    }()

    public init(size: CGFloat = 80, glow: Bool = false) {
        self.size = size
        self.glow = glow
    }

    public var body: some View {
        ZStack {
            if glow {
                Circle()
                    .fill(LiquidGlassTheme.primaryAccent.opacity(0.3))
                    .frame(width: size * 1.4, height: size * 1.4)
                    .blur(radius: size * 0.25)
            }

            if let img = Self.cachedImage {
                Image(nsImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
                    .shadow(color: Color.black.opacity(0.35), radius: size * 0.08, x: 0, y: size * 0.04)
            } else {
                // Vector fallback
                ZStack {
                    RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.08, green: 0.38, blue: 0.81), Color(red: 0.03, green: 0.05, blue: 0.35)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: size, height: size)

                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: size * 0.5, weight: .bold))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.white, LiquidGlassTheme.amberAccent],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                }
            }
        }
    }
}
