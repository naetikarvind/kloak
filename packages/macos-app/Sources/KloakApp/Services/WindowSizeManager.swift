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

    public weak var mainWindow: NSWindow? = nil
    private var resizeWorkItem: DispatchWorkItem? = nil

    private init() {}

    public func registerWindow(_ window: NSWindow) {
        self.mainWindow = window
    }

    public var currentWindow: NSWindow? {
        if let win = mainWindow, win.isVisible {
            return win
        }
        if let key = NSApp.keyWindow, key.isVisible && !(key is NSPanel) && key.canBecomeMain {
            return key
        }
        if let main = NSApp.mainWindow, main.isVisible && !(main is NSPanel) && main.canBecomeMain {
            return main
        }
        return NSApp.windows.first(where: {
            $0.isVisible &&
            !($0 is NSPanel) &&
            $0.canBecomeMain &&
            $0.className != "_NSMenuBarExtraWindow" &&
            !$0.className.contains("StatusBar") &&
            !$0.className.contains("MenuBar")
        })
    }

    public func resize(to mode: AppWindowMode, animated: Bool = true) {
        resizeWorkItem?.cancel()

        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            self.performResize(to: mode, animated: animated)
        }
        resizeWorkItem = work

        if animated {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.04, execute: work)
        } else {
            work.perform()
        }
    }

    private func performResize(to mode: AppWindowMode, animated: Bool) {
        guard let window = currentWindow else {
            return
        }

        // Only skip if window is in macOS full screen space (where setFrame cannot be applied)
        if window.styleMask.contains(.fullScreen) {
            return
        }

        let targetSize: CGSize
        let minSize: CGSize

        switch mode {
        case .unlock:
            targetSize = CGSize(width: 460, height: 580)
            minSize = CGSize(width: 420, height: 520)
        case .setup:
            targetSize = CGSize(width: 620, height: 680)
            minSize = CGSize(width: 540, height: 600)
        case .vaultItems:
            targetSize = CGSize(width: 1080, height: 740)
            minSize = CGSize(width: 960, height: 580)
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

            if abs(currentFrame.width - targetSize.width) > 3 || abs(currentFrame.height - targetSize.height) > 3 {
                window.setFrame(newFrame, display: true, animate: animated)
            }
        }
    }
}
