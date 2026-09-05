import Foundation
import AppKit

let fm = FileManager.default
let currentDir = URL(fileURLWithPath: fm.currentDirectoryPath)
let iconDir = currentDir.appendingPathComponent("AppIcon.icon")
let assetsDir = iconDir.appendingPathComponent("Assets")

func loadSvgLayers() -> String {
    // Read SVGs from AppIcon.icon/Assets if present
    let svg1Url = assetsDir.appendingPathComponent("gemini-svg (1).svg")
    let svg2Url = assetsDir.appendingPathComponent("gemini-svg (2).svg")
    let svg3Url = assetsDir.appendingPathComponent("gemini-svg (3).svg")
    let svg4Url = assetsDir.appendingPathComponent("gemini-svg (4).svg")
    let svgKUrl = assetsDir.appendingPathComponent("gemini-svg.svg")

    guard let svg1Data = try? Data(contentsOf: svg1Url), let svg1 = String(data: svg1Data, encoding: .utf8),
          let svg2Data = try? Data(contentsOf: svg2Url), let svg2 = String(data: svg2Data, encoding: .utf8),
          let svg3Data = try? Data(contentsOf: svg3Url), let svg3 = String(data: svg3Data, encoding: .utf8),
          let svg4Data = try? Data(contentsOf: svg4Url), let svg4 = String(data: svg4Data, encoding: .utf8),
          let svgKData = try? Data(contentsOf: svgKUrl), let svgK = String(data: svgKData, encoding: .utf8) else {
        fatalError("Failed reading AppIcon.icon SVG assets")
    }

    func cleanInner(_ svg: String) -> String {
        var str = svg
        if let start = str.range(of: "<svg[^>]*>", options: .regularExpression) {
            str.removeSubrange(start)
        }
        if let end = str.range(of: "</svg>", options: .backwards) {
            str.removeSubrange(end)
        }
        return str
    }

    let inner1 = cleanInner(svg1)
    let inner2 = cleanInner(svg2)
    let inner3 = cleanInner(svg3)
    let inner4 = cleanInner(svg4)
    let innerK = cleanInner(svgK)

    return """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
      <defs>
        <!-- Background Gradient from icon.json -->
        <linearGradient id="bg-grad" x1="50%" y1="0%" x2="50%" y2="85%">
          <stop offset="0%" stop-color="#5936FF"/>
          <stop offset="100%" stop-color="#8C19D8"/>
        </linearGradient>

        <filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.4"/>
        </filter>

        <filter id="element-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.4"/>
        </filter>

        <clipPath id="squircle-clip">
          <rect x="100" y="100" width="824" height="824" rx="185"/>
        </clipPath>
      </defs>

      <!-- Base Squircle -->
      <g filter="url(#tile-shadow)">
        <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg-grad)"/>
      </g>

      <g clip-path="url(#squircle-clip)">
        <!-- Inner highlight -->
        <rect x="100" y="100" width="824" height="824" rx="185" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4"/>

        <!-- Shackle Layer -->
        <g filter="url(#element-shadow)" transform="translate(-0.64, -50.06)">
          \(inner3)
        </g>

        <!-- Shield Body (Left & Right) -->
        <g filter="url(#element-shadow)" transform="translate(0, -15.88) scale(1.06)" transform-origin="512 512">
          \(inner2)
          \(inner1)
        </g>

        <!-- Shield Outline -->
        <g transform="translate(0, -17.84) scale(1.08)" transform-origin="512 512">
          \(inner4)
        </g>

        <!-- Glowing K Layer -->
        <g filter="url(#element-shadow)">
          \(innerK)
        </g>
      </g>
    </svg>
    """
}

let masterSvg = loadSvgLayers()

func renderPng(svgString: String, size: CGFloat, targetUrl: URL) -> Bool {
    guard let svgData = svgString.data(using: .utf8),
          let image = NSImage(data: svgData) else {
        print("Failed to load NSImage from SVG data")
        return false
    }

    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(size),
        pixelsHigh: Int(size),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )

    guard let bitmapRep = rep else { return false }
    bitmapRep.size = NSSize(width: size, height: size)

    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: bitmapRep)
    NSGraphicsContext.current = context

    image.draw(in: NSRect(x: 0, y: 0, width: size, height: size), from: .zero, operation: .copy, fraction: 1.0)

    NSGraphicsContext.restoreGraphicsState()

    guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
        return false
    }

    do {
        try pngData.write(to: targetUrl)
        return true
    } catch {
        print("Failed writing to \(targetUrl): \(error)")
        return false
    }
}

// 1. Create iconset directory
let iconsetDir = currentDir.appendingPathComponent("AppIcon.iconset")
try? fm.createDirectory(at: iconsetDir, withIntermediateDirectories: true)

let sizes: [(String, CGFloat)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

for (name, size) in sizes {
    let outUrl = iconsetDir.appendingPathComponent(name)
    _ = renderPng(svgString: masterSvg, size: size, targetUrl: outUrl)
}

print("Rendered all iconset sizes from AppIcon.icon layers!")

// 2. Output to browser extension icons
let extIconsDir = currentDir.appendingPathComponent("packages/browser-extension/icons")
try? fm.createDirectory(at: extIconsDir, withIntermediateDirectories: true)
_ = renderPng(svgString: masterSvg, size: 16, targetUrl: extIconsDir.appendingPathComponent("icon-16.png"))
_ = renderPng(svgString: masterSvg, size: 48, targetUrl: extIconsDir.appendingPathComponent("icon-48.png"))
_ = renderPng(svgString: masterSvg, size: 128, targetUrl: extIconsDir.appendingPathComponent("icon-128.png"))

// 3. Output master 512x512 png and svg
let resDir = currentDir.appendingPathComponent("packages/macos-app/Sources/KloakApp/Resources")
try? fm.createDirectory(at: resDir, withIntermediateDirectories: true)
try? masterSvg.data(using: .utf8)?.write(to: resDir.appendingPathComponent("KloakIcon.svg"))
_ = renderPng(svgString: masterSvg, size: 512, targetUrl: resDir.appendingPathComponent("AppIcon.png"))

print("Saved new extension and macOS resources!")
