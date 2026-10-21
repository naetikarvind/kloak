import React from 'react';
import { Check, X, Shield, Sparkles } from 'lucide-react';
import { KloakLogo } from './KloakLogo';

export const ComparisonSection: React.FC = () => {
  const features = [
    {
      title: 'Zero-Cloud Architecture',
      desc: 'Vault payload is strictly stored on local hardware with zero remote replication.',
      kloak: true,
      onePass: false,
      bitwarden: false,
      lastpass: false,
    },
    {
      title: 'Free & Open Source ($0/year)',
      desc: 'No subscription fees, no user limits, no feature tiering.',
      kloak: true,
      onePass: false,
      bitwarden: true,
      lastpass: false,
    },
    {
      title: 'Zero Open Network Ports',
      desc: 'Communicates via local Unix domain sockets without binding to TCP localhost.',
      kloak: true,
      onePass: false,
      bitwarden: false,
      lastpass: false,
    },
    {
      title: 'Zero Telemetry & Analytics',
      desc: 'No crashlytics, segment tracking, mixpanel, or Google analytics.',
      kloak: true,
      onePass: false,
      bitwarden: false,
      lastpass: false,
    },
    {
      title: 'Native macOS Touch ID & Secure Enclave',
      desc: 'Hardware biometric key unwrapping using Apple Silicon Secure Enclave.',
      kloak: true,
      onePass: true,
      bitwarden: true,
      lastpass: false,
    },
    {
      title: 'Built-in TOTP 2FA Authenticator',
      desc: 'RFC 6238 time-based one-time password generation without extra subscription.',
      kloak: true,
      onePass: true,
      bitwarden: false,
      lastpass: false,
    },
    {
      title: 'Raycast Command Palette Extension',
      desc: 'Quick search, copy credentials, and generate tokens from Raycast.',
      kloak: true,
      onePass: true,
      bitwarden: true,
      lastpass: false,
    },
    {
      title: 'Universal 1-Click Import',
      desc: 'Seamlessly migrates from 1Password, Bitwarden, LastPass, KeePass, and Chrome.',
      kloak: true,
      onePass: true,
      bitwarden: true,
      lastpass: true,
    },
  ];

  return (
    <section id="compare" style={{ padding: '72px 0', position: 'relative' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="badge-pill" style={{ marginBottom: '14px' }}>
            <Shield size={14} color="#10b981" />
            <span>Honest Evaluation</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px' }}>
            How Kloak Compares to Cloud Vaults
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '640px', margin: '0 auto' }}>
            Why thousands of developers and privacy-conscious users are migrating away from cloud-dependent password managers.
          </p>
        </div>

        {/* Table Container */}
        <div
          className="glass-panel"
          style={{
            overflowX: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '4px',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '20px 24px', color: 'var(--text-main)', fontWeight: 700, width: '40%' }}>
                  Security &amp; Architectural Feature
                </th>
                <th
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: 'rgba(59, 130, 246, 0.12)',
                    borderRadius: '12px 12px 0 0',
                    width: '18%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <KloakLogo size={24} />
                    <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '15px' }}>Kloak</span>
                  </div>
                </th>
                <th style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: '14%' }}>
                  1Password
                </th>
                <th style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: '14%' }}>
                  Bitwarden
                </th>
                <th style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: '14%' }}>
                  LastPass
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i === features.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <td style={{ padding: '18px 24px' }}>
                    <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '2px' }}>{f.title}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>{f.desc}</div>
                  </td>

                  {/* Kloak Column */}
                  <td
                    style={{
                      padding: '18px 16px',
                      textAlign: 'center',
                      background: 'rgba(59, 130, 246, 0.08)',
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                      <Check size={16} color="#10b981" strokeWidth={3} />
                    </div>
                  </td>

                  {/* 1Password */}
                  <td style={{ padding: '18px 16px', textAlign: 'center' }}>
                    {f.onePass ? (
                      <Check size={18} color="#60a5fa" style={{ margin: '0 auto' }} />
                    ) : (
                      <X size={18} color="#64748b" style={{ margin: '0 auto' }} />
                    )}
                  </td>

                  {/* Bitwarden */}
                  <td style={{ padding: '18px 16px', textAlign: 'center' }}>
                    {f.bitwarden ? (
                      <Check size={18} color="#60a5fa" style={{ margin: '0 auto' }} />
                    ) : (
                      <X size={18} color="#64748b" style={{ margin: '0 auto' }} />
                    )}
                  </td>

                  {/* LastPass */}
                  <td style={{ padding: '18px 16px', textAlign: 'center' }}>
                    {f.lastpass ? (
                      <Check size={18} color="#60a5fa" style={{ margin: '0 auto' }} />
                    ) : (
                      <X size={18} color="#ef4444" style={{ margin: '0 auto' }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
