import Cocoa

// MARK: - Canvas & Dimensions
let baseWidth: CGFloat = 1200
let baseHeight: CGFloat = 675
let scale: CGFloat = 2.0 // 2x Retina (2400 x 1350)

let pixelWidth = Int(baseWidth * scale)
let pixelHeight = Int(baseHeight * scale)

print("🎨 Rendering Premium LinkedIn Announcement Graphic (\(pixelWidth) x \(pixelHeight))...")

let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: pixelWidth,
    pixelsHigh: pixelHeight,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
)!
rep.size = NSSize(width: baseWidth, height: baseHeight)

NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: rep) else {
    fatalError("Failed to initialize NSGraphicsContext")
}
NSGraphicsContext.current = context
let cg = context.cgContext

func uiY(_ topY: CGFloat, height: CGFloat = 0) -> CGFloat {
    return baseHeight - topY - height
}

let colorSpace = CGColorSpaceCreateDeviceRGB()

func nsColor(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1.0) -> NSColor {
    return NSColor(calibratedRed: r/255.0, green: g/255.0, blue: b/255.0, alpha: a)
}

func cgColor(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1.0) -> CGColor {
    return nsColor(r, g, b, a).cgColor
}

// MARK: - 1. Deep Obsidian Background & Cyber Glows
let bgColors = [
    cgColor(6, 8, 18, 1.0),
    cgColor(10, 14, 28, 1.0)
] as CFArray
let bgGrad = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: [0.0, 1.0])!
cg.drawLinearGradient(bgGrad, start: CGPoint(x: 0, y: baseHeight), end: CGPoint(x: 0, y: 0), options: [])

// Cyan Radial Glow (Top-Left under macOS window)
let cyanGlowColors = [
    cgColor(0, 225, 255, 0.17),
    cgColor(0, 225, 255, 0.0)
] as CFArray
let cyanGlow = CGGradient(colorsSpace: colorSpace, colors: cyanGlowColors, locations: [0.0, 1.0])!
cg.drawRadialGradient(
    cyanGlow,
    startCenter: CGPoint(x: 320, y: uiY(280)),
    startRadius: 0,
    endCenter: CGPoint(x: 320, y: uiY(280)),
    endRadius: 460,
    options: [.drawsAfterEndLocation]
)

// Purple Radial Glow (Top-Right under Chrome extension)
let purpleGlowColors = [
    cgColor(139, 92, 246, 0.22),
    cgColor(139, 92, 246, 0.0)
] as CFArray
let purpleGlow = CGGradient(colorsSpace: colorSpace, colors: purpleGlowColors, locations: [0.0, 1.0])!
cg.drawRadialGradient(
    purpleGlow,
    startCenter: CGPoint(x: 880, y: uiY(280)),
    startRadius: 0,
    endCenter: CGPoint(x: 880, y: uiY(280)),
    endRadius: 480,
    options: [.drawsAfterEndLocation]
)

// Subtle Grid Lines
cg.saveGState()
cg.setStrokeColor(cgColor(255, 255, 255, 0.024))
cg.setLineWidth(1.0)
for x in stride(from: CGFloat(20), to: baseWidth, by: 40) {
    cg.move(to: CGPoint(x: x, y: 0))
    cg.addLine(to: CGPoint(x: x, y: baseHeight))
}
for y in stride(from: CGFloat(20), to: baseHeight, by: 40) {
    cg.move(to: CGPoint(x: 0, y: y))
    cg.addLine(to: CGPoint(x: baseWidth, y: y))
}
cg.strokePath()
cg.restoreGState()

// MARK: - 2. Top Header & Branding
let headerTopY: CGFloat = 24

// Kloak Logo
let logoUrl = URL(fileURLWithPath: "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/kloak-logo.png")
if let logoImage = NSImage(contentsOf: logoUrl) {
    var r = CGRect(x: 0, y: 0, width: logoImage.size.width, height: logoImage.size.height)
    if let cgLogo = logoImage.cgImage(forProposedRect: &r, context: nil, hints: nil) {
        let logoSize: CGFloat = 50
        let logoRect = CGRect(x: 42, y: uiY(headerTopY, height: logoSize), width: logoSize, height: logoSize)
        
        // Outer Cyan Glow
        cg.saveGState()
        cg.setShadow(offset: CGSize(width: 0, height: 0), blur: 16, color: cgColor(56, 189, 248, 0.50))
        let path = CGPath(roundedRect: logoRect, cornerWidth: 12, cornerHeight: 12, transform: nil)
        cg.addPath(path)
        cg.setFillColor(cgColor(15, 23, 42, 1.0))
        cg.fillPath()
        cg.restoreGState()
        
        // Squircle clip
        cg.saveGState()
        let clipPath = CGPath(roundedRect: logoRect, cornerWidth: 12, cornerHeight: 12, transform: nil)
        cg.addPath(clipPath)
        cg.clip()
        cg.draw(cgLogo, in: logoRect)
        cg.restoreGState()
        
        // Border
        cg.saveGState()
        cg.addPath(clipPath)
        cg.setStrokeColor(cgColor(56, 189, 248, 0.45))
        cg.setLineWidth(1.5)
        cg.strokePath()
        cg.restoreGState()
    }
}

