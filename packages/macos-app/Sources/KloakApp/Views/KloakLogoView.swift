import SwiftUI
import AppKit

public struct KloakLogoView: View {
    public var size: CGFloat
    public var glow: Bool = false

    public init(size: CGFloat = 80, glow: Bool = false) {
        self.size = size
        self.glow = glow
    }

    public var body: some View {
        ZStack {
            if glow {
                Circle()
                    .fill(Color(red: 0.35, green: 0.21, blue: 1.0).opacity(0.35))
                    .frame(width: size * 1.4, height: size * 1.4)
                    .blur(radius: size * 0.25)
            }

            if let img = loadAppIcon() {
                Image(nsImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
                    .shadow(color: Color.black.opacity(0.35), radius: size * 0.08, x: 0, y: size * 0.04)
            } else {
                // Native SwiftUI Vector Render of New Kloak Purple Icon
                NativeKloakIconVector(size: size)
            }
        }
    }

    private func loadAppIcon() -> NSImage? {
        if let img = NSImage(named: "AppIcon") {
            return img
        }
        return nil
    }
}

public struct NativeKloakIconVector: View {
    public var size: CGFloat

    public var body: some View {
        ZStack {
            // Background Squircle with Purple Gradient
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color(red: 0.35, green: 0.21, blue: 1.0), Color(red: 0.55, green: 0.10, blue: 0.85)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: size, height: size)
                .overlay(
                    RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                        .stroke(Color.white.opacity(0.25), lineWidth: max(1, size * 0.015))
                )
                .shadow(color: Color.black.opacity(0.4), radius: size * 0.08, x: 0, y: size * 0.04)

            // Inner Shield Artwork
            ZStack {
                // Lock Shackle Arc
                Circle()
                    .trim(from: 0.5, to: 1.0)
                    .stroke(
                        LinearGradient(
                            colors: [Color(red: 0.55, green: 0.36, blue: 0.96), Color(red: 0.23, green: 0.51, blue: 0.96)],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: size * 0.08, lineCap: .round)
                    )
                    .frame(width: size * 0.35, height: size * 0.35)
                    .offset(y: -size * 0.16)

                // Shield Body
                Image(systemName: "shield.fill")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: size * 0.54, height: size * 0.54)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(red: 0.36, green: 0.13, blue: 0.71), Color(red: 0.12, green: 0.11, blue: 0.29)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(
                        Image(systemName: "shield")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: size * 0.54, height: size * 0.54)
                            .foregroundColor(Color(red: 0.49, green: 0.83, blue: 0.99))
                    )
                    .offset(y: size * 0.04)

                // Glowing White 'K' in Center of Shield
                Text("K")
                    .font(.system(size: size * 0.32, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .shadow(color: Color(red: 0.49, green: 0.83, blue: 0.99), radius: size * 0.05)
                    .offset(y: size * 0.04)
            }
        }
        .frame(width: size, height: size)
    }
}
