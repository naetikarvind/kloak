#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "============================="
echo "  Kloak Icon Format Builder"
echo "============================="

# 1. Handle Apple Icon Composer .icon bundle/file
if [ -e "$REPO_ROOT/AppIcon.icon" ]; then
    echo "→ Detected Apple Icon Composer AppIcon.icon..."
    mkdir -p "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources"
    rm -rf "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/AppIcon.icon"
    cp -R "$REPO_ROOT/AppIcon.icon" "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/AppIcon.icon"
    if [ -f "$REPO_ROOT/scripts/build-icon-composer.mjs" ]; then
        node "$REPO_ROOT/scripts/build-icon-composer.mjs"
    fi
    echo "✓ AppIcon.icon synced to macOS app resources"
fi

# 2. Render iconset PNGs if needed
if [ -x "$REPO_ROOT/scripts/render-icon" ]; then
    echo "→ Rendering master iconset resolutions..."
    "$REPO_ROOT/scripts/render-icon"
elif [ -f "$REPO_ROOT/render_icon.swift" ]; then
    echo "→ Rendering iconset via Swift..."
    swift "$REPO_ROOT/render_icon.swift" 2>/dev/null || true
fi

# 3. Compile Apple ICNS format
if [ -d "$REPO_ROOT/AppIcon.iconset" ]; then
    echo "→ Compiling Apple ICNS format (AppIcon.icns)..."
    iconutil -c icns "$REPO_ROOT/AppIcon.iconset" -o "$REPO_ROOT/AppIcon.icns"
    mkdir -p "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources"
    cp "$REPO_ROOT/AppIcon.icns" "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/AppIcon.icns"
    echo "✓ AppIcon.icns built & synced to macOS app resources"
fi

# 4. Compile Windows/Web ICO format
if [ -f "$REPO_ROOT/scripts/build-ico.mjs" ]; then
    echo "→ Compiling ICO format (AppIcon.ico & favicon.ico)..."
    node "$REPO_ROOT/scripts/build-ico.mjs"
fi

# 5. Verify extension icons
mkdir -p "$REPO_ROOT/packages/browser-extension/icons"
if [ -f "$REPO_ROOT/AppIcon.iconset/icon_16x16.png" ]; then
    cp "$REPO_ROOT/AppIcon.iconset/icon_16x16.png" "$REPO_ROOT/packages/browser-extension/icons/icon-16.png"
    cp "$REPO_ROOT/AppIcon.iconset/icon_32x32@2x.png" "$REPO_ROOT/packages/browser-extension/icons/icon-48.png" 2>/dev/null || true
    cp "$REPO_ROOT/AppIcon.iconset/icon_128x128.png" "$REPO_ROOT/packages/browser-extension/icons/icon-128.png"
    echo "✓ Browser extension PNG icons synced"
fi

echo ""
echo "🎉 All icon formats built successfully:"
[ -e "$REPO_ROOT/AppIcon.icon" ] && ls -ld "$REPO_ROOT/AppIcon.icon"
[ -f "$REPO_ROOT/AppIcon.icns" ] && ls -lh "$REPO_ROOT/AppIcon.icns"
[ -f "$REPO_ROOT/AppIcon.ico" ] && ls -lh "$REPO_ROOT/AppIcon.ico"
[ -f "$REPO_ROOT/packages/browser-extension/icons/favicon.ico" ] && ls -lh "$REPO_ROOT/packages/browser-extension/icons/favicon.ico"
