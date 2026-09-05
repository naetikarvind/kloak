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
            // Ambient Aura Glow behind icon
            if glow {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 0.45, green: 0.25, blue: 1.0).opacity(0.45),
                                Color(red: 0.35, green: 0.78, blue: 0.98).opacity(0.20),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: size * 0.15,
                            endRadius: size * 0.85
                        )
                    )
                    .frame(width: size * 1.7, height: size * 1.7)
                    .blur(radius: size * 0.18)
            }

            // High-Fidelity Liquid Glass Icon matching AppIcon.icon
            LiquidGlassKloakIcon(size: size)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Native Liquid Glass Multi-Layer Icon Engine
public struct LiquidGlassKloakIcon: View {
    public var size: CGFloat

    public init(size: CGFloat = 80) {
        self.size = size
    }

    public var body: some View {
        ZStack {
            // ── Layer 1: Base Squircle Tile & Gradient ───────────────────────
            RoundedRectangle(cornerRadius: size * 0.224, style: .continuous)
                .fill(
                    LinearGradient(
                        stops: [
                            .init(color: Color(red: 0.3481, green: 0.2125, blue: 1.0000), location: 0.0),
                            .init(color: Color(red: 0.5499, green: 0.0979, blue: 0.8468), location: 0.70),
                            .init(color: Color(red: 0.4500, green: 0.0800, blue: 0.7500), location: 1.0)
                        ],
                        startPoint: UnitPoint(x: 0.5, y: 0.0),
                        endPoint: UnitPoint(x: 0.5, y: 1.0)
                    )
                )
                .frame(width: size, height: size)
                .shadow(color: Color.black.opacity(0.35), radius: size * 0.10, x: 0, y: size * 0.05)

            // ── Layer 2: Glass Specular Rim Border ───────────────────────────
            RoundedRectangle(cornerRadius: size * 0.224, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.55),
                            Color.white.opacity(0.18),
                            Color.white.opacity(0.04),
                            Color.white.opacity(0.12)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: max(1.0, size * 0.018)
                )
                .frame(width: size, height: size)

            // ── Layer 3: Glass Refraction & Vector Artwork Layers ────────────
            ZStack {
                // Diagonal Glass Sheen & Surface Refraction
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.20),
                        Color.white.opacity(0.05),
                        Color.clear
                    ],
                    startPoint: .topLeading,
                    endPoint: UnitPoint(x: 0.65, y: 0.65)
                )
                .blendMode(.screen)

                // ── Group 1: "LOck" Shackle Arc Layer (Glass & Lighten) ───────
                LockShackleLayer(size: size)

                // ── Group 2: "Shield" Body & Bevel (Glass & Depth) ───────────
                ShieldBodyLayer(size: size)

                // ── Group 3: "K" Emblem (Hard-Light & Neon Cyan Halo) ─────────
                EmblemKLayer(size: size)
            }
            .clipShape(RoundedRectangle(cornerRadius: size * 0.224, style: .continuous))
            .frame(width: size, height: size)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Vector Shapes matching AppIcon.icon/Assets/*.svg

/// Lock Shackle Arc Shape matching `gemini-svg (3).svg`
/// SVG Path: `M 360 400 L 360 280 A 152 152 0 0 1 664 280 L 664 400`
struct LockShackleShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let sx = rect.width / 1024.0
        let sy = rect.height / 1024.0
        let dy: CGFloat = -50.0625 * sy // translation from icon.json

        let p1 = CGPoint(x: rect.minX + 360.0 * sx, y: rect.minY + 400.0 * sy + dy)
        let p2 = CGPoint(x: rect.minX + 360.0 * sx, y: rect.minY + 280.0 * sy + dy)
        let center = CGPoint(x: rect.minX + 512.0 * sx, y: rect.minY + 280.0 * sy + dy)
        let radius = 152.0 * sx
        let p3 = CGPoint(x: rect.minX + 664.0 * sx, y: rect.minY + 400.0 * sy + dy)

        path.move(to: p1)
        path.addLine(to: p2)
        path.addArc(center: center, radius: radius, startAngle: .radians(.pi), endAngle: .radians(0), clockwise: false)
        path.addLine(to: p3)

        return path
    }
}

/// Left Shield Half matching `gemini-svg (2).svg`
/// SVG Path: `M 512 280 L 224 360 L 224 640 C 224 820 512 940 512 940 Z`
struct ShieldLeftShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let sx = rect.width / 1024.0
        let sy = rect.height / 1024.0
        let dy: CGFloat = -15.88 * sy // translation from icon.json

        // Scaled at 1.06 around center (512, 512)
        let scale: CGFloat = 1.06
        let cx = rect.midX
        let cy = rect.midY + dy

        func transform(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            let px = rect.minX + x * sx
            let py = rect.minY + y * sy
            return CGPoint(
                x: cx + (px - cx) * scale,
                y: cy + (py - cy) * scale
            )
        }

        path.move(to: transform(512, 280))
        path.addLine(to: transform(224, 360))
        path.addLine(to: transform(224, 640))
        path.addCurve(
            to: transform(512, 940),
            control1: transform(224, 820),
            control2: transform(512, 940)
        )
        path.closeSubpath()

        return path
    }
}

/// Right Shield Half matching `gemini-svg (1).svg`
/// SVG Path: `M 512 280 L 800 360 L 800 640 C 800 820 512 940 512 940 Z`
struct ShieldRightShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let sx = rect.width / 1024.0
        let sy = rect.height / 1024.0
        let dy: CGFloat = -15.88 * sy // translation from icon.json

        let scale: CGFloat = 1.06
        let cx = rect.midX
        let cy = rect.midY + dy

        func transform(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            let px = rect.minX + x * sx
            let py = rect.minY + y * sy
            return CGPoint(
                x: cx + (px - cx) * scale,
                y: cy + (py - cy) * scale
            )
        }

        path.move(to: transform(512, 280))
        path.addLine(to: transform(800, 360))
        path.addLine(to: transform(800, 640))
        path.addCurve(
            to: transform(512, 940),
            control1: transform(800, 820),
            control2: transform(512, 940)
        )
        path.closeSubpath()

        return path
    }
}

/// Shield Outline Rim matching `gemini-svg (4).svg`
/// SVG Path: `M 512 280 L 800 360 L 800 640 C 800 820 512 940 512 940 C 512 940 224 820 224 640 L 224 360 Z`
struct ShieldBorderShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let sx = rect.width / 1024.0
        let sy = rect.height / 1024.0
        let dy: CGFloat = -17.84 * sy // translation from icon.json

        let scale: CGFloat = 1.08
        let cx = rect.midX
        let cy = rect.midY + dy

        func transform(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            let px = rect.minX + x * sx
            let py = rect.minY + y * sy
            return CGPoint(
                x: cx + (px - cx) * scale,
                y: cy + (py - cy) * scale
            )
        }

        path.move(to: transform(512, 280))
        path.addLine(to: transform(800, 360))
        path.addLine(to: transform(800, 640))
        path.addCurve(
            to: transform(512, 940),
            control1: transform(800, 820),
            control2: transform(512, 940)
        )
        path.addCurve(
            to: transform(224, 640),
            control1: transform(512, 940),
            control2: transform(224, 820)
        )
        path.addLine(to: transform(224, 360))
        path.closeSubpath()

        return path
    }
}

/// Geometric "K" Emblem matching `gemini-svg.svg`
/// SVG Paths:
/// `M 377 440 L 437 440 L 437 760 L 377 760 Z`
/// `M 437 620 L 557 440 L 637 440 L 487 650 L 647 760 L 557 760 L 437 640 Z`
struct EmblemKShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let sx = rect.width / 1024.0
        let sy = rect.height / 1024.0

        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            return CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }

        // Stem
        path.move(to: pt(377, 440))
        path.addLine(to: pt(437, 440))
        path.addLine(to: pt(437, 760))
        path.addLine(to: pt(377, 760))
        path.closeSubpath()

        // Diagonal Arms
        path.move(to: pt(437, 620))
        path.addLine(to: pt(557, 440))
        path.addLine(to: pt(637, 440))
        path.addLine(to: pt(487, 650))
        path.addLine(to: pt(647, 760))
        path.addLine(to: pt(557, 760))
        path.addLine(to: pt(437, 640))
        path.closeSubpath()

        return path
    }
}

// MARK: - Layer Components

/// Lock Shackle with Liquid Glass material properties
struct LockShackleLayer: View {
    var size: CGFloat

    var body: some View {
        ZStack {
            // Neutral Shadow (icon.json: shadow neutral opacity 0.5)
            LockShackleShape()
                .stroke(
                    Color.black.opacity(0.40),
                    style: StrokeStyle(lineWidth: (64.0 / 1024.0) * size, lineCap: .round, lineJoin: .round)
                )
                .offset(y: size * 0.02)
                .blur(radius: size * 0.02)

            // Frosted Glass Shackle Gradient Tube (icon.json: glass: true, blend-mode: lighten)
            LockShackleShape()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(red: 0.545, green: 0.361, blue: 0.965), // #8B5CF6
                            Color(red: 0.231, green: 0.510, blue: 0.965)  // #3B82F6
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: (64.0 / 1024.0) * size, lineCap: .round, lineJoin: .round)
                )
                .opacity(0.95)
                .blendMode(.lighten)

            // Specular Glass Highlight Ridge
            LockShackleShape()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.65),
                            Color.white.opacity(0.15),
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    style: StrokeStyle(lineWidth: (14.0 / 1024.0) * size, lineCap: .round, lineJoin: .round)
                )
                .offset(y: -size * 0.006)
        }
        .frame(width: size, height: size)
    }
}

/// Translucent Shield with Frosted Glass Left Plate and Obsidian Right Plate
struct ShieldBodyLayer: View {
    var size: CGFloat

    var body: some View {
        ZStack {
            // Shield Depth Shadow (icon.json: shadow neutral opacity 0.5)
            ZStack {
                ShieldLeftShape().fill(Color.black.opacity(0.45))
                ShieldRightShape().fill(Color.black.opacity(0.45))
            }
            .offset(y: size * 0.035)
            .blur(radius: size * 0.03)

            // Left Shield: Frosted Violet Glass Plate (icon.json: glass: true, translucency: 0.5)
            ShieldLeftShape()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.357, green: 0.129, blue: 0.714).opacity(0.92), // #5B21B6
                            Color(red: 0.192, green: 0.180, blue: 0.506).opacity(0.85)  // #312E81
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                // Internal Glass Refraction & Light Sheen
                .overlay(
                    ShieldLeftShape()
                        .stroke(
                            LinearGradient(
                                colors: [Color.white.opacity(0.45), Color.clear],
                                startPoint: .topLeading,
                                endPoint: .center
                            ),
                            lineWidth: max(1.0, size * 0.012)
                        )
                )

            // Right Shield: Deep Indigo Shadow Plate (icon.json: translucency: 0.5)
            ShieldRightShape()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.180, green: 0.063, blue: 0.396).opacity(0.92), // #2E1065
                            Color(red: 0.118, green: 0.106, blue: 0.294).opacity(0.85)  // #1E1B4B
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            // Outer Shield Bevel Rim (icon.json: gemini-svg (4).svg, stroke #7DD3FC)
            ShieldBorderShape()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(red: 0.490, green: 0.827, blue: 0.988), // #7DD3FC
                            Color(red: 0.250, green: 0.600, blue: 0.950).opacity(0.80)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    style: StrokeStyle(
                        lineWidth: max(1.2, (16.0 / 1024.0) * size),
                        lineJoin: .round
                    )
                )
                // Specular Light Rim on upper shield edges
                .overlay(
                    ShieldBorderShape()
                        .stroke(
                            LinearGradient(
                                colors: [Color.white.opacity(0.70), Color.clear],
                                startPoint: .top,
                                endPoint: UnitPoint(x: 0.5, y: 0.4)
                            ),
                            style: StrokeStyle(lineWidth: max(1.0, (12.0 / 1024.0) * size), lineJoin: .round)
                        )
                )
        }
        .frame(width: size, height: size)
    }
}

/// Floating Geometric "K" with Cyan Glow Filter and Frosted White Glass
struct EmblemKLayer: View {
    var size: CGFloat

    var body: some View {
        ZStack {
            // Neon Cyan Refraction Halo (matching SVG filter k-glow: #7DD3FC)
            EmblemKShape()
                .fill(Color(red: 0.490, green: 0.827, blue: 0.988).opacity(0.60))
                .blur(radius: size * 0.035)

            // Soft Shadow
            EmblemKShape()
                .fill(Color.black.opacity(0.40))
                .offset(x: 0, y: size * 0.02)
                .blur(radius: size * 0.012)

            // Translucent Frosted White Glass Letter (icon.json: blend-mode: hard-light)
            EmblemKShape()
                .fill(
                    LinearGradient(
                        colors: [
                            Color.white,
                            Color(white: 0.92)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .blendMode(.hardLight)

            // Glass Specular Face Ridge
            EmblemKShape()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.85),
                            Color.white.opacity(0.20)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: max(0.8, size * 0.008)
                )
        }
        .frame(width: size, height: size)
    }
}
