import Cocoa
import WebKit

struct SceneTarget {
    let htmlFile: String
    let outputName: String
}

let scenes: [SceneTarget] = [
    SceneTarget(htmlFile: "scene-1-autofill.html", outputName: "screenshot-1-autofill.png"),
    SceneTarget(htmlFile: "scene-2-vault.html", outputName: "screenshot-2-vault.png"),
    SceneTarget(htmlFile: "scene-3-generator.html", outputName: "screenshot-3-generator.png"),
    SceneTarget(htmlFile: "scene-4-aliases.html", outputName: "screenshot-4-aliases.png"),
    SceneTarget(htmlFile: "scene-5-sidepanel.html", outputName: "screenshot-5-ai-security.png")
]

class MultiSnapshotApp: NSObject, WKNavigationDelegate {
    let webView: WKWebView
    var currentIndex: Int = 0
    let templatesDir = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/scripts/screenshot-templates"
    let promoDir = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/browser-extension/promo/screenshots"
    let docsDir = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/docs/screenshots"
    let websiteDir = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/screenshots"
    let brainDir = "/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/screenshots"

    override init() {
        let config = WKWebViewConfiguration()
        // 1280 x 800 viewport
        self.webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 1280, height: 800), configuration: config)
        super.init()
        self.webView.navigationDelegate = self
    }

    func start() {
        loadCurrentScene()
    }

    func loadCurrentScene() {
        guard currentIndex < scenes.count else {
            print("🎉 All 5 screenshots rendered and saved successfully!")
            exit(0)
        }

        let target = scenes[currentIndex]
        let filePath = "\(templatesDir)/\(target.htmlFile)"
        print("🌐 [\(currentIndex + 1)/\(scenes.count)] Loading HTML for \(target.outputName)...")
        
        let fileUrl = URL(fileURLWithPath: filePath)
        do {
            let html = try String(contentsOf: fileUrl, encoding: .utf8)
            self.webView.loadHTMLString(html, baseURL: fileUrl)
        } catch {
            print("❌ Error reading \(filePath): \(error)")
            exit(1)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Wait 0.4s to ensure fonts and styles settle
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            self.captureAndSaveCurrent()
        }
    }

    func captureAndSaveCurrent() {
        let target = scenes[currentIndex]
        print("📸 Capturing Retina Snapshot for \(target.outputName)...")

        self.webView.takeSnapshot(with: nil) { image2x, error in
            guard let img2x = image2x,
                  let tiff2x = img2x.tiffRepresentation,
                  let rep2x = NSBitmapImageRep(data: tiff2x) else {
                print("❌ Snapshot error for \(target.outputName):", error as Any)
                exit(1)
            }

            print("   Retina frame captured: \(rep2x.pixelsWide) x \(rep2x.pixelsHigh)")

            // Downsample with highest-quality interpolation to exact 1280 x 800
            let targetSize = NSSize(width: 1280, height: 800)
            let rep1x = NSBitmapImageRep(
                bitmapDataPlanes: nil,
                pixelsWide: 1280,
                pixelsHigh: 800,
                bitsPerSample: 8,
                samplesPerPixel: 4,
                hasAlpha: true,
                isPlanar: false,
                colorSpaceName: .deviceRGB,
                bytesPerRow: 0,
                bitsPerPixel: 0
            )!
            rep1x.size = targetSize

            NSGraphicsContext.saveGraphicsState()
            let ctx = NSGraphicsContext(bitmapImageRep: rep1x)!
            ctx.imageInterpolation = .high
            NSGraphicsContext.current = ctx

            rep2x.draw(in: CGRect(x: 0, y: 0, width: 1280, height: 800), from: .zero, operation: .copy, fraction: 1.0, respectFlipped: false, hints: [.interpolation: NSImageInterpolation.high])
            NSGraphicsContext.restoreGraphicsState()

            guard let pngData = rep1x.representation(using: .png, properties: [:]) else {
                print("❌ Failed to encode PNG for \(target.outputName)")
                exit(1)
            }

            let promoPath = "\(self.promoDir)/\(target.outputName)"
            let docsPath = "\(self.docsDir)/\(target.outputName)"
            let websitePath = "\(self.websiteDir)/\(target.outputName)"
            let brainPath = "\(self.brainDir)/\(target.outputName)"

            do {
                try pngData.write(to: URL(fileURLWithPath: promoPath))
                try pngData.write(to: URL(fileURLWithPath: docsPath))
                try pngData.write(to: URL(fileURLWithPath: websitePath))
                try pngData.write(to: URL(fileURLWithPath: brainPath))
                print("   ✅ Saved: \(target.outputName) (1280x800, \(pngData.count / 1024) KB)")
            } catch {
                print("❌ Error writing output files:", error)
                exit(1)
            }

            // Move to next scene
            self.currentIndex += 1
            self.loadCurrentScene()
        }
    }
}

let app = NSApplication.shared
let multiApp = MultiSnapshotApp()
multiApp.start()
app.run()
