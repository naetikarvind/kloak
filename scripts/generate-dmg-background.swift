import Cocoa

let width: CGFloat = 660
let height: CGFloat = 400

func renderImage(scale: CGFloat) -> NSImage {
    let size = NSSize(width: width, height: height)
    let pixelSize = NSSize(width: width * scale, height: height * scale)
    
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(pixelSize.width),
        pixelsHigh: Int(pixelSize.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    rep.size = size
    
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = context
    let cgContext = context.cgContext
    
    // Flip coordinate system so (0,0) is TOP-LEFT (matching Finder)
    cgContext.translateBy(x: 0, y: height)
    cgContext.scaleBy(x: 1.0, y: -1.0)
    
    // 1. Base Dark Background Gradient (Top to Bottom)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bgColors = [
        NSColor(red: 0.035, green: 0.045, blue: 0.075, alpha: 1.0).cgColor, // #090b13
        NSColor(red: 0.065, green: 0.085, blue: 0.145, alpha: 1.0).cgColor  // #111625
    ] as CFArray
    let bgGradient = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: [0.0, 1.0])!
    cgContext.drawLinearGradient(bgGradient, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: height), options: [])
    
    // 2. Subtle Grid overlay
    cgContext.setStrokeColor(NSColor(white: 1.0, alpha: 0.025).cgColor)
    cgContext.setLineWidth(1.0)
    let gridSize: CGFloat = 32
    for x in stride(from: gridSize, to: width, by: gridSize) {
        cgContext.move(to: CGPoint(x: x, y: 0))
        cgContext.addLine(to: CGPoint(x: x, y: height))
    }
    for y in stride(from: gridSize, to: height, by: gridSize) {
        cgContext.move(to: CGPoint(x: 0, y: y))
        cgContext.addLine(to: CGPoint(x: width, y: y))
    }
    cgContext.strokePath()
    
    // 3. Ambient Radial Glows behind the two icons
    // Left icon position: x: 180, y: 195
    // Right icon position: x: 480, y: 195
    let leftGlowColors = [
        NSColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 0.20).cgColor,
        NSColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 0.0).cgColor
    ] as CFArray
    let leftGlowGrad = CGGradient(colorsSpace: colorSpace, colors: leftGlowColors, locations: [0.0, 1.0])!
    cgContext.drawRadialGradient(leftGlowGrad, startCenter: CGPoint(x: 180, y: 195), startRadius: 0, endCenter: CGPoint(x: 180, y: 195), endRadius: 110, options: [])
    
    let rightGlowColors = [
        NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 0.18).cgColor,
        NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 0.0).cgColor
    ] as CFArray
    let rightGlowGrad = CGGradient(colorsSpace: colorSpace, colors: rightGlowColors, locations: [0.0, 1.0])!
    cgContext.drawRadialGradient(rightGlowGrad, startCenter: CGPoint(x: 480, y: 195), startRadius: 0, endCenter: CGPoint(x: 480, y: 195), endRadius: 110, options: [])
    
    // 4. Subtle pedestals / guides under icons
    let pedestalRectL = CGRect(x: 180 - 64, y: 195 - 64, width: 128, height: 128)
    let pathL = CGPath(roundedRect: pedestalRectL, cornerWidth: 26, cornerHeight: 26, transform: nil)
    cgContext.addPath(pathL)
    cgContext.setFillColor(NSColor(white: 1.0, alpha: 0.03).cgColor)
    cgContext.fillPath()
    cgContext.addPath(pathL)
    cgContext.setStrokeColor(NSColor(white: 1.0, alpha: 0.08).cgColor)
    cgContext.setLineWidth(1.5)
    cgContext.strokePath()

    let pedestalRectR = CGRect(x: 480 - 64, y: 195 - 64, width: 128, height: 128)
    let pathR = CGPath(roundedRect: pedestalRectR, cornerWidth: 26, cornerHeight: 26, transform: nil)
    cgContext.addPath(pathR)
    cgContext.setFillColor(NSColor(white: 1.0, alpha: 0.03).cgColor)
    cgContext.fillPath()
    cgContext.addPath(pathR)
    cgContext.setStrokeColor(NSColor(white: 1.0, alpha: 0.08).cgColor)
    cgContext.setLineWidth(1.5)
    cgContext.strokePath()
    
    // 5. Stylized Directional Arrow & Bridge (between x: 260 and x: 400)
    let arrowStartY: CGFloat = 195
    cgContext.saveGState()
    
    // Glowing line
    cgContext.setStrokeColor(NSColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 0.85).cgColor)
    cgContext.setLineWidth(3.0)
    cgContext.setLineCap(.round)
    cgContext.move(to: CGPoint(x: 268, y: arrowStartY))
    cgContext.addLine(to: CGPoint(x: 392, y: arrowStartY))
    cgContext.strokePath()
    
    // Arrowhead at (392, arrowStartY) pointing right
    cgContext.setFillColor(NSColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 0.95).cgColor)
    let arrowHead = CGMutablePath()
    arrowHead.move(to: CGPoint(x: 396, y: arrowStartY))
    arrowHead.addLine(to: CGPoint(x: 382, y: arrowStartY - 8))
    arrowHead.addLine(to: CGPoint(x: 382, y: arrowStartY + 8))
    arrowHead.closeSubpath()
    cgContext.addPath(arrowHead)
    cgContext.fillPath()
    cgContext.restoreGState()
    
    // 6. Pill Badge above the arrow: "DRAG TO INSTALL"
    let pillWidth: CGFloat = 126
    let pillHeight: CGFloat = 24
    let pillRect = CGRect(x: 330 - pillWidth / 2, y: 154, width: pillWidth, height: pillHeight)
    let pillPath = CGPath(roundedRect: pillRect, cornerWidth: pillHeight / 2, cornerHeight: pillHeight / 2, transform: nil)
    cgContext.addPath(pillPath)
    cgContext.setFillColor(NSColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 0.15).cgColor)
    cgContext.fillPath()
    cgContext.addPath(pillPath)
    cgContext.setStrokeColor(NSColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 0.35).cgColor)
    cgContext.setLineWidth(1.0)
    cgContext.strokePath()
    
    // Text inside pill (flipped back for NSAttributedString drawing)
    cgContext.saveGState()
    cgContext.translateBy(x: 0, y: height)
    cgContext.scaleBy(x: 1.0, y: -1.0)
    
    // Coordinates in unflipped (Cocoa) space: Cocoa Y = height - Flipped Y
    let pillCocoaY = height - (pillRect.origin.y + pillHeight)
    let pillText = "DRAG TO INSTALL"
    let pillFont = NSFont.systemFont(ofSize: 10, weight: .bold)
    let pillAttr: [NSAttributedString.Key: Any] = [
        .font: pillFont,
        .foregroundColor: NSColor(red: 0.58, green: 0.77, blue: 0.99, alpha: 1.0)
    ]
    let pillTextSize = (pillText as NSString).size(withAttributes: pillAttr)
    let pillTextPoint = CGPoint(x: 330 - pillTextSize.width / 2, y: pillCocoaY + (pillHeight - pillTextSize.height) / 2)
    (pillText as NSString).draw(at: pillTextPoint, withAttributes: pillAttr)
    
    // 7. Header Typography
    // Logo if exists
    let logoPath = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/kloak-logo-64.png"
    if let logoImage = NSImage(contentsOfFile: logoPath) {
        let logoSize: CGFloat = 34
        let logoRect = NSRect(x: 330 - logoSize / 2, y: height - 62, width: logoSize, height: logoSize)
        logoImage.draw(in: logoRect)
    }
    
    let titleText = "Kloak Password Manager"
    let titleFont = NSFont.systemFont(ofSize: 17, weight: .bold)
    let titleAttr: [NSAttributedString.Key: Any] = [
        .font: titleFont,
        .foregroundColor: NSColor.white
    ]
    let titleSize = (titleText as NSString).size(withAttributes: titleAttr)
    (titleText as NSString).draw(at: CGPoint(x: 330 - titleSize.width / 2, y: height - 90), withAttributes: titleAttr)
    
    let subtitleText = "Local-First  •  Zero Cloud  •  Apple Secure Enclave"
    let subtitleFont = NSFont.systemFont(ofSize: 11, weight: .medium)
    let subtitleAttr: [NSAttributedString.Key: Any] = [
        .font: subtitleFont,
        .foregroundColor: NSColor(red: 0.58, green: 0.65, blue: 0.76, alpha: 1.0)
    ]
    let subtitleSize = (subtitleText as NSString).size(withAttributes: subtitleAttr)
    (subtitleText as NSString).draw(at: CGPoint(x: 330 - subtitleSize.width / 2, y: height - 108), withAttributes: subtitleAttr)
    
    // 8. Footer Typography
    let footerText = "Drag Kloak to your Applications folder to complete installation."
    let footerFont = NSFont.systemFont(ofSize: 12, weight: .regular)
    let footerAttr: [NSAttributedString.Key: Any] = [
        .font: footerFont,
        .foregroundColor: NSColor(red: 0.40, green: 0.46, blue: 0.56, alpha: 1.0)
    ]
    let footerSize = (footerText as NSString).size(withAttributes: footerAttr)
    (footerText as NSString).draw(at: CGPoint(x: 330 - footerSize.width / 2, y: height - 378), withAttributes: footerAttr)
    
    cgContext.restoreGState()
    
    NSGraphicsContext.restoreGraphicsState()
    
    let img = NSImage(size: size)
    img.addRepresentation(rep)
    return img
}

func savePNG(image: NSImage, path: String) {
    if let tiffData = image.tiffRepresentation,
       let rep = NSBitmapImageRep(data: tiffData),
       let pngData = rep.representation(using: .png, properties: [:]) {
        try? pngData.write(to: URL(fileURLWithPath: path))
        print("✅ Saved: \(path)")
    }
}

let img1x = renderImage(scale: 1.0)
savePNG(image: img1x, path: "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/assets/dmg-background.png")

let img2x = renderImage(scale: 2.0)
savePNG(image: img2x, path: "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/assets/dmg-background@2x.png")
