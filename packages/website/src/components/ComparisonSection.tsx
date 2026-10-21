import React, { useState } from 'react';
import { Check, X, Shield, Sparkles, Filter } from 'lucide-react';
import { KloakLogo } from './KloakLogo';

type FilterCategory = 'all' | 'cloud' | 'local';

interface ServiceCol {
  id: string;
  name: string;
  tagline: string;
  isKloak?: boolean;
}

interface FeatureRow {
  title: string;
  desc: string;
  category: 'architecture' | 'privacy' | 'workflow';
  values: Record<string, { status: boolean; text?: string; note?: string }>;
}

export const ComparisonSection: React.FC = () => {
  const [filter, setFilter] = useState<FilterCategory>('all');

  const allServices: ServiceCol[] = [
    { id: 'kloak', name: 'Kloak', tagline: 'Local-First Vault', isKloak: true },
    { id: '1password', name: '1Password', tagline: 'Commercial Cloud' },
    { id: 'bitwarden', name: 'Bitwarden', tagline: 'Cloud / Self-Host' },
    { id: 'apple', name: 'Apple Passwords', tagline: 'iCloud Keychain' },
    { id: 'keepassxc', name: 'KeePassXC', tagline: 'Local Database' },
    { id: 'dashlane', name: 'Dashlane', tagline: 'Web / Cloud' },
    { id: 'proton', name: 'Proton Pass', tagline: 'Swiss Cloud' },
    { id: 'lastpass', name: 'LastPass', tagline: 'Commercial Cloud' },
  ];

  const visibleServices = allServices.filter((s) => {
    if (s.isKloak) return true;
    if (filter === 'all') return true;
    if (filter === 'cloud') {
      return ['1password', 'bitwarden', 'dashlane', 'proton', 'lastpass'].includes(s.id);
    }
    if (filter === 'local') {
      return ['apple', 'keepassxc'].includes(s.id);
    }
    return true;
  });

  const features: FeatureRow[] = [
    {
      title: 'Vault Storage Location',
      desc: 'Where your encrypted credentials and master keys reside.',
      category: 'architecture',
      values: {
        kloak: { status: true, text: '100% Local Disk' },
        '1password': { status: false, text: 'Cloud (AWS)' },
        bitwarden: { status: false, text: 'Cloud (Azure)' },
        apple: { status: false, text: 'iCloud Servers' },
        keepassxc: { status: true, text: 'Local File (.kdbx)' },
        dashlane: { status: false, text: 'Cloud (AWS)' },
        proton: { status: false, text: 'Cloud (Switzerland)' },
        lastpass: { status: false, text: 'Cloud (AWS)' },
      },
    },
    {
      title: 'Zero Cloud Breach Exposure',
      desc: 'Immune to remote server compromises and cloud credential leaks.',
      category: 'architecture',
      values: {
        kloak: { status: true, text: 'Zero Cloud Risk' },
        '1password': { status: false, text: 'Cloud Target' },
        bitwarden: { status: false, text: 'Cloud Target' },
        apple: { status: false, text: 'iCloud Target' },
        keepassxc: { status: true, text: 'Zero Cloud Risk' },
        dashlane: { status: false, text: 'Cloud Target' },
        proton: { status: false, text: 'Cloud Target' },
        lastpass: { status: false, text: 'Repeated Breaches' },
      },
    },
    {
      title: 'Open Source & Auditable',
      desc: 'Transparent public source code without hidden backdoors.',
      category: 'architecture',
      values: {
        kloak: { status: true, text: 'MIT License' },
        '1password': { status: false, text: 'Proprietary' },
        bitwarden: { status: true, text: 'GPLv3' },
        apple: { status: false, text: 'Proprietary' },
        keepassxc: { status: true, text: 'GPLv3' },
        dashlane: { status: false, text: 'Proprietary' },
        proton: { status: true, text: 'GPLv3' },
        lastpass: { status: false, text: 'Proprietary' },
      },
    },
    {
      title: 'Annual Subscription Cost',
      desc: 'Cost for unlimited personal devices and full feature access.',
      category: 'privacy',
      values: {
        kloak: { status: true, text: '$0 / Free Forever' },
        '1password': { status: false, text: '$36 / year' },
        bitwarden: { status: true, text: 'Free / $10 yr' },
        apple: { status: true, text: '$0 (Apple only)' },
        keepassxc: { status: true, text: '$0 / Free Forever' },
        dashlane: { status: false, text: '$60 / year' },
        proton: { status: false, text: 'Free / $48 yr' },
        lastpass: { status: false, text: '$36 / year' },
      },
    },
    {
      title: 'Zero Open Network Ports',
      desc: 'Communicates via local Unix domain sockets without open HTTP/TCP ports.',
      category: 'architecture',
      values: {
        kloak: { status: true, text: '0 Open Ports' },
        '1password': { status: false, text: 'Local Helper' },
        bitwarden: { status: false, text: 'HTTP API' },
        apple: { status: true, text: 'System IPC' },
        keepassxc: { status: false, text: 'TCP / Sockets' },
        dashlane: { status: false, text: 'Web HTTP' },
        proton: { status: false, text: 'Cloud HTTP' },
        lastpass: { status: false, text: 'Web HTTP' },
      },
    },
    {
      title: 'Zero Telemetry & Third-Party Trackers',
      desc: 'Strictly no analytics, diagnostic beacons, or user tracking SDKs.',
      category: 'privacy',
      values: {
        kloak: { status: true, text: 'Zero Trackers' },
        '1password': { status: false, text: 'Mixpanel / Telemetry' },
        bitwarden: { status: false, text: 'Opt-Out' },
        apple: { status: false, text: 'Apple Analytics' },
        keepassxc: { status: true, text: 'Zero Trackers' },
        dashlane: { status: false, text: 'Segment / GA' },
        proton: { status: false, text: 'Opt-Out' },
        lastpass: { status: false, text: 'Adjust / GA' },
      },
    },
    {
      title: 'Native macOS Touch ID & Secure Enclave',
      desc: 'Hardware biometric key unwrapping via Apple Secure Enclave.',
      category: 'workflow',
      values: {
        kloak: { status: true, text: 'Touch ID & Watch' },
        '1password': { status: true, text: 'Touch ID' },
        bitwarden: { status: true, text: 'Touch ID' },
        apple: { status: true, text: 'Native' },
        keepassxc: { status: false, text: 'Plugin only' },
        dashlane: { status: false, text: 'WebAuthn' },
        proton: { status: true, text: 'Biometric PIN' },
        lastpass: { status: false, text: 'Browser only' },
      },
    },
    {
      title: 'Built-in TOTP 2FA Authenticator',
      desc: 'Time-based one-time passwords without extra subscription fees.',
      category: 'workflow',
      values: {
        kloak: { status: true, text: 'Included Free' },
        '1password': { status: true, text: 'Paid Tier' },
        bitwarden: { status: false, text: '$10/yr Premium' },
        apple: { status: true, text: 'Included' },
        keepassxc: { status: true, text: 'Included' },
        dashlane: { status: true, text: '$60/yr Tier' },
        proton: { status: false, text: 'Pass Plus ($48)' },
        lastpass: { status: true, text: '$36/yr Tier' },
      },
    },
    {
      title: 'Raycast Command Palette Extension',
      desc: 'Instant fuzzy vault search and token generation from Raycast.',
      category: 'workflow',
      values: {
        kloak: { status: true, text: 'Native Extension' },
        '1password': { status: true, text: 'Official' },
        bitwarden: { status: true, text: 'Community' },
        apple: { status: false, text: 'AppleScript' },
        keepassxc: { status: false, text: 'Community' },
        dashlane: { status: false, text: 'None' },
        proton: { status: false, text: 'None' },
        lastpass: { status: false, text: 'None' },
      },
    },
    {
      title: 'Universal 1-Click Migration',
      desc: 'Import from 1Password, Bitwarden, LastPass, KeePass, and Chrome.',
      category: 'workflow',
      values: {
        kloak: { status: true, text: 'Universal Importer' },
        '1password': { status: true, text: 'Supported' },
        bitwarden: { status: true, text: 'Supported' },
        apple: { status: false, text: 'CSV Only' },
        keepassxc: { status: true, text: 'Supported' },
        dashlane: { status: true, text: 'Supported' },
        proton: { status: true, text: 'Supported' },
        lastpass: { status: true, text: 'Supported' },
      },
    },
  ];

  return (
    <section id="compare" style={{ padding: '80px 0', position: 'relative' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div className="badge-pill" style={{ marginBottom: '14px' }}>
            <Shield size={14} color="#10b981" />
            <span>Comprehensive Evaluation</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px' }}>
            How Kloak Compares to 7 Other Managers
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '680px', margin: '0 auto' }}>
            Compare Kloak against the leading cloud and local password managers. Filter by ecosystem or view the complete landscape.
          </p>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '28px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: filter === 'all' ? '#3b82f6' : 'var(--border-subtle)',
              background: filter === 'all' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: filter === 'all' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            All 8 Services
          </button>

          <button
            onClick={() => setFilter('cloud')}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: filter === 'cloud' ? '#3b82f6' : 'var(--border-subtle)',
              background: filter === 'cloud' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: filter === 'cloud' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            vs. Cloud (1Password, Bitwarden, Dashlane, Proton, LastPass)
          </button>

          <button
            onClick={() => setFilter('local')}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: filter === 'local' ? '#3b82f6' : 'var(--border-subtle)',
              background: filter === 'local' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: filter === 'local' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            vs. Local &amp; OS (Apple Passwords, KeePassXC)
          </button>
        </div>

        {/* Table Container with Horizontal Scroll & Sticky First Column */}
        <div
          className="glass-panel"
          style={{
            overflowX: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '2px',
            position: 'relative',
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: filter === 'all' ? '1100px' : '780px',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13.5px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                {/* Sticky Header Column */}
                <th
                  style={{
                    padding: '20px 22px',
                    color: 'var(--text-main)',
                    fontWeight: 700,
                    width: '260px',
                    minWidth: '240px',
                    position: 'sticky',
                    left: 0,
                    background: 'rgba(12, 16, 29, 0.96)',
                    backdropFilter: 'blur(16px)',
                    zIndex: 2,
                    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  Feature &amp; Security Guarantee
                </th>

                {/* Service Columns */}
                {visibleServices.map((s) => {
                  const isKloak = s.isKloak;
                  return (
                    <th
                      key={s.id}
                      style={{
                        padding: '18px 14px',
                        textAlign: 'center',
                        background: isKloak ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                        borderRight: isKloak ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                        borderLeft: isKloak ? '1px solid rgba(59, 130, 246, 0.3)' : 'none',
                        minWidth: '130px',
                      }}
                    >
                      {isKloak ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <KloakLogo size={28} withGlow={true} />
                          <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '15px' }}>Kloak</span>
                          <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {s.tagline}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '14px' }}>{s.name}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>{s.tagline}</span>
                        </div>
                      )}
                    </th>
                  );
                })}
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
                  {/* Sticky First Column */}
                  <td
                    style={{
                      padding: '16px 22px',
                      position: 'sticky',
                      left: 0,
                      background: 'rgba(12, 16, 29, 0.96)',
                      backdropFilter: 'blur(16px)',
                      zIndex: 2,
                      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '2px', fontSize: '13.5px' }}>
                      {f.title}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      {f.desc}
                    </div>
                  </td>

                  {/* Service Values */}
                  {visibleServices.map((s) => {
                    const isKloak = s.isKloak;
                    const val = f.values[s.id] || { status: false, text: 'No' };
                    const isPositive = val.status;

                    return (
                      <td
                        key={s.id}
                        style={{
                          padding: '14px 12px',
                          textAlign: 'center',
                          background: isKloak ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          borderRight: isKloak ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.03)',
                          borderLeft: isKloak ? '1px solid rgba(59, 130, 246, 0.3)' : 'none',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          {isPositive ? (
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: isKloak ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Check size={14} color={isKloak ? '#10b981' : '#60a5fa'} strokeWidth={2.8} />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <X size={13} color="#f87171" strokeWidth={2.5} />
                            </div>
                          )}

                          {val.text && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: isKloak ? 700 : 500,
                                color: isKloak ? '#93c5fd' : 'var(--text-muted)',
                                lineHeight: 1.2,
                              }}
                            >
                              {val.text}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
