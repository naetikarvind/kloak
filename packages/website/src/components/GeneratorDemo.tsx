import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Check, ShieldCheck, Sparkles, Sliders, Hash } from 'lucide-react';

const WORD_LIST = [
  'amber', 'beacon', 'cipher', 'daemon', 'enclave', 'falcon', 'galaxy',
  'harbor', 'island', 'jupiter', 'kinetic', 'lagoon', 'matrix', 'nebula',
  'oracle', 'photon', 'quantum', 'radar', 'safari', 'tundra', 'uranium',
  'vector', 'walrus', 'xenon', 'yellow', 'zenith', 'anchor', 'bridge',
  'crystal', 'dragon', 'eclipse', 'fossil', 'granite', 'horizon', 'iceberg',
  'jaguar', 'kestrel', 'lantern', 'meteor', 'neutron', 'obsidian', 'prism',
  'quartz', 'rooster', 'summit', 'titan', 'vortex', 'whisper', 'zebra'
];

export const GeneratorDemo: React.FC = () => {
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [length, setLength] = useState(24);
  const [wordsCount, setWordsCount] = useState(5);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true);
  const [separator, setSeparator] = useState('-');
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [entropy, setEntropy] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const generate = useCallback(() => {
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 400);

    if (mode === 'password') {
      let chars = '';
      if (includeUpper) chars += avoidAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (includeLower) chars += avoidAmbiguous ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
      if (includeNumbers) chars += avoidAmbiguous ? '23456789' : '0123456789';
      if (includeSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

      if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

      let result = '';
      const array = new Uint32Array(length);
      window.crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
      }
      setGenerated(result);

      // Entropy = L * log2(poolSize)
      const bits = Math.round(length * Math.log2(chars.length));
      setEntropy(bits);
    } else {
      let chosen: string[] = [];
      const array = new Uint32Array(wordsCount);
      window.crypto.getRandomValues(array);
      for (let i = 0; i < wordsCount; i++) {
        let w = WORD_LIST[array[i] % WORD_LIST.length];
        if (includeUpper) {
          w = w.charAt(0).toUpperCase() + w.slice(1);
        }
        chosen.push(w);
      }
      const result = chosen.join(separator);
      setGenerated(result);

      // Entropy = wordsCount * log2(listSize)
      const bits = Math.round(wordsCount * Math.log2(WORD_LIST.length));
      setEntropy(bits);
    }
  }, [mode, length, wordsCount, includeUpper, includeLower, includeNumbers, includeSymbols, avoidAmbiguous, separator]);

  useEffect(() => {
    generate();
  }, [generate]);

  const handleCopy = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrengthMeta = () => {
    if (entropy < 50) return { label: 'Weak', color: '#ef4444', pct: 25 };
    if (entropy < 70) return { label: 'Moderate', color: '#f59e0b', pct: 55 };
    if (entropy < 90) return { label: 'Strong', color: '#10b981', pct: 85 };
    return { label: 'Military Grade', color: '#6366f1', pct: 100 };
  };

  const strength = getStrengthMeta();

  return (
    <section id="generator" style={{ padding: '72px 0', position: 'relative' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div className="badge-pill" style={{ marginBottom: '14px' }}>
            <Sparkles size={14} color="#38bdf8" />
            <span>Interactive Crypto Playground</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px' }}>
            Military-Grade Password &amp; Passphrase Generator
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
            Generate cryptographically secure credentials directly in your browser with real-time entropy calculation.
          </p>
        </div>

        {/* Generator Card */}
        <div
          className="glass-panel"
          style={{
            padding: '36px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '28px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={() => setMode('password')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'password' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'transparent',
                color: mode === 'password' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Random Password
            </button>
            <button
              onClick={() => setMode('passphrase')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'passphrase' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'transparent',
                color: mode === 'passphrase' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Diceware Passphrase
            </button>
          </div>

          {/* Generated Result Box */}
          <div
            style={{
              background: 'rgba(6, 9, 17, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '20px 24px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(16px, 2.5vw, 22px)',
                fontWeight: 600,
                color: '#ffffff',
                wordBreak: 'break-all',
                letterSpacing: mode === 'password' ? '1.5px' : '0.5px',
              }}
            >
              {generated}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={generate}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '10px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  transform: isRotating ? 'rotate(180deg)' : 'none',
                }}
                title="Regenerate"
              >
                <RefreshCw size={18} />
              </button>

              <button
                onClick={handleCopy}
                className="btn-primary"
                style={{
                  padding: '10px 18px',
                  fontSize: '14px',
                  borderRadius: '10px',
                }}
              >
                {copied ? <Check size={16} color="#ffffff" /> : <Copy size={16} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Entropy Gauge */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color={strength.color} />
                Strength: <strong style={{ color: strength.color }}>{strength.label}</strong>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <strong>{entropy}</strong> bits of entropy
              </span>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${strength.pct}%`,
                  height: '100%',
                  background: strength.color,
                  boxShadow: `0 0 12px ${strength.color}`,
                  transition: 'all 0.3s ease',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {mode === 'password' ? (
              <>
                {/* Length Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Length</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#60a5fa' }}>{length} characters</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="64"
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                </div>

                {/* Toggles Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    paddingTop: '8px',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeUpper}
                      onChange={(e) => setIncludeUpper(e.target.checked)}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    Uppercase (A-Z)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeLower}
                      onChange={(e) => setIncludeLower(e.target.checked)}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    Lowercase (a-z)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeNumbers}
                      onChange={(e) => setIncludeNumbers(e.target.checked)}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    Numbers (0-9)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeSymbols}
                      onChange={(e) => setIncludeSymbols(e.target.checked)}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    Symbols (!@#$%)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer', gridColumn: '1 / -1' }}>
                    <input
                      type="checkbox"
                      checked={avoidAmbiguous}
                      onChange={(e) => setAvoidAmbiguous(e.target.checked)}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    Avoid ambiguous characters (e.g. 1, l, I, 0, O)
                  </label>
                </div>
              </>
            ) : (
              <>
                {/* Words Count Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Word Count</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#c084fc' }}>{wordsCount} words</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="8"
                    value={wordsCount}
                    onChange={(e) => setWordsCount(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
                  />
                </div>

                {/* Separator Chooser */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>Separator:</span>
                  {['-', '_', ' ', '.'].map((sep) => (
                    <button
                      key={sep}
                      onClick={() => setSeparator(sep)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: separator === sep ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                        background: separator === sep ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                        color: separator === sep ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {sep === ' ' ? 'Space' : sep}
                    </button>
                  ))}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-main)', marginLeft: 'auto', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeUpper}
                      onChange={(e) => setIncludeUpper(e.target.checked)}
                      style={{ accentColor: '#8b5cf6' }}
                    />
                    Capitalize words
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
