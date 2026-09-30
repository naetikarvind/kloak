import React, { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import SetupView from './views/SetupView';
import UnlockView from './views/UnlockView';
import VaultMainView from './views/VaultMainView';

type AppView = 'loading' | 'setup' | 'unlock' | 'vault';

export default function App() {
  const [view, setView] = useState<AppView>('loading');

  async function checkStatus() {
    try {
      const status = await window.kloak.status();
      if (!status.isInitialized) setView('setup');
      else if (!status.isUnlocked) setView('unlock');
      else setView('vault');
    } catch {
      setTimeout(checkStatus, 1000);
    }
  }

  useEffect(() => {
    checkStatus();
    window.kloak.onDaemonReady(checkStatus);
    window.kloak.onVaultLocked(() => setView('unlock'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      overflow: 'hidden',
    }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'loading' && <LoadingScreen />}
        {view === 'setup'   && <SetupView   onComplete={() => setView('vault')} />}
        {view === 'unlock'  && <UnlockView  onUnlocked={() => setView('vault')} />}
        {view === 'vault'   && <VaultMainView onLocked={() => setView('unlock')} />}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
      }}>
        🔒
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>Kloak</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Starting daemon…</p>
      </div>
      <div style={{
        width: '24px',
        height: '24px',
        border: '2px solid rgba(59,130,246,0.3)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
      }} className="animate-spin" />
    </div>
  );
}
