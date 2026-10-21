#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$REPO_ROOT/dist"
ASSETS_DIR="$REPO_ROOT/assets"
APP_NAME="Kloak"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
DMG_NAME="Kloak-macOS"
DMG_VOLUME="Kloak"
PLIST="$REPO_ROOT/packages/macos-app/Info.plist"

VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$PLIST" 2>/dev/null || echo "1.1.0")

DMG_PATH="$DIST_DIR/${DMG_NAME}-v${VERSION}.dmg"
DMG_LATEST="$DIST_DIR/${DMG_NAME}.dmg"
STAGING_DIR="$DIST_DIR/.dmg-staging-$$"

echo "======================================"
echo "  Kloak DMG Package Builder v${VERSION}"
echo "======================================"
echo ""

# 1. Ensure latest Kloak.app exists
if [ ! -d "$APP_BUNDLE" ]; then
    echo "→ Kloak.app not found in dist/. Building now..."
    "$REPO_ROOT/build-app.sh"
fi

# 2. Generate custom Retina DMG background if not present or outdated
BACKGROUND_TIFF="$ASSETS_DIR/dmg-background.tiff"
if [ ! -f "$BACKGROUND_TIFF" ]; then
    echo "→ Generating custom Retina DMG background..."
    mkdir -p "$ASSETS_DIR"
    swift "$REPO_ROOT/scripts/generate-dmg-background.swift"
    tiffutil -cathidpicheck \
        "$ASSETS_DIR/dmg-background.png" \
        "$ASSETS_DIR/dmg-background@2x.png" \
        -out "$BACKGROUND_TIFF"
fi

# 3. Clean old DMG artifacts
rm -f "$DMG_PATH" "$DMG_LATEST"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Copy app into staging
echo "→ Staging Kloak.app..."
cp -R "$APP_BUNDLE" "$STAGING_DIR/"

# 4. Check for create-dmg tool
CREATE_DMG=$(which create-dmg || echo "/opt/homebrew/bin/create-dmg")

if [ -x "$CREATE_DMG" ]; then
    echo "→ Building custom-designed DMG with background and icon positioning..."
    "$CREATE_DMG" \
        --volname "$DMG_VOLUME" \
        --volicon "$REPO_ROOT/packages/macos-app/AppIcon.icns" \
        --background "$BACKGROUND_TIFF" \
        --window-pos 200 120 \
        --window-size 660 400 \
        --icon-size 110 \
        --text-size 13 \
        --icon "Kloak.app" 180 195 \
        --app-drop-link 480 195 \
        --hide-extension "Kloak.app" \
        --no-internet-enable \
        --format UDZO \
        --overwrite \
        "$DMG_PATH" \
        "$STAGING_DIR"
else
    echo "⚠️  create-dmg not found — falling back to standard hdiutil package..."
    ln -s /Applications "$STAGING_DIR/Applications"
    hdiutil create -volname "$DMG_VOLUME" \
                   -srcfolder "$STAGING_DIR" \
                   -ov \
                   -format UDZO \
                   -imagekey zlib-level=9 \
                   "$DMG_PATH"
fi

# Clean staging area
rm -rf "$STAGING_DIR"

# Mirror as latest
cp "$DMG_PATH" "$DMG_LATEST"

# Compute sha256 checksum and size
CHECKSUM=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')
FILE_SIZE=$(du -sh "$DMG_PATH" | awk '{print $1}')

echo ""
echo "======================================"
echo "  ✅ Custom DMG Created Successfully!"
echo "     File:       $DMG_PATH"
echo "     Latest:     $DMG_LATEST"
echo "     Size:       $FILE_SIZE"
echo "     Background: Custom Dark Glass Retina"
echo "     SHA256:     $CHECKSUM"
echo "======================================"
echo ""
