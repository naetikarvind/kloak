import React, { useState } from 'react';
import { Download, Terminal, Sparkles, ExternalLink, Check, ShieldAlert, Cpu } from 'lucide-react';
import { KloakLogo } from './KloakLogo';
import { ChromeIcon, AppleIcon } from './Icons';

export const DownloadsSection: React.FC = () => {
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
            alignItems: 'stretch',
            marginBottom: '40px',
          }}
        >
          {/* 1. macOS DMG Card */}
          <div
            className="glass-panel download-card"
            style={{
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(15, 22, 38, 0.75) 100%)',
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

            <div className="download-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
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
                    flexShrink: 0,
                  }}
                >
                  <AppleIcon size={28} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Kloak for macOS</h3>
                  <p style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 600 }}>v1.0.0 Universal DMG (4.9 MB)</p>
                </div>
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5, minHeight: '42px' }}>
                Native desktop application built with SwiftUI, Apple Touch ID hardware biometric unlock, and integrated auto-updater.
              </p>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-main)', marginBottom: '16px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Apple Silicon (M1–M4) &amp; Intel Universal Binary</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>macOS 14+ Sonoma &amp; macOS 15+ Sequoia</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>In-App Auto-Updater via GitHub Releases</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Zero-Knowledge iCloud Multi-Device Sync</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Touch ID &amp; Apple Watch Biometrics</span>
                </li>
              </ul>
            </div>

            {/* Pinned Footer */}
            <div className="download-card-footer">
              <a
                href="https://github.com/naetikarvind/kloak/releases/latest/download/Kloak-macOS.dmg"
                className="download-card-btn download-btn-mac"
              >
                <Download size={18} />
                <span>Download for macOS</span>
              </a>

              <a
                href="https://github.com/naetikarvind/kloak/releases/tag/v1.0.0"
                target="_blank"
                rel="noopener noreferrer"
                className="download-card-sublink"
              >
                <span>Release Notes &amp; Checksums</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* 2. Chrome Web Store Card */}
          <div
            className="glass-panel download-card"
            style={{
              border: '1px solid rgba(16, 185, 129, 0.3)',
              background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 22, 38, 0.75) 100%)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div className="download-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
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
                    flexShrink: 0,
                  }}
                >
                  <ChromeIcon size={28} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Chrome Extension</h3>
                  <p style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>v1.1.0 Web Store Official</p>
                </div>
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5, minHeight: '42px' }}>
                Seamless autofill companion for Chrome, Brave, Arc, and Edge. Communicates directly with your local vault via Native Messaging.
              </p>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-main)', marginBottom: '16px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>1-Click Install from Chrome Web Store</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Google Manifest V3 Security Compliant</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Intelligent Local Favicons &amp; URL Shield</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Zero Open Ports (Native Messaging Socket)</span>
                </li>
              </ul>
            </div>

            {/* Pinned Footer */}
            <div className="download-card-footer">
              <a
                href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
                target="_blank"
                rel="noopener noreferrer"
                className="download-card-btn download-btn-chrome"
              >
                <ChromeIcon size={18} />
                <span>Add to Chrome</span>
              </a>

              <a
                href="https://github.com/naetikarvind/kloak/releases/latest/download/kloak-browser-extension-v1.1.0.zip"
                className="download-card-sublink"
              >
                <span>Or download .zip package</span>
                <Download size={12} />
              </a>
            </div>
          </div>

          {/* 3. Raycast & CLI Card */}
          <div
            className="glass-panel download-card"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 22, 38, 0.75) 100%)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div className="download-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
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
                    flexShrink: 0,
                  }}
                >
                  <Terminal size={26} color="#a855f7" />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Raycast &amp; CLI</h3>
                  <p style={{ fontSize: '13px', color: '#c084fc', fontWeight: 600 }}>Command Palette &amp; Terminal</p>
                </div>
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5, minHeight: '42px' }}>
                Access and search your passwords in a fraction of a second right from Raycast or your favorite terminal shell.
              </p>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-main)', marginBottom: '16px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Instant Raycast fuzzy vault search</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Scriptable CLI for automation: npm i -g @kloak/cli</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Cross-platform JSON-RPC background daemon</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>Zero cloud relays or external dependencies</span>
                </li>
              </ul>
            </div>

            {/* Pinned Footer */}
            <div className="download-card-footer">
              <a
                href="https://github.com/naetikarvind/kloak/tree/main/packages/raycast-extension"
                target="_blank"
                rel="noopener noreferrer"
                className="download-card-btn download-btn-raycast"
              >
                <ExternalLink size={17} />
                <span>View on Raycast</span>
              </a>

              <a
                href="https://github.com/naetikarvind/kloak"
                target="_blank"
                rel="noopener noreferrer"
                className="download-card-sublink"
              >
                <span>Or install via npm: @kloak/cli</span>
                <Terminal size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .download-card {
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
          padding: 32px !important;
          box-sizing: border-box !important;
        }
        .download-card-body {
          flex: 1 1 auto !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .download-card-footer {
          margin-top: auto !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
          padding-top: 24px !important;
          border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
        }

        /* Perfectly matched 48px buttons across all three cards */
        .download-card-btn {
          width: 100% !important;
          height: 48px !important;
          min-height: 48px !important;
          max-height: 48px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          border-radius: 12px !important;
          white-space: nowrap !important;
          line-height: 1 !important;
          text-decoration: none !important;
          box-sizing: border-box !important;
          cursor: pointer !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .download-btn-mac {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.18) !important;
          box-shadow: 0 4px 18px rgba(59, 130, 246, 0.35) !important;
        }
        .download-btn-mac:hover {
          transform: translateY(-2px) !important;
          background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%) !important;
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.5) !important;
        }

        .download-btn-chrome {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.18) !important;
          box-shadow: 0 4px 18px rgba(16, 185, 129, 0.35) !important;
        }
        .download-btn-chrome:hover {
          transform: translateY(-2px) !important;
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%) !important;
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.5) !important;
        }

        .download-btn-raycast {
          background: rgba(255, 255, 255, 0.06) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
        }
        .download-btn-raycast:hover {
          transform: translateY(-2px) !important;
          background: rgba(255, 255, 255, 0.12) !important;
          border-color: rgba(255, 255, 255, 0.25) !important;
        }

        .download-card-sublink {
          height: 24px !important;
          min-height: 24px !important;
          max-height: 24px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          font-size: 12.5px !important;
          color: var(--text-dim) !important;
          text-decoration: none !important;
          white-space: nowrap !important;
          line-height: 1 !important;
          transition: color 0.2s !important;
        }
        .download-card-sublink:hover {
          color: var(--text-muted) !important;
          text-decoration: underline !important;
        }
      `}</style>
    </section>
  );
};
