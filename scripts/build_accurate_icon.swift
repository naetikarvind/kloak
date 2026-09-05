import Foundation
import AppKit

let masterSvg = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Background Squircle Gradient -->
    <linearGradient id="bgGrad" x1="50%" y1="0%" x2="50%" y2="85%">
      <stop offset="0%" stop-color="#5936FF"/>
      <stop offset="100%" stop-color="#8C19D8"/>
    </linearGradient>

    <!-- Shield Left Gradient -->
    <linearGradient id="shieldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5B21B6"/>
      <stop offset="100%" stop-color="#312E81"/>
    </linearGradient>

    <!-- Shield Right Gradient -->
    <linearGradient id="shieldRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2E1065"/>
      <stop offset="100%" stop-color="#1E1B4B"/>
    </linearGradient>

    <!-- Lock Shackle Gradient -->
    <linearGradient id="shackleGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>

    <!-- Soft Base Shadow -->
    <filter id="tileShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.4"/>
    </filter>

    <!-- Element Depth Shadow -->
    <filter id="elemShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35"/>
    </filter>

    <clipPath id="squircleClip">
      <rect x="100" y="100" width="824" height="824" rx="185"/>
    </clipPath>
  </defs>

  <!-- Background Base Squircle with Shadow -->
  <g filter="url(#tileShadow)">
    <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bgGrad)"/>
  </g>

  <!-- Clipped Artwork Layer -->
  <g clip-path="url(#squircleClip)">
    <!-- Inner Rim Highlight -->
    <rect x="100" y="100" width="824" height="824" rx="185" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="4"/>

    <!-- Lock Shackle (Layer 1) -->
    <g filter="url(#elemShadow)">
      <path d="M 360 400 L 360 280 A 152 152 0 0 1 664 280 L 664 400" 
            fill="none" stroke="url(#shackleGrad)" stroke-width="64" stroke-linecap="round" />
    </g>

    <!-- Shield Body Left & Right (Layer 2) -->
    <g filter="url(#elemShadow)">
      <!-- Left Shield -->
      <path d="M 512 280 L 224 360 L 224 640 C 224 820 512 940 512 940 Z" 
            fill="url(#shieldLeft)"/>
      <!-- Right Shield -->
      <path d="M 512 280 L 800 360 L 800 640 C 800 820 512 940 512 940 Z" 
            fill="url(#shieldRight)"/>
    </g>

    <!-- Shield Border (Layer 3) -->
    <path d="M 512 280 L 800 360 L 800 640 C 800 820 512 940 512 940 C 512 940 224 820 224 640 L 224 360 Z" 
          fill="none" stroke="#7DD3FC" stroke-width="16" stroke-linejoin="round"/>

    <!-- Glowing 'K' Emblem (Layer 4 - Front & Center) -->
    <g filter="url(#elemShadow)">
      <!-- Outer Cyan Glow Halo -->
      <path d="M 377 440 L 437 440 L 437 760 L 377 760 Z M 437 620 L 557 440 L 637 440 L 487 650 L 647 760 L 557 760 L 437 640 Z" 
            fill="none" stroke="#38BDF8" stroke-width="12" stroke-linejoin="round" opacity="0.6"/>
      <!-- Pure Crisp White 'K' -->
      <path d="M 377 440 L 437 440 L 437 760 L 377 760 Z M 437 620 L 557 440 L 637 440 L 487 650 L 647 760 L 557 760 L 437 640 Z" 
            fill="#FFFFFF"/>
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

let fm = FileManager.default
let currentDir = URL(fileURLWithPath: fm.currentDirectoryPath)
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

// Save extension and resources
let extIconsDir = currentDir.appendingPathComponent("packages/browser-extension/icons")
try? fm.createDirectory(at: extIconsDir, withIntermediateDirectories: true)
_ = renderPng(svgString: masterSvg, size: 16, targetUrl: extIconsDir.appendingPathComponent("icon-16.png"))
_ = renderPng(svgString: masterSvg, size: 48, targetUrl: extIconsDir.appendingPathComponent("icon-48.png"))
_ = renderPng(svgString: masterSvg, size: 128, targetUrl: extIconsDir.appendingPathComponent("icon-128.png"))

let resDir = currentDir.appendingPathComponent("packages/macos-app/Sources/KloakApp/Resources")
try? fm.createDirectory(at: resDir, withIntermediateDirectories: true)
try? masterSvg.data(using: .utf8)?.write(to: resDir.appendingPathComponent("KloakIcon.svg"))
_ = renderPng(svgString: masterSvg, size: 512, targetUrl: resDir.appendingPathComponent("AppIcon.png"))
_ = renderPng(svgString: masterSvg, size: 512, targetUrl: currentDir.appendingPathComponent("accurate_icon.png"))

print("Successfully rendered master SVG and all icon targets!")
