#!/usr/bin/env python3
"""
generate_store_html.py
Generates the 5 high-fidelity, realistic HTML scenes for Chrome Web Store screenshots (1280x800).
Matches the authentic look and feel of the Kloak extension:
- Dark theme tokens: #16151D, #191823, #211F2D, #28233C, #6D4AFF, #29C98F, #9E9AA8
- Dual-pane layout, search header, lock, generator key, plus button (clean, no redundant buttons)
- Real squircle brand icons (GitHub, ProtonMail, Spotify, Autodesk, Dribbble, Zoom)
- Authentic detail view with LOW RISK health badges and 2FA Authenticator (glowing 225 271, 11s countdown)
- Inline Bento autofill dropdown on website login
- Cryptographic generator view
- Chrome Side Panel with Secure Notes and text file import
"""

import os

TEMPLATES_DIR = "/Users/naetikarvind/.gemini/antigravity/scratch/kloak/scripts/screenshot-templates"
os.makedirs(TEMPLATES_DIR, exist_ok=True)

# Common SVG definitions
SVG_KLOAK_SHIELD = """<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="url(#kloakGrad)" stroke="#7C5CFF" stroke-width="0.8"/><path d="M12 7c1.66 0 3 1.34 3 3v1h1c.55 0 1 .45 1 1v5c0 .55-.45 1-1 1H8c-.55 0-1-.45-1-1v-5c0-.55.45-1 1-1h1v-1c0-1.66 1.34-3 3-3zm0 2c-.55 0-1 .45-1 1v1h2v-1c0-.55-.45-1-1-1z" fill="#FFFFFF"/><defs><linearGradient id="kloakGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#6D4AFF"/><stop offset="1" stop-color="#341266"/></linearGradient></defs></svg>"""

SVG_GITHUB = """<svg viewBox="0 0 24 24" width="18" height="18" fill="#FFFFFF"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>"""

SVG_PROTON = """<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#6D4AFF"/><path d="M7 6h5.2a4 4 0 0 1 4 4 4 4 0 0 1-4 4H9.5v4H7V6zm2.5 5.5h2.7a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5H9.5v3z" fill="#FFFFFF"/></svg>"""

SVG_SPOTIFY = """<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#121212"/><circle cx="12" cy="12" r="8" fill="#1DB954"/><path d="M7.5 10.2c3.2-.8 6.5-.4 9.2 1.1-.3.4-.6.9-1 .8-2.3-1.3-5.2-1.6-8-.9-.3.1-.6-.2-.7-.5-.1-.3.2-.5.5-.5zm.5 2.6c2.6-.7 5.5-.3 7.7.9-.3.4-.5.8-.8.7-1.9-1.1-4.4-1.3-6.6-.7-.3.1-.5-.1-.6-.4-.1-.3.1-.5.3-.5zm.6 2.6c2.2-.5 4.5-.2 6.3.7-.3.3-.4.7-.7.6-1.6-.8-3.6-.9-5.3-.5-.3.1-.5-.1-.5-.3 0-.3.1-.5.2-.5z" fill="#121212"/></svg>"""

SVG_GOOGLE = """<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>"""

SVG_AUTODESK = """<svg viewBox="0 0 24 24" width="18" height="18" fill="#FFFFFF"><rect width="24" height="24" rx="6" fill="#0696D7"/><path d="M6 18l5-12h2l5 12h-2.2l-1.2-3H9.4l-1.2 3H6zm4.1-5h3.8L12 8.2 10.1 13z"/></svg>"""

SVG_DRIBBBLE = """<svg viewBox="0 0 24 24" width="18" height="18" fill="#FFFFFF"><rect width="24" height="24" rx="6" fill="#EA4C89"/><circle cx="12" cy="12" r="7" stroke="#FFFFFF" stroke-width="1.5" fill="none"/><path d="M5.5 10.5c3.5 0 6.5-1.5 8-4M6.5 17c4-2 7-1 10.5-.5M12 5c2 4 3 8 3 13.5" stroke="#FFFFFF" stroke-width="1.5" fill="none"/></svg>"""

SVG_ZOOM = """<svg viewBox="0 0 24 24" width="18" height="18" fill="#FFFFFF"><rect width="24" height="24" rx="6" fill="#2D8CFF"/><path d="M6 9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9zm11 1.5l3-2v7l-3-2v-3z"/></svg>"""

COMMON_STYLE = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

:root {
  --bg-base: #16151D;
  --bg-sidebar: #191823;
  --bg-active: #28233C;
  --bg-card: #211F2D;
  --bg-card-hover: #292738;
  --bg-input: #111017;
  --bg-btn: #272535;
  --bg-btn-hover: #333045;
  --bg-url: #241D3B;
  
  --border: #2C293D;
  --border-card: #2F2C3F;
  
  --accent: #6D4AFF;
  --accent-hover: #7E5EFF;
  --accent-muted: rgba(109, 74, 255, 0.16);
  
  --color-login: #6D4AFF;
  --color-alias: #00D2B4;
  --color-card: #FF884D;
  --color-note: #4D96FF;
  
  --text-main: #FFFFFF;
  --text-muted: #9E9AA8;
  --text-subtle: #736F80;
  --text-url: #B098FF;
  
  --success: #29C98F;
  --warning: #FFB800;
  --danger: #F54A4A;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 1280px;
  height: 800px;
  overflow: hidden;
  background: #0C0B12;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--text-main);
  position: relative;
  display: flex;
  flex-direction: column;
  user-select: none;
}

/* Background Ambient Lighting */
.ambient-glow-purple {
  position: absolute;
  top: -120px;
  left: 20%;
  width: 650px;
  height: 500px;
  background: radial-gradient(circle, rgba(109, 74, 255, 0.18) 0%, rgba(109, 74, 255, 0) 70%);
  filter: blur(60px);
  pointer-events: none;
  z-index: 0;
}

.ambient-glow-green {
  position: absolute;
  bottom: -100px;
  right: 15%;
  width: 550px;
  height: 450px;
  background: radial-gradient(circle, rgba(41, 201, 143, 0.14) 0%, rgba(41, 201, 143, 0) 70%);
  filter: blur(70px);
  pointer-events: none;
  z-index: 0;
}

.studio-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
  z-index: 0;
}

/* Header Banner (1280x800 layout) */
.hero-header {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 30px 40px 14px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(109, 74, 255, 0.18);
  border: 1px solid rgba(109, 74, 255, 0.4);
  color: #B8A5FF;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.hero-badge.emerald {
  background: rgba(41, 201, 143, 0.16);
  border-color: rgba(41, 201, 143, 0.38);
  color: #29C98F;
}

.hero-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: #FFFFFF;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-muted);
  max-width: 780px;
  line-height: 1.45;
}

