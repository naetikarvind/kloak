import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onUnlocked: () => void;
}

export default function UnlockView({ onUnlocked }: Props) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleUnlock() {
    if (!password) return;
    setError('');
    setLoading(true);
    try {
      await window.kloak.unlock(password);
      onUnlocked();
    } catch (e: any) {
      setError(e?.message ?? 'Incorrect password. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleUnlock();
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        animation: 'fadeIn 0.25s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            margin: '0 auto 16px',
            boxShadow: '0 12px 32px rgba(59,130,246,0.35)',
            animation: shake ? 'shake 0.4s ease' : undefined,
          }}>
            🔒
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Vault Locked
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Enter your master password to continue
          </p>
        </div>

        {/* Input */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            ref={inputRef}
            type={showPw ? 'text' : 'password'}
            placeholder="Master password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            style={{
              paddingRight: '44px',
              fontSize: '15px',
              height: '44px',
              borderColor: error ? 'rgba(239,68,68,0.6)' : undefined,
            }}
          />
          <button
            onClick={() => setShowPw(p => !p)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              borderRadius: '4px',
            }}
          >
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#fca5a5',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Unlock button */}
        <button
          onClick={handleUnlock}
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: '12px',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '15px',
            borderRadius: '10px',
            border: 'none',
            cursor: loading || !password ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background 0.15s',
            opacity: !password ? 0.55 : 1,
          }}
        >
          {loading ? (
            <>
              <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} className="animate-spin" />
              Unlocking…
            </>
          ) : (
            'Unlock'
          )}
        </button>

        <style>{`
          @keyframes shake {
            0%,100% { transform: translateX(0); }
            20%      { transform: translateX(-8px); }
            40%      { transform: translateX(8px); }
            60%      { transform: translateX(-5px); }
            80%      { transform: translateX(5px); }
          }
        `}</style>
      </div>
    </div>
  );
}
