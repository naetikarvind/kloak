import React, { useState, useEffect, useMemo } from 'react';
import ItemListView from './ItemListView';
import GeneratorView from './GeneratorView';
import SettingsView from './SettingsView';

type Section =
  | 'all' | 'favorites' | 'login' | 'secure_note' | 'card' | 'identity'
  | 'authenticator' | 'trash' | 'generator' | 'settings';

interface NavItem {
  id: Section;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { id: 'all',           label: 'All Items',        icon: '🗄️' },
  { id: 'favorites',     label: 'Favorites',        icon: '⭐' },
  { id: 'login',         label: 'Logins',           icon: '🔑' },
  { id: 'secure_note',   label: 'Secure Notes',     icon: '📝' },
  { id: 'card',          label: 'Cards',            icon: '💳' },
  { id: 'identity',      label: 'Identities',       icon: '👤' },
  { id: 'authenticator', label: '2FA Authenticator',icon: '🔐' },
  { id: 'trash',         label: 'Trash',            icon: '🗑️' },
];

const TOOLS: NavItem[] = [
  { id: 'generator', label: 'Generator', icon: '⚙️' },
  { id: 'settings',  label: 'Settings',  icon: '🛠️' },
];

interface Props {
  onLocked: () => void;
}

export default function VaultMainView({ onLocked }: Props) {
  const [activeSection, setActiveSection] = useState<Section>('all');
  const [items, setItems]         = useState<VaultItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearch]  = useState('');

  async function loadItems() {
    setLoading(true);
    try {
      const includeTrash = activeSection === 'trash';
      const all = await window.kloak.getItems(includeTrash);
      setItems(all);
    } catch (e) {
      console.error('Failed to load items', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, [activeSection]);

  const filtered = useMemo(() => {
    let list = items;

    if (activeSection === 'favorites')     list = list.filter(i => i.favorite && !i.trashed);
    else if (activeSection === 'trash')    list = list.filter(i => i.trashed);
    else if (activeSection !== 'all')      list = list.filter(i => i.type === activeSection && !i.trashed);
    else                                   list = list.filter(i => !i.trashed);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.username ?? '').toLowerCase().includes(q) ||
        (i.urls ?? []).some(u => u.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, activeSection, searchQuery]);

  async function handleLock() {
    try {
      await window.kloak.lock();
    } catch {}
    onLocked();
  }

  const isListSection = !['generator', 'settings'].includes(activeSection);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ─── Sidebar ─────────────────────────────────────── */}
      <aside style={{
        width: '210px',
        flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          <SectionLabel>Vault</SectionLabel>
          {NAV.map(n => (
            <NavBtn
              key={n.id}
              item={n}
              active={activeSection === n.id}
              onClick={() => { setActiveSection(n.id); setSearch(''); }}
            />
          ))}

          <SectionLabel style={{ marginTop: '16px' }}>Tools</SectionLabel>
          {TOOLS.map(n => (
            <NavBtn
              key={n.id}
              item={n}
              active={activeSection === n.id}
              onClick={() => { setActiveSection(n.id); setSearch(''); }}
            />
          ))}
        </nav>

        {/* Lock */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLock}
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
          >
            🔒 Lock Vault
          </button>
        </div>
      </aside>

      {/* ─── Main content ────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search bar */}
        {isListSection && (
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-primary)',
          }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                fontSize: '16px',
                pointerEvents: 'none',
              }}>🔍</span>
              <input
                type="text"
                placeholder={`Search ${NAV.find(n => n.id === activeSection)?.label ?? 'items'}…`}
                value={searchQuery}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '36px', height: '36px', background: 'rgba(255,255,255,0.04)' }}
              />
            </div>
          </div>
        )}

        {/* View content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeSection === 'generator' && <GeneratorView />}
          {activeSection === 'settings'  && <SettingsView />}
          {isListSection && (
            <ItemListView
              items={filtered}
              loading={loading}
              section={activeSection}
              onItemChanged={loadItems}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)',
      padding: '4px 8px 4px',
      ...style,
    }}>
      {children}
    </p>
  );
}

function NavBtn({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 10px',
        borderRadius: '8px',
        background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 400,
        fontSize: '13px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.12s, color 0.12s',
        marginBottom: '1px',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </button>
  );
}
