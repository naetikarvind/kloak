#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$REPO_ROOT/dist"
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

# Ensure latest Kloak.app exists
if [ ! -d "$APP_BUNDLE" ]; then
    echo "→ Kloak.app not found in dist/. Building now..."
    "$REPO_ROOT/build-app.sh"
fi

# Clean staging area
echo "→ Preparing staging folder..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Copy app bundle
echo "→ Copying Kloak.app into staging area..."
cp -R "$APP_BUNDLE" "$STAGING_DIR/"

# Create standard Applications symlink for drag-and-drop installation
echo "→ Creating /Applications symlink..."
ln -s /Applications "$STAGING_DIR/Applications"

# Remove old DMGs
rm -f "$DMG_PATH" "$DMG_LATEST"

# Create compressed DMG directly using hdiutil
echo "→ Creating compressed DMG (${DMG_NAME}-v${VERSION}.dmg)..."
hdiutil create -volname "$DMG_VOLUME" \
               -srcfolder "$STAGING_DIR" \
               -ov \
               -format UDZO \
               -imagekey zlib-level=9 \
               "$DMG_PATH"

# Mirror as latest
cp "$DMG_PATH" "$DMG_LATEST"

# Clean staging
rm -rf "$STAGING_DIR"

# Compute sha256 checksum
CHECKSUM=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')
FILE_SIZE=$(du -sh "$DMG_PATH" | awk '{print $1}')

echo ""
echo "======================================"
echo "  ✅ DMG Package Created Successfully!"
echo "     File:     $DMG_PATH"
echo "     Latest:   $DMG_LATEST"
echo "     Size:     $FILE_SIZE"
echo "     SHA256:   $CHECKSUM"
echo "======================================"
echo ""