// Brand Title & Tagline
let brandTitleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 22, weight: .heavy),
    .foregroundColor: NSColor.white,
    .kern: 1.5
]
let brandSubAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
    .foregroundColor: nsColor(56, 189, 248)
]
let tagAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 11, weight: .medium),
    .foregroundColor: nsColor(148, 163, 184)
]

let brandTitle = "K L O A K" as NSString
let brandType = "PASSWORD MANAGER" as NSString
let brandTag = "100% Local-First • Zero-Knowledge • Zero-Telemetry • Free & Open Source" as NSString

brandTitle.draw(at: NSPoint(x: 104, y: uiY(headerTopY + 3, height: 20)), withAttributes: brandTitleAttrs)
brandType.draw(at: NSPoint(x: 232, y: uiY(headerTopY + 6, height: 16)), withAttributes: brandSubAttrs)
brandTag.draw(at: NSPoint(x: 104, y: uiY(headerTopY + 29, height: 14)), withAttributes: tagAttrs)

// Status Pill on Top Right
let badgeW: CGFloat = 320
let badgeH: CGFloat = 32
let badgeRect = CGRect(x: baseWidth - badgeW - 42, y: uiY(headerTopY + 9, height: badgeH), width: badgeW, height: badgeH)

cg.saveGState()
let badgePath = CGPath(roundedRect: badgeRect, cornerWidth: 16, cornerHeight: 16, transform: nil)
cg.addPath(badgePath)
cg.setFillColor(cgColor(56, 189, 248, 0.12))
cg.fillPath()
cg.addPath(badgePath)
cg.setStrokeColor(cgColor(56, 189, 248, 0.40))
cg.setLineWidth(1.2)
cg.strokePath()

let badgeText = "🚀 PUBLIC RELEASE AVAILABLE NOW" as NSString
let badgeAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 11, weight: .bold),
    .foregroundColor: nsColor(56, 189, 248),
    .kern: 0.8
]
let bSize = badgeText.size(withAttributes: badgeAttrs)
badgeText.draw(at: NSPoint(x: badgeRect.midX - bSize.width/2, y: badgeRect.midY - bSize.height/2 + 1), withAttributes: badgeAttrs)
cg.restoreGState()

// MARK: - 3. Central Showcase Cards (Side-by-Side: macOS App & Chrome Extension)
let cardTopY: CGFloat = 88
let cardW: CGFloat = 540
let cardH: CGFloat = 442
let cardRadius: CGFloat = 16
let titleBarH: CGFloat = 36
let footerH: CGFloat = 34

// Load Screenshots
let s2Url = URL(fileURLWithPath: "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/screenshots/screenshot-2-vault.png")
let s1Url = URL(fileURLWithPath: "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/screenshots/screenshot-1-autofill.png")

let s2Img = NSImage(contentsOf: s2Url)
let s1Img = NSImage(contentsOf: s1Url)

var s2R = CGRect(x: 0, y: 0, width: s2Img?.size.width ?? 0, height: s2Img?.size.height ?? 0)
var s1R = CGRect(x: 0, y: 0, width: s1Img?.size.width ?? 0, height: s1Img?.size.height ?? 0)

let cgS2 = s2Img?.cgImage(forProposedRect: &s2R, context: nil, hints: nil)
let cgS1 = s1Img?.cgImage(forProposedRect: &s1R, context: nil, hints: nil)

// Window crops
let cgWin2 = cgS2?.cropping(to: CGRect(x: 136, y: 206, width: 1008, height: 588))
// For Chrome Autofill, crop centered on the login card and autofill popup
let cgWin1 = cgS1?.cropping(to: CGRect(x: 235, y: 175, width: 710, height: 490))

