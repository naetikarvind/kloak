import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the browser extension talk to the desktop app without open ports?',
      a: 'Kloak utilizes the Chromium Native Messaging protocol. The browser launches a local native bridge process which connects directly to the Kloak daemon via a local Unix Domain Socket (~/.kloak/kloak.sock on macOS) or Named Pipe (\\\\.\\pipe\\kloak on Windows). Because no TCP/HTTP port is opened on localhost, malicious scripts in other browser tabs cannot scan or attack your vault via RFC 1918 cross-origin requests.',
    },
    {
      q: 'How does the in-app auto-updater work?',
      a: 'The macOS app includes a native background updater service (UpdaterService.swift) that checks official GitHub Releases for updates. When a new version is tagged, it downloads the signed Kloak-macOS.dmg directly from GitHub Releases and provides an in-app prompt to open the installer, keeping your software always up to date without any proprietary telemetry servers.',
    },
    {
      q: 'Can I import my existing vault from 1Password, Bitwarden, or Chrome?',
      a: 'Yes! Kloak features a 1-click universal importer supporting 1Password (.1pux, .1pif, CSV), Bitwarden (JSON, CSV), LastPass (CSV), KeePass (XML), Apple Passwords (CSV), and Google Chrome (CSV). Your folders, tags, and TOTP secrets are seamlessly preserved and encrypted locally.',
    },
    {
      q: 'What happens if I forget my master password?',
      a: 'Because Kloak is strictly zero-knowledge, there are no remote servers, backdoors, or recovery emails. If you have Touch ID enabled on macOS, you can unlock the vault using your biometric fingerprint and export or change your master password from within the app settings.',
    },
    {
      q: 'Can I synchronize my vault between multiple devices?',
      a: 'Kloak stores its encrypted vault at ~/.kloak/vault.kloak. You can synchronize this encrypted file using any private mechanism of your choice — such as Syncthing, iCloud Drive, Git, or an encrypted USB drive. Because the file is encrypted with AES-256-GCM before write, it is completely secure even on shared storage.',
    },
    {
      q: 'Why is Kloak free and open source?',
      a: 'We believe security software should never be locked behind recurring SaaS paywalls or opaque proprietary binaries. Kloak is licensed under the MIT License and completely open source on GitHub. You are free to inspect, audit, build from source, and run Kloak forever without fees.',
    },
  ];

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" style={{ padding: '72px 0', position: 'relative' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="badge-pill" style={{ marginBottom: '14px' }}>
            <HelpCircle size={14} color="#38bdf8" />
            <span>Got Questions?</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px' }}>
            Frequently Asked Questions
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
            Everything you need to know about Kloak architecture, security, and usage.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {faqs.map((f, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={i}
                className="glass-panel"
                style={{
                  border: isOpen ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                <button
                  onClick={() => toggle(i)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '16px',
                    fontWeight: 700,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>{f.q}</span>
                  <ChevronDown
                    size={20}
                    color={isOpen ? '#38bdf8' : 'var(--text-dim)'}
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.25s ease',
                      flexShrink: 0,
                    }}
                  />
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 24px 22px 24px',
                      color: 'var(--text-muted)',
                      fontSize: '14.5px',
                      lineHeight: 1.65,
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      paddingTop: '16px',
                    }}
                  >
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
