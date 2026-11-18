import Cocoa
import WebKit

class SmallPromoSnapshotApp: NSObject, WKNavigationDelegate {
    let webView: WKWebView
    let templatePath = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/scripts/screenshot-templates/small-promo-440x280.html"
    let promoPath = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/browser-extension/promo/small-promo-440x280.png"
    let docsPath = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/docs/screenshots/small-promo-440x280.png"
    let websitePath = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/screenshots/small-promo-440x280.png"
    let brainPath = "/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/small-promo-440x280.png"

    override init() {
        let config = WKWebViewConfiguration()
        // 440 x 280 frame -> 880 x 560 backing store on Retina
        self.webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 440, height: 280), configuration: config)
        super.init()
        self.webView.navigationDelegate = self
    }

    func start() {
        print("🌐 Loading small-promo-440x280.html in WebKit...")
        let fileUrl = URL(fileURLWithPath: templatePath)
        do {
            let html = try String(contentsOf: fileUrl, encoding: .utf8)
            self.webView.loadHTMLString(html, baseURL: fileUrl)
        } catch {
            print("❌ Failed to read HTML:", error)
            exit(1)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            self.captureAndSave()
        }
    }

    func captureAndSave() {
        print("📸 Capturing Retina Snapshot for small-promo-440x280...")
        self.webView.takeSnapshot(with: nil) { image2x, error in
            guard let img2x = image2x,
                  let tiff2x = img2x.tiffRepresentation,
                  let rep2x = NSBitmapImageRep(data: tiff2x) else {
                print("❌ Snapshot error:", error as Any)
                exit(1)
            }

            print("   Retina frame captured: \(rep2x.pixelsWide) x \(rep2x.pixelsHigh)")

            // Downsample with highest-quality interpolation to exact 440 x 280
            let targetSize = NSSize(width: 440, height: 280)
            let rep1x = NSBitmapImageRep(
                bitmapDataPlanes: nil,
                pixelsWide: 440,
                pixelsHigh: 280,
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

            rep2x.draw(in: CGRect(x: 0, y: 0, width: 440, height: 280), from: .zero, operation: .copy, fraction: 1.0, respectFlipped: false, hints: [.interpolation: NSImageInterpolation.high])
            NSGraphicsContext.restoreGraphicsState()

            guard let pngData = rep1x.representation(using: .png, properties: [:]) else {
                print("❌ Failed to encode PNG")
                exit(1)
            }

            do {
                try pngData.write(to: URL(fileURLWithPath: self.promoPath))
                try pngData.write(to: URL(fileURLWithPath: self.docsPath))
                try pngData.write(to: URL(fileURLWithPath: self.websitePath))
                try pngData.write(to: URL(fileURLWithPath: self.brainPath))
                print("✅ Successfully saved small promo tile:")
                print("   Dimensions: \(rep1x.pixelsWide) x \(rep1x.pixelsHigh)")
                print("   Size: \(pngData.count / 1024) KB")
                print("   Saved to: \(self.promoPath)")
            } catch {
                print("❌ Error writing output files:", error)
                exit(1)
            }

            exit(0)
        }
    }
}

let app = NSApplication.shared
let promoApp = SmallPromoSnapshotApp()
promoApp.start()
app.run()
