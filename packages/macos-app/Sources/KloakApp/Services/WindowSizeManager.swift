import SwiftUI
import AppKit

@MainActor
public final class WindowSizeManager {
    public static let shared = WindowSizeManager()

    public enum AppWindowMode {
        case unlock          // 460 x 580 (compact authentication)
        case setup           // 580 x 640 (onboarding wizard)
        case vaultItems      // 1060 x 720 (3-column credential manager)
        case vaultSettings   // 960 x 760 (2-column spacious settings)
        case vaultGenerator  // 880 x 700 (2-column generator)
        case vaultImport     // 920 x 720 (2-column import & export)
    }

    private init() {}

    public func resize(to mode: AppWindowMode, animated: Bool = true) {
        // Find the main app window (skip status bar panels or popovers)
        guard let window = NSApp.keyWindow ?? NSApp.windows.first(where: {
            $0.isVisible && !($0 is NSPanel) && $0.canBecomeMain
        }) ?? NSApp.windows.first else {
            return
        }

        // Do not force resize if user is in fullscreen or zoomed (maximized)
        if window.styleMask.contains(.fullScreen) || window.isZoomed {
            return
        }

        let targetSize: CGSize
        let minSize: CGSize

        switch mode {
        case .unlock:
            targetSize = CGSize(width: 460, height: 580)
            minSize = CGSize(width: 420, height: 520)
        case .setup:
            targetSize = CGSize(width: 580, height: 640)
            minSize = CGSize(width: 500, height: 580)
        case .vaultItems:
            targetSize = CGSize(width: 1060, height: 720)
            minSize = CGSize(width: 860, height: 560)
        case .vaultSettings:
            targetSize = CGSize(width: 960, height: 760)
            minSize = CGSize(width: 780, height: 580)
        case .vaultGenerator:
            targetSize = CGSize(width: 880, height: 700)
            minSize = CGSize(width: 740, height: 560)
        case .vaultImport:
            targetSize = CGSize(width: 920, height: 720)
            minSize = CGSize(width: 760, height: 580)
        }

        window.minSize = minSize

        let currentFrame = window.frame
        let screen = window.screen ?? NSScreen.main ?? NSScreen.screens.first

        if let screen = screen {
            let visible = screen.visibleFrame

            // Center resize around current window midpoint
            let newX = currentFrame.midX - (targetSize.width / 2)
            let newY = currentFrame.midY - (targetSize.height / 2)

            let clampedX = max(visible.minX + 12, min(newX, visible.maxX - targetSize.width - 12))
            let clampedY = max(visible.minY + 12, min(newY, visible.maxY - targetSize.height - 12))
            let newFrame = NSRect(x: clampedX, y: clampedY, width: targetSize.width, height: targetSize.height)

            if abs(currentFrame.width - targetSize.width) > 20 || abs(currentFrame.height - targetSize.height) > 20 {
                window.setFrame(newFrame, display: true, animate: animated)
            }
        }
    }
}
