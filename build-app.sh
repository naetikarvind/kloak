#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
MACOS_APP_DIR="$REPO_ROOT/packages/macos-app"
DIST_DIR="$REPO_ROOT/dist"
APP_NAME="Kloak"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
BINARY_NAME="Kloak"

echo "============================="
echo "  Kloak .app builder"
echo "============================="
echo ""

# ── 1. Build Swift app (release) ──────────────────────────────────────────────
echo "→ Building Swift app (release)..."
cd "$MACOS_APP_DIR"
swift build -c release 2>&1
SWIFT_BINARY="$MACOS_APP_DIR/.build/release/$BINARY_NAME"
echo "✓ Swift build complete: $SWIFT_BINARY"

# ── 2. Create .app bundle structure ───────────────────────────────────────────
echo ""
echo "→ Assembling $APP_NAME.app bundle..."
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# ── 3. Copy binary (renamed to match CFBundleExecutable = "Kloak") ─────────────
cp "$SWIFT_BINARY" "$APP_BUNDLE/Contents/MacOS/Kloak"
chmod +x "$APP_BUNDLE/Contents/MacOS/Kloak"
echo "✓ Binary copied"

# ── 4. Copy Info.plist ────────────────────────────────────────────────────────
cp "$MACOS_APP_DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
echo "✓ Info.plist copied"

# ── 5. Copy app icon ──────────────────────────────────────────────────────────
ICNS="$MACOS_APP_DIR/Sources/KloakApp/Resources/AppIcon.icns"
if [ -f "$ICNS" ]; then
    cp "$ICNS" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
    echo "✓ AppIcon.icns copied"
else
    echo "⚠ AppIcon.icns not found, skipping icon"
fi

# ── 6. Copy Swift resources bundle (if it exists) ─────────────────────────────
RESOURCES_BUNDLE="$MACOS_APP_DIR/.build/release/KloakApp_KloakApp.bundle"
if [ -d "$RESOURCES_BUNDLE" ]; then
    cp -r "$RESOURCES_BUNDLE" "$APP_BUNDLE/Contents/Resources/"
    echo "✓ Resources bundle copied"
fi

# ── 7. PkgInfo ────────────────────────────────────────────────────────────────
printf "APPL????" > "$APP_BUNDLE/Contents/PkgInfo"
echo "✓ PkgInfo written"

# ── 8. Remove quarantine FIRST, then ad-hoc code sign ────────────────────────
echo ""
echo "→ Code signing (ad-hoc)..."
xattr -cr "$APP_BUNDLE" 2>/dev/null || true
codesign --force --deep --sign - "$APP_BUNDLE"
echo "✓ Signed (ad-hoc)"


# ── 10. Verify ────────────────────────────────────────────────────────────────
echo ""
echo "→ Verifying bundle..."
codesign --verify --verbose "$APP_BUNDLE" 2>&1 || true

echo ""
echo "============================="
echo "  ✅ Done! App bundle:"
echo "     $APP_BUNDLE"
echo "============================="
echo ""
echo "To open: open \"$APP_BUNDLE\""
