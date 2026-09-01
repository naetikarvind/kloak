import SwiftUI

public struct GeneratorView: View {
    @State private var mode: Int = 0 // 0: Password, 1: Passphrase
    @State private var length: Double = 20
    @State private var wordsCount: Double = 4
    @State private var useUpper: Bool = true
    @State private var useLower: Bool = true
    @State private var useNumbers: Bool = true
    @State private var useSymbols: Bool = true
    @State private var avoidAmbiguous: Bool = false
    
    @State private var generatedString: String = ""
    @State private var copied: Bool = false

    public var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Standalone Glass Preview Card
                VStack(spacing: 16) {
                    HStack {
                        Picker("", selection: $mode) {
                            Text("Random Password").tag(0)
                            Text("EFF Passphrase").tag(1)
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 260)

                        Spacer()

                        Button(action: generate) {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: false))
                    }

                    // Result box
                    HStack(alignment: .center, spacing: 12) {
                        Text(generatedString)
                            .font(.system(size: 15, weight: .bold, design: .monospaced))
                            .foregroundColor(.primary)
                            .textSelection(.enabled)
                            .lineLimit(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .fixedSize(horizontal: false, vertical: true)

                        Button(action: copyToClipboard) {
                            Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: true))
                    }
                    .padding(14)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    // Strength Indicator Bar
                    HStack(spacing: 6) {
                        ForEach(0..<4) { idx in
                            Capsule()
                                .fill(idx < strengthScore ? LiquidGlassTheme.emeraldAccent : Color.white.opacity(0.1))
                                .frame(height: 5)
                        }
                    }
                }
                .padding(20)
                .glassEffect(cornerRadius: 20)

                // Controls Panel
                VStack(alignment: .leading, spacing: 18) {
                    Text("CONFIGURATION")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.secondary)

                    if mode == 0 {
                        // Length slider
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Length")
                                    .font(.system(size: 13, weight: .medium))
                                Spacer()
                                Text("\(Int(length)) characters")
                                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                            }
                            Slider(value: $length, in: 8...64, step: 1)
                                .onChange(of: length) { _, _ in generate() }
                        }

                        Divider().opacity(0.15)

                        Toggle("Uppercase Letters (A-Z)", isOn: $useUpper)
                            .onChange(of: useUpper) { _, _ in generate() }
                        Toggle("Lowercase Letters (a-z)", isOn: $useLower)
                            .onChange(of: useLower) { _, _ in generate() }
                        Toggle("Numbers (0-9)", isOn: $useNumbers)
                            .onChange(of: useNumbers) { _, _ in generate() }
                        Toggle("Symbols (!@#$%^&*)", isOn: $useSymbols)
                            .onChange(of: useSymbols) { _, _ in generate() }
                        Toggle("Avoid Ambiguous Characters (0, O, 1, l, I)", isOn: $avoidAmbiguous)
                            .onChange(of: avoidAmbiguous) { _, _ in generate() }
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Word Count")
                                    .font(.system(size: 13, weight: .medium))
                                Spacer()
                                Text("\(Int(wordsCount)) words")
                                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                            }
                            Slider(value: $wordsCount, in: 3...10, step: 1)
                                .onChange(of: wordsCount) { _, _ in generate() }
                        }
                    }
                }
                .padding(20)
                .glassEffect(cornerRadius: 20)
            }
            .padding(24)
        }
        .onAppear { generate() }
        .onChange(of: mode) { _, _ in generate() }
    }

    private var strengthScore: Int {
        if mode == 1 {
            return Int(wordsCount) >= 5 ? 4 : 3
        }
        if length >= 20 { return 4 }
        if length >= 14 { return 3 }
        if length >= 10 { return 2 }
        return 1
    }

    private func generate() {
        if mode == 0 {
            var pool = ""
            if useUpper { pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ" }
            if useLower { pool += "abcdefghijklmnopqrstuvwxyz" }
            if useNumbers { pool += "0123456789" }
            if useSymbols { pool += "!@#$%^&*()_+-=[]{}|;:,.<>?" }
            if avoidAmbiguous {
                pool = pool.filter { !"0O1lI|[]{}()/'\"`~,;:.<>".contains($0) }
            }
            if pool.isEmpty { pool = "abcdefghijklmnopqrstuvwxyz" }

            var res = ""
            for _ in 0..<Int(length) {
                if let char = pool.randomElement() {
                    res.append(char)
                }
            }
            generatedString = res
        } else {
            let sampleWords = ["Quantum", "Obsidian", "Cascade", "Cipher", "Aurora", "Beacon", "Vortex", "Horizon", "Nebula", "Sentinel", "Apex", "Echo"]
            var words: [String] = []
            for _ in 0..<Int(wordsCount) {
                words.append(sampleWords.randomElement() ?? "Key")
            }
            words.append("\(Int.random(in: 10...99))")
            generatedString = words.joined(separator: "-")
        }
    }

    private func copyToClipboard() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(generatedString, forType: .string)
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            copied = false
        }
    }
}
