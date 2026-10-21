import React, { useState } from 'react';
import { Shield, Cpu, Lock, Terminal, RefreshCw, EyeOff, CheckCircle2, Cloud } from 'lucide-react';

export const ArchitectureSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const pillars = [
    {
      icon: Lock,
      title: 'Local AES-256-GCM & Argon2id',
      badge: 'Zero Cloud Storage',
      summary: 'Your master password never leaves your hardware.',
      details: [
        'Argon2id key derivation with 64 MB memory cost, 4 iterations, and 4 parallel threads.',
        'Authenticated AES-256-GCM symmetric cipher with a fresh 96-bit cryptographic nonce per write.',
        'Payload stored entirely on local disk in ~/.kloak/vault.kloak with strict 0600 file permissions.',
        'Zero cloud sync servers, zero databases in AWS/GCP, zero remote attack vectors.',
      ],
      code: `// Vault Key Derivation & Encryption Pipeline
const masterKey = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 4,
  parallelism: 4,
  raw: true
});

const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
const ciphertext = Buffer.concat([cipher.update(vaultJson), cipher.final()]);
const authTag = cipher.getAuthTag();`,
    },
    {
      icon: Terminal,
      title: 'Native Domain Socket IPC Bridge',
      badge: 'Zero Open HTTP Ports',
      summary: 'Extension and Desktop app communicate through local Unix Domain Sockets.',
      details: [
        'Browser extension uses standard Chromium Native Messaging Protocol.',
        'Direct connection to ~/.kloak/kloak.sock (macOS/Linux) or \\\\.\\pipe\\kloak (Windows).',
        'Zero open TCP/HTTP ports — immune to malicious websites attempting localhost port scans (RFC 1918).',
        'Sub-8ms end-to-end latency for instant credential filling.',
      ],
      code: `// Chromium Native Messaging -> Unix Domain Socket
const socket = net.connect(process.platform === 'win32'
  ? '\\\\\\\\.\\\\pipe\\\\kloak'
  : path.join(os.homedir(), '.kloak', 'kloak.sock')
);

// Binary JSON-RPC exchange over authenticated local stream
socket.write(serializeRpcRequest('vault.matchByUrl', { url }));`,
    },
    {
      icon: Cpu,
      title: 'Touch ID & Apple Secure Enclave',
      badge: 'Hardware Biometrics',
      summary: 'Unlock your vault in 100 milliseconds with your fingerprint.',
      details: [
        'Integrates directly with Apple LocalAuthentication and Secure Enclave coprocessor.',
        'Master key is securely sealed into the macOS Keychain with kSecAccessControlBiometryAny.',
        'Supports Touch ID on MacBook keyboards, Apple Magic Keyboard, and Apple Watch confirmation.',
        'Automatic vault lock when display sleeps, screensaver activates, or system idles.',
      ],
      code: `// SwiftUI Secure Enclave Integration
let context = LAContext()
context.localizedReason = "Unlock Kloak Master Vault"

let (success, _) = try await context.evaluatePolicy(
    .deviceOwnerAuthenticationWithBiometrics,
    localizedReason: context.localizedReason
)
if success {
    self.unlockVaultWithEnclaveKey()
}`,
    },
    {
      icon: RefreshCw,
      title: 'Direct GitHub Releases Auto-Updater',
      badge: 'Cryptographically Verified',
      summary: 'Autonomous in-app updater that queries official GitHub releases directly.',
      details: [
        'Directly checks https://api.github.com/repos/naetikarvind/kloak/releases/latest.',
        'Downloads the signed Kloak-macOS.dmg package in the background with live progress.',
        'Prompts user to install with one click, preserving full offline sovereignty.',
        'Zero third-party telemetry, zero Sparkle telemetry servers.',
      ],
      code: `// Native Updater Service
let release = try await GitHubReleases.fetchLatest(repo: "naetikarvind/kloak")
if release.isNewer(than: currentVersion) {
    self.downloadTask = URLSession.shared.downloadTask(with: release.dmgAsset.url)
    self.state = .readyToInstall(localDmgUrl)
}`,
    },
    {
      icon: Cloud,
      title: 'Zero-Knowledge iCloud Multi-Device Sync',
      badge: 'Private iCloud Storage',
      summary: 'Keep your vault synchronized across all your Macs and Apple devices with zero server trust.',
      details: [
        'Local Argon2id + AES-256-GCM encryption occurs on your hardware before bytes touch iCloud Drive.',
        'Apple and iCloud only store encrypted ciphertext blobs — zero metadata or plaintexts revealed.',
        'Uses macOS Mobile Documents DispatchSource notification triggers for instant cross-device updates.',
        'Transparent atomic symlinks preserve local daemon and browser extension IPC without configuration.',
      ],
      code: `// Zero-Knowledge iCloud Sync Pipeline
// 1. Vault encrypted on device with Argon2id + AES-256-GCM
const ciphertext = encryptVaultPayload(vaultData, masterKey);

// 2. Synced through private iCloud Drive container
await fs.promises.writeFile(
  path.join(home, 'Library/Mobile Documents/com~apple~CloudDocs/Kloak/vault.kloak'),
  ciphertext
);

// 3. DispatchSource monitors file change events across Macs`,
    },
  ];

  const current = pillars[activeTab];
  const Icon = current.icon;

  return (
    <section id="architecture" style={{ padding: '72px 0', position: 'relative' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="badge-pill" style={{ marginBottom: '14px' }}>
            <Cpu size={14} color="#a855f7" />
            <span>Under The Hood</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px' }}>
            Engineered for Absolute Sovereignty
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '640px', margin: '0 auto' }}>
            Examine the exact cryptographic mechanisms that ensure your passwords never touch any server.
          </p>
        </div>

        {/* Tab Selector Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'center',
            marginBottom: '32px',
          }}
        >
          {pillars.map((p, idx) => {
            const PIcon = p.icon;
            const isSel = idx === activeTab;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: isSel ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
                  background: isSel ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSel ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <PIcon size={16} color={isSel ? '#60a5fa' : '#94a3b8'} />
                <span>{p.title}</span>
              </button>
            );
          })}
        </div>

        {/* Pillar Detail Box */}
        <div
          className="glass-panel architecture-grid"
          style={{
            padding: '36px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '36px',
            alignItems: 'center',
          }}
        >
          {/* Left Column: Details */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>
              <Icon size={14} />
              {current.badge}
            </div>

            <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
              {current.title}
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '20px' }}>
              {current.summary}
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {current.details.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Code Snippet */}
          <div
            style={{
              background: 'rgba(5, 7, 13, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '20px',
              overflow: 'hidden',
              fontFamily: 'var(--font-mono)',
              fontSize: '12.5px',
              lineHeight: 1.6,
              color: '#cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '6px' }}>architecture-spec.ts</span>
            </div>

            <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              <code>{current.code}</code>
            </pre>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .architecture-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};
