import React from 'react';

export default function TitleBar() {
  const btn: React.CSSProperties = {
    WebkitAppRegion: 'no-drag' as any,
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    padding: 0,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    flexShrink: 0,
  };

  return (
    <div style={{
      height: '38px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 10px 0 14px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      WebkitAppRegion: 'drag' as any,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Left: brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '22px',
          height: '22px',
          borderRadius: '6px',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          flexShrink: 0,
        }}>
          🔒
        </div>
        <span style={{
          fontWeight: 600,
          fontSize: '13px',
          color: 'var(--text-primary)',
          letterSpacing: '0.3px',
        }}>
          Kloak
        </span>
      </div>

      {/* Right: window controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', WebkitAppRegion: 'no-drag' as any }}>
        {/* Minimize */}
        <button
          style={btn}
          title="Minimize"
          onClick={() => window.kloak.minimize()}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="12" height="2" viewBox="0 0 12 2" fill="currentColor">
            <rect width="12" height="2" rx="1" />
          </svg>
        </button>

        {/* Hide / close to tray */}
        <button
          style={{ ...btn }}
          title="Hide to tray"
          onClick={() => window.kloak.hide()}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