// ── LEFT CARD: Native macOS Desktop App ──
let leftCardRect = CGRect(x: 42, y: uiY(cardTopY, height: cardH), width: cardW, height: cardH)

cg.saveGState()
// Shadow
cg.setShadow(offset: CGSize(width: 0, height: -12), blur: 32, color: cgColor(0, 0, 0, 0.60))
let leftPath = CGPath(roundedRect: leftCardRect, cornerWidth: cardRadius, cornerHeight: cardRadius, transform: nil)
cg.addPath(leftPath)
cg.setFillColor(cgColor(14, 18, 33, 0.98))
cg.fillPath()
cg.restoreGState()

// Border with subtle cyan glow
cg.saveGState()
cg.addPath(leftPath)
cg.setStrokeColor(cgColor(56, 189, 248, 0.40))
cg.setLineWidth(1.5)
cg.strokePath()
cg.restoreGState()

// Left Card Clip
cg.saveGState()
cg.addPath(leftPath)
cg.clip()

// Titlebar
let leftTitlebarRect = CGRect(x: leftCardRect.minX, y: leftCardRect.maxY - titleBarH, width: cardW, height: titleBarH)
cg.setFillColor(cgColor(18, 24, 44, 1.0))
cg.fill(leftTitlebarRect)

// Traffic light dots
let tlY = leftTitlebarRect.midY - 4.5
let colors: [(CGFloat, CGFloat, CGFloat)] = [(255, 95, 86), (255, 189, 46), (39, 201, 63)]
for (i, c) in colors.enumerated() {
    let dotX = leftTitlebarRect.minX + 14 + CGFloat(i * 15)
    cg.setFillColor(cgColor(c.0, c.1, c.2, 1.0))
    cg.fillEllipse(in: CGRect(x: dotX, y: tlY, width: 9, height: 9))
}

// Titlebar title
let leftTitle = " Native macOS App — Liquid Glass Vault" as NSString
let leftTitleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 11.5, weight: .semibold),
    .foregroundColor: nsColor(241, 245, 249)
]
let ltSize = leftTitle.size(withAttributes: leftTitleAttrs)
leftTitle.draw(at: NSPoint(x: leftTitlebarRect.midX - ltSize.width/2 + 10, y: leftTitlebarRect.midY - ltSize.height/2 + 1), withAttributes: leftTitleAttrs)

// Touch ID badge
let tidRect = CGRect(x: leftTitlebarRect.maxX - 110, y: leftTitlebarRect.midY - 9, width: 96, height: 18)
let tidPath = CGPath(roundedRect: tidRect, cornerWidth: 9, cornerHeight: 9, transform: nil)
cg.addPath(tidPath)
cg.setFillColor(cgColor(16, 185, 129, 0.15))
cg.fillPath()
cg.addPath(tidPath)
cg.setStrokeColor(cgColor(16, 185, 129, 0.40))
cg.setLineWidth(1.0)
cg.strokePath()

let tidText = "● Touch ID Ready" as NSString
let tidAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 9.5, weight: .bold),
    .foregroundColor: nsColor(52, 211, 153)
]
tidText.draw(at: NSPoint(x: tidRect.minX + 8, y: tidRect.minY + 3.5), withAttributes: tidAttrs)

// Divider line under titlebar
cg.setStrokeColor(cgColor(255, 255, 255, 0.08))
cg.setLineWidth(1.0)
cg.move(to: CGPoint(x: leftTitlebarRect.minX, y: leftTitlebarRect.minY))
cg.addLine(to: CGPoint(x: leftTitlebarRect.maxX, y: leftTitlebarRect.minY))
cg.strokePath()

// App Screenshot inside left card body
if let win2 = cgWin2 {
    let bodyRect = CGRect(
        x: leftCardRect.minX,
        y: leftCardRect.minY + footerH,
        width: cardW,
        height: cardH - titleBarH - footerH
    )
    cg.saveGState()
    cg.clip(to: bodyRect)
    cg.draw(win2, in: bodyRect)
    cg.restoreGState()
}

// Left Card Footer
let leftFooterRect = CGRect(x: leftCardRect.minX, y: leftCardRect.minY, width: cardW, height: footerH)
cg.setFillColor(cgColor(14, 18, 33, 1.0))
cg.fill(leftFooterRect)

cg.setStrokeColor(cgColor(255, 255, 255, 0.08))
cg.setLineWidth(1.0)
cg.move(to: CGPoint(x: leftFooterRect.minX, y: leftFooterRect.maxY))
cg.addLine(to: CGPoint(x: leftFooterRect.maxX, y: leftFooterRect.maxY))
cg.strokePath()

