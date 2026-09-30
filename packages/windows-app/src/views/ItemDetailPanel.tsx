import React, { useState, useCallback } from 'react';
import TOTPCode from '../components/TOTPCode';

interface Props {
  item: VaultItem;
  onClose: () => void;
  onItemChanged: () => void;
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  setTimeout(() => navigator.clipboard.writeText(''), 30_000);
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/* ─── Shared field row ──────────────────────────────────────── */
function FieldRow({
  label, value, secret, mono, multiline,
}: {
  label: string;
  value: string;
  secret?: boolean;
  mono?: boolean;
  multiline?: boolean;
}) {
  const [revealed, setRevealed] = useState(!secret);
  const [copied,   setCopied]   = useState(false);

  function handleCopy() {
    copyText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const display = secret && !revealed
    ? '••••••••••••'
    : value;

  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      <div style={{
        display: 'flex',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: '6px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: multiline ? '10px 12px' : '8px 12px',
      }}>
        <span style={{
          flex: 1,
          fontFamily: mono ? "'Consolas','SF Mono','Menlo',monospace" : 'inherit',
          fontSize: mono ? '15px' : '13px',
          color: 'var(--text-primary)',
          letterSpacing: secret && !revealed ? '2px' : 'normal',
          wordBreak: multiline ? 'break-word' : undefined,
          whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
          overflow: multiline ? undefined : 'hidden',
          textOverflow: multiline ? undefined : 'ellipsis',
          userSelect: 'text',
        }}>
          {display}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
          {secret && (
            <button onClick={() => setRevealed(r => !r)} style={iconBtnStyle} title={revealed ? 'Hide' : 'Reveal'}>
              {revealed ? '🙈' : '👁️'}
            </button>
          )}
          <button onClick={handleCopy} style={{ ...iconBtnStyle, color: copied ? 'var(--accent-green)' : 'var(--text-secondary)' }} title="Copy">
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '14px',
  padding: '2px 4px',
  borderRadius: '4px',
  lineHeight: 1,
};

/* ─── Edit form ─────────────────────────────────────────────── */
function EditForm({ item, onSaved, onCancel }: { item: VaultItem; onSaved: () => void; onCancel: () => void }) {
  const [title,    setTitle]    = useState(item.title);
  const [username, setUsername] = useState(item.username ?? '');
  const [password, setPassword] = useState(item.password ?? '');
  const [url,      setUrl]      = useState(item.urls?.[0] ?? '');
  const [notes,    setNotes]    = useState(item.notes ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    try {
      await window.kloak.updateItem(item.id, {
        title: title.trim(),
        username: username || undefined,
        password: password || undefined,
        urls: url ? [url] : [],
        notes: notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save.');
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <FormField label="Title">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Item title" />
      </FormField>
      {(item.type === 'login' || item.type === 'oauth') && (
        <>
          <FormField label="Username">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username or email" />
          </FormField>
          <FormField label="Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
          </FormField>
          <FormField label="Website URL">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" />
          </FormField>
        </>
      )}
      <FormField label="Notes">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
      </FormField>
      {error && <p style={{ color: '#fca5a5', fontSize: '12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSave} disabled={saving} style={{
          flex: 1, padding: '9px', background: 'var(--accent)', color: '#fff', fontWeight: 600,
          borderRadius: '8px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={onCancel} style={{
          padding: '9px 16px', background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)',
          borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ─── Main detail panel ─────────────────────────────────────── */
export default function ItemDetailPanel({ item, onClose, onItemChanged }: Props) {
  const [editing,   setEditing]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const domain = (() => {
    try { return item.urls?.[0] ? new URL(item.urls[0]).hostname.replace(/^www\./, '') : ''; }
    catch { return ''; }
  })();

  async function handleDelete() {
    setDeleting(true);
    try {
      await window.kloak.deleteItem(item.id, false);
      onItemChanged();
    } catch (e: any) {
      alert(e?.message ?? 'Delete failed.');
      setDeleting(false);
    }
  }

  async function handleToggleFavorite() {
    await window.kloak.updateItem(item.id, { favorite: !item.favorite });
    onItemChanged();
  }

  if (editing) {
    return (
      <div style={panelStyle}>
        <PanelHeader title="Edit Item" onClose={onClose} />
        <div style={{ padding: '16px' }}>
          <EditForm
            item={item}
            onSaved={() => { setEditing(false); onItemChanged(); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle} className="animate-fadeIn">
      <PanelHeader title={item.title} onClose={onClose} />

      <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
        {/* Header meta */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '20px',
          padding: '14px',
          background: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
            border: '1px solid var(--border)', flexShrink: 0,
          }}>
            {typeIcon(item.type)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '2px' }} className="truncate">{item.title}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{domain || typeName(item.type)}</p>
          </div>
          <button
            onClick={handleToggleFavorite}
            title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
            style={{ ...iconBtnStyle, fontSize: '20px' }}
          >
            {item.favorite ? '⭐' : '☆'}
          </button>
        </div>

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {item.tags.map(tag => (
              <span key={tag} style={{
                fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: 'var(--accent)',
                padding: '3px 8px', borderRadius: '12px',
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* ── Type-specific fields ── */}
        {(item.type === 'login' || item.type === 'oauth') && <LoginFields item={item} />}
        {item.type === 'secure_note' && <NoteFields item={item} />}
        {item.type === 'card' && <CardFields item={item} />}
        {item.type === 'identity' && <IdentityFields item={item} />}
        {item.type === 'authenticator' && item.totpSecret && (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              TOTP Code
            </label>
            <TOTPCode secret={item.totpSecret} />
          </div>
        )}

        {/* TOTP on login items */}
        {item.type === 'login' && item.totpSecret && (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Authenticator Code
            </label>
            <TOTPCode secret={item.totpSecret} />
          </div>
        )}

        {/* Custom fields */}
        {item.customFields?.length ? (
          <div style={{ marginBottom: '14px' }}>
            <SectionTitle>Custom Fields</SectionTitle>
            {item.customFields.map(f => (
              <FieldRow
                key={f.id}
                label={f.name}
                value={f.value}
                secret={f.type === 'hidden'}
                mono={f.type === 'hidden'}
              />
            ))}
          </div>
        ) : null}

        {/* Notes */}
        {item.notes && (
          <div style={{ marginBottom: '14px' }}>
            <SectionTitle>Notes</SectionTitle>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              userSelect: 'text',
              lineHeight: 1.6,
            }}>
              {item.notes}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div style={{
          marginTop: '20px',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <span>Created: {fmtDate(item.createdAt)}</span>
          <span>Modified: {fmtDate(item.updatedAt)}</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              flex: 1, padding: '9px', background: 'rgba(59,130,246,0.15)',
              color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '8px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            ✏️ Edit
          </button>

          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              style={{
                padding: '9px 14px', background: 'rgba(239,68,68,0.1)',
                color: '#f87171', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '8px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              🗑️ Delete
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '9px 14px', background: '#ef4444',
                  color: '#fff', border: 'none',
                  borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                style={{
                  padding: '9px 10px', background: 'rgba(255,255,255,0.07)',
                  color: 'var(--text-secondary)', border: '1px solid var(--border)',
                  borderRadius: '8px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helper sub-components ─────────────────────────────────── */

const panelStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-primary)',
};

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      <span style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      <button onClick={onClose} style={{ ...iconBtnStyle, fontSize: '18px', marginLeft: '8px' }}>✕</button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
      {children}
    </p>
  );
}

function LoginFields({ item }: { item: VaultItem }) {
  return (
    <>
      {item.username && <FieldRow label="Username" value={item.username} />}
      {item.password && <FieldRow label="Password" value={item.password} secret mono />}
      {item.urls?.[0] && (
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
            Website
          </label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '8px 12px',
          }}>
            <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'text' }}>
              {item.urls[0]}
            </span>
            <button
              onClick={() => window.kloak.openExternal(item.urls[0])}
              style={{ ...iconBtnStyle }}
              title="Open in browser"
            >
              🌐
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function NoteFields({ item }: { item: VaultItem }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Secure Note</label>
        <button
          onClick={() => { copyText(item.notes ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          style={{ ...iconBtnStyle, color: copied ? 'var(--accent-green)' : 'var(--text-secondary)' }}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '13px',
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        userSelect: 'text',
        lineHeight: 1.7,
        minHeight: '80px',
      }}>
        {item.notes ?? '(empty)'}
      </div>
    </div>
  );
}

function CardFields({ item }: { item: VaultItem }) {
  const card = item.card;
  if (!card) return null;
  const maskedNum = card.number
    ? card.number.replace(/\d(?=\d{4})/g, '•').replace(/(.{4})/g, '$1 ').trim()
    : '';
  return (
    <>
      {card.cardholderName && <FieldRow label="Cardholder Name" value={card.cardholderName} />}
      {card.number         && <FieldRow label="Card Number" value={card.number} secret mono />}
      {(card.expMonth || card.expYear) && (
        <FieldRow label="Expiry" value={`${card.expMonth ?? '??'} / ${card.expYear ?? '????'}`} />
      )}
      {card.cvv  && <FieldRow label="CVV" value={card.cvv} secret mono />}
      {card.brand && <FieldRow label="Brand" value={card.brand} />}
    </>
  );
}

function IdentityFields({ item }: { item: VaultItem }) {
  const id = item.identity;
  if (!id) return null;
  const fullName = [id.firstName, id.lastName].filter(Boolean).join(' ');
  return (
    <>
      {fullName      && <FieldRow label="Full Name"        value={fullName} />}
      {id.email      && <FieldRow label="Email"            value={id.email} />}
      {id.phone      && <FieldRow label="Phone"            value={id.phone} />}
      {id.address1   && <FieldRow label="Address"          value={[id.address1, id.city, id.state, id.zip, id.country].filter(Boolean).join(', ')} />}
      {id.passportNumber && <FieldRow label="Passport"     value={id.passportNumber} secret />}
      {id.ssn        && <FieldRow label="SSN"              value={id.ssn} secret mono />}
    </>
  );
}

function typeIcon(type: string) {
  const m: Record<string, string> = {
    login: '🔑', secure_note: '📝', card: '💳', identity: '👤',
    oauth: '🔐', email_alias: '📧', authenticator: '🕒',
  };
  return m[type] ?? '🗄️';
}

function typeName(type: string) {
  const m: Record<string, string> = {
    login: 'Login', secure_note: 'Secure Note', card: 'Card',
    identity: 'Identity', oauth: 'OAuth', email_alias: 'Email Alias', authenticator: '2FA',
  };
  return m[type] ?? type;
}
