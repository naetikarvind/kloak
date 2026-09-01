import SwiftUI

public struct TOTPRingView: View {
    public let secret: String
    @State private var totpResult: TOTPResult?
    @State private var timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    @State private var copied: Bool = false

    public init(secret: String) {
        self.secret = secret
    }

    private var progress: Double {
        guard let res = totpResult else { return 0 }
        return Double(res.secondsRemaining) / Double(res.period)
    }

    private var ringColor: Color {
        guard let res = totpResult else { return .blue }
        if res.secondsRemaining <= 5 { return LiquidGlassTheme.roseAccent }
        if res.secondsRemaining <= 10 { return LiquidGlassTheme.amberAccent }
        return LiquidGlassTheme.emeraldAccent
    }

    public var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.12), lineWidth: 4.5)
                    .frame(width: 52, height: 52)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(ringColor, style: StrokeStyle(lineWidth: 4.5, lineCap: .round))
                    .frame(width: 52, height: 52)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1.0), value: progress)

                Text("\(totpResult?.secondsRemaining ?? 0)s")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(.primary)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("ONE-TIME PASSWORD")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                Text(formattedToken(totpResult?.token ?? "------"))
                    .font(.system(size: 26, weight: .heavy, design: .monospaced))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    .tracking(2)
            }

            Spacer()

            Button(action: copyToken) {
                HStack(spacing: 5) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 13, weight: .bold))
                    if copied {
                        Text("Copied")
                            .font(.system(size: 11, weight: .bold))
                            .transition(.opacity.combined(with: .scale))
                    }
                }
                .foregroundColor(copied ? LiquidGlassTheme.emeraldAccent : .secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .scaleEffect(copied ? 1.05 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: copied)
            }
            .buttonStyle(.plain)
            .help("Copy Authenticator Code")
        }
        .padding(12)
        .background(Color.black.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .onAppear { updateCode() }
        .onReceive(timer) { _ in updateCode() }
    }

    private func updateCode() {
        totpResult = TOTPEngine.shared.generate(secretBase32: secret)
    }

    private func formattedToken(_ token: String) -> String {
        if token.count == 6 {
            let first = token.prefix(3)
            let second = token.suffix(3)
            return "\(first) \(second)"
        }
        return token
    }

    private func copyToken() {
        guard let token = totpResult?.token else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(token, forType: .string)
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            copied = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation(.easeInOut(duration: 0.2)) {
                copied = false
            }
        }
    }
}