/* Center Stage Container */
.stage-container {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40px 28px 40px;
}
"""

print("🎨 Creating HTML templates for all 5 store screenshots...")

# -------------------------------------------------------------
# SCENE 1: 1-Click Smart Autofill & In-Browser Touch ID
# -------------------------------------------------------------
scene_1_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screenshot 1: 1-Click Autofill & Touch ID</title>
  <style>
    {COMMON_STYLE}
    
    /* Mock Browser Window */
    .browser-window {{
      width: 980px;
      height: 560px;
      background: #0D1117;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(109, 74, 255, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }}
    
    .browser-titlebar {{
      height: 40px;
      background: #161B22;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      padding: 0 14px;
      gap: 14px;
    }}
    
    .window-dots {{
      display: flex;
      gap: 7px;
    }}
    .dot {{ width: 11px; height: 11px; border-radius: 50%; }}
    .dot-red {{ background: #FF5F56; }}
    .dot-yellow {{ background: #FFBD2E; }}
    .dot-green {{ background: #27C93F; }}
    
    .address-bar {{
      flex: 1;
      max-width: 520px;
      height: 26px;
      background: #090D13;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      display: flex;
      align-items: center;
      padding: 0 10px;
      gap: 7px;
      font-size: 11.5px;
      color: #7D8590;
      margin: 0 auto;
    }}
    .address-bar .lock-icon {{ width: 12px; height: 12px; fill: #29C98F; }}
    .address-bar .url-domain {{ color: #FFFFFF; font-weight: 500; }}
    .address-bar .url-path {{ color: #7D8590; }}
    .verified-pill {{
      margin-left: auto;
      font-size: 9px;
      font-weight: 700;
      color: #29C98F;
      background: rgba(41, 201, 143, 0.15);
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid rgba(41, 201, 143, 0.3);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }}
    
    .browser-extensions {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .ext-icon {{
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(109, 74, 255, 0.2);
      border: 1px solid rgba(109, 74, 255, 0.4);
    }}
    
    /* GitHub Login Form in Browser Page */
    .page-body {{
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
    }}
    
    .gh-logo {{
      width: 44px;
      height: 44px;
      margin-bottom: 12px;
      fill: #FFFFFF;
    }}
    
    .gh-heading {{
      font-size: 21px;
      font-weight: 400;
      letter-spacing: -0.3px;
      margin-bottom: 16px;
      color: #FFFFFF;
    }}
    
    .gh-card {{
      width: 320px;
      background: #161B22;
      border: 1px solid #30363D;
      border-radius: 6px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
    }}
    
    .gh-field-group {{
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }}
    
    .gh-label {{
      font-size: 13px;
      color: #E6EDF3;
      font-weight: 500;
      display: flex;
      justify-content: space-between;
    }}
    
    .gh-input-wrap {{
      position: relative;
      display: flex;
      align-items: center;
    }}
    
    .gh-input {{
      width: 100%;
      height: 34px;
      background: #0D1117;
      border: 1.5px solid #6D4AFF;
      box-shadow: 0 0 0 3px rgba(109, 74, 255, 0.35);
      border-radius: 6px;
      color: #FFFFFF;
      font-size: 13px;
      padding: 0 36px 0 10px;
      outline: none;
    }}
    
    .kloak-field-badge {{
      position: absolute;
      right: 8px;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background: #191823;
      border: 1px solid #6D4AFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px rgba(109, 74, 255, 0.5);
    }}
    
    .gh-btn-submit {{
      height: 32px;
      background: #238636;
      border: 1px solid rgba(240, 246, 252, 0.1);
      border-radius: 6px;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
    }}

    /* ── AUTHENTIC KLOAK BENTO POPUP OVERLAY ── */
    .kloak-popup {{
      position: absolute;
      top: 60px;
      left: 0;
      width: 324px;
      background: rgba(18, 16, 28, 0.98);
      border: 1px solid rgba(124, 92, 255, 0.45);
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.85), 0 0 24px rgba(109, 74, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.1);
      color: #FFFFFF;
      z-index: 100;
      font-size: 11.5px;
      backdrop-filter: blur(28px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }}
    
    .kloak-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 11px;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }}
    .kloak-brand {{
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      color: #B5A8FF;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }}
    .kloak-close-btn {{
      color: #8C8899;
      font-size: 12px;
      cursor: pointer;
    }}
    
    .kloak-context-bar {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 11px;
      font-size: 10px;
      background: rgba(109, 74, 255, 0.09);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      color: #B5A8FF;
    }}
    .kloak-context-tag {{
      font-size: 8.5px;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 700;
      text-transform: uppercase;
      background: rgba(41, 201, 143, 0.2);
      color: #29C98F;
      border: 1px solid rgba(41, 201, 143, 0.4);
    }}
    
    .kloak-body {{
      padding: 9px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}
    
    .kloak-bento-card {{
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(109, 74, 255, 0.35);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }}
    
    .kloak-bento-card-top {{
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .kloak-id-group {{
      display: flex;
      align-items: center;
      gap: 7px;
    }}
    .kloak-avatar {{
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: #111;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .kloak-bento-title {{
      font-size: 12px;
      font-weight: 700;
      color: #FFFFFF;
    }}
    .kloak-fill-all-btn {{
      background: linear-gradient(135deg, #6D4AFF 0%, #7E5EFF 100%);
      color: #FFFFFF;
      border: none;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(109, 74, 255, 0.45);
    }}
    
    .kloak-bento-inputs {{
      display: flex;
      flex-direction: column;
      gap: 5px;
    }}
    .kloak-bento-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 5px;
      padding: 4px 8px;
      font-size: 11px;
      color: #E2E8F0;
    }}
    .kloak-bento-row .copy-icon {{
      color: #8C8899;
      font-size: 11px;
    }}
    
    .totp-pill-live {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(41, 201, 143, 0.15);
      border: 1px solid rgba(41, 201, 143, 0.3);
      padding: 2px 7px;
      border-radius: 5px;
      color: #29C98F;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }}

    .touch-id-banner {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      background: rgba(109, 74, 255, 0.15);
      border: 1px solid rgba(109, 74, 255, 0.35);
      border-radius: 7px;
      padding: 7px 10px;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }}
    .touch-id-banner:hover {{
      background: rgba(109, 74, 255, 0.28);
    }}
    .touch-id-banner svg {{
      width: 15px;
      height: 15px;
      fill: none;
      stroke: #A78BFA;
      stroke-width: 2.2;
    }}

    .kloak-footer {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 11px;
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 9.5px;
      color: #8C8899;
    }}
    .kloak-status-pill {{
      display: flex;
      align-items: center;
      gap: 4px;
      color: #29C98F;
    }}
    .status-dot {{
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #29C98F;
      box-shadow: 0 0 6px #29C98F;
    }}
  </style>
</head>
<body>
  <div class="ambient-glow-purple"></div>
  <div class="ambient-glow-green"></div>
  <div class="studio-grid"></div>

  <!-- Header Section -->
  <header class="hero-header">
    <div class="hero-badge">
      <span>⚡ 1-Click Secure Autofill & Touch ID</span>
    </div>
    <h1 class="hero-title">Instant In-Page Credential Autofill</h1>
    <p class="hero-subtitle">Context-aware credential detection with verified domain defense and direct macOS Touch ID biometric unlock.</p>
  </header>

  <!-- Center Mockup Stage -->
  <div class="stage-container">
    <div class="browser-window">
      <!-- Titlebar -->
      <div class="browser-titlebar">
        <div class="window-dots">
          <div class="dot dot-red"></div>
          <div class="dot dot-yellow"></div>
          <div class="dot dot-green"></div>
        </div>
        <div class="address-bar">
          <svg class="lock-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <span class="url-domain">https://github.com</span><span class="url-path">/login</span>
          <span class="verified-pill">🛡️ Verified Domain</span>
        </div>
        <div class="browser-extensions">
          <div class="ext-icon">
            {SVG_KLOAK_SHIELD}
          </div>
        </div>
      </div>

      <!-- Page Content -->
      <div class="page-body">
        <svg class="gh-logo" viewBox="0 0 24 24"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        <h2 class="gh-heading">Sign in to GitHub</h2>

        <div class="gh-card">
          <div class="gh-field-group">
            <label class="gh-label">Username or email address</label>
            <div class="gh-input-wrap">
              <input type="text" class="gh-input" value="naetik.arvnd@gmail.com" readonly>
              <div class="kloak-field-badge">
                {SVG_KLOAK_SHIELD}
              </div>

              <!-- Kloak Bento Popup Overlay -->
              <div class="kloak-popup">
                <div class="kloak-header">
                  <div class="kloak-brand">
                    {SVG_KLOAK_SHIELD}
                    <span>KLOAK AUTOFILL</span>
                  </div>
                  <span class="kloak-close-btn">✕</span>
                </div>

                <div class="kloak-context-bar">
                  <span>github.com</span>
                  <span class="kloak-context-tag">✓ Verified Domain</span>
                </div>

                <div class="kloak-body">
                  <!-- Bento Account Card -->
                  <div class="kloak-bento-card">
                    <div class="kloak-bento-card-top">
                      <div class="kloak-id-group">
                        <div class="kloak-avatar">
                          {SVG_GITHUB}
                        </div>
                        <span class="kloak-bento-title">GitHub</span>
                      </div>
                      <button class="kloak-fill-all-btn">
                        <span>⚡ Fill All</span>
                      </button>
                    </div>

                    <div class="kloak-bento-inputs">
                      <div class="kloak-bento-row">
                        <span>naetik.arvnd@gmail.com</span>
                        <span class="copy-icon">📋</span>
                      </div>
                      <div class="kloak-bento-row">
                        <span>••••••••••••••••</span>
                        <span class="copy-icon">📋</span>
                      </div>
                    </div>
                  </div>

                  <!-- 2FA Live Token Badge -->
                  <div class="kloak-bento-row" style="background: rgba(41,201,143,0.1); border-color: rgba(41,201,143,0.3);">
                    <span style="font-size: 10px; color: #29C98F; font-weight: 600;">2FA TOTP TOKEN</span>
                    <span class="totp-pill-live">
                      <span>⏱️ 11s</span>
                      <span>225 271</span>
                    </span>
                  </div>

                  <!-- Touch ID Biometric Button -->
                  <div class="touch-id-banner">
                    <svg viewBox="0 0 24 24"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>
                    <span>Unlock Vault with Touch ID</span>
                  </div>
                </div>

                <div class="kloak-footer">
                  <span class="kloak-status-pill"><span class="status-dot"></span> Local Daemon Synced</span>
                  <span>AES-256-GCM</span>
                </div>
              </div>
            </div>
          </div>

          <div class="gh-field-group">
            <label class="gh-label">
              <span>Password</span>
              <a href="#" style="font-size: 11px; color: #2F81F7; text-decoration: none;">Forgot password?</a>
            </label>
            <input type="password" class="gh-input" value="kloak-strong-vault-pwd" style="border-color: #30363D; box-shadow: none;" readonly>
          </div>

          <button class="gh-btn-submit" type="button">Sign in</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""

with open(f"{TEMPLATES_DIR}/scene-1-autofill.html", "w") as f:
    f.write(scene_1_html)
print("  ✓ scene-1-autofill.html written")


# -------------------------------------------------------------
# SCENE 2: Dual-Pane Vault & Instant Search (Matching Image 4 & Image 2)
# -------------------------------------------------------------
scene_2_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screenshot 2: Dual-Pane Vault Management</title>
  <style>
    {COMMON_STYLE}

    /* Popup Frame */
    .popup-shell {{
      width: 760px;
      height: 530px;
      background: var(--bg-base);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 32px 90px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(109, 74, 255, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }}

    /* ── HEADER ── */
    .header {{
      display: flex;
      align-items: center;
      height: 52px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border);
      gap: 12px;
      background: var(--bg-base);
      flex-shrink: 0;
    }}

    .search-wrapper {{
      flex: 1;
      height: 36px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 10px;
    }}
    .search-wrapper svg {{ width: 16px; height: 16px; fill: var(--text-muted); }}
    .search-input {{
      flex: 1; background: transparent; border: none; outline: none;
      color: var(--text-main); font-size: 13.5px; font-family: inherit;
    }}
    .search-input::placeholder {{ color: var(--text-muted); }}

    .header-right {{ display: flex; align-items: center; gap: 9px; }}
    .btn-icon {{
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--bg-btn);
      border: none;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }}
    .btn-icon.purple {{
      background: var(--accent);
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(109, 74, 255, 0.4);
    }}
    .btn-icon svg {{ width: 17px; height: 17px; fill: currentColor; }}

    /* ── MAIN SPLIT ── */
    .main-view {{ display: flex; flex: 1; min-height: 0; overflow: hidden; }}

    /* ── SIDEBAR ── */
    .sidebar {{
      width: 270px;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      background: var(--bg-sidebar);
      overflow: hidden;
      flex-shrink: 0;
    }}

    /* SUGGESTED FOR THIS SITE */
    .suggested-container {{
      margin: 10px 12px 6px 12px;
      padding: 9px;
      background: #1C1A27;
      border: 1px solid #2C293D;
      border-radius: 9px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }}
    .suggested-header {{
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      color: #9E9AA8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .suggested-header svg {{ width: 12px; height: 12px; fill: #6D4AFF; }}
    .suggested-row {{
      display: flex;
      align-items: center;
      background: #252234;
      border: 1px solid rgba(255,255,255,0.04);
      border-radius: 7px;
      padding: 6px 8px;
      gap: 8px;
    }}
    .suggested-avatar {{
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111;
    }}
    .suggested-info {{ flex: 1; overflow: hidden; }}
    .suggested-title {{ font-size: 12px; font-weight: 600; color: #FFF; }}
    .suggested-sub {{ font-size: 10px; color: var(--text-muted); }}
    .btn-copy-pass {{
      background: #2B82FE;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 4px 9px;
      font-size: 10.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }}

    /* FILTER TABS */
    .sidebar-filters {{
      display: flex;
      padding: 7px 10px;
      gap: 4px;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }}
    .filter-btn {{
      display: flex; align-items: center; gap: 4px;
      height: 27px; padding: 0 8px; border-radius: 6px;
      background: transparent; border: 1px solid transparent;
      color: var(--text-muted); font-size: 11px; font-weight: 500;
    }}
    .filter-btn.active {{
      background: rgba(109,74,255,0.18); color: var(--text-main);
      border-color: rgba(109,74,255,0.4);
      font-weight: 600;
    }}
    .filter-btn svg {{ width: 13px; height: 13px; fill: currentColor; }}
    .sort-icon-btn {{
      margin-left: auto;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }}

    /* ITEMS LIST */
    .item-list {{
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }}
    .list-group-header {{
      padding: 8px 14px 4px 14px;
      font-size: 10.5px;
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .list-item {{
      display: flex;
      align-items: center;
      padding: 8px 14px;
      gap: 10px;
      border-left: 3px solid transparent;
    }}
    .list-item.active {{
      background: var(--bg-active);
      border-left-color: var(--accent);
    }}
    .item-avatar {{
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }}
    .item-info {{ flex: 1; min-width: 0; }}
    .item-title {{ font-size: 13px; font-weight: 600; color: #FFF; }}
    .item-sub {{ font-size: 11px; color: var(--text-muted); }}
    .status-ring {{
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #29C98F;
      flex-shrink: 0;
    }}
    .status-ring.amber {{ border-color: #FFB800; }}

    /* ── DETAIL PANE (Strictly Matching Image 4 & Image 2) ── */
    .detail-pane {{
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--bg-base);
      overflow-y: auto;
      padding: 20px;
      gap: 14px;
    }}

    .detail-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .detail-brand-group {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    .detail-logo {{
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }}
    .detail-title {{
      font-size: 20px;
      font-weight: 700;
      color: #FFFFFF;
    }}

    .detail-actions {{ display: flex; gap: 8px; }}
    .btn-pill {{
      height: 30px; padding: 0 12px; border-radius: 15px;
      background: var(--bg-btn); border: none; color: var(--text-main);
      font-size: 12px; font-weight: 500; display: flex;
      align-items: center; gap: 6px; cursor: pointer;
    }}
    .btn-pill:hover {{ background: var(--bg-btn-hover); }}

    /* CARDS */
    .card {{
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
    }}
    .card-row {{
      display: flex;
      align-items: center;
      padding: 10px 14px;
      min-height: 52px;
      position: relative;
    }}
    .card-row:not(:last-child)::after {{
      content: ''; position: absolute; bottom: 0; left: 14px; right: 14px;
      height: 1px; background: var(--border-card);
    }}
    .card-icon {{
      width: 22px; height: 22px; display: flex; align-items: center;
      justify-content: center; color: var(--accent); margin-right: 12px;
    }}
    .card-content {{ flex: 1; }}
    .card-label {{ font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }}
    .card-value {{ font-size: 13px; color: #FFFFFF; font-weight: 400; }}
    .card-actions {{ display: flex; gap: 8px; color: var(--text-muted); }}

    /* SECURITY & RISK HEALTH CARD (Ring removed as in Image 2!) */
    .risk-detail-card {{
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}
    .risk-header-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .risk-title {{
      font-size: 13px;
      font-weight: 700;
      color: #FFFFFF;
    }}
    .risk-status-pill {{
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(41, 201, 143, 0.16);
      color: #29C98F;
      border: 1px solid rgba(41, 201, 143, 0.35);
      letter-spacing: 0.5px;
    }}
    .risk-chips-wrap {{
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }}
    .risk-chip {{
      font-size: 11px;
      color: #E2E8F0;
      background: rgba(255, 255, 255, 0.05);
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }}

    /* AUTHENTICATOR (TOTP) CARD */
    .totp-container {{
      background: linear-gradient(135deg, rgba(41, 201, 143, 0.09) 0%, rgba(33, 31, 45, 0.95) 100%);
      border: 1px solid rgba(41, 201, 143, 0.28);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }}
    .totp-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .totp-label-group {{
      display: flex;
      align-items: center;
      gap: 7px;
      color: #29C98F;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }}
    .totp-countdown-pill {{
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(0, 0, 0, 0.4);
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: #29C98F;
      border: 1px solid rgba(41, 201, 143, 0.25);
    }}
    .totp-body-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 0, 0, 0.38);
      border-radius: 8px;
      padding: 8px 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }}
    .totp-code-display {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #FFFFFF;
      text-shadow: 0 0 12px rgba(41, 201, 143, 0.35);
    }}
    .totp-copy-btn {{
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(41, 201, 143, 0.15);
      color: #29C98F;
      border: 1px solid rgba(41, 201, 143, 0.3);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }}

    .url-pill {{
      background: var(--bg-url);
      color: var(--text-url);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      text-decoration: none;
      width: fit-content;
    }}
    .meta-row {{
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: var(--text-muted);
      padding: 0 4px;
    }}
  </style>
</head>
<body>
  <div class="ambient-glow-purple"></div>
  <div class="ambient-glow-green"></div>
  <div class="studio-grid"></div>

  <!-- Header Section -->
  <header class="hero-header">
    <div class="hero-badge">
      <span>🛡️ 100% Local-First & Zero-Knowledge</span>
    </div>
    <h1 class="hero-title">Dual-Pane Vault & Instant Search</h1>
    <p class="hero-subtitle">Organize passwords, 2FA keys, payment cards, and encrypted notes with squircle brand icons and live security health audits.</p>
  </header>

  <!-- Center Stage Popup -->
  <div class="stage-container">
    <div class="popup-shell">
      <!-- Header -->
      <div class="header">
        <div class="search-wrapper">
          <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" class="search-input" placeholder="Search in all items..." readonly>
        </div>
        <div class="header-right">
          <button class="btn-icon" title="Lock Vault">
            <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          </button>
          <button class="btn-icon" title="Password Generator">
            <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
          </button>
          <button class="btn-icon purple" title="Add Item">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </div>
      </div>

      <!-- Main Split -->
      <div class="main-view">
        <!-- Sidebar -->
        <div class="sidebar">
          <!-- Suggested Card -->
          <div class="suggested-container">
            <div class="suggested-header">
              <svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
              <span>SUGGESTED FOR GITHUB.COM</span>
            </div>
            <div class="suggested-row">
              <div class="suggested-avatar">
                {SVG_GITHUB}
              </div>
              <div class="suggested-info">
                <div class="suggested-title">GitHub</div>
                <div class="suggested-sub">naetik.arvnd@gmail.com</div>
              </div>
              <button class="btn-copy-pass">🔑 Copy Pass</button>
            </div>
          </div>

          <!-- Tabs -->
          <div class="sidebar-filters">
            <button class="filter-btn active">
              <svg viewBox="0 0 24 24"><path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
              <span>All</span>
            </button>
            <button class="filter-btn">
              <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
              <span>Logins</span>
            </button>
            <button class="filter-btn">
              <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              <span>Favorites</span>
            </button>
            <button class="filter-btn">
              <svg viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.9 17.58 11 21 11 21z"/></svg>
              <span>Gen</span>
            </button>
            <div class="sort-icon-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
            </div>
          </div>

          <!-- Items List -->
          <div class="item-list">
            <div class="list-group-header">ALL ITEMS</div>

            <!-- GitHub Item (Active) -->
            <div class="list-item active">
              <div class="item-avatar" style="background: #111;">
                {SVG_GITHUB}
              </div>
              <div class="item-info">
                <div class="item-title">GitHub</div>
                <div class="item-sub">naetik.arvnd@gmail.com</div>
              </div>
              <div class="status-ring"></div>
            </div>

            <!-- ProtonMail -->
            <div class="list-item">
              <div class="item-avatar">
                {SVG_PROTON}
              </div>
              <div class="item-info">
                <div class="item-title">ProtonMail</div>
                <div class="item-sub">security@proton.me</div>
              </div>
              <div class="status-ring"></div>
            </div>

            <!-- Spotify -->
            <div class="list-item">
              <div class="item-avatar">
                {SVG_SPOTIFY}
              </div>
              <div class="item-info">
                <div class="item-title">Spotify</div>
                <div class="item-sub">naetik.arvind@gmail.com</div>
              </div>
              <div class="status-ring"></div>
            </div>

            <!-- Autodesk -->
            <div class="list-item">
              <div class="item-avatar">
                {SVG_AUTODESK}
              </div>
              <div class="item-info">
                <div class="item-title">Autodesk</div>
                <div class="item-sub">naetik.arvind@gmail.com</div>
              </div>
              <div class="status-ring amber"></div>
            </div>

            <!-- Dribbble -->
            <div class="list-item">
              <div class="item-avatar">
                {SVG_DRIBBBLE}
              </div>
              <div class="item-info">
                <div class="item-title">Dribbble</div>
                <div class="item-sub">Rad77</div>
              </div>
              <div class="status-ring"></div>
            </div>

            <!-- Zoom -->
            <div class="list-item">
              <div class="item-avatar">
                {SVG_ZOOM}
              </div>
              <div class="item-info">
                <div class="item-title">Zoom</div>
                <div class="item-sub">naetik.arvind@gmail.com</div>
              </div>
              <div class="status-ring"></div>
            </div>
          </div>
        </div>

        <!-- Detail Pane (Matching Image 2 strictly without circular ring!) -->
        <div class="detail-pane">
          <!-- Detail Header -->
          <div class="detail-header">
            <div class="detail-brand-group">
              <div class="detail-logo">
                {SVG_GITHUB}
              </div>
              <h2 class="detail-title">GitHub</h2>
            </div>
            <div class="detail-actions">
              <button class="btn-pill">★ Favorite</button>
              <button class="btn-pill" style="background: var(--accent); color: #FFF;">■ Fill</button>
              <button class="btn-pill">✎ Edit</button>
            </div>
          </div>

          <!-- Credentials Card -->
          <div class="card">
            <div class="card-row">
              <div class="card-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div class="card-content">
                <div class="card-label">USERNAME</div>
                <div class="card-value">naetik.arvnd@gmail.com</div>
              </div>
              <div class="card-actions">
                <span>📋</span>
              </div>
            </div>

            <div class="card-row">
              <div class="card-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
              </div>
              <div class="card-content">
                <div class="card-label">PASSWORD</div>
                <div class="card-value">••••••••••••••••</div>
              </div>
              <div class="card-actions">
                <span>👁️</span>
                <span>📋</span>
              </div>
            </div>
          </div>

          <!-- Security & Risk Health Card (No circular ring as in Image 2!) -->
          <div class="risk-detail-card">
            <div class="risk-header-row">
              <span class="risk-title">Security & Risk Health</span>
              <span class="risk-status-pill">LOW RISK</span>
            </div>
            <div class="risk-chips-wrap">
              <span class="risk-chip">🔐 99 bits entropy</span>
              <span class="risk-chip">✓ Unique password</span>
              <span class="risk-chip" style="color: #29C98F; border-color: rgba(41,201,143,0.3);">🛡️ 2FA Active</span>
            </div>
          </div>

          <!-- Live Authenticator Card -->
          <div class="totp-container">
            <div class="totp-header">
              <div class="totp-label-group">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
                <span>AUTHENTICATOR</span>
              </div>
              <div class="totp-countdown-pill">
                <span>⏱️ 11s</span>
              </div>
            </div>
            <div class="totp-body-row">
              <div class="totp-code-display">225 271</div>
              <button class="totp-copy-btn">📋 Copy</button>
            </div>
          </div>

          <!-- Website Pill & Metadata -->
          <div class="card" style="padding: 10px 14px;">
            <div class="card-label" style="margin-bottom: 5px;">WEBSITES</div>
            <a class="url-pill" href="#">https://github.com</a>
          </div>

          <div class="meta-row">
            <span>Created: 11/17/2026</span>
            <span>Modified: 11/17/2026</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""

with open(f"{TEMPLATES_DIR}/scene-2-vault.html", "w") as f:
    f.write(scene_2_html)
print("  ✓ scene-2-vault.html written")


# -------------------------------------------------------------
# SCENE 3: High-Entropy Password & EFF Passphrase Generator
# -------------------------------------------------------------
scene_3_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screenshot 3: Password & Passphrase Generator</title>
  <style>
    {COMMON_STYLE}

    .generator-box {{
      width: 680px;
      background: var(--bg-card);
      border-radius: 12px;
      border: 1px solid rgba(109, 74, 255, 0.35);
      box-shadow: 0 28px 80px rgba(0,0,0,0.8), 0 0 24px rgba(109, 74, 255, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
      gap: 18px;
    }}

    .gen-toggle-row {{
      display: flex;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 3px;
      gap: 4px;
    }}
    .gen-toggle-btn {{
      flex: 1;
      padding: 8px 14px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
    }}
    .gen-toggle-btn.active {{
      background: var(--accent);
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(109, 74, 255, 0.4);
    }}

    /* Password Display Card */
    .password-display-card {{
      background: linear-gradient(135deg, rgba(109, 74, 255, 0.14) 0%, rgba(22, 21, 29, 0.98) 100%);
      border: 1px solid rgba(109, 74, 255, 0.35);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}

    .password-text-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }}

    .password-code {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 1.5px;
      word-break: break-all;
      flex: 1;
    }}
    .char-sym {{ color: #FF884D; font-weight: 800; }}
    .char-num {{ color: #00D2B4; font-weight: 800; }}
    .char-upper {{ color: #A78BFA; }}
    .char-lower {{ color: #FFFFFF; }}

    .password-actions {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .btn-gen-action {{
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      background: var(--bg-btn);
      border: 1px solid var(--border);
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .btn-gen-action.copied {{
      background: #29C98F;
      border-color: #29C98F;
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(41, 201, 143, 0.4);
    }}

    /* Entropy & Strength Meter */
    .entropy-bar-wrapper {{
      display: flex;
      flex-direction: column;
      gap: 6px;
    }}
    .entropy-header {{
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
    }}
    .entropy-label {{ color: #29C98F; font-weight: 700; }}
    .entropy-val {{ color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }}

    .entropy-track {{
      display: flex;
      gap: 4px;
      height: 5px;
    }}
    .entropy-seg {{
      flex: 1;
      height: 100%;
      background: #29C98F;
      border-radius: 2px;
      box-shadow: 0 0 6px rgba(41, 201, 143, 0.4);
    }}

    /* Configuration Panel */
    .config-card {{
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }}

    .slider-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
    }}
    .slider-badge {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      color: var(--accent);
      background: rgba(109, 74, 255, 0.16);
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid rgba(109, 74, 255, 0.35);
    }}

    .slider-track {{
      height: 6px;
      background: #312E40;
      border-radius: 3px;
      position: relative;
    }}
    .slider-fill {{
      width: 48%;
      height: 100%;
      background: var(--accent);
      border-radius: 3px;
      box-shadow: 0 0 8px rgba(109, 74, 255, 0.5);
    }}
    .slider-thumb {{
      position: absolute;
      left: 48%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }}

    /* Character toggles */
    .chips-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }}
    .toggle-chip {{
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(109, 74, 255, 0.16);
      border: 1px solid var(--accent);
      color: #A78BFA;
    }}
    .toggle-chip.secondary {{
      background: var(--bg-btn);
      border-color: var(--border);
      color: var(--text-muted);
    }}

    /* EFF Passphrase preview banner */
    .eff-preview-box {{
      background: rgba(0, 210, 180, 0.08);
      border: 1px solid rgba(0, 210, 180, 0.25);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .eff-title {{
      font-size: 11.5px;
      font-weight: 700;
      color: #00D2B4;
    }}
    .eff-passphrase {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #FFFFFF;
      font-weight: 600;
    }}
  </style>
</head>
<body>
  <div class="ambient-glow-purple"></div>
  <div class="ambient-glow-green"></div>
  <div class="studio-grid"></div>

  <!-- Header Section -->
  <header class="hero-header">
    <div class="hero-badge emerald">
      <span>🔐 Cryptographic Password & Passphrase Studio</span>
    </div>
    <h1 class="hero-title">High-Entropy Passwords & EFF Passphrases</h1>
    <p class="hero-subtitle">Generate uncrackable passwords and memorable Diceware passphrases in local memory with real-time entropy scoring.</p>
  </header>

  <!-- Center Stage Container -->
  <div class="stage-container">
    <div class="generator-box">
      <!-- Mode Toggle -->
      <div class="gen-toggle-row">
        <button class="gen-toggle-btn active">🔑 Password Generator</button>
        <button class="gen-toggle-btn">💬 EFF Passphrase Studio</button>
      </div>

      <!-- Main Display -->
      <div class="password-display-card">
        <div class="password-text-row">
          <div class="password-code">
            <span class="char-upper">K</span><span class="char-lower">p</span><span class="char-num">9</span><span class="char-sym">#</span><span class="char-lower">v</span><span class="char-upper">X</span><span class="char-num">2</span><span class="char-sym">$</span><span class="char-lower">m</span><span class="char-upper">Q</span><span class="char-num">8</span><span class="char-sym">!</span><span class="char-lower">z</span><span class="char-upper">L</span><span class="char-num">4</span><span class="char-sym">@</span><span class="char-lower">t</span><span class="char-upper">W</span><span class="char-num">5</span><span class="char-sym">^</span><span class="char-lower">y</span><span class="char-upper">R</span><span class="char-num">7</span><span class="char-sym">&amp;</span>
          </div>
          <div class="password-actions">
            <button class="btn-gen-action" title="Regenerate">🔄</button>
            <button class="btn-gen-action copied">✓ Copied!</button>
          </div>
        </div>

        <!-- Entropy Meter -->
        <div class="entropy-bar-wrapper">
          <div class="entropy-header">
            <span class="entropy-label">Military Grade Strength</span>
            <span class="entropy-val">128 bits entropy</span>
          </div>
          <div class="entropy-track">
            <div class="entropy-seg"></div>
            <div class="entropy-seg"></div>
            <div class="entropy-seg"></div>
            <div class="entropy-seg"></div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="config-card">
        <div class="slider-header">
          <span>Password Length</span>
          <span class="slider-badge">24 characters</span>
        </div>

        <div class="slider-track">
          <div class="slider-fill"></div>
          <div class="slider-thumb"></div>
        </div>

        <div class="chips-row">
          <div class="toggle-chip">✓ A-Z Uppercase</div>
          <div class="toggle-chip">✓ a-z Lowercase</div>
          <div class="toggle-chip">✓ 0-9 Digits</div>
          <div class="toggle-chip">✓ !@#$%^&amp;* Symbols</div>
          <div class="toggle-chip secondary">Avoid Ambiguous (1, l, O, 0)</div>
        </div>
      </div>

      <!-- EFF Passphrase Preview -->
      <div class="eff-preview-box">
        <div>
          <div class="eff-title">EFF DICEWARE ALTERNATIVE</div>
          <div class="eff-passphrase">correct-horse-battery-staple</div>
        </div>
        <span style="font-size: 11px; color: #00D2B4; background: rgba(0,210,180,0.15); padding: 3px 8px; border-radius: 4px; font-weight: 600;">77 bits entropy</span>
      </div>
    </div>
  </div>
</body>
</html>
"""

