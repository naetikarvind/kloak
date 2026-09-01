import SwiftUI

public struct LiquidGlassTheme {
    public static let primaryAccent = Color(red: 0.20, green: 0.55, blue: 1.0)
    public static let emeraldAccent = Color(red: 0.15, green: 0.80, blue: 0.50)
    public static let roseAccent = Color(red: 1.0, green: 0.30, blue: 0.40)
    public static let amberAccent = Color(red: 1.0, green: 0.72, blue: 0.15)
    public static let purpleAccent = Color(red: 0.65, green: 0.35, blue: 1.0)

    public static let glassBackground = Color.black.opacity(0.35)
    public static let cardBackground = Color.white.opacity(0.04)
    public static let cardBorder = Color.white.opacity(0.10)
    public static let glassBorder = LinearGradient(
        colors: [Color.white.opacity(0.20), Color.white.opacity(0.05)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

public struct GlassCardModifier: ViewModifier {
    var cornerRadius: CGFloat = 14
    var isInteractive: Bool = false
    @State private var isHovered: Bool = false

    public func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(LiquidGlassTheme.cardBorder, lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.15), radius: 8, x: 0, y: 3)
            )
            .onHover { hovering in
                if isInteractive {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        isHovered = hovering
                    }
                }
            }
    }
}

public struct GlassCapsuleButton: ButtonStyle {
    var isPrimary: Bool = true

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .semibold))
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .foregroundColor(isPrimary ? .white : .primary)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(isPrimary ? AnyShapeStyle(LinearGradient(colors: [LiquidGlassTheme.primaryAccent, Color.blue], startPoint: .top, endPoint: .bottom)) : AnyShapeStyle(Color.white.opacity(0.08)))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Color.white.opacity(isPrimary ? 0.30 : 0.12), lineWidth: 0.75)
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

public struct GlassEffectContainer<Content: View>: View {
    let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.06, blue: 0.12),
                    Color(red: 0.06, green: 0.04, blue: 0.10),
                    Color.black
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            content
        }
    }
}

extension View {
    public func glassEffect(cornerRadius: CGFloat = 14, interactive: Bool = false) -> some View {
        self.modifier(GlassCardModifier(cornerRadius: cornerRadius, isInteractive: interactive))
    }
}
