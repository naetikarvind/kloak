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

# 3. Generate all standard iconset sizes & Sync Browser Extension
mkdir -p "$REPO_ROOT/packages/browser-extension/icons"
if [ -d "$REPO_ROOT/AppIcon.iconset" ]; then
    BASE_256="$REPO_ROOT/AppIcon.iconset/icon_128x128@2x.png"
    if [ -f "$BASE_256" ]; then
        sips -z 32 32 "$BASE_256" --out "$REPO_ROOT/AppIcon.iconset/icon_32x32.png" >/dev/null 2>&1 || true
        sips -z 64 64 "$BASE_256" --out "$REPO_ROOT/AppIcon.iconset/icon_32x32@2x.png" >/dev/null 2>&1 || true
        sips -z 256 256 "$BASE_256" --out "$REPO_ROOT/AppIcon.iconset/icon_256x256.png" >/dev/null 2>&1 || true
        sips -z 512 512 "$BASE_256" --out "$REPO_ROOT/AppIcon.iconset/icon_256x256@2x.png" >/dev/null 2>&1 || true
        sips -z 512 512 "$BASE_256" --out "$REPO_ROOT/AppIcon.iconset/icon_512x512.png" >/dev/null 2>&1 || true
        sips -z 1024 1024 "$BASE_256" --out "$REPO_ROOT/AppIcon.iconset/icon_512x512@2x.png" >/dev/null 2>&1 || true
    fi

    # Generate tight-cropped, full-bleed icons for Browser Extension toolbar and web store
    MASTER_PNG="$REPO_ROOT/AppIcon.iconset/icon_512x512@2x.png"
    if [ ! -f "$MASTER_PNG" ]; then
        MASTER_PNG="$REPO_ROOT/AppIcon.iconset/icon_512x512.png"
    fi
    
    TMP_CROPPED="/tmp/kloak_ext_icon_tight.png"
    sips -c 890 890 "$MASTER_PNG" --out "$TMP_CROPPED" >/dev/null 2>&1 || cp "$MASTER_PNG" "$TMP_CROPPED"
    
    sips -z 16 16 "$TMP_CROPPED" --out "$REPO_ROOT/packages/browser-extension/icons/icon-16.png" >/dev/null 2>&1 || true
    sips -z 32 32 "$TMP_CROPPED" --out "$REPO_ROOT/packages/browser-extension/icons/icon-32.png" >/dev/null 2>&1 || true
    sips -z 48 48 "$TMP_CROPPED" --out "$REPO_ROOT/packages/browser-extension/icons/icon-48.png" >/dev/null 2>&1 || true
    sips -z 128 128 "$TMP_CROPPED" --out "$REPO_ROOT/packages/browser-extension/icons/icon-128.png" >/dev/null 2>&1 || true
    rm -f "$TMP_CROPPED"
    
    echo "✓ Browser extension PNG icons (16, 32, 48, 128) cropped and synced (maximized toolbar size)"
fi

# 4. Sync Raycast extension icons
mkdir -p "$REPO_ROOT/packages/raycast-extension/assets"
if [ -d "$REPO_ROOT/AppIcon.iconset" ]; then
    SRC_512="$REPO_ROOT/AppIcon.iconset/icon_512x512.png"
    if [ ! -f "$SRC_512" ]; then
        SRC_512="$REPO_ROOT/AppIcon.iconset/icon_256x256@2x.png"
    fi
    cp "$SRC_512" "$REPO_ROOT/packages/raycast-extension/icon.png"
    cp "$SRC_512" "$REPO_ROOT/packages/raycast-extension/assets/icon.png"
    cp "$SRC_512" "$REPO_ROOT/packages/raycast-extension/assets/icon@dark.png"
    
    if [ -e "$REPO_ROOT/AppIcon.icon" ]; then
        rm -rf "$REPO_ROOT/packages/raycast-extension/assets/icon.icon"
        cp -R "$REPO_ROOT/AppIcon.icon" "$REPO_ROOT/packages/raycast-extension/assets/icon.icon"
    fi
    
    # Mirror directly to local raycast dev config if installed
    RAYCAST_DEV_DIR="$HOME/.config/raycast/extensions/kloak"
    if [ -d "$RAYCAST_DEV_DIR" ]; then
        mkdir -p "$RAYCAST_DEV_DIR/assets" 2>/dev/null || true
        cp "$SRC_512" "$RAYCAST_DEV_DIR/icon.png" 2>/dev/null || true
        cp "$SRC_512" "$RAYCAST_DEV_DIR/assets/icon.png" 2>/dev/null || true
        cp "$SRC_512" "$RAYCAST_DEV_DIR/assets/icon@dark.png" 2>/dev/null || true
        [ -e "$REPO_ROOT/AppIcon.icon" ] && cp -R "$REPO_ROOT/AppIcon.icon" "$RAYCAST_DEV_DIR/assets/icon.icon" 2>/dev/null || true
        cp "$REPO_ROOT/packages/raycast-extension/package.json" "$RAYCAST_DEV_DIR/package.json" 2>/dev/null || true
    fi
    echo "✓ Raycast extension icons (512x512, dark mode, icon.icon) synced"
fi

echo ""
echo "🎉 All icon formats built successfully:"
[ -e "$REPO_ROOT/AppIcon.icon" ] && ls -ld "$REPO_ROOT/AppIcon.icon"
[ -f "$REPO_ROOT/AppIcon.icns" ] && ls -lh "$REPO_ROOT/AppIcon.icns"
[ -f "$REPO_ROOT/AppIcon.ico" ] && ls -lh "$REPO_ROOT/AppIcon.ico"
[ -f "$REPO_ROOT/packages/browser-extension/icons/favicon.ico" ] && ls -lh "$REPO_ROOT/packages/browser-extension/icons/favicon.ico"
[ -f "$REPO_ROOT/packages/raycast-extension/icon.png" ] && ls -lh "$REPO_ROOT/packages/raycast-extension/icon.png"