// 3 Feature chips in left footer
let leftChips = ["🔒 AES-256-GCM", "⚡️ Argon2id", "📂 ~/.kloak/ Vault"]
for (idx, ch) in leftChips.enumerated() {
    let chX = leftFooterRect.minX + 14 + CGFloat(idx * 168)
    let chRect = CGRect(x: chX, y: leftFooterRect.midY - 9, width: 156, height: 18)
    let chPath = CGPath(roundedRect: chRect, cornerWidth: 5, cornerHeight: 5, transform: nil)
    cg.addPath(chPath)
    cg.setFillColor(cgColor(255, 255, 255, 0.04))
    cg.fillPath()
    cg.addPath(chPath)
    cg.setStrokeColor(cgColor(255, 255, 255, 0.08))
    cg.setLineWidth(0.8)
    cg.strokePath()
    
    let chStr = ch as NSString
    let chAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 9.5, weight: .semibold),
        .foregroundColor: nsColor(148, 163, 184)
    ]
    let s = chStr.size(withAttributes: chAttrs)
    chStr.draw(at: NSPoint(x: chRect.midX - s.width/2, y: chRect.midY - s.height/2 + 1), withAttributes: chAttrs)
}
cg.restoreGState() // restore left card

// ── RIGHT CARD: Chrome Browser Extension & Autofill ──
let rightCardRect = CGRect(x: baseWidth - cardW - 42, y: uiY(cardTopY, height: cardH), width: cardW, height: cardH)

cg.saveGState()
// Purple Glow Shadow
cg.setShadow(offset: CGSize(width: 0, height: -12), blur: 32, color: cgColor(124, 58, 237, 0.45))
let rightPath = CGPath(roundedRect: rightCardRect, cornerWidth: cardRadius, cornerHeight: cardRadius, transform: nil)
cg.addPath(rightPath)
cg.setFillColor(cgColor(14, 18, 33, 0.98))
cg.fillPath()
cg.restoreGState()

// Border with subtle purple glow
cg.saveGState()
cg.addPath(rightPath)
cg.setStrokeColor(cgColor(168, 85, 247, 0.45))
cg.setLineWidth(1.5)
cg.strokePath()
cg.restoreGState()

// Right Card Clip
cg.saveGState()
cg.addPath(rightPath)
cg.clip()

// Titlebar
let rightTitlebarRect = CGRect(x: rightCardRect.minX, y: rightCardRect.maxY - titleBarH, width: cardW, height: titleBarH)
cg.setFillColor(cgColor(24, 18, 44, 1.0))
cg.fill(rightTitlebarRect)

// Puzzle / Extension icon
let pIcon = "🧩" as NSString
pIcon.draw(at: NSPoint(x: rightTitlebarRect.minX + 14, y: rightTitlebarRect.midY - 8), withAttributes: [.font: NSFont.systemFont(ofSize: 13)])

// Titlebar title
let rightTitle = "Chrome Web Store Extension & 1-Click Autofill" as NSString
let rightTitleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 11.5, weight: .semibold),
    .foregroundColor: nsColor(241, 245, 249)
]
let rtSize = rightTitle.size(withAttributes: rightTitleAttrs)
rightTitle.draw(at: NSPoint(x: rightTitlebarRect.midX - rtSize.width/2 + 6, y: rightTitlebarRect.midY - rtSize.height/2 + 1), withAttributes: rightTitleAttrs)

// Anti-Phishing badge
let phRect = CGRect(x: rightTitlebarRect.maxX - 128, y: rightTitlebarRect.midY - 9, width: 116, height: 18)
let phPath = CGPath(roundedRect: phRect, cornerWidth: 9, cornerHeight: 9, transform: nil)
cg.addPath(phPath)
cg.setFillColor(cgColor(168, 85, 247, 0.18))
cg.fillPath()
cg.addPath(phPath)
cg.setStrokeColor(cgColor(168, 85, 247, 0.45))
cg.setLineWidth(1.0)
cg.strokePath()

let phText = "🛡️ Anti-Phishing Guard" as NSString
let phAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 9.5, weight: .bold),
    .foregroundColor: nsColor(216, 180, 254)
]
phText.draw(at: NSPoint(x: phRect.minX + 6, y: phRect.minY + 3.5), withAttributes: phAttrs)

