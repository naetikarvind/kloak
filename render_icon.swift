import Foundation
import AppKit

let masterSvg = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg-grad" x1="50%" y1="0%" x2="50%" y2="85%">
      <stop offset="0%" stop-color="#1962d3"/>
      <stop offset="100%" stop-color="#070c48"/>
    </linearGradient>

    <!-- Shield Left Gradient -->
    <linearGradient id="shield-left-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cfd8dc"/>
      <stop offset="100%" stop-color="#546e7a"/>
    </linearGradient>

    <!-- Shield Right Gradient -->
    <linearGradient id="shield-right-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#455a64"/>
      <stop offset="100%" stop-color="#1a2327"/>
    </linearGradient>

    <!-- K Upper Gradient -->
    <linearGradient id="k-upper-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b0bec5"/>
      <stop offset="100%" stop-color="#37474f"/>
    </linearGradient>

    <!-- K Lower Gradient -->
    <linearGradient id="k-lower-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#78909c"/>
      <stop offset="100%" stop-color="#263238"/>
    </linearGradient>

    <!-- Gold Lock Gradient -->
    <linearGradient id="gold-lock-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff8e1"/>
      <stop offset="45%" stop-color="#ffb300"/>
      <stop offset="100%" stop-color="#ff8f00"/>
    </linearGradient>

    <!-- HIG macOS App Icon Drop Shadow for the squircle tile -->
    <filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.4"/>
    </filter>

    <!-- Inner Element Shadow filter -->
    <filter id="element-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.4"/>
    </filter>

    <clipPath id="squircle-clip">
      <rect x="100" y="100" width="824" height="824" rx="185"/>
    </clipPath>
  </defs>

  <!-- HIG Base Squircle with standard macOS drop shadow -->
  <g filter="url(#tile-shadow)">
    <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg-grad)"/>
  </g>

  <!-- Clipped Artwork Layer -->
  <g clip-path="url(#squircle-clip)">
    <!-- Inner subtle border highlight -->
    <rect x="100" y="100" width="824" height="824" rx="185" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="4"/>

    <!-- Scaled Artwork -->
    <g transform="translate(100, 100) scale(1.609375)">
      <!-- Main Shield Group with Shadow -->
      <g filter="url(#element-shadow)" transform="translate(0, 8)">
        <!-- Left Shield -->
        <path d="M 256 64 Q 160 96 80 112 C 80 304 144 416 256 464 Z" fill="url(#shield-left-grad)"/>
        <!-- Right Shield -->
        <path d="M 256 64 Q 352 96 432 112 C 432 304 368 416 256 464 Z" fill="url(#shield-right-grad)"/>
        
        <!-- K Metallic Wings -->
        <path d="M 256 216 L 336 120 L 416 120 L 288 256 Z" fill="url(#k-upper-grad)"/>
        <path d="M 256 280 L 288 240 L 416 376 L 336 376 Z" fill="url(#k-lower-grad)"/>
      </g>

      <!-- Golden Lock in Center -->
      <g filter="url(#element-shadow)">
        <!-- Shackle -->
        <path d="M 216 256 V 208 A 40 40 0 0 1 296 208 V 256" fill="none" stroke="url(#gold-lock-grad)" stroke-width="24" stroke-linecap="round"/>
        <!-- Lock Body -->
        <rect x="176" y="256" width="160" height="128" rx="32" fill="url(#gold-lock-grad)"/>
        <!-- Keyhole Base -->
        <circle cx="256" cy="304" r="16" fill="#1c262b"/>
        <!-- Keyhole Stem -->
        <path d="M 248 312 L 240 352 H 272 L 264 312 Z" fill="#1c262b"/>
      </g>
    </g>
  </g>
</svg>
"""

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
let fm = FileManager.default
let currentDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
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

print("Rendered all iconset sizes!")

// 2. Also output to browser extension icons
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

print("Saved extension and macOS resources!")
