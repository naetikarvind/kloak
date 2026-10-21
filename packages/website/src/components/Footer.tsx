import React from 'react';
import { KloakLogo } from './KloakLogo';
import { ShieldCheck, Heart, Download } from 'lucide-react';
import { GithubIcon, ChromeIcon } from './Icons';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(5, 7, 13, 0.95)',
        padding: '64px 0 36px 0',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '40px',
            marginBottom: '48px',
          }}
        >
          {/* Brand Info */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <KloakLogo size={36} />
              <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Kloak
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '340px', lineHeight: 1.6, marginBottom: '20px' }}>
              The local-first password manager engineered with AES-256-GCM, Argon2id, and Apple Touch ID. Zero cloud storage. Total sovereignty.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a
                href="https://github.com/naetikarvind/kloak"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                  textDecoration: 'none',
                }}
              >
                <GithubIcon size={14} />
                <span>GitHub (MIT)</span>
              </a>

              <a
                href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#34d399',
                  fontSize: '12.5px',
                  textDecoration: 'none',
                }}
              >
                <ChromeIcon size={14} />
                <span>Chrome Store</span>
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
              Downloads
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
              <li>
                <a href="https://github.com/naetikarvind/kloak/releases/latest/download/Kloak-macOS.dmg" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  macOS App (.dmg)
                </a>
              </li>
              <li>
                <a href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Chrome Extension
                </a>
              </li>
              <li>
                <a href="https://github.com/naetikarvind/kloak/tree/main/packages/raycast-extension" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Raycast Extension
                </a>
              </li>
              <li>
                <a href="https://github.com/naetikarvind/kloak/releases/tag/v1.0.0" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  GitHub Releases v1.0.0
                </a>
              </li>
            </ul>
          </div>

          {/* Security & Legal */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
              Security &amp; Privacy
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
              <li>
                <a href="privacy.html" style={{ color: 'var(--emerald)', textDecoration: 'none', fontWeight: 600 }}>
                  Privacy Policy (Standalone)
                </a>
              </li>
              <li>
                <a href="#privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Data Handling Disclosures
                </a>
              </li>
              <li>
                <a href="#architecture" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  AES-256 Cryptography
                </a>
              </li>
              <li>
                <a href="https://github.com/naetikarvind/kloak/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  MIT License
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '13px',
            color: 'var(--text-dim)',
          }}
        >
          <div>
            © 2026 Kloak Password Manager. All rights reserved. 100% Local-First &amp; Zero-Knowledge.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Crafted for absolute privacy &amp; developer sovereignty.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