// Divider line under titlebar
cg.setStrokeColor(cgColor(255, 255, 255, 0.08))
cg.setLineWidth(1.0)
cg.move(to: CGPoint(x: rightTitlebarRect.minX, y: rightTitlebarRect.minY))
cg.addLine(to: CGPoint(x: rightTitlebarRect.maxX, y: rightTitlebarRect.minY))
cg.strokePath()

// App Screenshot inside right card body
if let win1 = cgWin1 {
    let bodyRect = CGRect(
        x: rightCardRect.minX,
        y: rightCardRect.minY + footerH,
        width: cardW,
        height: cardH - titleBarH - footerH
    )
    cg.saveGState()
    cg.clip(to: bodyRect)
    cg.draw(win1, in: bodyRect)
    cg.restoreGState()
}

// Right Card Footer
let rightFooterRect = CGRect(x: rightCardRect.minX, y: rightCardRect.minY, width: cardW, height: footerH)
cg.setFillColor(cgColor(16, 14, 28, 1.0))
cg.fill(rightFooterRect)

cg.setStrokeColor(cgColor(255, 255, 255, 0.08))
cg.setLineWidth(1.0)
cg.move(to: CGPoint(x: rightFooterRect.minX, y: rightFooterRect.maxY))
cg.addLine(to: CGPoint(x: rightFooterRect.maxX, y: rightFooterRect.maxY))
cg.strokePath()

// 3 Feature chips in right footer
let rightChips = ["⚡️ 1-Click Autofill", "🧠 AI Threat Shield", "🎭 Private Aliases"]
for (idx, ch) in rightChips.enumerated() {
    let chX = rightFooterRect.minX + 14 + CGFloat(idx * 168)
    let chRect = CGRect(x: chX, y: rightFooterRect.midY - 9, width: 156, height: 18)
    let chPath = CGPath(roundedRect: chRect, cornerWidth: 5, cornerHeight: 5, transform: nil)
    cg.addPath(chPath)
    cg.setFillColor(cgColor(168, 85, 247, 0.08))
    cg.fillPath()
    cg.addPath(chPath)
    cg.setStrokeColor(cgColor(168, 85, 247, 0.20))
    cg.setLineWidth(0.8)
    cg.strokePath()
    
    let chStr = ch as NSString
    let chAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 9.5, weight: .semibold),
        .foregroundColor: nsColor(216, 180, 254)
    ]
    let s = chStr.size(withAttributes: chAttrs)
    chStr.draw(at: NSPoint(x: chRect.midX - s.width/2, y: chRect.midY - s.height/2 + 1), withAttributes: chAttrs)
}
cg.restoreGState() // restore right card

// MARK: - 4. Bottom Ecosystem Chips & High-Impact URL Callout
let footerTopY: CGFloat = 552

// Ecosystem Badges (Left Column - 4 Pills in 2x2 grid)
let chips = [
    " macOS Native (Universal)",
    "🧩 Chrome Web Store (V3)",
    "⚡️ Raycast Launcher Suite",
    "☁️ iCloud Sync (Multi-Device)"
]

let chipAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 10.5, weight: .semibold),
    .foregroundColor: nsColor(203, 213, 225)
]

for (idx, chip) in chips.enumerated() {
    let col = idx % 2
    let row = idx / 2
    let chipX = 42 + CGFloat(col * 272)
    let chipY = uiY(footerTopY + CGFloat(row * 30), height: 25)
    let cRect = CGRect(x: chipX, y: chipY, width: 260, height: 25)
    
    let cPath = CGPath(roundedRect: cRect, cornerWidth: 6, cornerHeight: 6, transform: nil)
    cg.saveGState()
    cg.addPath(cPath)
    cg.setFillColor(cgColor(255, 255, 255, 0.04))
    cg.fillPath()
    cg.addPath(cPath)
    cg.setStrokeColor(cgColor(255, 255, 255, 0.12))
    cg.setLineWidth(1.0)
    cg.strokePath()
    
    let nsChip = chip as NSString
    nsChip.draw(at: NSPoint(x: cRect.minX + 10, y: cRect.minY + 5.5), withAttributes: chipAttrs)
    cg.restoreGState()
}

// ── Prominent Webpage CTA Button (Right Column) ──
let ctaW: CGFloat = 540
let ctaH: CGFloat = 56
let ctaRect = CGRect(x: baseWidth - ctaW - 42, y: uiY(footerTopY + 2, height: ctaH), width: ctaW, height: ctaH)

