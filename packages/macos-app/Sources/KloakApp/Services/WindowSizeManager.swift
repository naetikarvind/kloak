import SwiftUI
import AppKit

@MainActor
public final class WindowSizeManager {
    public static let shared = WindowSizeManager()

    public enum AppWindowMode {
        case unlock                  // 460 x 580 (compact authentication)
        case setup                   // 620 x 680 (onboarding wizard)
        case vaultItems              // 1120 x 740 (standard 3-column credential manager)
        case vaultThreePaneExpanded  // 1280 x 760 (3-column with rich center like Password Health + ItemDetail)
        case vaultCombine            // 1240 x 760 (Combine Credentials 2-column studio + sidebar)
        case vaultDuplicates         // 1120 x 750 (Duplicates manager)
        case vaultSettings           // 980 x 760 (2-column settings)
        case vaultGenerator          // 900 x 700 (2-column generator)
        case vaultImport             // 960 x 720 (2-column import & export)
    }

    public weak var mainWindow: NSWindow? = nil
    private var resizeWorkItem: DispatchWorkItem? = nil

    private init() {}

    public func registerWindow(_ window: NSWindow) {
        window.tabbingMode = .disallowed
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
            targetSize = CGSize(width: 1120, height: 740)
            minSize = CGSize(width: 960, height: 580)
        case .vaultThreePaneExpanded:
            targetSize = CGSize(width: 1280, height: 760)
            minSize = CGSize(width: 1120, height: 600)
        case .vaultCombine:
            targetSize = CGSize(width: 1240, height: 760)
            minSize = CGSize(width: 1040, height: 600)
        case .vaultDuplicates:
            targetSize = CGSize(width: 1120, height: 750)
            minSize = CGSize(width: 960, height: 580)
        case .vaultSettings:
            targetSize = CGSize(width: 980, height: 760)
            minSize = CGSize(width: 780, height: 580)
        case .vaultGenerator:
            targetSize = CGSize(width: 900, height: 700)
            minSize = CGSize(width: 740, height: 560)
        case .vaultImport:
            targetSize = CGSize(width: 960, height: 720)
            minSize = CGSize(width: 760, height: 580)
        }

        window.minSize = minSize

        let currentFrame = window.frame
        guard let screen = window.screen ?? NSScreen.main ?? NSScreen.screens.first else { return }
        let visible = screen.visibleFrame

        // Fit within screen visible area safely with margin
        let maxAllowedWidth = max(minSize.width, visible.width - 24)
        let maxAllowedHeight = max(minSize.height, visible.height - 24)

        var finalWidth = min(targetSize.width, maxAllowedWidth)
        var finalHeight = min(targetSize.height, maxAllowedHeight)

        // SMART SIZING RULE:
        // When transitioning between vault modes, do not unexpectedly shrink a window that
        // the user has manually widened beyond the default target.
        // However, if the mode demands more room (e.g. 3-pane expansion), enforce expansion.
        let isVaultContext = (mode != .unlock && mode != .setup)
        if isVaultContext {
            if mode == .vaultThreePaneExpanded {
                finalWidth = max(currentFrame.width, min(1280, maxAllowedWidth))
            } else if currentFrame.width > finalWidth {
                finalWidth = min(currentFrame.width, maxAllowedWidth)
            }
            if currentFrame.height > finalHeight {
                finalHeight = min(currentFrame.height, maxAllowedHeight)
            }
        }

        // Anchor top-left corner: keep left edge (origin.x) and top edge stationary
        var newX = currentFrame.origin.x
        let currentTop = currentFrame.origin.y + currentFrame.height
        var newY = currentTop - finalHeight

        // Clamp so window never overflows the right or left edge of the visible screen
        if newX + finalWidth > visible.maxX - 12 {
            newX = visible.maxX - finalWidth - 12
        }
        newX = max(visible.minX + 12, newX)

        // Clamp vertical position within visible screen bounds
        if newY < visible.minY + 12 {
            newY = visible.minY + 12
        }
        if newY + finalHeight > visible.maxY - 12 {
            newY = visible.maxY - finalHeight - 12
        }

        let newFrame = NSRect(x: newX, y: newY, width: finalWidth, height: finalHeight)

        if abs(currentFrame.width - finalWidth) > 3 || abs(currentFrame.height - finalHeight) > 3 ||
           abs(currentFrame.origin.x - newX) > 3 || abs(currentFrame.origin.y - newY) > 3 {
            window.setFrame(newFrame, display: true, animate: animated)
        }
    }
}
