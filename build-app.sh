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

# ── 2. Copy to dist/ and Bundle Icons ──────────────────────────────────────────
echo ""
echo "→ Assembling $APP_NAME.app into dist/..."
mkdir -p "$DIST_DIR"
rm -rf "$APP_BUNDLE"
cp -R "$BUILT_APP" "$APP_BUNDLE"

# Compile Apple Icon Composer .icon into Liquid Glass AppIcon.icns & Assets.car
if [ -e "$MACOS_APP_DIR/AppIcon.icon" ]; then
    echo "→ Compiling AppIcon.icon (Liquid Glass) via actool..."
    xcrun actool "$MACOS_APP_DIR/AppIcon.icon" \
        --compile "$APP_BUNDLE/Contents/Resources" \
        --platform macosx \
        --minimum-deployment-target 14.0 \
        --app-icon AppIcon \
        --output-partial-info-plist /tmp/kloak_app_icon.plist \
        --output-format xml1

    # Also keep AppIcon.icon directly in Resources
    rm -rf "$APP_BUNDLE/Contents/Resources/AppIcon.icon"
    cp -R "$MACOS_APP_DIR/AppIcon.icon" "$APP_BUNDLE/Contents/Resources/AppIcon.icon"
    
    # Mirror compiled assets back to Built App in DerivedData
    cp "$APP_BUNDLE/Contents/Resources/AppIcon.icns" "$BUILT_APP/Contents/Resources/AppIcon.icns" 2>/dev/null || true
    cp "$APP_BUNDLE/Contents/Resources/Assets.car" "$BUILT_APP/Contents/Resources/Assets.car" 2>/dev/null || true

    echo "✓ AppIcon.icns, Assets.car, and AppIcon.icon packaged into app bundle"
fi

# ── 3. Code signing (ad-hoc) ──────────────────────────────────────────────────
echo ""
echo "→ Code signing (ad-hoc)..."
xattr -cr "$APP_BUNDLE" 2>/dev/null || true
codesign --force --deep --sign - "$APP_BUNDLE"
echo "✓ Signed (ad-hoc)"

# ── 4. Verify & Register with LaunchServices ──────────────────────────────────
echo ""
echo "→ Verifying bundle & refreshing Dock cache..."
codesign --verify --verbose "$APP_BUNDLE" 2>&1 || true

# Register with macOS LaunchServices to immediately update Dock and Finder icons
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_BUNDLE" 2>/dev/null || true
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$BUILT_APP" 2>/dev/null || true
touch "$APP_BUNDLE"

echo ""
echo "============================="
echo "  ✅ Done! App bundle:"
echo "     $APP_BUNDLE"
echo "============================="
echo ""
echo "To open: open \"$APP_BUNDLE\""