with open(f"{TEMPLATES_DIR}/scene-3-generator.html", "w") as f:
    f.write(scene_3_html)
print("  ✓ scene-3-generator.html written")


# -------------------------------------------------------------
# SCENE 4: Built-in 2FA Authenticator & Disposable Email Aliases
# -------------------------------------------------------------
scene_4_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screenshot 4: 2FA & Privacy Aliases</title>
  <style>
    {COMMON_STYLE}

    .dual-showcase {{
      display: flex;
      gap: 24px;
      width: 960px;
    }}

    .showcase-card {{
      flex: 1;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 12px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7);
    }}

    .card-top {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .card-badge-icon {{
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .card-head-title {{
      font-size: 16px;
      font-weight: 700;
      color: #FFFFFF;
    }}
    .card-head-sub {{
      font-size: 11px;
      color: var(--text-muted);
    }}

    /* 2FA Card Styling */
    .totp-box {{
      background: linear-gradient(135deg, rgba(41, 201, 143, 0.12) 0%, rgba(20, 19, 27, 0.98) 100%);
      border: 1px solid rgba(41, 201, 143, 0.35);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    .totp-time-row {{
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    .totp-digits-large {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 5px;
      color: #FFFFFF;
      text-shadow: 0 0 16px rgba(41, 201, 143, 0.4);
    }}
    .totp-countdown-circle {{
      display: flex;
      align-items: center;
      gap: 6px;
      color: #29C98F;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.4);
      padding: 4px 10px;
      border-radius: 14px;
      border: 1px solid rgba(41, 201, 143, 0.3);
    }}

    /* Alias Card Styling */
    .alias-box {{
      background: linear-gradient(135deg, rgba(0, 210, 180, 0.1) 0%, rgba(20, 19, 27, 0.98) 100%);
      border: 1px solid rgba(0, 210, 180, 0.3);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    .alias-email-text {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
      font-weight: 700;
      color: #00D2B4;
    }}
    .alias-forward-text {{
      font-size: 11.5px;
      color: var(--text-muted);
    }}

    .bullet-feature {{
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 12px;
      color: #E2E8F0;
      line-height: 1.4;
    }}
    .bullet-icon {{
      color: #29C98F;
      font-weight: 700;
    }}
    .bullet-icon.teal {{ color: #00D2B4; }}

    .btn-action-full {{
      height: 38px;
      border-radius: 8px;
      border: none;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }}
    .btn-action-full.green {{
      background: #29C98F;
      color: #FFFFFF;
      box-shadow: 0 2px 10px rgba(41, 201, 143, 0.4);
    }}
    .btn-action-full.purple {{
      background: var(--accent);
      color: #FFFFFF;
      box-shadow: 0 2px 10px rgba(109, 74, 255, 0.4);
    }}
  </style>
</head>
<body>
  <div class="ambient-glow-purple"></div>
  <div class="ambient-glow-green"></div>
  <div class="studio-grid"></div>

  <!-- Header Section -->
  <header class="hero-header">
    <div class="hero-badge">
      <span>🛡️ Integrated 2FA & Privacy Shield</span>
    </div>
    <h1 class="hero-title">Live 2FA Authenticator & Disposable Email Aliases</h1>
    <p class="hero-subtitle">Replace external authenticator apps with auto-copying TOTP codes and keep your personal email address safe with private alias relays.</p>
  </header>

  <!-- Center Stage Container -->
  <div class="stage-container">
    <div class="dual-showcase">
      <!-- 2FA Card -->
      <div class="showcase-card">
        <div class="card-top">
          <div class="card-badge-icon" style="background: rgba(41, 201, 143, 0.18); color: #29C98F;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          </div>
          <div>
            <div class="card-head-title">Built-in 2FA Authenticator</div>
            <div class="card-head-sub">Standard RFC 6238 TOTP Engine</div>
          </div>
        </div>

        <div class="totp-box">
          <div class="totp-time-row">
            <span style="font-size: 11px; font-weight: 700; color: #29C98F; text-transform: uppercase;">GitHub Verification</span>
            <div class="totp-countdown-circle">
              <span>⏱️ 11s left</span>
            </div>
          </div>
          <div class="totp-digits-large">225 271</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="bullet-feature">
            <span class="bullet-icon">✓</span>
            <span>Automatically detects 2FA input fields and autofills code with 1 click.</span>
          </div>
          <div class="bullet-feature">
            <span class="bullet-icon">✓</span>
            <span>Encrypted locally alongside your login credentials at ~/.kloak/vault.</span>
          </div>
          <div class="bullet-feature">
            <span class="bullet-icon">✓</span>
            <span>No external mobile app or internet connection required.</span>
          </div>
        </div>

        <button class="btn-action-full green">📋 Copy TOTP Code (Instant)</button>
      </div>

      <!-- Aliases Card -->
      <div class="showcase-card">
        <div class="card-top">
          <div class="card-badge-icon" style="background: rgba(0, 210, 180, 0.18); color: #00D2B4;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71c-.36-.45-.91-.7-1.5-.7-1.25 0-2.38 1.05-2.38 2.41 0 1.34 1.13 2.41 2.38 2.41.59 0 1.14-.25 1.5-.7v.58c0 .88-.72 1.6-1.6 1.6-.74 0-1.39-.5-1.55-1.21l-1.36.32c.28 1.25 1.41 2.09 2.91 2.09 1.65 0 2.8-1.15 2.8-2.8V9.5h-1.2v.79zm-1.5 2.82c-.66 0-1.2-.54-1.2-1.21 0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2 0 .67-.54 1.21-1.2 1.21z"/></svg>
          </div>
          <div>
            <div class="card-head-title">Disposable Email Aliases</div>
            <div class="card-head-sub">Keep your real email address hidden</div>
          </div>
        </div>

        <div class="alias-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10px; font-weight: 700; color: #00D2B4; text-transform: uppercase;">GENERATED ALIAS RELAY</span>
            <span style="font-size: 9.5px; background: rgba(0,210,180,0.18); color: #00D2B4; padding: 1px 6px; border-radius: 4px; font-weight: 700;">ACTIVE</span>
          </div>
          <div class="alias-email-text">github.pr7x2@kloak.alias</div>
          <div class="alias-forward-text">Forwarding to: <strong>security@proton.me</strong></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="bullet-feature">
            <span class="bullet-icon teal">✓</span>
            <span>Blocks trackers, spammers, and marketing profiling before reaching your inbox.</span>
          </div>
          <div class="bullet-feature">
            <span class="bullet-icon teal">✓</span>
            <span>Disable or regenerate aliases instantly if a service gets compromised.</span>
          </div>
          <div class="bullet-feature">
            <span class="bullet-icon teal">✓</span>
            <span>1-Click generate and autofill into web registration forms.</span>
          </div>
        </div>

        <button class="btn-action-full purple">➕ Create Disposable Alias</button>
      </div>
    </div>
  </div>
</body>
</html>
"""

with open(f"{TEMPLATES_DIR}/scene-4-aliases.html", "w") as f:
    f.write(scene_4_html)
print("  ✓ scene-4-aliases.html written")


# -------------------------------------------------------------
# SCENE 5: Chrome Side Panel & Secure Notes / Text Import
# -------------------------------------------------------------
scene_5_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screenshot 5: Chrome Side Panel & Notes</title>
  <style>
    {COMMON_STYLE}

    /* Mock Chrome Window with Side Panel */
    .browser-frame {{
      width: 1020px;
      height: 540px;
      background: #0E0D15;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 28px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(109, 74, 255, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }}

    .titlebar {{
      height: 38px;
      background: #171622;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      padding: 0 14px;
      gap: 12px;
    }}
    .dots {{ display: flex; gap: 6px; }}
    .d {{ width: 10px; height: 10px; border-radius: 50%; }}

    .main-workspace {{
      flex: 1;
      display: flex;
      min-height: 0;
      overflow: hidden;
    }}

    /* Web Content (Left) */
    .web-content {{
      flex: 1;
      background: #111018;
      border-right: 1px solid var(--border);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }}
    .mock-web-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 12px;
    }}
    .mock-web-card {{
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}

    /* ── CHROME SIDE PANEL (Right, 380px) ── */
    .side-panel {{
      width: 380px;
      background: var(--bg-sidebar);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }}

    .side-panel-header {{
      height: 48px;
      padding: 0 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-base);
    }}
    .sp-brand {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #FFFFFF;
    }}

    .sp-search-bar {{
      padding: 8px 12px;
      background: var(--bg-sidebar);
    }}
    .sp-search-input {{
      width: 100%;
      height: 32px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: #FFF;
      font-size: 12px;
      padding: 0 10px;
      outline: none;
    }}

    .sp-tabs {{
      display: flex;
      padding: 4px 12px 8px 12px;
      gap: 4px;
      border-bottom: 1px solid var(--border);
    }}
    .sp-tab {{
      padding: 4px 10px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      background: transparent;
      border: none;
    }}
    .sp-tab.active {{
      background: rgba(77, 150, 255, 0.18);
      color: #4D96FF;
      font-weight: 700;
      border: 1px solid rgba(77, 150, 255, 0.35);
    }}

    /* Encrypted Notes List */
    .notes-list {{
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}

    .note-card {{
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.15s;
    }}
    .note-card.active {{
      border-color: rgba(77, 150, 255, 0.4);
      background: rgba(77, 150, 255, 0.08);
    }}
    .note-head {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .note-icon {{
      width: 22px;
      height: 22px;
      border-radius: 5px;
      background: rgba(77, 150, 255, 0.2);
      color: #4D96FF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }}
    .note-title {{
      font-size: 12px;
      font-weight: 600;
      color: #FFF;
      flex: 1;
    }}
    .note-tag {{
      font-size: 9px;
      background: rgba(77, 150, 255, 0.15);
      color: #4D96FF;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 700;
      text-transform: uppercase;
    }}
    .note-body-preview {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      color: var(--text-muted);
      background: rgba(0,0,0,0.3);
      padding: 6px 8px;
      border-radius: 5px;
      line-height: 1.4;
      word-break: break-all;
    }}

    /* Feature Banner for Text Import */
    .import-banner {{
      margin: 8px 12px;
      padding: 10px 12px;
      background: linear-gradient(135deg, rgba(109, 74, 255, 0.15) 0%, rgba(77, 150, 255, 0.1) 100%);
      border: 1px solid rgba(109, 74, 255, 0.35);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }}
    .import-title {{
      font-size: 11px;
      font-weight: 700;
      color: #B5A8FF;
      display: flex;
      align-items: center;
      gap: 5px;
    }}
    .import-desc {{
      font-size: 10px;
      color: var(--text-muted);
      line-height: 1.35;
    }}
  </style>
</head>
<body>
  <div class="ambient-glow-purple"></div>
  <div class="ambient-glow-green"></div>
  <div class="studio-grid"></div>

  <!-- Header Section -->
  <header class="hero-header">
    <div class="hero-badge">
      <span>📑 Native Side Panel & Secure Notes</span>
    </div>
    <h1 class="hero-title">Side-by-Side Vault & Plain Text Import</h1>
    <p class="hero-subtitle">Access logins, server keys, and recovery codes directly inside Chrome's native Side Panel with seamless .txt and .md file import.</p>
  </header>

  <!-- Center Stage Container -->
  <div class="stage-container">
    <div class="browser-frame">
      <!-- Titlebar -->
      <div class="titlebar">
        <div class="dots">
          <div class="d" style="background: #FF5F56;"></div>
          <div class="d" style="background: #FFBD2E;"></div>
          <div class="d" style="background: #27C93F;"></div>
        </div>
        <span style="font-size: 11.5px; color: #7D8590; margin-left: 10px;">console.aws.amazon.com/iam</span>
      </div>

      <!-- Main Workspace -->
      <div class="main-workspace">
        <!-- Web Content -->
        <div class="web-content">
          <div class="mock-web-header">
            <div>
              <h3 style="font-size: 15px; font-weight: 600; color: #FFF;">AWS Identity and Access Management (IAM)</h3>
              <p style="font-size: 11px; color: #8C8899;">Production Account: 9281-4821-1049</p>
            </div>
            <button style="background: #EC7211; color: #FFF; border: none; padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: 600;">Sign in to Console</button>
          </div>

          <div class="mock-web-card">
            <span style="font-size: 12px; font-weight: 600; color: #E2E8F0;">Root User Multi-Factor Authentication</span>
            <p style="font-size: 11px; color: #8C8899;">Retrieve root emergency MFA emergency backup codes from your encrypted Kloak side panel.</p>
          </div>
        </div>

        <!-- Native Side Panel -->
        <div class="side-panel">
          <div class="side-panel-header">
            <div class="sp-brand">
              {SVG_KLOAK_SHIELD}
              <span>Kloak Side Panel</span>
            </div>
            <button class="btn-icon" style="width: 28px; height: 28px;">🔒</button>
          </div>

          <div class="sp-search-bar">
            <input type="text" class="sp-search-input" placeholder="Search notes &amp; keys..." readonly>
          </div>

          <div class="sp-tabs">
            <button class="sp-tab">All</button>
            <button class="sp-tab">Logins</button>
            <button class="sp-tab active">Notes (3)</button>
            <button class="sp-tab">Favorites</button>
          </div>

          <!-- Text File Import Callout -->
          <div class="import-banner">
            <div class="import-title">
              <span>📥 Secure Note &amp; Text Import</span>
            </div>
            <div class="import-desc">
              Import .txt, .md, .note files into Kloak — encrypted instantly into Secure Notes.
            </div>
          </div>

          <!-- Notes List -->
          <div class="notes-list">
            <div class="note-card active">
              <div class="note-head">
                <div class="note-icon">📝</div>
                <div class="note-title">AWS Production Root Keys</div>
                <div class="note-tag">SECURE NOTE</div>
              </div>
              <div class="note-body-preview">
                MFA backup codes: 9281-4821, 1049-5832, 4829-1940, 5012-9843...
              </div>
            </div>

            <div class="note-card">
              <div class="note-head">
                <div class="note-icon">🔑</div>
                <div class="note-title">SSH Key Pair - Ed25519</div>
                <div class="note-tag">SECURE NOTE</div>
              </div>
              <div class="note-body-preview">
                ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... dev-cluster-us-east-1
              </div>
            </div>

            <div class="note-card">
              <div class="note-head">
                <div class="note-icon">🛡️</div>
                <div class="note-title">WireGuard VPN Config</div>
                <div class="note-tag">SECURE NOTE</div>
              </div>
              <div class="note-body-preview">
                [Interface] PrivateKey = yAn4/..., Address = 10.0.0.2/24
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""

with open(f"{TEMPLATES_DIR}/scene-5-sidepanel.html", "w") as f:
    f.write(scene_5_html)
print("  ✓ scene-5-sidepanel.html written")

print("🎉 All 5 HTML templates generated successfully in scripts/screenshot-templates/")