cg.saveGState()
// Outer Cyan Glow
cg.setShadow(offset: CGSize(width: 0, height: 0), blur: 26, color: cgColor(56, 189, 248, 0.45))
let ctaPath = CGPath(roundedRect: ctaRect, cornerWidth: 28, cornerHeight: 28, transform: nil)
cg.addPath(ctaPath)

// Gradient Fill
let ctaGradColors = [
    cgColor(14, 165, 233, 0.25),
    cgColor(168, 85, 247, 0.25)
] as CFArray
let ctaGrad = CGGradient(colorsSpace: colorSpace, colors: ctaGradColors, locations: [0.0, 1.0])!
cg.saveGState()
cg.clip()
cg.drawLinearGradient(ctaGrad, start: CGPoint(x: ctaRect.minX, y: ctaRect.midY), end: CGPoint(x: ctaRect.maxX, y: ctaRect.midY), options: [])
cg.restoreGState()

// Gradient Border
cg.addPath(ctaPath)
cg.setStrokeColor(cgColor(56, 189, 248, 0.80))
cg.setLineWidth(1.8)
cg.strokePath()
cg.restoreGState()

// Inside CTA Button
let globeIcon = "🌐" as NSString
globeIcon.draw(at: NSPoint(x: ctaRect.minX + 18, y: ctaRect.midY - 11), withAttributes: [.font: NSFont.systemFont(ofSize: 22)])

let ctaSub = "OFFICIAL WEBPAGE & DOWNLOADS" as NSString
let ctaSubAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 9.5, weight: .bold),
    .foregroundColor: nsColor(56, 189, 248),
    .kern: 1.0
]
ctaSub.draw(at: NSPoint(x: ctaRect.minX + 54, y: ctaRect.midY + 4), withAttributes: ctaSubAttrs)

let ctaUrl = "naetikarvind.github.io/kloak" as NSString
let ctaUrlAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 18, weight: .bold),
    .foregroundColor: NSColor.white,
    .kern: 0.5
]
ctaUrl.draw(at: NSPoint(x: ctaRect.minX + 54, y: ctaRect.midY - 18), withAttributes: ctaUrlAttrs)

let arrow = "→" as NSString
let arrowAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 22, weight: .bold),
    .foregroundColor: nsColor(56, 189, 248)
]
arrow.draw(at: NSPoint(x: ctaRect.maxX - 38, y: ctaRect.midY - 12), withAttributes: arrowAttrs)

// MARK: - 5. Save Outputs (Both 2x Retina & Standard 1200x675)
NSGraphicsContext.restoreGraphicsState()

let png2xData = rep.representation(using: .png, properties: [:])!

let outputWebsite2x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/linkedin-announcement.png"
let outputWebsite1x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/linkedin-announcement-1200x675.png"

let outputArtifact2x = "/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/linkedin-announcement.png"
let outputArtifact1x = "/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/linkedin-announcement-1200x675.png"

try! png2xData.write(to: URL(fileURLWithPath: outputWebsite2x))
try! png2xData.write(to: URL(fileURLWithPath: outputArtifact2x))

// Also copy to docs/ folder so GitHub Pages has it available immediately
let outputDocs2x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/docs/linkedin-announcement.png"
let outputDocs1x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/docs/linkedin-announcement-1200x675.png"
try! png2xData.write(to: URL(fileURLWithPath: outputDocs2x))

// Resize to standard 1200x675 (1x)
let rep1x = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(baseWidth),
    pixelsHigh: Int(baseHeight),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
)!
rep1x.size = NSSize(width: baseWidth, height: baseHeight)

NSGraphicsContext.saveGraphicsState()
let ctx1x = NSGraphicsContext(bitmapImageRep: rep1x)!
NSGraphicsContext.current = ctx1x
rep.draw(in: CGRect(x: 0, y: 0, width: baseWidth, height: baseHeight))
NSGraphicsContext.restoreGraphicsState()

let png1xData = rep1x.representation(using: .png, properties: [:])!
try! png1xData.write(to: URL(fileURLWithPath: outputWebsite1x))
try! png1xData.write(to: URL(fileURLWithPath: outputArtifact1x))
try! png1xData.write(to: URL(fileURLWithPath: outputDocs1x))

print("✅ Saved 2x Retina (2400x1350) and 1x Standard (1200x675) across:")
print("   - Website public folder")
print("   - Docs deployment folder")
print("   - Brain artifact folder")
print("🎉 Success!")
