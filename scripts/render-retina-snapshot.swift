import Cocoa
import WebKit

class SnapshotApp: NSObject, WKNavigationDelegate {
    let webView: WKWebView
    
    override init() {
        let config = WKWebViewConfiguration()
        // 1200 x 675 viewport on Retina Macs creates a 2400 x 1350 backing snapshot
        self.webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 1200, height: 675), configuration: config)
        super.init()
        self.webView.navigationDelegate = self
    }
    
    func start() {
        print("🌐 Loading HTML in WebKit...")
        let fileUrl = URL(fileURLWithPath: "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/scripts/linkedin-announcement.html")
        let html = try! String(contentsOf: fileUrl, encoding: .utf8)
        self.webView.loadHTMLString(html, baseURL: nil)
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.captureImages()
        }
    }
    
    func captureImages() {
        print("📸 Capturing 2x Retina Snapshot (2400 x 1350)...")
        self.webView.takeSnapshot(with: nil) { image2x, error in
            guard let img2x = image2x,
                  let tiff2x = img2x.tiffRepresentation,
                  let rep2x = NSBitmapImageRep(data: tiff2x) else {
                print("Failed to capture snapshot:", error as Any)
                exit(1)
            }
            
            let png2x = rep2x.representation(using: .png, properties: [:])!
            
            let pathWebsite2x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/linkedin-announcement.png"
            let pathDocs2x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/docs/linkedin-announcement.png"
            let pathArtifact2x = "/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/linkedin-announcement.png"
            
            try! png2x.write(to: URL(fileURLWithPath: pathWebsite2x))
            try! png2x.write(to: URL(fileURLWithPath: pathDocs2x))
            try! png2x.write(to: URL(fileURLWithPath: pathArtifact2x))
            print("✅ 2x Retina (2400x1350) saved: \(rep2x.pixelsWide) x \(rep2x.pixelsHigh) (\(png2x.count / 1024) KB)")
            
            // Downsample with highest-quality interpolation to 1200 x 675 (1x Standard)
            print("📸 Rendering 1x Standard (1200 x 675)...")
            let targetSize = NSSize(width: 1200, height: 675)
            let rep1x = NSBitmapImageRep(
                bitmapDataPlanes: nil,
                pixelsWide: 1200,
                pixelsHigh: 675,
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
            
            rep2x.draw(in: CGRect(x: 0, y: 0, width: 1200, height: 675), from: .zero, operation: .copy, fraction: 1.0, respectFlipped: false, hints: [.interpolation: NSImageInterpolation.high])
            NSGraphicsContext.restoreGraphicsState()
            
            let png1x = rep1x.representation(using: .png, properties: [:])!
            
            let pathWebsite1x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/linkedin-announcement-1200x675.png"
            let pathDocs1x = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/docs/linkedin-announcement-1200x675.png"
            let pathArtifact1x = "/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/linkedin-announcement-1200x675.png"
            
            try! png1x.write(to: URL(fileURLWithPath: pathWebsite1x))
            try! png1x.write(to: URL(fileURLWithPath: pathDocs1x))
            try! png1x.write(to: URL(fileURLWithPath: pathArtifact1x))
            print("✅ 1x Standard (1200x675) saved: \(rep1x.pixelsWide) x \(rep1x.pixelsHigh) (\(png1x.count / 1024) KB)")
            
            print("🎉 Success! High-quality graphics deployed.")
            exit(0)
        }
    }
}

let app = NSApplication.shared
let snapshotApp = SnapshotApp()
snapshotApp.start()
app.run()
