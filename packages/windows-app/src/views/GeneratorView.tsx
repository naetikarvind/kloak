import React, { useState, useCallback, useEffect } from 'react';

/* ─── Strength helpers (local, no daemon) ──────────────────── */
function calcEntropy(pw: string): number {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
  return pool === 0 ? 0 : Math.floor(pw.length * Math.log2(pool));
}
function strengthInfo(entropy: number) {
  if (entropy < 25) return { label: 'Weak',        color: '#ef4444', pct: 20  };
  if (entropy < 50) return { label: 'Moderate',    color: '#f59e0b', pct: 45  };
  if (entropy < 70) return { label: 'Strong',      color: '#3b82f6', pct: 70  };
  return               { label: 'Very Strong', color: '#10b981', pct: 100 };
}

/* ─── Sub-components ───────────────────────────────────────── */

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '90px', flexShrink: 0 }}>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0',
        color: checked ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px',
      }}
    >
      <div style={{
        width: '36px', height: '20px', borderRadius: '10px',
        background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: '3px',
          left: checked ? '19px' : '3px',
          width: '14px', height: '14px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </div>
      {label}
    </button>
  );
}

/* ─── Generator ─────────────────────────────────────────────── */

type GenMode = 'password' | 'passphrase';

export default function GeneratorView() {
  const [mode,         setMode]         = useState<GenMode>('password');
  const [length,       setLength]       = useState(20);
  const [wordCount,    setWordCount]    = useState(4);
  const [uppercase,    setUppercase]    = useState(true);
  const [lowercase,    setLowercase]    = useState(true);
  const [numbers,      setNumbers]      = useState(true);
  const [symbols,      setSymbols]      = useState(true);
  const [noAmbiguous,  setNoAmbiguous]  = useState(false);
  const [generated,    setGenerated]    = useState('');
  const [loading,      setLoading]      = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [copyTimer,    setCopyTimer]    = useState<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setCopied(false);
    try {
      if (mode === 'password') {
        const res = await window.kloak.generatePassword({
          length, uppercase, lowercase, numbers, symbols,
          avoidAmbiguous: noAmbiguous,
        });
        setGenerated(res.password);
      } else {
        const res = await window.kloak.generatePassphrase({ wordCount });
        setGenerated(res.passphrase);
      }
    } catch {
      // Fallback: generate client-side
      const charset = [
        lowercase ? 'abcdefghijklmnopqrstuvwxyz' : '',
        uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '',
        numbers   ? '0123456789'                  : '',
        symbols   ? '!@#$%^&*()-_=+[]{}|;:,.<>?' : '',
      ].join('').replace(noAmbiguous ? /[0OoIl1]/g : /^/, '') || 'abcdefghijklmnopqrstuvwxyz';
      let pw = '';
      const arr = new Uint32Array(length);
      crypto.getRandomValues(arr);
      for (let i = 0; i < length; i++) pw += charset[arr[i] % charset.length];
      setGenerated(pw);
    } finally {
      setLoading(false);
    }
  }, [mode, length, wordCount, uppercase, lowercase, numbers, symbols, noAmbiguous]);

  // Auto-generate on options change
  useEffect(() => { generate(); }, [generate]);

  function handleCopy() {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    setCopied(true);
    if (copyTimer) clearTimeout(copyTimer);
    const t = setTimeout(() => {
      navigator.clipboard.writeText('');
      setCopied(false);
    }, 30_000);
    setCopyTimer(t);
  }

  const entropy   = calcEntropy(generated);
  const strength  = strengthInfo(entropy);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px', maxWidth: '560px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Password Generator</h2>

      {/* Mode toggle */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px',
      }}>
        {(['password', 'passphrase'] as GenMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, padding: '8px', borderRadius: '7px', fontWeight: 500, border: 'none',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Options */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px', marginBottom: '20px',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        {mode === 'password' ? (
          <>
            {/* Length */}
            <div>
              <Row>
                <Label>Length</Label>
                <input
                  type="range" min={8} max={128} value={length}
                  onChange={e => setLength(+e.target.value)}
                  style={{ flex: 1, accentColor: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                />
                <span style={{ minWidth: '30px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{length}</span>
              </Row>
            </div>

            {/* Character toggles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Toggle checked={uppercase}   onChange={setUppercase}   label="Uppercase (A-Z)" />
              <Toggle checked={lowercase}   onChange={setLowercase}   label="Lowercase (a-z)" />
              <Toggle checked={numbers}     onChange={setNumbers}     label="Numbers (0-9)" />
              <Toggle checked={symbols}     onChange={setSymbols}     label="Symbols (!@#…)" />
            </div>
            <Toggle checked={noAmbiguous} onChange={setNoAmbiguous} label="Avoid ambiguous characters (O, 0, I, l)" />
          </>
        ) : (
          /* Passphrase */
          <div>
            <Row>
              <Label>Word count</Label>
              <input
                type="range" min={3} max={8} value={wordCount}
                onChange={e => setWordCount(+e.target.value)}
                style={{ flex: 1, accentColor: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              />
              <span style={{ minWidth: '20px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{wordCount}</span>
            </Row>
          </div>
        )}
      </div>

      {/* Output */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px', marginBottom: '16px',
      }}>
        <div style={{
          fontFamily: "'Consolas','SF Mono','Menlo',monospace",
          fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)',
          wordBreak: 'break-all', lineHeight: 1.5, minHeight: '28px',
          marginBottom: '12px', userSelect: 'text',
          opacity: loading ? 0.4 : 1, transition: 'opacity 0.2s',
        }}>
          {loading ? '…' : generated}
        </div>

        {/* Strength bar */}
        {generated && mode === 'password' && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '5px' }}>
              <div style={{ height: '100%', width: `${strength.pct}%`, background: strength.color, borderRadius: '2px', transition: 'width 0.3s, background 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{entropy} bits</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={generate}
            disabled={loading}
            style={{
              flex: 1, padding: '9px', background: 'rgba(255,255,255,0.07)',
              color: 'var(--text-primary)', border: '1px solid var(--border)',
              borderRadius: '8px', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            🔄 Regenerate
          </button>
          <button
            onClick={handleCopy}
            disabled={!generated || loading}
            style={{
              flex: 1, padding: '9px',
              background: copied ? 'rgba(16,185,129,0.15)' : 'var(--accent)',
              color: copied ? 'var(--accent-green)' : '#fff',
              border: copied ? '1px solid rgba(16,185,129,0.3)' : 'none',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'background 0.2s',
            }}
          >
            {copied ? '✓ Copied! Clears in 30s' : '📋 Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
