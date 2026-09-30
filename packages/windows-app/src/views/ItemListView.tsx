import React, { useState } from 'react';
import ItemDetailPanel from './ItemDetailPanel';

const TYPE_ICONS: Record<string, string> = {
  login:        '🔑',
  secure_note:  '📝',
  card:         '💳',
  identity:     '👤',
  oauth:        '🔐',
  email_alias:  '📧',
  authenticator:'🕒',
};

const TYPE_LABELS: Record<string, string> = {
  login:        'Login',
  secure_note:  'Note',
  card:         'Card',
  identity:     'Identity',
  oauth:        '2FA',
  email_alias:  'Alias',
  authenticator:'2FA',
};

function getDomain(urls: string[]): string {
  if (!urls?.length) return '';
  try {
    return new URL(urls[0]).hostname.replace(/^www\./, '');
  } catch {
    return urls[0];
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  // Auto-clear after 30s
  setTimeout(() => navigator.clipboard.writeText(''), 30_000);
}

interface Props {
  items: VaultItem[];
  loading: boolean;
  section: string;
  onItemChanged: () => void;
}

export default function ItemListView({ items, loading, section, onItemChanged }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId]       = useState<string | null>(null);

  const selected = items.find(i => i.id === selectedId) ?? null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
        <span style={{ width: '20px', height: '20px', border: '2px solid rgba(59,130,246,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} className="animate-spin" />
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading vault…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '48px', opacity: 0.4 }}>
          {section === 'trash' ? '🗑️' : section === 'favorites' ? '⭐' : '🗄️'}
        </span>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          {section === 'trash' ? 'Trash is empty' : section === 'favorites' ? 'No favorites yet' : 'No items found'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ─── List panel ──────────────────────────────────── */}
      <div style={{
        width: selected ? '320px' : '100%',
        flexShrink: 0,
        borderRight: selected ? '1px solid var(--border)' : 'none',
        overflowY: 'auto',
        background: 'var(--bg-primary)',
        transition: 'width 0.2s ease',
      }}>
        {items.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={item.id === selectedId}
            isHovered={item.id === hoverId}
            onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)}
            onHover={setHoverId}
          />
        ))}
      </div>

      {/* ─── Detail panel ────────────────────────────────── */}
      {selected && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
          <ItemDetailPanel
            item={selected}
            onClose={() => setSelectedId(null)}
            onItemChanged={() => { onItemChanged(); setSelectedId(null); }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Row ──────────────────────────────────────────────────────── */

interface RowProps {
  item: VaultItem;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}

function ItemRow({ item, isSelected, isHovered, onSelect, onHover }: RowProps) {
  const domain = getDomain(item.urls);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        cursor: 'pointer',
        background: isSelected
          ? 'rgba(59,130,246,0.12)'
          : isHovered
          ? 'rgba(255,255,255,0.04)'
          : 'transparent',
        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s',
        position: 'relative',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '9px',
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        flexShrink: 0,
        border: '1px solid var(--border)',
      }}>
        {TYPE_ICONS[item.type] ?? '🔑'}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {item.title}
          </span>
          {item.favorite && <span style={{ fontSize: '12px' }}>⭐</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {item.username ?? domain ?? '—'}
          </span>
          <span style={{
            fontSize: '10px',
            background: 'rgba(59,130,246,0.15)',
            color: 'var(--accent)',
            padding: '1px 5px',
            borderRadius: '4px',
            flexShrink: 0,
            fontWeight: 500,
          }}>
            {TYPE_LABELS[item.type] ?? item.type}
          </span>
        </div>
      </div>

      {/* Hover quick-copy buttons */}
      {isHovered && (
        <div style={{
          display: 'flex',
          gap: '4px',
          flexShrink: 0,
        }}
          onClick={e => e.stopPropagation()}
        >
          {item.username && (
            <QuickCopyBtn
              title="Copy username"
              onClick={() => copyToClipboard(item.username!)}
            >
              👤
            </QuickCopyBtn>
          )}
          {item.password && (
            <QuickCopyBtn
              title="Copy password"
              onClick={() => copyToClipboard(item.password!)}
            >
              🔑
            </QuickCopyBtn>
          )}
        </div>
      )}
    </div>
  );
}

function QuickCopyBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  const [copied, setCopied] = useState(false);
  function handle() {
    onClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      title={title}
      onClick={handle}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.15s',
      }}
    >
      {copied ? '✓' : children}
    </button>
  );
}
