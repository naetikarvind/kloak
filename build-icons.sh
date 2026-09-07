#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "============================="
echo "  Kloak Icon Format Builder"
echo "============================="

# 1. Compile Apple Icon Composer .icon directly via actool
if [ -e "$REPO_ROOT/AppIcon.icon" ]; then
    echo "→ Compiling Apple Icon Composer AppIcon.icon via actool..."
    mkdir -p "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources"
    mkdir -p "$REPO_ROOT/dist"
    
    # Copy .icon to macOS app resources
    rm -rf "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/AppIcon.icon"
    cp -R "$REPO_ROOT/AppIcon.icon" "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/AppIcon.icon"
    
    # Compile AppIcon.icns and Assets.car with full Liquid Glass effects
    xcrun actool "$REPO_ROOT/AppIcon.icon" \
        --compile "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources" \
        --platform macosx \
        --minimum-deployment-target 14.0 \
        --app-icon AppIcon \
        --output-partial-info-plist /tmp/kloak_icon_partial.plist \
        --output-format xml1
    
    # Mirror compiled AppIcon.icns and Assets.car to repo root and packages/macos-app
    cp "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/AppIcon.icns" "$REPO_ROOT/AppIcon.icns"
    cp "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/AppIcon.icns" "$REPO_ROOT/packages/macos-app/AppIcon.icns" 2>/dev/null || true
    cp "$REPO_ROOT/packages/macos-app/Sources/KloakApp/Resources/Assets.car" "$REPO_ROOT/packages/macos-app/Assets.car" 2>/dev/null || true
    
    echo "✓ AppIcon.icns & Assets.car compiled with Liquid Glass from AppIcon.icon"

    # Extract iconset for web/extension PNG targets
    rm -rf "$REPO_ROOT/AppIcon.iconset"
    iconutil -c iconset "$REPO_ROOT/AppIcon.icns" -o "$REPO_ROOT/AppIcon.iconset"
    echo "✓ AppIcon.iconset extracted from compiled Liquid Glass ICNS"
fi

# 2. Compile Windows/Web ICO format
if [ -f "$REPO_ROOT/scripts/build-ico.mjs" ]; then
    echo "→ Compiling ICO format (AppIcon.ico & favicon.ico)..."
    node "$REPO_ROOT/scripts/build-ico.mjs" 2>/dev/null || true
fi

# 3. Verify extension icons
mkdir -p "$REPO_ROOT/packages/browser-extension/icons"
if [ -d "$REPO_ROOT/AppIcon.iconset" ]; then
    [ -f "$REPO_ROOT/AppIcon.iconset/icon_16x16.png" ] && cp "$REPO_ROOT/AppIcon.iconset/icon_16x16.png" "$REPO_ROOT/packages/browser-extension/icons/icon-16.png"
    [ -f "$REPO_ROOT/AppIcon.iconset/icon_32x32@2x.png" ] && cp "$REPO_ROOT/AppIcon.iconset/icon_32x32@2x.png" "$REPO_ROOT/packages/browser-extension/icons/icon-48.png"
    [ -f "$REPO_ROOT/AppIcon.iconset/icon_128x128.png" ] && cp "$REPO_ROOT/AppIcon.iconset/icon_128x128.png" "$REPO_ROOT/packages/browser-extension/icons/icon-128.png"
    echo "✓ Browser extension PNG icons synced from compiled asset"
fi

echo ""
echo "🎉 All icon formats built successfully:"
[ -e "$REPO_ROOT/AppIcon.icon" ] && ls -ld "$REPO_ROOT/AppIcon.icon"
[ -f "$REPO_ROOT/AppIcon.icns" ] && ls -lh "$REPO_ROOT/AppIcon.icns"
[ -f "$REPO_ROOT/AppIcon.ico" ] && ls -lh "$REPO_ROOT/AppIcon.ico"
[ -f "$REPO_ROOT/packages/browser-extension/icons/favicon.ico" ] && ls -lh "$REPO_ROOT/packages/browser-extension/icons/favicon.ico"
