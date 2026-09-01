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
                    .stroke(Color.white.opacity(0.1), lineWidth: 4)
                    .frame(width: 44, height: 44)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(ringColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .frame(width: 44, height: 44)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1.0), value: progress)

                Text("\(totpResult?.secondsRemaining ?? 0)s")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(.secondary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("ONE-TIME CODE")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                HStack {
                    Text(formattedToken(totpResult?.token ?? "------"))
                        .font(.system(size: 22, weight: .heavy, design: .monospaced))
                        .foregroundColor(.primary)

                    Button(action: copyToken) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(copied ? LiquidGlassTheme.emeraldAccent : .secondary)
                            .scaleEffect(copied ? 1.25 : 1.0)
                            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: copied)
                    }
                    .buttonStyle(.plain)
                    .padding(.leading, 6)
                }
            }

            Spacer()
        }
        .padding(12)
        .glassEffect(cornerRadius: 12)
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
