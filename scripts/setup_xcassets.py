import os
import shutil
import json

base_dir = "packages/macos-app/Assets.xcassets"
appicon_dir = os.path.join(base_dir, "AppIcon.appiconset")
os.makedirs(appicon_dir, exist_ok=True)

# 1. Root Contents.json
with open(os.path.join(base_dir, "Contents.json"), "w") as f:
    json.dump({"info": {"author": "xcode", "version": 1}}, f, indent=2)

# 2. Copy images from AppIcon.iconset
scales = [
    ("icon_16x16.png", "16x16", "1x"),
    ("icon_16x16@2x.png", "16x16", "2x"),
    ("icon_32x32.png", "32x32", "1x"),
    ("icon_32x32@2x.png", "32x32", "2x"),
    ("icon_128x128.png", "128x128", "1x"),
    ("icon_128x128@2x.png", "128x128", "2x"),
    ("icon_256x256.png", "256x256", "1x"),
    ("icon_256x256@2x.png", "256x256", "2x"),
    ("icon_512x512.png", "512x512", "1x"),
    ("icon_512x512@2x.png", "512x512", "2x")
]

images = []
for file_name, size, scale in scales:
    src = os.path.join("AppIcon.iconset", file_name)
    dst = os.path.join(appicon_dir, file_name)
    if os.path.exists(src):
        shutil.copyfile(src, dst)
        images.append({
            "idiom": "mac",
            "scale": scale,
            "size": size,
            "filename": file_name
        })

# Also copy 1024x1024 as master AppIcon.png
if os.path.exists("AppIcon.iconset/icon_512x512@2x.png"):
    shutil.copyfile("AppIcon.iconset/icon_512x512@2x.png", os.path.join(appicon_dir, "AppIcon.png"))
    images.append({
        "idiom": "universal",
        "platform": "macOS",
        "size": "512x512",
        "filename": "AppIcon.png"
    })

with open(os.path.join(appicon_dir, "Contents.json"), "w") as f:
    json.dump({
        "images": images,
        "info": {"author": "xcode", "version": 1}
    }, f, indent=2)

print(f"Created {appicon_dir} with {len(images)} icon representations!")
