import React, { useState } from 'react';
import { Download, Terminal, Sparkles, ExternalLink, Check, ShieldAlert, Cpu } from 'lucide-react';
import { KloakLogo } from './KloakLogo';
import { ChromeIcon, AppleIcon } from './Icons';

export const DownloadsSection: React.FC = () => {
  const [copiedCli, setCopiedCli] = useState(false);

  const handleCopyCli = () => {
    navigator.clipboard.writeText('npm install -g @kloak/cli');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <section id="downloads" style={{ padding: '80px 0', position: 'relative' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="badge-pill" style={{ marginBottom: '14px' }}>
            <Download size={14} color="#3b82f6" />
            <span>Universal Downloads</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px' }}>
            Get Started with Kloak Today
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '640px', margin: '0 auto' }}>
            Choose your platform below. Everything is 100% free, open source, and self-contained.
          </p>
        </div>

        {/* Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            marginBottom: '40px',
          }}
        >
          {/* macOS DMG Card */}
          <div
            className="glass-panel"
            style={{
              padding: '36px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(15, 22, 38, 0.75) 100%)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top Recommended Tag */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: '9999px',
                letterSpacing: '0.6px',
              }}
            >
              Recommended
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <AppleIcon size={28} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Kloak for macOS</h3>
                <p style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 600 }}>v1.0.0 Universal DMG (4.9 MB)</p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Native desktop application built with SwiftUI, Apple Touch ID hardware biometric unlock, and integrated auto-updater.
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px', fontSize: '13px', color: 'var(--text-main)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Apple Silicon (M1/M2/M3/M4) &amp; Intel Universal Binary
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                macOS 14+ Sonoma &amp; macOS 15+ Sequoia
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                In-App Auto-Updater via GitHub Releases
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Touch ID &amp; Apple Watch Biometrics
              </li>
            </ul>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://github.com/naetikarvind/kloak/releases/latest/download/Kloak-macOS.dmg"
                className="btn-primary"
                style={{ width: '100%' }}
              >
                <Download size={18} />
                <span>Download Kloak-macOS.dmg</span>
              </a>

              <a
                href="https://github.com/naetikarvind/kloak/releases/tag/v1.0.0"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: 'var(--text-dim)',
                  textDecoration: 'none',
                  padding: '6px',
                }}
              >
                <span>Release Notes &amp; Checksums</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Chrome Web Store Card */}
          <div
            className="glass-panel"
            style={{
              padding: '36px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 22, 38, 0.75) 100%)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <ChromeIcon size={28} color="#10b981" />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Chrome Extension</h3>
                <p style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>v1.1.0 Web Store Official</p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Seamless autofill companion for Chrome, Brave, Arc, and Edge. Communicates directly with your local vault via Native Messaging.
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px', fontSize: '13px', color: 'var(--text-main)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                1-Click Install from Chrome Web Store
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Google Manifest V3 Compliant
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Intelligent Local Favicons &amp; URL Shield
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Zero Open Ports (Native Messaging Socket)
              </li>
            </ul>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-chrome"
                style={{ width: '100%' }}
              >
                <ChromeIcon size={18} />
                <span>Add to Chrome</span>
              </a>

              <a
                href="https://github.com/naetikarvind/kloak/releases/latest/download/kloak-browser-extension-v1.1.0.zip"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: 'var(--text-dim)',
                  textDecoration: 'none',
                  padding: '6px',
                }}
              >
                <span>Or download .zip for manual install</span>
                <Download size={12} />
              </a>
            </div>
          </div>

          {/* Raycast & CLI Card */}
          <div
            className="glass-panel"
            style={{
              padding: '36px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(139, 92, 246, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                }}
              >
                <Terminal size={26} color="#a855f7" />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Raycast &amp; CLI</h3>
                <p style={{ fontSize: '13px', color: '#c084fc', fontWeight: 600 }}>Command Palette &amp; Terminal</p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Access and search your passwords in a fraction of a second right from Raycast or your favorite terminal.
            </p>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '12.5px',
              }}
            >
              <span style={{ color: '#93c5fd' }}>$ npm i -g @kloak/cli</span>
              <button
                onClick={handleCopyCli}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                title="Copy command"
              >
                {copiedCli ? <Check size={14} color="#10b981" /> : <Terminal size={14} />}
              </button>
            </div>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px', fontSize: '13px', color: 'var(--text-main)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Instant Raycast fuzzy search
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Scriptable CLI for automation
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#10b981" />
                Cross-platform JSON-RPC daemon
              </li>
            </ul>

            <div style={{ marginTop: 'auto' }}>
              <a
                href="https://github.com/naetikarvind/kloak/tree/main/packages/raycast-extension"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ width: '100%' }}
              >
                <span>View Raycast Extension</span>
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
