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

    private var resizeWorkItem: DispatchWorkItem? = nil

    private init() {}

    public func resize(to mode: AppWindowMode, animated: Bool = true) {
        resizeWorkItem?.cancel()

        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            self.performResize(to: mode, animated: animated)
        }
        resizeWorkItem = work

        if animated {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.012, execute: work)
        } else {
            work.perform()
        }
    }

    private func performResize(to mode: AppWindowMode, animated: Bool) {
        guard let window = NSApp.keyWindow ?? NSApp.windows.first(where: {
            $0.isVisible && !($0 is NSPanel) && $0.canBecomeMain
        }) ?? NSApp.windows.first else {
            return
        }

        // Respect fullscreen / maximized state
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

            // Anchor the top-left corner: keep left edge (origin.x) and top edge stationary
            var newX = currentFrame.origin.x
            let currentTop = currentFrame.origin.y + currentFrame.height
            var newY = currentTop - targetSize.height

            // Clamp so window never overflows the right or left edge of the visible screen
            if newX + targetSize.width > visible.maxX - 12 {
                newX = visible.maxX - targetSize.width - 12
            }
            newX = max(visible.minX + 12, newX)

            // Clamp vertical position within visible screen bounds
            if newY < visible.minY + 12 {
                newY = visible.minY + 12
            }
            if newY + targetSize.height > visible.maxY - 12 {
                newY = visible.maxY - targetSize.height - 12
            }

            let newFrame = NSRect(x: newX, y: newY, width: targetSize.width, height: targetSize.height)

            if abs(currentFrame.width - targetSize.width) > 4 || abs(currentFrame.height - targetSize.height) > 4 {
                if animated {
                    NSAnimationContext.runAnimationGroup { context in
                        context.duration = 0.36
                        context.timingFunction = CAMediaTimingFunction(controlPoints: 0.22, 1.0, 0.36, 1.0)
                        context.allowsImplicitAnimation = true
                        window.animator().setFrame(newFrame, display: true)
                    }
                } else {
                    window.setFrame(newFrame, display: true)
                }
            }
        }
    }
}
