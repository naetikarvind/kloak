import React, { useState, useCallback } from 'react';
import PasswordStrength from '../components/PasswordStrength';

interface Props {
  onComplete: () => void;
}

export default function SetupView({ onComplete }: Props) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);

  const validate = useCallback(() => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirm)  return 'Passwords do not match.';
    return '';
  }, [password, confirm]);

  async function handleCreate() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      await window.kloak.create(password);
      await window.kloak.unlock(password);
      setSuccess(true);
      setTimeout(onComplete, 600);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create vault. Please try again.');
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
  }

  const inputRow: React.CSSProperties = {
    position: 'relative',
    width: '100%',
  };

  const eyeBtn: React.CSSProperties = {
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

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
        maxWidth: '420px',
        animation: 'fadeIn 0.3s ease',
      }}>
        {/* Hero */}
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
          }}>🔒</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Welcome to Kloak
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, maxWidth: '340px', margin: '0 auto' }}>
            Your vault lives entirely on this device — <strong style={{ color: 'var(--text-primary)' }}>zero cloud, zero tracking</strong>. Choose a strong master password; it cannot be recovered if lost.
          </p>
        </div>

        {/* Features strip */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '28px',
        }}>
          {[
            { icon: '🛡️', label: 'AES-256 encrypted' },
            { icon: '🏠', label: 'Local-first' },
            { icon: '🔓', label: 'Open source' },
          ].map(f => (
            <div key={f.label} style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 6px',
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>{f.icon}</div>
              {f.label}
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Master password */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              Master Password
            </label>
            <div style={inputRow}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{ paddingRight: '40px' }}
              />
              <button style={eyeBtn} onClick={() => setShowPw(p => !p)}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Strength */}
          {password && <PasswordStrength password={password} />}

          {/* Confirm */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              Confirm Password
            </label>
            <div style={inputRow}>
              <input
                type={showCf ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                style={{ paddingRight: '40px' }}
              />
              <button style={eyeBtn} onClick={() => setShowCf(p => !p)}>
                {showCf ? '🙈' : '👁️'}
              </button>
            </div>
            {/* match indicator */}
            {confirm && (
              <p style={{ fontSize: '11px', marginTop: '4px', color: password === confirm ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
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
            }}>
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleCreate}
            disabled={loading || success}
            style={{
              width: '100%',
              padding: '11px',
              background: success ? 'var(--accent-green)' : 'var(--accent)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '15px',
              borderRadius: '10px',
              border: 'none',
              cursor: loading || success ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
              marginTop: '4px',
            }}
          >
            {loading ? (
              <>
                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} className="animate-spin" />
                Creating vault…
              </>
            ) : success ? (
              '✓ Vault created!'
            ) : (
              'Create Vault'
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            ⚠️ There is no way to recover a lost master password. Store it somewhere safe.
          </p>
        </div>
      </div>
    </div>
  );
}
