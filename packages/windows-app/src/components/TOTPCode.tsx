import React, { useState, useEffect, useCallback } from 'react';

interface Props {
  secret: string;
}

export default function TOTPCode({ secret }: Props) {
  const [token,   setToken]   = useState('------');
  const [seconds, setSeconds] = useState(30);
  const [copied,  setCopied]  = useState(false);

  const fetchTotp = useCallback(async () => {
    try {
      const res = await window.kloak.generateTotp(secret);
      setToken(res.token);
      setSeconds(res.secondsRemaining);
    } catch {
      setToken('ERROR');
    }
  }, [secret]);

  useEffect(() => {
    fetchTotp();
    const id = setInterval(fetchTotp, 1000);
    return () => clearInterval(id);
  }, [fetchTotp]);

  function handleCopy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pct = (seconds / 30) * 100;
  const barColor = seconds > 10 ? 'var(--accent-green)' : seconds > 5 ? '#f59e0b' : '#ef4444';

  // Format token with a space in the middle: "123 456"
  const display = token.length === 6
    ? `${token.slice(0, 3)} ${token.slice(3)}`
    : token;

  return (
    <div
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Click to copy'}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '12px 16px',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      {/* Code */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontFamily: "'Consolas', 'SF Mono', 'Menlo', monospace",
          fontSize: '28px',
          fontWeight: 700,
          color: barColor,
          letterSpacing: '4px',
        }}>
          {display}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
            {copied ? '✓ Copied' : `${seconds}s`}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6 }}>
            {copied ? '' : 'click to copy'}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '3px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          borderRadius: '2px',
          transition: 'width 1s linear, background 0.3s',
        }} />
      </div>
    </div>
  );
}
