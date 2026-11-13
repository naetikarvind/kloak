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

type OptionsTab = 'autofill' | 'security' | 'generator' | 'connection';

const TABS: { id: OptionsTab; label: string; icon: string; subtitle: string }[] = [
  { id: 'autofill', label: 'Autofill & Browser', icon: '⚡', subtitle: 'Manage in-page autofill, save prompts, and phishing defense' },
  { id: 'security', label: 'Vault & Security', icon: '🛡️', subtitle: 'Auto-lock timers, hardware security keys, and local encryption' },
  { id: 'generator', label: 'Password Generator', icon: '🔑', subtitle: 'Default password rules, entropy strength, and live test' },
  { id: 'connection', label: 'Desktop Connection', icon: '🔌', subtitle: 'Status of local communication with the Kloak desktop application' },
];

const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OptionsTab>('autofill');
  const [nativeStatus, setNativeStatus] = useState<string>('Checking connection...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [phishingDefense, setPhishingDefense] = useState<boolean>(true);
  const [autoSavePrompts, setAutoSavePrompts] = useState<boolean>(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(15);
  const [bentoAutofill, setBentoAutofill] = useState<boolean>(true);
  const [totpAutofill, setTotpAutofill] = useState<boolean>(true);
  const [hardwareKeyRegistered, setHardwareKeyRegistered] = useState<boolean>(false);

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
      chrome.storage.local.get([
        'kloak_phishing_shield',
        'kloak_auto_save',
        'kloak_autolock',
        'kloak_bento_autofill',
        'kloak_totp_autofill',
        'kloak_hardware_key',
      ], (items) => {
        if (items.kloak_phishing_shield !== undefined) setPhishingDefense(items.kloak_phishing_shield);
        if (items.kloak_auto_save !== undefined) setAutoSavePrompts(items.kloak_auto_save);
        if (items.kloak_autolock !== undefined) setAutoLockMinutes(items.kloak_autolock);
        if (items.kloak_bento_autofill !== undefined) setBentoAutofill(items.kloak_bento_autofill);
        if (items.kloak_totp_autofill !== undefined) setTotpAutofill(items.kloak_totp_autofill);
        if (items.kloak_hardware_key) setHardwareKeyRegistered(true);
      });

      // Test background connectivity
      chrome.runtime.sendMessage({ type: 'PING' }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          setNativeStatus('Kloak Desktop Standby (Make sure Kloak App is running)');
          setIsConnected(false);
        } else {
          setNativeStatus('Connected to Kloak Desktop App (Local IPC active)');
          setIsConnected(true);
        }
      });
    } else {
      setNativeStatus('Running in standalone mode');
      setIsConnected(true);
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

  const handleToggleBento = () => {
    const next = !bentoAutofill;
    setBentoAutofill(next);
    chrome.storage?.local?.set({ kloak_bento_autofill: next });
  };

  const handleToggleTotp = () => {
    const next = !totpAutofill;
    setTotpAutofill(next);
    chrome.storage?.local?.set({ kloak_totp_autofill: next });
  };

  const handleAutoLockChange = (mins: number) => {
    setAutoLockMinutes(mins);
    chrome.storage?.local?.set({ kloak_autolock: mins });
  };

  const handleCopy = () => {
    if (!genPassword) return;
    navigator.clipboard.writeText(genPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTabObj = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px', width: '100%' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
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
            <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>Kloak Extension Settings</h1>
            <p style={{ fontSize: '13px', color: '#9E9AA8' }}>
              Organized preferences for autofill, security, and passwords • <ShinyText text="v1.1.0" />
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          color: isConnected ? '#34d399' : '#fbbf24',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#10b981' : '#f59e0b',
            boxShadow: `0 0 8px ${isConnected ? '#10b981' : '#f59e0b'}`,
          }} />
          {isConnected ? 'Kloak App Connected' : 'App Standby'}
        </div>
      </div>

      {/* Categorized Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '6px',
        background: 'rgba(255, 255, 255, 0.04)',
        padding: '5px',
        borderRadius: '12px',
        marginBottom: '28px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === t.id ? '#6D4AFF' : 'transparent',
              color: activeTab === t.id ? '#ffffff' : '#9E9AA8',
              fontSize: '13px',
              fontWeight: activeTab === t.id ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Category Subtitle */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
          {currentTabObj.label}
        </h2>
        <p style={{ fontSize: '13px', color: '#9E9AA8' }}>
          {currentTabObj.subtitle}
        </p>
      </div>

      {/* Tab 1: Autofill & Browser */}
      {activeTab === 'autofill' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SpotlightCard spotlightColor="rgba(109, 74, 255, 0.2)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '4px' }}>Japanese Bento Autofill Popup</div>
                <div style={{ fontSize: '12.5px', color: '#9E9AA8', maxWidth: '580px' }}>
                  Displays an elegant tile-based Bento popup on login and signup fields for fast 1-click password filling.
                </div>
              </div>
              <button
                onClick={handleToggleBento}
                style={{
                  background: bentoAutofill ? '#6D4AFF' : '#272535',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {bentoAutofill ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.2)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '4px' }}>Prompt to Save New Passwords</div>
                <div style={{ fontSize: '12.5px', color: '#9E9AA8', maxWidth: '580px' }}>
                  Shows a smooth bottom banner when you submit a new login or changed password, allowing you to save it instantly to your vault.
                </div>
              </div>
              <button
                onClick={handleToggleAutoSave}
                style={{
                  background: autoSavePrompts ? '#10b981' : '#272535',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {autoSavePrompts ? 'Active' : 'Muted'}
              </button>
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(244, 63, 94, 0.2)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '4px' }}>Phishing & Lookalike Website Shield</div>
                <div style={{ fontSize: '12.5px', color: '#9E9AA8', maxWidth: '580px' }}>
                  Protects against deceptive homograph attacks (e.g. Cyrillic lookalikes) and fake login domains. Alerts and pauses autofill if a domain looks suspicious.
                </div>
              </div>
              <button
                onClick={handleTogglePhishing}
                style={{
                  background: phishingDefense ? '#10b981' : '#272535',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {phishingDefense ? 'Protected' : 'Off'}
              </button>
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(56, 189, 248, 0.2)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '4px' }}>Instant 2FA TOTP Code Filler</div>
                <div style={{ fontSize: '12.5px', color: '#9E9AA8', maxWidth: '580px' }}>
                  Automatically detects two-factor authentication verification input fields and fills the 6-digit one-time code from your vault.
                </div>
              </div>
              <button
                onClick={handleToggleTotp}
                style={{
                  background: totpAutofill ? '#38bdf8' : '#272535',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {totpAutofill ? 'Auto-Fill' : 'Manual'}
              </button>
            </div>
          </SpotlightCard>
        </div>
      )}

      {/* Tab 2: Vault & Security */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SpotlightCard spotlightColor="rgba(109, 74, 255, 0.25)">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Auto-Lock Inactivity Timer</h3>
            <p style={{ color: '#9E9AA8', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
              Choose how quickly Kloak locks itself when you step away from your computer to keep your passwords secure.
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: '1 Minute', value: 1 },
                { label: '5 Minutes', value: 5 },
                { label: '15 Minutes (Default)', value: 15 },
                { label: '30 Minutes', value: 30 },
                { label: '1 Hour', value: 60 },
                { label: 'Never', value: 0 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAutoLockChange(opt.value)}
                  style={{
                    background: autoLockMinutes === opt.value ? '#6D4AFF' : 'rgba(255,255,255,0.06)',
                    color: autoLockMinutes === opt.value ? '#ffffff' : '#cbd5e1',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.25)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Hardware Security Key (FIDO2 / YubiKey)</h3>
              <span style={{
                fontSize: '11px',
                padding: '3px 9px',
                borderRadius: '12px',
                background: hardwareKeyRegistered ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
                color: hardwareKeyRegistered ? '#34d399' : '#9E9AA8',
                fontWeight: 700,
              }}>
                {hardwareKeyRegistered ? '✓ Registered' : 'Optional'}
              </span>
            </div>
            <p style={{ color: '#9E9AA8', fontSize: '13px', lineHeight: 1.5, marginBottom: '14px' }}>
              Unlock your vault with a single physical touch on your YubiKey or FIDO2 hardware security key. Fast, hardware-backed, and phishing-proof.
            </p>
            <div style={{ fontSize: '12.5px', color: '#cbd5e1', background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: '8px' }}>
              💡 To register or change your hardware key, click the <strong>Key icon</strong> in the extension popup header.
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(56, 189, 248, 0.2)">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Local Zero-Knowledge Architecture</h3>
            <p style={{ color: '#9E9AA8', fontSize: '13px', lineHeight: 1.6, marginBottom: '14px' }}>
              Kloak has zero cloud servers, zero ads, and zero telemetry. All credentials remain encrypted on your local machine with authenticated AES-256-GCM and Argon2id.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(109, 74, 255, 0.15)', color: '#B098FF', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                100% Local-First
              </span>
              <span style={{ background: 'rgba(109, 74, 255, 0.15)', color: '#B098FF', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                Argon2id Key Derivation
              </span>
              <span style={{ background: 'rgba(109, 74, 255, 0.15)', color: '#B098FF', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                Zero Cloud Tracking
              </span>
            </div>
          </SpotlightCard>
        </div>
      )}

      {/* Tab 3: Password Generator */}
      {activeTab === 'generator' && (
        <SpotlightCard spotlightColor="rgba(56, 189, 248, 0.25)">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Custom Password Generator</h3>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.12)', padding: '3px 10px', borderRadius: '12px' }}>
              ENTROPY: ~{Math.round(pwLength * 5.95)} BITS
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
          <div style={{ display: 'flex', gap: '24px' }}>
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

      {/* Tab 4: Desktop Connection */}
      {activeTab === 'connection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.25)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#f59e0b',
                  boxShadow: `0 0 10px ${isConnected ? '#10b981' : '#f59e0b'}`,
                }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Kloak Desktop Bridge</h3>
              </div>
              <span style={{
                fontSize: '11px',
                background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: isConnected ? '#34d399' : '#fbbf24',
                padding: '3px 10px',
                borderRadius: '9999px',
                fontWeight: 700,
              }}>
                {isConnected ? 'ONLINE' : 'STANDBY'}
              </span>
            </div>
            <p style={{ color: '#9E9AA8', fontSize: '13.5px', lineHeight: 1.6, marginBottom: '16px' }}>
              {nativeStatus}
            </p>
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px 16px', borderRadius: '10px', fontSize: '12px', color: '#cbd5e1' }}>
              Communication uses direct local Native Messaging (<code>app.kloak.native</code>) with zero external ports or cloud proxies.
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(109, 74, 255, 0.2)">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Extension Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#9E9AA8', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                <span>Version</span>
                <strong style={{ color: '#ffffff' }}>1.1.0</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                <span>Target</span>
                <strong style={{ color: '#ffffff' }}>Chrome Manifest V3 / Web Store Official</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Developer</span>
                <strong style={{ color: '#ffffff' }}>Kloak Open Source</strong>
              </div>
            </div>
          </SpotlightCard>
        </div>
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
