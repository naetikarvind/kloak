import React, { useState, useEffect } from 'react';
import PasswordStrength from '../components/PasswordStrength';

const AUTO_LOCK_OPTIONS = [
  { label: '1 minute',  value: 1  },
  { label: '5 minutes', value: 5  },
  { label: '15 minutes',value: 15 },
  { label: '30 minutes',value: 30 },
  { label: 'Never',     value: 0  },
];

const CLEAR_CLIP_OPTIONS = [
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '60 seconds', value: 60 },
  { label: 'Never',      value: 0  },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '18px', marginBottom: '16px',
    }}>
      <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</p>
        {description && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '42px', height: '24px', borderRadius: '12px', flexShrink: 0,
        background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
        padding: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: '4px',
        left: checked ? '22px' : '4px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  );
}

function SelectDropdown({ value, onChange, options }: {
  value: number; onChange: (v: number) => void;
  options: { label: string; value: number }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(+e.target.value)}
      style={{ width: '140px', height: '32px', padding: '4px 8px', flexShrink: 0 }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function SettingsView() {
  // Settings state
  const [autoLock,   setAutoLock]   = useState(15);
  const [clearClip,  setClearClip]  = useState(30);
  const [autoStart,  setAutoStart]  = useState(false);
  const [version,    setVersion]    = useState('1.0.0');
  const [loading,    setLoading]    = useState(true);

  // Change password state
  const [oldPw,     setOldPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError,   setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Wipe state
  const [wipeText,    setWipeText]    = useState('');
  const [wipeLoading, setWipeLoading] = useState(false);
  const [wipeError,   setWipeError]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [settings, autoStartEnabled] = await Promise.all([
          window.kloak.getSettings(),
          window.kloak.getAutoStart(),
        ]);
        if (settings.autoLockMinutes !== undefined) setAutoLock(settings.autoLockMinutes);
        if (settings.clearClipboardSeconds !== undefined) setClearClip(settings.clearClipboardSeconds);
        setAutoStart(autoStartEnabled);
      } catch {}
      setLoading(false);
    })();
  }, []);

  async function saveSetting(key: string, value: any) {
    try {
      await window.kloak.updateSettings({ [key]: value });
    } catch (e) {
      console.error('Failed to save setting', e);
    }
  }

  async function handleAutoLock(v: number) {
    setAutoLock(v);
    await saveSetting('autoLockMinutes', v);
  }

  async function handleClearClip(v: number) {
    setClearClip(v);
    await saveSetting('clearClipboardSeconds', v);
  }

  async function handleAutoStart(v: boolean) {
    setAutoStart(v);
    await window.kloak.setAutoStart(v);
  }

  async function handleChangePassword() {
    setPwError(''); setPwSuccess('');
    if (!oldPw)               { setPwError('Enter your current password.'); return; }
    if (newPw.length < 8)     { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw)  { setPwError('New passwords do not match.'); return; }
    setPwLoading(true);
    try {
      await window.kloak.changeMasterPassword(oldPw, newPw);
      setPwSuccess('Master password updated successfully!');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) {
      setPwError(e?.message ?? 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleWipe() {
    if (wipeText !== 'WIPE') { setWipeError('Type WIPE to confirm.'); return; }
    setWipeLoading(true);
    setWipeError('');
    try {
      // Export with destroy option — implementation-specific
      await (window.kloak as any).wipeVault?.();
      window.location.reload();
    } catch (e: any) {
      setWipeError(e?.message ?? 'Wipe failed. Please try again.');
      setWipeLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
        <span style={{ width: '18px', height: '18px', border: '2px solid rgba(59,130,246,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} className="animate-spin" />
        <span style={{ color: 'var(--text-secondary)' }}>Loading settings…</span>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px', maxWidth: '580px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Settings</h2>

      {/* ─── Security ─────────────────────────────── */}
      <SectionCard title="Security">
        <SettingRow label="Auto-Lock" description="Lock vault after period of inactivity">
          <SelectDropdown value={autoLock} onChange={handleAutoLock} options={AUTO_LOCK_OPTIONS} />
        </SettingRow>
        <SettingRow label="Clear Clipboard" description="Auto-clear clipboard after copy">
          <SelectDropdown value={clearClip} onChange={handleClearClip} options={CLEAR_CLIP_OPTIONS} />
        </SettingRow>
      </SectionCard>

      {/* ─── System ───────────────────────────────── */}
      <SectionCard title="System">
        <SettingRow label="Start with Windows" description="Launch Kloak automatically at login">
          <Toggle checked={autoStart} onChange={handleAutoStart} />
        </SettingRow>
      </SectionCard>

      {/* ─── Change master password ────────────────── */}
      <SectionCard title="Change Master Password">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="password" placeholder="Current password"
            value={oldPw} onChange={e => setOldPw(e.target.value)}
          />
          <input
            type="password" placeholder="New password (min 8 characters)"
            value={newPw} onChange={e => setNewPw(e.target.value)}
          />
          {newPw && <PasswordStrength password={newPw} />}
          <input
            type="password" placeholder="Confirm new password"
            value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
          />

          {pwError   && <p style={{ fontSize: '12px', color: '#fca5a5' }}>{pwError}</p>}
          {pwSuccess && <p style={{ fontSize: '12px', color: 'var(--accent-green)' }}>{pwSuccess}</p>}

          <button
            onClick={handleChangePassword}
            disabled={pwLoading}
            style={{
              padding: '9px', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              opacity: pwLoading ? 0.6 : 1,
            }}
          >
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </SectionCard>

      {/* ─── Biometrics (placeholder) ──────────────── */}
      <SectionCard title="Biometrics">
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
        }}>
          <span style={{ fontSize: '28px' }}>🪟</span>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 500 }}>Windows Hello</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Biometric unlock coming soon — PIN, fingerprint, and face recognition.</p>
          </div>
          <span style={{
            marginLeft: 'auto', fontSize: '11px', background: 'rgba(59,130,246,0.15)',
            color: 'var(--accent)', padding: '3px 8px', borderRadius: '20px', flexShrink: 0,
          }}>
            Soon
          </span>
        </div>
      </SectionCard>

      {/* ─── Danger zone ──────────────────────────── */}
      <div style={{
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '12px', padding: '18px', marginBottom: '16px',
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          ⚠️ Danger Zone
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.6 }}>
          Wiping the vault permanently deletes all data. This action <strong style={{ color: '#f87171' }}>cannot be undone</strong>.
          Type <code style={{ background: 'rgba(239,68,68,0.15)', padding: '1px 5px', borderRadius: '3px', color: '#f87171' }}>WIPE</code> to confirm.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={wipeText}
            onChange={e => { setWipeText(e.target.value); setWipeError(''); }}
            placeholder="Type WIPE to confirm"
            style={{ flex: 1, borderColor: 'rgba(239,68,68,0.3)' }}
          />
          <button
            onClick={handleWipe}
            disabled={wipeLoading || wipeText !== 'WIPE'}
            style={{
              padding: '9px 16px', background: wipeText === 'WIPE' ? '#ef4444' : 'rgba(239,68,68,0.15)',
              color: wipeText === 'WIPE' ? '#fff' : '#f87171',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
              fontWeight: 600, cursor: wipeText !== 'WIPE' ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s', flexShrink: 0, opacity: wipeLoading ? 0.6 : 1,
            }}
          >
            {wipeLoading ? 'Wiping…' : 'Wipe Vault'}
          </button>
        </div>
        {wipeError && <p style={{ fontSize: '12px', color: '#fca5a5', marginTop: '6px' }}>{wipeError}</p>}
      </div>

      {/* ─── App info ─────────────────────────────── */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', paddingBottom: '24px' }}>
        Kloak v{version} — Local-first password manager
      </div>
    </div>
  );
}
