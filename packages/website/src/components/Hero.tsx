import React, { useState, useEffect } from 'react';
import { Download, Shield, Key, Fingerprint, Lock, Check, Copy, ArrowRight, Sparkles } from 'lucide-react';
import { KloakLogo } from './KloakLogo';
import { ChromeIcon } from './Icons';

export const Hero: React.FC = () => {
  const [totpSeconds, setTotpSeconds] = useState(24);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTotpSeconds((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText('849204');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText('curl -fsSL https://kloak.app/install.sh | bash');
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <section style={{ paddingTop: '56px', paddingBottom: '72px', position: 'relative', overflow: 'hidden' }}>
      <div className="container" style={{ textAlign: 'center' }}>
        {/* Release Pill Badge */}
        <div style={{ display: 'inline-flex', marginBottom: '24px' }}>
          <div className="badge-pill">
            <span className="badge-dot" />
            <span style={{ color: '#ffffff', fontWeight: 700 }}>v1.0.0 Live</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span>macOS Universal (.dmg) &amp; Chrome Web Store</span>
            <Sparkles size={14} color="#f59e0b" />
          </div>
        </div>

        {/* Master Headline */}
        <h1
          style={{
            fontSize: 'clamp(38px, 6vw, 68px)',
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-2px',
            marginBottom: '20px',
            maxWidth: '960px',
            margin: '0 auto 20px auto',
          }}
        >
          Your Secrets. <br />
          <span className="text-gradient">Zero Servers. </span>
          <span className="text-gradient-cyan">Total Kloak.</span>
        </h1>

        {/* Subheading */}
        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 20px)',
            color: 'var(--text-muted)',
            maxWidth: '720px',
            margin: '0 auto 36px auto',
            lineHeight: 1.6,
          }}
        >
          The local-first password manager engineered with authenticated{' '}
          <strong style={{ color: '#ffffff' }}>AES-256-GCM</strong>,{' '}
          <strong style={{ color: '#ffffff' }}>Argon2id</strong> key derivation, and{' '}
          <strong style={{ color: '#ffffff' }}>Touch ID</strong> biometrics.
          Zero cloud data breaches. Zero trackers. 100% sovereign.
        </p>

        {/* Dual Primary CTA Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          <a
            href="https://github.com/naetikarvind/kloak/releases/latest/download/Kloak-macOS.dmg"
            className="btn-primary"
            style={{ padding: '15px 30px', fontSize: '16px' }}
          >
            <Download size={20} />
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div>Download for macOS</div>
              <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>
                Universal Binary • Apple Silicon &amp; Intel • v1.0.0
              </div>
            </div>
          </a>

          <a
            href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-chrome"
            style={{ padding: '15px 30px', fontSize: '16px' }}
          >
            <ChromeIcon size={20} />
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div>Add to Chrome</div>
              <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 500 }}>
                Chrome Web Store • 1-Click Install
              </div>
            </div>
          </a>
        </div>

        {/* Trust Points */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            fontSize: '13.5px',
            color: 'var(--text-dim)',
            marginBottom: '48px',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} color="#10b981" /> No credit card required
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} color="#10b981" /> $0 Forever Open Source
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} color="#10b981" /> Works 100% Offline
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} color="#10b981" /> Auto-Updater Included
          </span>
        </div>

        {/* Hero Interactive App Mockup */}
        <div
          style={{
            position: 'relative',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          {/* Backlight Ambient Glow */}
          <div
            style={{
              position: 'absolute',
              top: '-20px',
              left: '15%',
              right: '15%',
              height: '240px',
              background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 75%)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Window Container */}
          <div
            className="glass-panel"
            style={{
              position: 'relative',
              zIndex: 1,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 30px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              overflow: 'hidden',
              textAlign: 'left',
            }}
          >
            {/* macOS Title Bar */}
            <div
              style={{
                height: '44px',
                background: 'rgba(10, 14, 26, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                <KloakLogo size={18} />
                <span>Kloak — Primary Vault</span>
                <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 7px', borderRadius: '4px' }}>
                  UNLOCKED
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-dim)' }}>
                <Fingerprint size={14} color="#38bdf8" />
                <span>Touch ID Active</span>
              </div>
            </div>

            {/* App Body Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 300px 1fr',
                minHeight: '380px',
                background: 'rgba(9, 13, 23, 0.88)',
              }}
              className="hero-app-grid"
            >
              {/* Sidebar */}
              <div
                style={{
                  borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: 'rgba(6, 9, 17, 0.5)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', padding: '0 10px 6px', letterSpacing: '0.6px' }}>
                  Vault Categories
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#ffffff', fontWeight: 600, fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={14} color="#60a5fa" /> All Items
                  </span>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '10px' }}>42</span>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={14} color="#94a3b8" /> Logins
                  </span>
                  <span style={{ fontSize: '11px' }}>28</span>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={14} color="#10b981" /> 2FA Authenticator
                  </span>
                  <span style={{ fontSize: '11px' }}>14</span>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Fingerprint size={14} color="#c084fc" /> Passkeys
                  </span>
                  <span style={{ fontSize: '11px' }}>5</span>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    AES-256-GCM Encrypted
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div
                style={{
                  borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                  🔍 Search vault items...
                </div>

                {/* Selected Item */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#24292e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: '12px', fontWeight: 800 }}>GH</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>GitHub Enterprise</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>naetik@kloak.app</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    <span>TOTP Enabled</span> • <span>Passkey Available</span>
                  </div>
                </div>

                {/* Unselected Items */}
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#4285f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800 }}>G</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>Google Workspace</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>admin@kloak.app</div>
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ff9900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800 }}>AWS</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>AWS Root Account</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>security-prod</div>
                  </div>
                </div>
              </div>

              {/* Item Detail Panel */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#24292e', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>GH</span>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700 }}>GitHub Enterprise</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>github.com • Modified 2 hours ago</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    Auto-Fill Ready
                  </span>
                </div>

                {/* Password Box */}
                <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Password
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ fontSize: '15px', letterSpacing: '2px', color: '#93c5fd' }}>••••••••••••••••••••</span>
                    <button
                      onClick={handleCopyCode}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {copiedCode ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Live TOTP Countdown Box */}
                <div style={{ padding: '14px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.05))', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2FA TOTP Code
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      Expires in {totpSeconds}s
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '4px', color: '#ffffff' }}>
                      849 204
                    </div>
                    {/* Visual Progress Dial */}
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `conic-gradient(#3b82f6 ${(totpSeconds / 30) * 360}deg, rgba(255,255,255,0.1) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#090d17', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#93c5fd' }}>
                        {totpSeconds}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Native Messaging Bridge Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-dim)', marginTop: 'auto' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  <span>Native Messaging Bridge connected to Chrome extension</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .hero-app-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};
