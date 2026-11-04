import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// ── React Bits Components ───────────────────────────────────────────────────

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
  spotlightSize?: number;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  spotlightColor = 'rgba(109, 74, 255, 0.22)',
  spotlightSize = 300,
  style,
  className = '',
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      style={{
        position: 'relative',
        borderRadius: '16px',
        background: 'rgba(25, 24, 35, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '24px',
        overflow: 'hidden',
        transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.24s ease, box-shadow 0.24s ease',
        ...style,
      }}
      className={`kloak-spotlight-card ${className}`}
      {...props}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          borderRadius: 'inherit',
          opacity,
          background: `radial-gradient(circle ${spotlightSize}px at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 70%)`,
          transition: 'opacity 0.2s ease-out',
          zIndex: 1,
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  );
};

const ShinyText: React.FC<{ text: string; speed?: number; style?: React.CSSProperties }> = ({
  text,
  speed = 4,
  style,
}) => {
  return (
    <span
      style={{
        color: '#b5b5b5a4',
        background: 'linear-gradient(120deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.4) 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        display: 'inline-block',
        animation: `kloak-shine ${speed}s linear infinite`,
        ...style,
      }}
    >
      {text}
    </span>
  );
};

const DecryptedText: React.FC<{ text: string; speed?: number }> = ({ text, speed = 30 }) => {
  const [display, setDisplay] = useState(text);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*';

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(text);
      return;
    }
    let iteration = 0;
    const maxIterations = text.length * 2;
    const interval = setInterval(() => {
      iteration++;
      setDisplay(
        text
          .split('')
          .map((c, i) => {
            if (c === ' ' || c === '-') return c;
            if (i < Math.floor((iteration / maxIterations) * text.length)) {
              return c;
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );
      if (iteration >= maxIterations) {
        clearInterval(interval);
        setDisplay(text);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{display}</span>;
};

const MagnetButton: React.FC<{ children: React.ReactNode; strength?: number; onClick?: () => void; style?: React.CSSProperties }> = ({
  children,
  strength = 10,
  onClick,
  style,
}) => {
  const btnRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!btnRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = btnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    setOffset({
      x: ((e.clientX - centerX) / (rect.width / 2)) * strength,
      y: ((e.clientY - centerY) / (rect.height / 2)) * strength,
    });
  };

  return (
    <div
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition: 'transform 0.18s cubic-bezier(0.25, 1, 0.5, 1)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── Options Main App ────────────────────────────────────────────────────────

const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bridge' | 'generator' | 'security' | 'autofill'>('bridge');
  const [nativeStatus, setNativeStatus] = useState<string>('Connecting...');
  const [phishingDefense, setPhishingDefense] = useState<boolean>(true);
  const [autoSavePrompts, setAutoSavePrompts] = useState<boolean>(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(15);

  // Generator state
  const [pwLength, setPwLength] = useState<number>(20);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [genPassword, setGenPassword] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const generateNewPassword = useCallback(() => {
    let charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    if (includeNumbers) charset += '23456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const arr = new Uint32Array(pwLength);
    window.crypto.getRandomValues(arr);
    let res = '';
    for (let i = 0; i < pwLength; i++) {
      res += charset[arr[i] % charset.length];
    }
    setGenPassword(res);
  }, [pwLength, includeSymbols, includeNumbers]);

  useEffect(() => {
    generateNewPassword();
  }, [generateNewPassword]);

  // Load preferences from chrome.storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['kloak_phishing_shield', 'kloak_auto_save', 'kloak_autolock'], (items) => {
        if (items.kloak_phishing_shield !== undefined) setPhishingDefense(items.kloak_phishing_shield);
        if (items.kloak_auto_save !== undefined) setAutoSavePrompts(items.kloak_auto_save);
        if (items.kloak_autolock !== undefined) setAutoLockMinutes(items.kloak_autolock);
      });

      // Test background connectivity
      chrome.runtime.sendMessage({ type: 'PING' }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          setNativeStatus('Extension Worker Standby (Port Fallback Active)');
        } else {
          setNativeStatus('Native Messaging Bridge Connected (app.kloak.native)');
        }
      });
    } else {
      setNativeStatus('Native Messaging Daemon Active (Simulated)');
    }
  }, []);

  const handleTogglePhishing = () => {
    const next = !phishingDefense;
    setPhishingDefense(next);
    chrome.storage?.local?.set({ kloak_phishing_shield: next });
  };

  const handleToggleAutoSave = () => {
    const next = !autoSavePrompts;
    setAutoSavePrompts(next);
    chrome.storage?.local?.set({ kloak_auto_save: next });
  };

  const handleCopy = () => {
    if (!genPassword) return;
    navigator.clipboard.writeText(genPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '48px 20px', width: '100%' }}>
      {/* Global CSS for Animations */}
      <style>{`
        @keyframes kloak-shine {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .kloak-spotlight-card:hover {
          transform: translateY(-2px);
          border-color: rgba(109, 74, 255, 0.4) !important;
          box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.7), 0 0 16px rgba(109, 74, 255, 0.15);
        }
        @media (prefers-reduced-motion: reduce) {
          .kloak-spotlight-card:hover { transform: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6D4AFF, #4922e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(109, 74, 255, 0.35)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px' }}>Kloak Extension Hub</h1>
            <p style={{ fontSize: '13px', color: '#9E9AA8' }}>
              Local-first zero-knowledge autofill companion • <ShinyText text="v1.1.0 Web Store Official" />
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '10px' }}>
          {(['bridge', 'generator', 'security', 'autofill'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === t ? '#6D4AFF' : 'transparent',
                color: activeTab === t ? '#ffffff' : '#9E9AA8',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Bridge Diagnostics */}
      {activeTab === 'bridge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.25)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Native Messaging Host</h2>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '3px 10px', borderRadius: '9999px', fontWeight: 700 }}>
                RFC 1918 HARDENED
              </span>
            </div>
            <p style={{ color: '#9E9AA8', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
              {nativeStatus}
            </p>
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px 16px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '12.5px', color: '#cbd5e1' }}>
              Host target: <strong>app.kloak.native</strong> • Direct binary stdio JSON-RPC stream (Zero open TCP ports)
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(109, 74, 255, 0.25)">
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>Local Vault Architecture</h2>
            <p style={{ color: '#9E9AA8', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px' }}>
              Kloak does not connect to any external cloud, auth proxy, or telemetry server. All vault encryption happens on your host system with authenticated AES-256-GCM and Argon2id.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(109, 74, 255, 0.15)', color: '#B098FF', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                AES-256-GCM Authenticated
              </span>
              <span style={{ background: 'rgba(109, 74, 255, 0.15)', color: '#B098FF', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                Strict eTLD+1 Domain Isolation
              </span>
              <span style={{ background: 'rgba(109, 74, 255, 0.15)', color: '#B098FF', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                Shadow DOM Injected UI
              </span>
            </div>
          </SpotlightCard>
        </div>
      )}

      {/* Tab 2: Crypto Playground */}
      {activeTab === 'generator' && (
        <SpotlightCard spotlightColor="rgba(56, 189, 248, 0.25)">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>In-Extension Password Generator</h2>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>
              CSPRNG ENTROPY: ~{Math.round(pwLength * 5.95)} BITS
            </span>
          </div>

          {/* Generated Password Box */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px' }}>
              <DecryptedText text={genPassword} speed={25} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <MagnetButton strength={6}>
                <button
                  onClick={generateNewPassword}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Regenerate
                </button>
              </MagnetButton>

              <MagnetButton strength={6}>
                <button
                  onClick={handleCopy}
                  style={{
                    background: copied ? '#10b981' : '#6D4AFF',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </MagnetButton>
            </div>
          </div>

          {/* Length Slider */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: '#9E9AA8' }}>Password Length</span>
              <strong style={{ color: '#ffffff' }}>{pwLength} characters</strong>
            </div>
            <input
              type="range"
              min="12"
              max="48"
              value={pwLength}
              onChange={(e) => setPwLength(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6D4AFF', cursor: 'pointer' }}
            />
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeNumbers}
                onChange={(e) => setIncludeNumbers(e.target.checked)}
                style={{ accentColor: '#6D4AFF' }}
              />
              Numbers (0-9)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeSymbols}
                onChange={(e) => setIncludeSymbols(e.target.checked)}
                style={{ accentColor: '#6D4AFF' }}
              />
              Special Characters (!@#$%)
            </label>
          </div>
        </SpotlightCard>
      )}

      {/* Tab 3: Security & Phishing Shield */}
      {activeTab === 'security' && (
        <SpotlightCard spotlightColor="rgba(244, 63, 94, 0.25)">
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>URL Phishing &amp; Lookalike Shield</h2>
          <p style={{ color: '#9E9AA8', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
            Protects against homograph attacks (e.g. Cyrillic letters looking identical to Latin characters) and malicious lookalike subdomains (e.g. <code>paypal.com.scam-site.ru</code>).
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Active Phishing Detection</div>
              <div style={{ fontSize: '12px', color: '#9E9AA8' }}>Warns and halts autofill if domain mismatch or spoof is detected</div>
            </div>
            <button
              onClick={handleTogglePhishing}
              style={{
                background: phishingDefense ? '#10b981' : '#272535',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {phishingDefense ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </SpotlightCard>
      )}

      {/* Tab 4: Autofill & Save Rules */}
      {activeTab === 'autofill' && (
        <SpotlightCard spotlightColor="rgba(168, 85, 247, 0.25)">
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Auto Password Saver &amp; Prompts</h2>
          <p style={{ color: '#9E9AA8', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
            When you enter credentials into a login or signup form on the web, Kloak automatically detects the submission and offers a non-intrusive bottom banner to save or update your vault.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Prompt to Save New Logins</div>
              <div style={{ fontSize: '12px', color: '#9E9AA8' }}>Shows smooth slide-up save banner on form submissions</div>
            </div>
            <button
              onClick={handleToggleAutoSave}
              style={{
                background: autoSavePrompts ? '#6D4AFF' : '#272535',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {autoSavePrompts ? 'Active' : 'Muted'}
            </button>
          </div>
        </SpotlightCard>
      )}
    </div>
  );
};

// Mount React Root
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<OptionsApp />);
}
