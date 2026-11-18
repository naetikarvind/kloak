#!/usr/bin/env python3
"""
generate_small_promo.py
Generates the HTML template and Swift renderer for the Chrome Web Store small promo tile (440x280)
using the NEW official Kloak Liquid Glass App Icon (kloak-logo.png / AppIcon.icns).
"""

import os
import base64

TEMPLATES_DIR = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/scripts/screenshot-templates"
os.makedirs(TEMPLATES_DIR, exist_ok=True)

# Read the NEW official Kloak App Icon PNG (1024x1024)
logo_png_path = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/kloak-logo.png"
with open(logo_png_path, "rb") as f:
    logo_b64 = base64.b64encode(f.read()).decode('utf-8')

small_promo_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kloak Small Promo Tile 440x280</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      width: 440px;
      height: 280px;
      overflow: hidden;
      background: #0C0B14;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      user-select: none;
    }}

    /* Ambient Lighting */
    .ambient-glow-purple {{
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      width: 340px;
      height: 220px;
      background: radial-gradient(circle, rgba(123, 57, 253, 0.4) 0%, rgba(109, 74, 255, 0) 70%);
      filter: blur(40px);
      pointer-events: none;
      z-index: 1;
    }}

    .ambient-glow-green {{
      position: absolute;
      bottom: -40px;
      right: 12%;
      width: 220px;
      height: 160px;
      background: radial-gradient(circle, rgba(41, 201, 143, 0.22) 0%, rgba(41, 201, 143, 0) 70%);
      filter: blur(40px);
      pointer-events: none;
      z-index: 1;
    }}

    .grid-overlay {{
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 22px 22px;
      pointer-events: none;
      z-index: 1;
    }}

    .tile-container {{
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 100%;
      padding: 0 20px;
    }}

    /* NEW OFFICIAL KLOAK LOGO CONTAINER */
    .logo-box {{
      width: 88px;
      height: 88px;
      filter: drop-shadow(0 12px 28px rgba(109, 74, 255, 0.65));
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .logo-box img {{
      width: 100%;
      height: 100%;
      object-fit: contain;
    }}

    .brand-title {{
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #FFFFFF;
      text-shadow: 0 2px 14px rgba(0,0,0,0.7);
      line-height: 1.15;
    }}

    .brand-sub {{
      font-size: 12px;
      font-weight: 600;
      color: #B5A8FF;
      letter-spacing: 0.3px;
      margin-top: 3px;
      text-shadow: 0 1px 8px rgba(0,0,0,0.5);
    }}

    /* Feature Pills */
    .pills-row {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 14px;
    }}

    .pill {{
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 9px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }}

    .pill.autofill {{
      background: rgba(109, 74, 255, 0.22);
      border: 1px solid rgba(109, 74, 255, 0.45);
      color: #C4B5FD;
    }}

    .pill.touchid {{
      background: rgba(167, 139, 250, 0.2);
      border: 1px solid rgba(167, 139, 250, 0.4);
      color: #DDD6FE;
    }}

    .pill.totp {{
      background: rgba(41, 201, 143, 0.2);
      border: 1px solid rgba(41, 201, 143, 0.4);
      color: #29C98F;
    }}

    .security-footer {{
      margin-top: 14px;
      font-size: 9.5px;
      font-weight: 600;
      color: #7D798B;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 5px;
    }}
  </style>
</head>
<body>
  <div class="ambient-glow-purple"></div>
  <div class="ambient-glow-green"></div>
  <div class="grid-overlay"></div>

  <div class="tile-container">
    <div class="logo-box">
      <img src="data:image/png;base64,{logo_b64}" alt="Kloak App Icon">
    </div>

    <h1 class="brand-title">K L O A K</h1>
    <p class="brand-sub">Local-First Password Manager &amp; 2FA</p>

    <div class="pills-row">
      <div class="pill autofill">
        <span>⚡ 1-Click Autofill</span>
      </div>
      <div class="pill touchid">
        <span>🧬 Touch ID</span>
      </div>
      <div class="pill totp">
        <span>⏱️ 2FA TOTP</span>
      </div>
    </div>

    <div class="security-footer">
      <span>🔒 100% Zero-Knowledge • AES-256-GCM • Offline Vault</span>
    </div>
  </div>
</body>
</html>
"""

html_path = f"{TEMPLATES_DIR}/small-promo-440x280.html"
with open(html_path, "w") as f:
    f.write(small_promo_html)
print(f"✓ Created {html_path} with the NEW official Kloak logo!")
