import base64
import os

with open('/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/website/public/kloak-logo.png', 'rb') as f:
    logo_b64 = base64.b64encode(f.read()).decode('utf-8')

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Kloak Password Manager — Official Public Release</title>
<style>
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }}
  body {{
    width: 1200px;
    height: 675px;
    background: #060813;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
    overflow: hidden;
    position: relative;
    padding: 22px 36px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}

  /* Ambient Cosmic Background Lighting */
  .ambient-glow-cyan {{
    position: absolute;
    top: -50px;
    left: 80px;
    width: 520px;
    height: 520px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(14, 165, 233, 0) 70%);
    filter: blur(65px);
    pointer-events: none;
    z-index: 0;
  }}
  .ambient-glow-purple {{
    position: absolute;
    top: -30px;
    right: 60px;
    width: 560px;
    height: 560px;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, rgba(168, 85, 247, 0) 70%);
    filter: blur(65px);
    pointer-events: none;
    z-index: 0;
  }}
  .ambient-grid {{
    position: absolute;
    inset: 0;
    background-image: 
      radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    opacity: 0.7;
  }}

  /* Top Header */
  .header {{
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 54px;
  }}
  .brand-group {{
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .logo-box {{
    width: 50px;
    height: 50px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 0 25px rgba(56, 189, 248, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    border: 1.5px solid rgba(56, 189, 248, 0.55);
    background: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  .logo-box img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
  }}
  .brand-text {{
    display: flex;
    flex-direction: column;
    gap: 2px;
  }}
  .brand-title-row {{
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .brand-name {{
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 2px;
    color: #ffffff;
  }}
  .brand-sub {{
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    background: linear-gradient(90deg, #38bdf8 0%, #a855f7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}
  .brand-tagline {{
    font-size: 11.5px;
    font-weight: 500;
    color: #94a3b8;
    letter-spacing: 0.2px;
  }}

  .header-badge {{
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(56, 189, 248, 0.12);
    border: 1.5px solid rgba(56, 189, 248, 0.45);
    padding: 7px 18px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 700;
    color: #38bdf8;
    letter-spacing: 0.6px;
    box-shadow: 0 0 18px rgba(56, 189, 248, 0.3);
  }}
  .header-badge .dot {{
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8;
  }}

  /* Main Showcase Area */
  .showcase {{
    position: relative;
    z-index: 10;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    height: 446px;
  }}

  .glass-card {{
    background: rgba(14, 18, 33, 0.96);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }}
  .glass-card-macos {{
    border-color: rgba(56, 189, 248, 0.40);
    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.75), 0 0 35px rgba(56, 189, 248, 0.16);
  }}
  .glass-card-chrome {{
    border-color: rgba(168, 85, 247, 0.45);
    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.75), 0 0 35px rgba(168, 85, 247, 0.20);
  }}

  /* Window Titlebars */
  .card-titlebar {{
    height: 38px;
    background: rgba(20, 26, 46, 0.98);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
  }}
  .card-titlebar-chrome {{
    background: rgba(24, 18, 44, 0.98);
    border-bottom: 1px solid rgba(168, 85, 247, 0.22);
  }}
  .traffic-lights {{
    display: flex;
    align-items: center;
    gap: 7px;
  }}
  .traffic-dot {{
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }}
  .dot-red {{ background: #ff5f56; box-shadow: 0 0 4px #ff5f56; }}
  .dot-yellow {{ background: #ffbd2e; box-shadow: 0 0 4px #ffbd2e; }}
  .dot-green {{ background: #27c93f; box-shadow: 0 0 4px #27c93f; }}

  .card-title {{
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 7px;
  }}
  .card-status-badge {{
    font-size: 9.5px;
    font-weight: 700;
    padding: 2.5px 8px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
  }}
  .status-green {{
    background: rgba(16, 185, 129, 0.16);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.40);
  }}
  .status-purple {{
    background: rgba(168, 85, 247, 0.20);
    color: #d8b4fe;
    border: 1px solid rgba(168, 85, 247, 0.45);
  }}

  /* macOS App Vault Content */
  .macos-body {{
    flex: 1;
    display: grid;
    grid-template-columns: 145px 200px 1fr;
    background: rgba(10, 13, 24, 0.94);
    overflow: hidden;
  }}
  .macos-sidebar {{
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(6, 9, 17, 0.4);
  }}
  .sidebar-header {{
    font-size: 9.5px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 2px 8px 6px;
  }}
  .sidebar-item {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    color: #94a3b8;
  }}
  .sidebar-item.active {{
    background: rgba(56, 189, 248, 0.16);
    color: #ffffff;
    font-weight: 600;
    border: 1px solid rgba(56, 189, 248, 0.35);
  }}
  .sidebar-count {{
    font-size: 10px;
    background: rgba(255,255,255,0.08);
    padding: 1px 6px;
    border-radius: 8px;
    color: #cbd5e1;
  }}

  .macos-list {{
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}
  .search-input {{
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 10.5px;
    color: #64748b;
    margin-bottom: 2px;
    display: flex;
    justify-content: space-between;
  }}
  .account-row {{
    padding: 7px 9px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .account-row.active {{
    background: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.35);
  }}
  .acc-icon {{
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
  }}
  .acc-info {{
    flex: 1;
    overflow: hidden;
  }}
  .acc-title {{
    font-size: 11.5px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }}
  .acc-user {{
    font-size: 9.5px;
    color: #94a3b8;
  }}

  .macos-detail {{
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .detail-card {{
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 9px 11px;
  }}
  .detail-label {{
    font-size: 9.5px;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }}
  .totp-box {{
    background: rgba(56, 189, 248, 0.10);
    border: 1.5px solid rgba(56, 189, 248, 0.35);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .totp-code {{
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 3px;
    color: #38bdf8;
  }}
  .totp-timer {{
    font-size: 10px;
    font-weight: 700;
    color: #34d399;
    background: rgba(16, 185, 129, 0.15);
    padding: 2px 7px;
    border-radius: 4px;
  }}

  /* Chrome Browser Autofill Content */
  .chrome-body {{
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #0d0c14;
    padding: 12px 18px;
    overflow: hidden;
    position: relative;
  }}
  .browser-url-bar {{
    height: 28px;
    background: #161522;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 8px;
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 10px;
  }}
  .browser-url-bar .lock {{
    color: #34d399;
    font-size: 12px;
  }}
  .browser-url-bar .host {{
    color: #ffffff;
    font-weight: 600;
  }}

  .mock-form {{
    max-width: 450px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}
  .mock-input-row {{
    position: relative;
    width: 100%;
  }}
  .mock-input {{
    width: 100%;
    height: 35px;
    background: #14121F;
    border: 1.5px solid #6D4AFF;
    border-radius: 7px;
    padding: 0 38px 0 12px;
    color: #ffffff;
    font-size: 12px;
    box-shadow: 0 0 0 3px rgba(109, 74, 255, 0.25);
  }}
  .kloak-field-badge {{
    position: absolute;
    right: 8px;
    top: 6.5px;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    background: #1C1929;
    border: 1px solid #6D4AFF;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 8px rgba(109, 74, 255, 0.5);
  }}

  /* Kloak In-Field Popup */
  .kloak-popup {{
    width: 100%;
    background: #14121F;
    border: 1px solid rgba(109, 74, 255, 0.5);
    border-radius: 8px;
    box-shadow: 0 16px 35px rgba(0,0,0,0.7), 0 0 20px rgba(109, 74, 255, 0.2);
    overflow: hidden;
  }}
  .popup-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: #1C1929;
    border-bottom: 1px solid rgba(109, 74, 255, 0.2);
    font-size: 10.5px;
    font-weight: 600;
  }}
  .pwd-row {{
    padding: 7px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 11.5px;
  }}
  .pwd-val {{
    font-family: ui-monospace, monospace;
    letter-spacing: 2px;
    color: #c084fc;
    font-weight: 700;
  }}
  .btn-gen {{
    padding: 7px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(109, 74, 255, 0.12);
    border-bottom: 1px solid rgba(109, 74, 255, 0.2);
    cursor: pointer;
  }}
  .btn-gen-title {{
    font-size: 11px;
    font-weight: 600;
    color: #e2e8f0;
  }}
  .btn-gen-sub {{
    font-size: 9px;
    color: #94a3b8;
  }}

  .ai-shield {{
    padding: 7px 12px;
    background: #110F1B;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }}
  .ai-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 600;
  }}
  .ai-badge {{
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
  }}
  .ai-meta {{
    display: flex;
    gap: 8px;
    font-size: 9px;
    color: #94a3b8;
  }}

  .btn-alias {{
    padding: 6px 12px;
    background: #14121F;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    color: #cbd5e1;
  }}

  /* Card Footers */
  .card-footer {{
    height: 34px;
    background: rgba(14, 18, 33, 1.0);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
  }}
  .spec-chip {{
    font-size: 10px;
    font-weight: 600;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 3px 8px;
    border-radius: 4px;
  }}
  .spec-chip.cyan {{
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.08);
    border-color: rgba(56, 189, 248, 0.25);
  }}
  .spec-chip.purple {{
    color: #c084fc;
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.25);
  }}

  /* Bottom Banner (Ecosystem & High-Impact CTA) */
  .footer-banner {{
    position: relative;
    z-index: 10;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    align-items: center;
    height: 58px;
  }}
  .eco-chips {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
  }}
  .eco-pill {{
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 8px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 7px;
  }}

  .cta-button {{
    height: 56px;
    background: linear-gradient(90deg, rgba(14, 165, 233, 0.30) 0%, rgba(168, 85, 247, 0.30) 100%);
    border: 1.8px solid #38bdf8;
    border-radius: 28px;
    box-shadow: 0 0 35px rgba(56, 189, 248, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    text-decoration: none;
  }}
  .cta-left {{
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .cta-globe {{
    font-size: 26px;
  }}
  .cta-text-group {{
    display: flex;
    flex-direction: column;
    gap: 1px;
  }}
  .cta-sub {{
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 1.2px;
    color: #38bdf8;
    text-transform: uppercase;
  }}
  .cta-url {{
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #ffffff;
  }}
  .cta-arrow {{
    font-size: 22px;
    font-weight: 800;
    color: #38bdf8;
  }}
</style>
</head>
<body>

  <div class="ambient-glow-cyan"></div>
  <div class="ambient-glow-purple"></div>
  <div class="ambient-grid"></div>

  <!-- Top Header -->
  <header class="header">
    <div class="brand-group">
      <div class="logo-box">
        <img src="data:image/png;base64,{logo_b64}" alt="Kloak Logo">
      </div>
      <div class="brand-text">
        <div class="brand-title-row">
          <span class="brand-name">K L O A K</span>
          <span class="brand-sub">PASSWORD MANAGER</span>
        </div>
        <div class="brand-tagline">100% Local-First • Zero-Knowledge • Zero-Telemetry • Free &amp; Open Source</div>
      </div>
    </div>

    <div class="header-badge">
      <span class="dot"></span>
      <span>PUBLIC RELEASE AVAILABLE NOW</span>
    </div>
  </header>

  <!-- Central Showcase Area -->
  <main class="showcase">

    <!-- LEFT: Native macOS App -->
    <div class="glass-card glass-card-macos">
      <div class="card-titlebar">
        <div class="traffic-lights">
          <span class="traffic-dot dot-red"></span>
          <span class="traffic-dot dot-yellow"></span>
          <span class="traffic-dot dot-green"></span>
        </div>
        <div class="card-title">
          <span></span>
          <span>Native macOS App — Liquid Glass Vault</span>
        </div>
        <div class="card-status-badge status-green">
          <span>●</span>
          <span>Touch ID Active</span>
        </div>
      </div>

      <div class="macos-body">
        <!-- Sidebar -->
        <div class="macos-sidebar">
          <div class="sidebar-header">Vaults</div>
          <div class="sidebar-item active">
            <span>🔑 All Items</span>
            <span class="sidebar-count">42</span>
          </div>
          <div class="sidebar-item">
            <span>🔒 Logins</span>
            <span class="sidebar-count">28</span>
          </div>
          <div class="sidebar-item">
            <span>🛡️ 2FA TOTP</span>
            <span class="sidebar-count">14</span>
          </div>
          <div class="sidebar-item">
            <span>💳 Cards</span>
            <span class="sidebar-count">6</span>
          </div>
          <div class="sidebar-item">
            <span>📝 Notes</span>
            <span class="sidebar-count">8</span>
          </div>
        </div>

        <!-- Items List -->
        <div class="macos-list">
          <div class="search-input">
            <span>🔍 Search vault...</span>
            <span style="font-size: 9px; background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px;">⌘K</span>
          </div>

          <div class="account-row active">
            <div class="acc-icon" style="background: #24292e;">GH</div>
            <div class="acc-info">
              <div class="acc-title">GitHub Enterprise</div>
              <div class="acc-user">naetik@kloak.app</div>
            </div>
          </div>

          <div class="account-row">
            <div class="acc-icon" style="background: #ea4335;">G</div>
            <div class="acc-info">
              <div class="acc-title">Google Workspace</div>
              <div class="acc-user">naetik@company.com</div>
            </div>
          </div>

          <div class="account-row">
            <div class="acc-icon" style="background: #ff9900;">AWS</div>
            <div class="acc-info">
              <div class="acc-title">AWS Production</div>
              <div class="acc-user">admin@infra.cloud</div>
            </div>
          </div>

          <div class="account-row">
            <div class="acc-icon" style="background: #635bff;">S</div>
            <div class="acc-info">
              <div class="acc-title">Stripe Dashboard</div>
              <div class="acc-user">finance@kloak.app</div>
            </div>
          </div>
        </div>

        <!-- Detail Panel -->
        <div class="macos-detail">
          <div class="detail-card">
            <div class="detail-label">Master Password</div>
            <div style="font-family: monospace; font-size: 13px; letter-spacing: 2px; color: #cbd5e1;">
              ••••••••••••••••
            </div>
          </div>

          <div class="totp-box">
            <div>
              <div class="detail-label" style="color: #38bdf8;">2FA Authenticator Code</div>
              <div class="totp-code">849 204</div>
            </div>
            <div class="totp-timer">⏱️ 28s</div>
          </div>

          <div class="detail-card" style="margin-top: auto;">
            <div class="detail-label">Vault Storage &amp; Security</div>
            <div style="font-size: 10px; color: #94a3b8; line-height: 1.4;">
              Encrypted at <span style="color: #38bdf8; font-family: monospace;">~/.kloak/vault.kloak</span><br>
              Zero unencrypted data touched by network.
            </div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <span class="spec-chip cyan">🔒 AES-256-GCM + Argon2id</span>
        <span class="spec-chip"> Apple Silicon &amp; Intel Native</span>
        <span class="spec-chip cyan">⚡️ Instant Local IPC Daemon</span>
      </div>
    </div>

    <!-- RIGHT: Chrome Web Store Extension -->
    <div class="glass-card glass-card-chrome">
      <div class="card-titlebar card-titlebar-chrome">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13px;">🧩</span>
          <span class="card-title">Chrome Extension &amp; In-Field Autofill</span>
        </div>
        <div class="card-status-badge status-purple">
          <span>🛡️</span>
          <span>Zero Network Pings</span>
        </div>
      </div>

      <div class="chrome-body">
        <div class="browser-url-bar">
          <span class="lock">🔒</span>
          <span>https://</span><span class="host">github.com</span><span>/login</span>
          <span style="margin-left: auto; font-size: 10px; color: #34d399; font-weight: 600;">TLS Verified</span>
        </div>

        <div class="mock-form">
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">Password</div>
          <div class="mock-input-row">
            <input type="text" class="mock-input" value="••••••••••••••••" readonly>
            <div class="kloak-field-badge">
              <span style="font-size: 11px;">🛡️</span>
            </div>
          </div>

          <!-- Kloak In-Field Popup -->
          <div class="kloak-popup">
            <div class="popup-header">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: #818cf8;">⚡️</span>
                <span>Kloak In-Field Autofill</span>
              </div>
              <span style="color: #34d399; font-size: 9.5px; font-weight: 700;">1-Click Fill</span>
            </div>

            <div class="pwd-row">
              <span style="font-size: 10px; color: #64748b; font-weight: 700;">PASS</span>
              <span class="pwd-val">••••••••••••••••</span>
              <div style="display: flex; gap: 6px; font-size: 11px;">
                <span>👁️</span><span>📋</span><span>👤</span>
              </div>
            </div>

            <div class="btn-gen">
              <div>
                <div class="btn-gen-title">⚡️ Generate Strong Password</div>
                <div class="btn-gen-sub">18 chars • High entropy • Zero memory leak</div>
              </div>
              <span style="color: #818cf8; font-weight: 800;">↗</span>
            </div>

            <div class="ai-shield">
              <div class="ai-header">
                <span style="color: #e2e8f0;">🧠 AI Threat Shield &amp; Domain Inspector</span>
                <span class="ai-badge">🟢 0% Risk • Safe</span>
              </div>
              <div class="ai-meta">
                <span>🔒 DigiCert EV TLS</span>
                <span>•</span>
                <span>🏢 GitHub, Inc. Verified Domain</span>
              </div>
            </div>

            <div class="btn-alias">
              <span style="display: flex; align-items: center; gap: 5px;">
                <span>🛡️</span><span>Generate Custom Alias for github.com</span>
              </span>
              <span style="color: #818cf8;">→</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <span class="spec-chip purple">⚡️ Non-Invasive DOM Injection</span>
        <span class="spec-chip">🛡️ On-Device Anti-Phishing Guard</span>
        <span class="spec-chip purple">🧩 Chrome Web Store</span>
      </div>
    </div>

  </main>

  <!-- Bottom Banner -->
  <footer class="footer-banner">
    <div class="eco-chips">
      <div class="eco-pill">
        <span></span><span>macOS Native Universal</span>
      </div>
      <div class="eco-pill">
        <span>🧩</span><span>Chrome Web Store (MV3)</span>
      </div>
      <div class="eco-pill">
        <span>⚡️</span><span>Raycast Command Suite</span>
      </div>
      <div class="eco-pill">
        <span>☁️</span><span>Zero-Knowledge iCloud Sync</span>
      </div>
    </div>

    <div class="cta-button">
      <div class="cta-left">
        <span class="cta-globe">🌐</span>
        <div class="cta-text-group">
          <span class="cta-sub">OFFICIAL WEBPAGE &amp; DOWNLOADS</span>
          <span class="cta-url">naetikarvind.github.io/kloak</span>
        </div>
      </div>
      <span class="cta-arrow">→</span>
    </div>
  </footer>

</body>
</html>
"""

output_path = '/Users/naetikarvind/.gemini/antigravity/scratch/kloak/scripts/linkedin-announcement.html'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"✅ Generated refined template HTML at: {output_path}")
