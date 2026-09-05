#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
MACOS_APP_DIR="$REPO_ROOT/packages/macos-app"
DIST_DIR="$REPO_ROOT/dist"
APP_NAME="Kloak"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"

echo "============================="
echo "  Kloak .app builder"
echo "============================="
echo ""

# ── 1. Build Xcode App (Release) ─────────────────────────────────────────────
echo "→ Building with xcodebuild (release)..."
cd "$MACOS_APP_DIR"
xcodebuild -project Kloak.xcodeproj \
           -scheme Kloak \
           -configuration Release \
           -derivedDataPath "$MACOS_APP_DIR/DerivedData" \
           build

BUILT_APP="$MACOS_APP_DIR/DerivedData/Build/Products/Release/$APP_NAME.app"
echo "✓ Xcode build complete: $BUILT_APP"

# ── 2. Copy to dist/ ──────────────────────────────────────────────────────────
echo ""
echo "→ Assembling $APP_NAME.app into dist/..."
mkdir -p "$DIST_DIR"
rm -rf "$APP_BUNDLE"
cp -R "$BUILT_APP" "$APP_BUNDLE"

# Ensure AppIcon.icon is in place and no legacy icns exists
rm -f "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
if [ -e "$MACOS_APP_DIR/AppIcon.icon" ]; then
    rm -rf "$APP_BUNDLE/Contents/Resources/AppIcon.icon"
    cp -R "$MACOS_APP_DIR/AppIcon.icon" "$APP_BUNDLE/Contents/Resources/AppIcon.icon"
    echo "✓ AppIcon.icon bundled directly (Liquid Glass asset)"
fi

# ── 3. Code signing (ad-hoc) ──────────────────────────────────────────────────
echo ""
echo "→ Code signing (ad-hoc)..."
xattr -cr "$APP_BUNDLE" 2>/dev/null || true
codesign --force --deep --sign - "$APP_BUNDLE"
echo "✓ Signed (ad-hoc)"

# ── 4. Verify ─────────────────────────────────────────────────────────────────
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
