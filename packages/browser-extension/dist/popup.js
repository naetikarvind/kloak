"use strict";
/**
 * Kloak Browser Extension — Popup Logic
 * Authentic Proton Pass design: theme colors, category icons, add menu & credentials creator.
 */
let allItems = [];
let activeItem = null;
let currentTabId;
let isEditing = false;
let totpInterval = null;
let addTotpInterval = null;
// Proton Pass Category Icons
const PROTON_ICONS = {
    login: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    alias: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71c-.36-.45-.91-.7-1.5-.7-1.25 0-2.38 1.05-2.38 2.41 0 1.34 1.13 2.41 2.38 2.41.59 0 1.14-.25 1.5-.7v.58c0 .88-.72 1.6-1.6 1.6-.74 0-1.39-.5-1.55-1.21l-1.36.32c.28 1.25 1.41 2.09 2.91 2.09 1.65 0 2.8-1.15 2.8-2.8V9.5h-1.2v.79zm-1.5 2.82c-.66 0-1.2-.54-1.2-1.21 0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2 0 .67-.54 1.21-1.2 1.21z',
    card: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
    note: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    identity: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V18z',
    authenticator: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z'
};
const PROTON_COLORS = {
    login: '#6D4AFF',
    alias: '#00D2B4',
    card: '#FF884D',
    note: '#4D96FF',
    identity: '#E066FF',
    authenticator: '#29C98F'
};
let activeTabUrl = '';
let activeDomain = '';
document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab?.id;
    activeTabUrl = tab?.url || '';
    try {
        if (activeTabUrl.startsWith('http')) {
            activeDomain = new URL(activeTabUrl).hostname.replace('www.', '');
        }
    }
    catch { /* ignore */ }
    setupSearch();
    setupAddDropdown();
    setupSortDropdown();
    await loadLogins();
});
let currentSortMode = 'recent';
// ── Search & Filter ──
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', () => {
        applyFilterAndSort();
    });
    const filterAllBtn = document.getElementById('filter-all');
    filterAllBtn?.addEventListener('click', () => {
        if (searchInput)
            searchInput.value = '';
        filterAllBtn.classList.add('active');
        applyFilterAndSort();
    });
}
// ── Sort Dropdown ──
function setupSortDropdown() {
    const btnSort = document.getElementById('btn-sort');
    const sortDropdown = document.getElementById('sort-dropdown');
    const sortLabel = document.getElementById('sort-label');
    if (!btnSort || !sortDropdown)
        return;
    btnSort.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('add-dropdown')?.classList.remove('open');
        sortDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => {
        sortDropdown.classList.remove('open');
    });
    sortDropdown.querySelectorAll('.sort-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const sort = item.dataset.sort;
            if (sort) {
                currentSortMode = sort;
                sortDropdown.querySelectorAll('.sort-item').forEach(si => si.classList.remove('active'));
                item.classList.add('active');
                const labels = {
                    recent: 'Recent',
                    alpha: 'A to Z',
                    newest: 'Newest',
                    oldest: 'Oldest'
                };
                const sortIcons = {
                    recent: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>',
                    alpha: '<path d="M9.25 5l-4.5 12h2.09l.94-2.75h4.44l.94 2.75h2.09L10.75 5h-1.5zm-.53 7.42l1.53-4.5 1.53 4.5H8.72zM15 15h6v1.75h-6V15zm0-3.5h6v1.75h-6V11.5zm0-3.5h6v1.75h-6V8z"/>',
                    newest: '<path d="M19 15l-1.41-1.41L13 18.17V2h-2v16.17l-4.59-4.59L5 15l7 7 7-7z"/>',
                    oldest: '<path d="M5 9l1.41 1.41L11 5.83V22h2V5.83l4.59 4.59L19 9l-7-7-7 7z"/>'
                };
                if (sortLabel)
                    sortLabel.textContent = labels[sort] || 'Sort';
                const btnIcon = document.getElementById('sort-btn-icon');
                if (btnIcon && sortIcons[sort])
                    btnIcon.innerHTML = sortIcons[sort];
                sortDropdown.classList.remove('open');
                applyFilterAndSort();
            }
        });
    });
}
function sortItems(items) {
    const copy = [...items];
    switch (currentSortMode) {
        case 'alpha':
            return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        case 'newest':
            return copy.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
        case 'oldest':
            return copy.sort((a, b) => new Date(a.createdAt || a.updatedAt || 0).getTime() - new Date(b.createdAt || b.updatedAt || 0).getTime());
        case 'recent':
        default:
            return copy.sort((a, b) => {
                const timeA = new Date(a.lastUsedAt || a.updatedAt || a.createdAt || 0).getTime();
                const timeB = new Date(b.lastUsedAt || b.updatedAt || b.createdAt || 0).getTime();
                return timeB - timeA;
            });
    }
}
function applyFilterAndSort() {
    const searchInput = document.getElementById('search-input');
    const query = (searchInput?.value || '').toLowerCase();
    let filtered = allItems;
    if (query) {
        filtered = allItems.filter(item => (item.title || '').toLowerCase().includes(query) ||
            (item.username || '').toLowerCase().includes(query) ||
            (item.urls || []).some((u) => u.toLowerCase().includes(query)));
    }
    const sorted = sortItems(filtered);
    renderSidebarList(sorted);
}
// ── Add Dropdown ──
function setupAddDropdown() {
    const btn = document.getElementById('btn-add');
    const dropdown = document.getElementById('add-dropdown');
    if (!btn || !dropdown)
        return;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
    });
    dropdown.querySelectorAll('.add-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = item.dataset.type || 'login';
            dropdown.classList.remove('open');
            showAddForm(type);
        });
    });
}
// ── Proton Pass Creation Pages ──
function showAddForm(type) {
    const container = document.getElementById('detail-pane');
    if (!container)
        return;
    if (totpInterval) {
        clearInterval(totpInterval);
        totpInterval = null;
    }
    if (addTotpInterval) {
        clearInterval(addTotpInterval);
        addTotpInterval = null;
    }
    const typeConfig = {
        login: { title: 'New login', icon: PROTON_ICONS.login, color: PROTON_COLORS.login },
        alias: { title: 'New alias', icon: PROTON_ICONS.alias, color: PROTON_COLORS.alias },
        card: { title: 'New credit card', icon: PROTON_ICONS.card, color: PROTON_COLORS.card },
        note: { title: 'New encrypted note', icon: PROTON_ICONS.note, color: PROTON_COLORS.note },
        identity: { title: 'New identity', icon: PROTON_ICONS.identity, color: PROTON_COLORS.identity },
        authenticator: { title: 'New Authenticator (2FA)', icon: PROTON_ICONS.authenticator, color: PROTON_COLORS.authenticator }
    };
    const cfg = typeConfig[type] || typeConfig.login;
    let formHtml = `
    <div class="creation-header">
      <div class="creation-title-group">
        <button class="btn-back" id="btn-cancel-create" title="Back">
          <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div class="detail-title" style="font-size: 16px;">${cfg.title}</div>
      </div>
      <div class="detail-actions">
        <button class="btn-pill" id="btn-save-create" style="background: var(--accent); color: #fff; font-weight: 600;">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Save
        </button>
      </div>
    </div>

    <div class="vault-selector-badge">
      <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
      <span>Personal Vault</span>
    </div>
  `;
    if (type === 'login') {
        formHtml += `
      <!-- Title & Favicon -->
      <div class="card">
        <div class="card-row">
          <div class="card-icon" id="title-avatar-box" style="color: ${cfg.color};">
            <svg viewBox="0 0 24 24"><path d="${cfg.icon}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Title / Service</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. GitHub, Google, Netflix">
          </div>
        </div>
      </div>

      <!-- Credentials Card -->
      <div class="card">
        <!-- Username/Email -->
        <div class="card-row">
          <div class="card-icon">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div class="card-content">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="card-label">Username or email</div>
              <span id="btn-gen-alias" style="font-size: 10px; color: var(--color-alias); cursor: pointer; font-weight: 500;">+ Generate alias</span>
            </div>
            <input type="text" class="edit-input" id="field-username" placeholder="user@example.com">
          </div>
        </div>

        <!-- Password -->
        <div class="card-row" style="flex-direction: column; align-items: stretch;">
          <div style="display: flex; align-items: center; width: 100%;">
            <div class="card-icon" style="color: var(--color-login);">
              <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.login}"/></svg>
            </div>
            <div class="card-content" style="margin-right: 8px;">
              <div class="card-label">Password</div>
              <input type="password" class="edit-input" id="field-password" placeholder="Enter or generate password">
            </div>
            <div class="card-actions">
              <div class="action-icon" id="btn-toggle-create-pwd" title="Toggle visibility">
                <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </div>
              <div class="action-icon" id="btn-toggle-gen-panel" title="Password generator" style="color: var(--accent);">
                <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7 7h2v2H7V7zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm10 2h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>
              </div>
            </div>
          </div>

          <!-- Password Strength Meter -->
          <div class="strength-wrapper" id="strength-box" style="display: none;">
            <div class="strength-bars">
              <div class="strength-segment" id="str-1"></div>
              <div class="strength-segment" id="str-2"></div>
              <div class="strength-segment" id="str-3"></div>
              <div class="strength-segment" id="str-4"></div>
            </div>
            <div class="strength-label" id="str-label">Strength</div>
          </div>

          <!-- Inline Proton Pass Style Generator Panel -->
          <div class="inline-gen-panel" id="gen-panel" style="display: none;">
            <div class="gen-row">
              <span style="font-weight: 500; color: var(--text-main);">Length</span>
              <div class="gen-slider-container">
                <input type="range" class="gen-slider" id="gen-length-slider" min="8" max="64" value="20">
                <span id="gen-length-num" style="font-weight: 600; color: var(--accent); min-width: 20px;">20</span>
              </div>
            </div>
            <div class="gen-options-row">
              <label class="gen-chip active" id="chip-upper"><input type="checkbox" checked id="chk-upper"> A-Z</label>
              <label class="gen-chip active" id="chip-lower"><input type="checkbox" checked id="chk-lower"> a-z</label>
              <label class="gen-chip active" id="chip-digits"><input type="checkbox" checked id="chk-digits"> 0-9</label>
              <label class="gen-chip active" id="chip-symbols"><input type="checkbox" checked id="chk-symbols"> !@#$%</label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
              <button class="btn-pill" id="btn-regen-pwd" style="height: 24px; font-size: 11px;">
                <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                Regenerate
              </button>
              <button class="btn-pill" id="btn-apply-pwd" style="height: 24px; font-size: 11px; background: var(--accent); color: #fff;">Use Password</button>
            </div>
          </div>
        </div>

        <!-- 2FA (TOTP) Secret Key -->
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-note);">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">2FA Secret Key (TOTP)</div>
            <input type="text" class="edit-input" id="field-totp" placeholder="Base32 key (e.g. JBSWY3DPEHPK3PXP)">
            <div id="totp-preview-container" style="display: none;">
              <div class="totp-inline-preview" id="totp-live-badge">
                <span>Code: </span><span id="totp-live-code">------</span>
                <span id="totp-live-timer" style="font-size: 10px; opacity: 0.8;">⏱ 30s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Websites Card -->
      <div class="card">
        <div class="card-row" style="flex-direction: column; align-items: stretch;">
          <div class="card-label" style="margin-bottom: 6px;">Websites</div>
          <div id="url-inputs-container">
            <div class="multi-url-row">
              <div class="card-icon" style="margin-right: 6px;">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </div>
              <input type="text" class="edit-input url-input" placeholder="https://example.com">
            </div>
          </div>
          <button class="btn-add-inline" id="btn-add-more-url">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add another website
          </button>
        </div>
      </div>

      <!-- Notes Card -->
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-note);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.note}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Note</div>
            <textarea class="edit-input" id="field-notes" rows="3" placeholder="Security questions, recovery codes, or notes..."></textarea>
          </div>
        </div>
      </div>
    `;
    }
    else if (type === 'alias') {
        const randomAlias = `kloak.${Math.random().toString(36).substring(2, 7)}@kloak.link`;
        formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-alias);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.alias}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Title / Purpose</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. Online Shopping, Newsletter">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Generated Alias Email</div>
            <input type="text" class="edit-input" id="field-username" value="${randomAlias}">
          </div>
          <div class="card-actions">
            <div class="action-icon" id="btn-refresh-alias" title="Generate another alias" style="color: var(--color-alias);">
              <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </div>
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Forward To Real Email</div>
            <input type="text" class="edit-input" id="field-forward" placeholder="your.real.email@example.com">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Notes</div>
            <textarea class="edit-input" id="field-notes" rows="3" placeholder="Notes..."></textarea>
          </div>
        </div>
      </div>
    `;
    }
    else if (type === 'card') {
        formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-card);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.card}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Card Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. Personal Visa, Corporate Amex">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Cardholder Name</div>
            <input type="text" class="edit-input" id="field-cardholder" placeholder="Name on card">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Card Number</div>
            <input type="text" class="edit-input" id="field-cardnumber" placeholder="0000 0000 0000 0000" maxlength="19">
          </div>
        </div>
        <div class="card-row" style="gap: 12px;">
          <div class="card-content">
            <div class="card-label">Expiration (MM/YY)</div>
            <input type="text" class="edit-input" id="field-expiry" placeholder="MM/YY" maxlength="5">
          </div>
          <div class="card-content">
            <div class="card-label">Security Code (CVV)</div>
            <input type="password" class="edit-input" id="field-cvv" placeholder="CVV" maxlength="4">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Card PIN</div>
            <input type="password" class="edit-input" id="field-pin" placeholder="PIN" maxlength="6">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Notes</div>
            <textarea class="edit-input" id="field-notes" rows="2" placeholder="Bank phone, billing zip, etc."></textarea>
          </div>
        </div>
      </div>
    `;
    }
    else if (type === 'note') {
        formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-note);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.note}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="Note title...">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Content</div>
            <textarea class="edit-input" id="field-notes" rows="8" placeholder="Type your secure note here..." style="font-family: inherit; font-size: 13px; min-height: 140px;"></textarea>
          </div>
        </div>
      </div>
    `;
    }
    else if (type === 'identity') {
        formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-identity);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.identity}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Identity Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. My Passport, Personal Info">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row" style="gap: 12px;">
          <div class="card-content">
            <div class="card-label">First Name</div>
            <input type="text" class="edit-input" id="field-firstname" placeholder="First Name">
          </div>
          <div class="card-content">
            <div class="card-label">Last Name</div>
            <input type="text" class="edit-input" id="field-lastname" placeholder="Last Name">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Email</div>
            <input type="email" class="edit-input" id="field-email" placeholder="Email">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Phone Number</div>
            <input type="tel" class="edit-input" id="field-phone" placeholder="Phone">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Address</div>
            <input type="text" class="edit-input" id="field-address" placeholder="Street Address" style="margin-bottom: 6px;">
            <div style="display: flex; gap: 8px;">
              <input type="text" class="edit-input" id="field-city" placeholder="City">
              <input type="text" class="edit-input" id="field-zip" placeholder="ZIP" style="max-width: 80px;">
            </div>
          </div>
        </div>
      </div>
    `;
    }
    else if (type === 'authenticator') {
        formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-alias);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.authenticator}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Account / Service Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. AWS Root Account, GitHub 2FA">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Issuer / Service Name</div>
            <input type="text" class="edit-input" id="field-auth-issuer" placeholder="e.g. Amazon Web Services, GitHub">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Secret Key (Base32 or otpauth://)</div>
            <input type="text" class="edit-input" id="field-auth-secret" placeholder="JBSWY3DPEHPK3PXP" style="font-family: monospace;">
          </div>
        </div>
        <div class="card-row" style="gap: 8px;">
          <div class="card-content">
            <div class="card-label">Algorithm</div>
            <select class="edit-input" id="field-auth-algo" style="background: var(--bg-input);">
              <option value="TOTP">TOTP (Time)</option>
              <option value="HOTP">HOTP (Counter)</option>
            </select>
          </div>
          <div class="card-content">
            <div class="card-label">Digits</div>
            <select class="edit-input" id="field-auth-digits" style="background: var(--bg-input);">
              <option value="6">6 digits</option>
              <option value="8">8 digits</option>
            </select>
          </div>
          <div class="card-content">
            <div class="card-label">Period</div>
            <select class="edit-input" id="field-auth-period" style="background: var(--bg-input);">
              <option value="30">30s</option>
              <option value="60">60s</option>
            </select>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Notes (Optional)</div>
            <textarea class="edit-input" id="field-notes" rows="2" placeholder="Additional recovery details..."></textarea>
          </div>
        </div>
      </div>
    `;
    }
    container.innerHTML = formHtml;
    // ── Event Handlers ──
    document.getElementById('btn-cancel-create')?.addEventListener('click', () => {
        if (addTotpInterval) {
            clearInterval(addTotpInterval);
            addTotpInterval = null;
        }
        if (activeItem)
            renderDetailPane(activeItem);
        else
            container.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
    });
    if (type === 'login') {
        const titleInput = document.getElementById('field-title');
        const pwdInput = document.getElementById('field-password');
        const strengthBox = document.getElementById('strength-box');
        const genPanel = document.getElementById('gen-panel');
        titleInput?.addEventListener('input', () => {
            const val = titleInput.value.trim();
            const avatarBox = document.getElementById('title-avatar-box');
            if (!avatarBox)
                return;
            if (val.length > 2) {
                const domain = val.includes('.') ? val : `${val.toLowerCase().replace(/\s+/g, '')}.com`;
                avatarBox.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" style="width: 20px; height: 20px; border-radius: 4px;" onerror="this.remove()">`;
            }
        });
        document.getElementById('btn-gen-alias')?.addEventListener('click', () => {
            const userInput = document.getElementById('field-username');
            if (userInput) {
                const t = titleInput?.value ? titleInput.value.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
                userInput.value = `${t}.${Math.random().toString(36).substring(2, 6)}@kloak.link`;
            }
        });
        document.getElementById('btn-toggle-create-pwd')?.addEventListener('click', () => {
            if (pwdInput)
                pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
        });
        pwdInput?.addEventListener('input', () => {
            const p = pwdInput.value;
            if (!p) {
                if (strengthBox)
                    strengthBox.style.display = 'none';
                return;
            }
            if (strengthBox)
                strengthBox.style.display = 'flex';
            updateStrengthMeter(p);
        });
        document.getElementById('btn-toggle-gen-panel')?.addEventListener('click', () => {
            if (genPanel) {
                const isOpen = genPanel.style.display !== 'none';
                genPanel.style.display = isOpen ? 'none' : 'flex';
                if (!isOpen)
                    generateAndSetPreview();
            }
        });
        const slider = document.getElementById('gen-length-slider');
        const numDisplay = document.getElementById('gen-length-num');
        slider?.addEventListener('input', () => {
            if (numDisplay)
                numDisplay.textContent = slider.value;
            generateAndSetPreview();
        });
        ['chk-upper', 'chk-lower', 'chk-digits', 'chk-symbols'].forEach(id => {
            const el = document.getElementById(id);
            el?.parentElement?.addEventListener('click', (e) => {
                if (e.target !== el)
                    el.checked = !el.checked;
                el.parentElement?.classList.toggle('active', el.checked);
                generateAndSetPreview();
            });
        });
        function generateAndSetPreview() {
            const len = parseInt(slider?.value || '20', 10);
            const upper = document.getElementById('chk-upper')?.checked;
            const lower = document.getElementById('chk-lower')?.checked;
            const digits = document.getElementById('chk-digits')?.checked;
            const symbols = document.getElementById('chk-symbols')?.checked;
            let chars = '';
            if (upper)
                chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            if (lower)
                chars += 'abcdefghijklmnopqrstuvwxyz';
            if (digits)
                chars += '0123456789';
            if (symbols)
                chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
            if (!chars)
                chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let pwd = '';
            for (let i = 0; i < len; i++) {
                pwd += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            if (pwdInput) {
                pwdInput.value = pwd;
                if (strengthBox)
                    strengthBox.style.display = 'flex';
                updateStrengthMeter(pwd);
            }
        }
        document.getElementById('btn-regen-pwd')?.addEventListener('click', generateAndSetPreview);
        document.getElementById('btn-apply-pwd')?.addEventListener('click', () => {
            if (genPanel)
                genPanel.style.display = 'none';
        });
        const totpInput = document.getElementById('field-totp');
        const totpPreviewBox = document.getElementById('totp-preview-container');
        totpInput?.addEventListener('input', () => {
            const key = totpInput.value.trim().replace(/\s+/g, '');
            if (key.length >= 8) {
                if (totpPreviewBox)
                    totpPreviewBox.style.display = 'block';
                startAddTotpLivePreview(key);
            }
            else {
                if (totpPreviewBox)
                    totpPreviewBox.style.display = 'none';
                if (addTotpInterval) {
                    clearInterval(addTotpInterval);
                    addTotpInterval = null;
                }
            }
        });
        document.getElementById('btn-add-more-url')?.addEventListener('click', () => {
            const urlContainer = document.getElementById('url-inputs-container');
            if (!urlContainer)
                return;
            const row = document.createElement('div');
            row.className = 'multi-url-row';
            row.innerHTML = `
        <div class="card-icon" style="margin-right: 6px;">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
        <input type="text" class="edit-input url-input" placeholder="https://">
        <div class="action-icon btn-del-url" style="color: var(--danger);"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>
      `;
            row.querySelector('.btn-del-url')?.addEventListener('click', () => row.remove());
            urlContainer.appendChild(row);
        });
    }
    if (type === 'alias') {
        document.getElementById('btn-refresh-alias')?.addEventListener('click', () => {
            const aliasInput = document.getElementById('field-username');
            if (aliasInput) {
                aliasInput.value = `kloak.${Math.random().toString(36).substring(2, 7)}@kloak.link`;
            }
        });
    }
    if (type === 'card') {
        const cardInput = document.getElementById('field-cardnumber');
        cardInput?.addEventListener('input', () => {
            let v = cardInput.value.replace(/\D/g, '').substring(0, 16);
            cardInput.value = v.replace(/(\d{4})/g, '$1 ').trim();
        });
        const expInput = document.getElementById('field-expiry');
        expInput?.addEventListener('input', () => {
            let v = expInput.value.replace(/\D/g, '').substring(0, 4);
            if (v.length >= 2)
                expInput.value = `${v.substring(0, 2)}/${v.substring(2)}`;
            else
                expInput.value = v;
        });
    }
    // ── SAVE ACTION ──
    document.getElementById('btn-save-create')?.addEventListener('click', () => {
        if (addTotpInterval) {
            clearInterval(addTotpInterval);
            addTotpInterval = null;
        }
        const title = document.getElementById('field-title')?.value || 'Untitled';
        const notes = document.getElementById('field-notes')?.value || '';
        const newItem = {
            title,
            notes,
            urls: [],
            createdAt: new Date().toISOString()
        };
        if (type === 'login') {
            newItem.type = 'login';
            newItem.username = document.getElementById('field-username')?.value || '';
            newItem.password = document.getElementById('field-password')?.value || '';
            const totp = document.getElementById('field-totp')?.value || '';
            if (totp)
                newItem.totpSecret = totp.replace(/\s+/g, '');
            const urlInputs = document.querySelectorAll('.url-input');
            urlInputs.forEach(u => {
                if (u.value.trim())
                    newItem.urls.push(u.value.trim());
            });
        }
        else if (type === 'alias') {
            const aliasMail = document.getElementById('field-username')?.value || '';
            const fwd = document.getElementById('field-forward')?.value || '';
            newItem.type = 'email_alias';
            newItem.username = aliasMail;
            newItem.alias = {
                aliasEmail: aliasMail,
                forwardTo: fwd,
                provider: 'DuckDuckGo'
            };
            newItem.notes = fwd ? `Forwarding to: ${fwd}\n${notes}` : notes;
        }
        else if (type === 'card') {
            const cardNum = document.getElementById('field-cardnumber')?.value || '';
            const cardHolder = document.getElementById('field-cardholder')?.value || '';
            const expiry = document.getElementById('field-expiry')?.value || '';
            const cvv = document.getElementById('field-cvv')?.value || '';
            const pin = document.getElementById('field-pin')?.value || '';
            const [expM, expY] = expiry.split('/');
            newItem.type = 'card';
            newItem.username = cardHolder ? `${cardHolder} (•••• ${cardNum.slice(-4)})` : `•••• ${cardNum.slice(-4)}`;
            newItem.password = cvv;
            newItem.card = {
                cardholderName: cardHolder,
                number: cardNum.replace(/\s+/g, ''),
                brand: 'visa',
                expMonth: expM,
                expYear: expY,
                cvv
            };
            newItem.notes = `Card: ${cardNum}\nExpiry: ${expiry}\nCVV: ${cvv}${pin ? '\nPIN: ' + pin : ''}\n${notes}`;
        }
        else if (type === 'identity') {
            const fn = document.getElementById('field-firstname')?.value || '';
            const ln = document.getElementById('field-lastname')?.value || '';
            const em = document.getElementById('field-email')?.value || '';
            const ph = document.getElementById('field-phone')?.value || '';
            const addr = document.getElementById('field-address')?.value || '';
            const city = document.getElementById('field-city')?.value || '';
            const zip = document.getElementById('field-zip')?.value || '';
            newItem.type = 'identity';
            newItem.username = `${fn} ${ln}`.trim() || em;
            newItem.email = em;
            newItem.identity = {
                firstName: fn,
                lastName: ln,
                email: em,
                phone: ph,
                address1: addr,
                city,
                zip
            };
            newItem.notes = `Phone: ${ph}\nAddress: ${addr}, ${city} ${zip}\n${notes}`;
        }
        else if (type === 'authenticator') {
            const issuer = document.getElementById('field-auth-issuer')?.value || '';
            const secret = document.getElementById('field-auth-secret')?.value || '';
            const algo = document.getElementById('field-auth-algo')?.value || 'TOTP';
            const digits = parseInt(document.getElementById('field-auth-digits')?.value || '6', 10);
            const period = parseInt(document.getElementById('field-auth-period')?.value || '30', 10);
            newItem.type = 'authenticator';
            newItem.username = issuer || undefined;
            newItem.totpSecret = secret.replace(/\s+/g, '') || undefined;
            newItem.authenticatorDetails = {
                issuer: issuer || undefined,
                algorithm: algo,
                digits,
                period
            };
        }
        else if (type === 'note') {
            newItem.type = 'secure_note';
        }
        chrome.runtime.sendMessage({ type: 'ADD_ITEM', item: newItem }, (res) => {
            if (res?.success) {
                const created = res.item || newItem;
                allItems.push(created);
                renderSidebarList(allItems);
                selectItem(created);
            }
        });
    });
}
function updateStrengthMeter(pwd) {
    let score = 0;
    if (pwd.length >= 8)
        score++;
    if (pwd.length >= 14)
        score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd))
        score++;
    if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd))
        score++;
    const colors = ['#F54A4A', '#FF884D', '#FFB800', '#29C98F'];
    const labels = ['Weak', 'Fair', 'Good', 'Strong'];
    for (let i = 1; i <= 4; i++) {
        const seg = document.getElementById(`str-${i}`);
        if (seg) {
            seg.style.background = i <= score ? colors[score - 1] : '#312E40';
        }
    }
    const lbl = document.getElementById('str-label');
    if (lbl) {
        lbl.textContent = score > 0 ? labels[score - 1] : 'Very weak';
        lbl.style.color = score > 0 ? colors[score - 1] : 'var(--text-muted)';
    }
}
function startAddTotpLivePreview(secret) {
    if (addTotpInterval)
        clearInterval(addTotpInterval);
    const update = () => {
        const code = generateTOTP(secret);
        const codeEl = document.getElementById('totp-live-code');
        const timerEl = document.getElementById('totp-live-timer');
        if (codeEl)
            codeEl.textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
        if (timerEl) {
            const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            timerEl.textContent = `⏱ ${remaining}s`;
        }
    };
    update();
    addTotpInterval = window.setInterval(update, 1000);
}
// ── Global Copy Helper ──
async function copyToClipboardText(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    }
    catch { /* ignore */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
    }
    catch {
        return false;
    }
}
// ── Smart Contextual Suggestions (Matching macOS helper) ──
function renderSmartSuggestions(items) {
    const container = document.getElementById('suggested-container');
    const titleEl = document.getElementById('suggested-title');
    const listEl = document.getElementById('suggested-list');
    if (!container || !titleEl || !listEl)
        return;
    if (!activeDomain) {
        container.style.display = 'none';
        return;
    }
    const cleanDomain = activeDomain.toLowerCase();
    const domainPrefix = cleanDomain.split('.')[0];
    const matched = items.filter(item => {
        const titleMatch = (item.title || '').toLowerCase().includes(domainPrefix);
        const urlMatch = (item.urls || []).some((u) => {
            try {
                return new URL(u).hostname.replace('www.', '').toLowerCase() === cleanDomain;
            }
            catch {
                return u.toLowerCase().includes(cleanDomain);
            }
        });
        return titleMatch || urlMatch;
    });
    if (matched.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    titleEl.textContent = `SUGGESTED FOR ${activeDomain.toUpperCase()}`;
    listEl.innerHTML = '';
    matched.slice(0, 3).forEach(item => {
        const row = document.createElement('div');
        row.className = 'suggested-row';
        const avatar = document.createElement('div');
        avatar.className = 'item-avatar';
        renderItemAvatar(avatar, item, 26);
        const info = document.createElement('div');
        info.className = 'item-info';
        const titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = item.title || activeDomain;
        const subDiv = document.createElement('div');
        subDiv.className = 'item-subtitle';
        subDiv.textContent = item.username || 'no username';
        info.appendChild(titleDiv);
        info.appendChild(subDiv);
        const btn = document.createElement('button');
        btn.className = 'btn-suggested-action';
        btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
      <span>Copy Pass</span>
    `;
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (item.password) {
                await copyToClipboardText(item.password);
                btn.classList.add('copied');
                btn.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span>Copied</span>
        `;
                if (currentTabId) {
                    chrome.tabs.sendMessage(currentTabId, {
                        type: 'INJECT_CREDENTIALS',
                        username: item.username,
                        password: item.password
                    }).catch(() => null);
                }
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `
            <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
            <span>Copy Pass</span>
          `;
                }, 1800);
            }
        });
        row.appendChild(avatar);
        row.appendChild(info);
        row.appendChild(btn);
        row.addEventListener('click', () => selectItem(item));
        listEl.appendChild(row);
    });
}
// ── Load Logins ──
async function loadLogins(retryCount = 0) {
    chrome.runtime.sendMessage({ type: 'SEARCH_VAULT', query: '' }, (searchRes) => {
        if (searchRes && searchRes.isUnlocked && Array.isArray(searchRes.items) && searchRes.items.length > 0) {
            allItems = searchRes.items;
            renderSmartSuggestions(allItems);
            applyFilterAndSort();
            const sorted = sortItems(allItems);
            if (sorted.length > 0 && !activeItem)
                selectItem(sorted[0]);
        }
        else if (searchRes && searchRes.isUnlocked) {
            allItems = searchRes.items || [];
            renderSmartSuggestions(allItems);
            applyFilterAndSort();
        }
        else {
            chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (statusRes) => {
                if (statusRes && statusRes.isUnlocked && retryCount < 2) {
                    setTimeout(() => loadLogins(retryCount + 1), 300);
                }
                else if (!statusRes || !statusRes.isUnlocked) {
                    const container = document.getElementById('sidebar-list');
                    if (container) {
                        container.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 11px;">Vault is locked.<br>Open the macOS app to unlock.</div>';
                    }
                }
            });
        }
    });
}
// ── Brand Recognition & Favicon Engine ──
const BRAND_DOMAINS = {
    "gemini": "gemini.google.com",
    "google gemini": "gemini.google.com",
    "deepmind": "deepmind.google",
    "chatgpt": "openai.com",
    "openai": "openai.com",
    "claude": "anthropic.com",
    "anthropic": "anthropic.com",
    "github": "github.com",
    "copilot": "github.com",
    "cursor": "cursor.com",
    "proton": "proton.me",
    "protonmail": "proton.me",
    "proton mail": "proton.me",
    "google": "google.com",
    "gmail": "google.com",
    "google workspace": "google.com",
    "apple": "apple.com",
    "icloud": "apple.com",
    "apple card": "apple.com",
    "amazon": "amazon.com",
    "aws": "aws.amazon.com",
    "netflix": "netflix.com",
    "spotify": "spotify.com",
    "discord": "discord.com",
    "slack": "slack.com",
    "notion": "notion.so",
    "figma": "figma.com",
    "dropbox": "dropbox.com",
    "huggingface": "huggingface.co",
    "replicate": "replicate.com",
    "midjourney": "midjourney.com",
    "perplexity": "perplexity.ai",
    "twitter": "x.com",
    "x.com": "x.com",
    "reddit": "reddit.com",
    "linkedin": "linkedin.com",
    "facebook": "facebook.com",
    "meta": "meta.com",
    "instagram": "instagram.com",
    "gitlab": "gitlab.com",
    "bitbucket": "bitbucket.org",
    "atlassian": "atlassian.com",
    "stripe": "stripe.com",
    "paypal": "paypal.com",
    "linear": "linear.app",
    "vercel": "vercel.com",
    "supabase": "supabase.com",
    "tailscale": "tailscale.com",
    "docker": "docker.com",
    "cloudflare": "cloudflare.com",
    "digitalocean": "digitalocean.com",
    "heroku": "heroku.com",
    "zoom": "zoom.us",
    "uber": "uber.com",
    "airbnb": "airbnb.com",
    "pinterest": "pinterest.com",
    "twitch": "twitch.tv",
    "steam": "steampowered.com",
    "epic games": "epicgames.com",
    "playstation": "playstation.com",
    "xbox": "xbox.com",
    "nintendo": "nintendo.com",
    "ebay": "ebay.com",
    "adobe": "adobe.com",
    "shopify": "shopify.com",
    "whatsapp": "whatsapp.com",
    "telegram": "telegram.org",
    "signal": "signal.org",
    "1password": "1password.com",
    "bitwarden": "bitwarden.com",
    "chase": "chase.com",
    "bank of america": "bankofamerica.com",
    "wells fargo": "wellsfargo.com",
    "citi": "citi.com",
    "american express": "americanexpress.com",
    "amex": "americanexpress.com",
    "mastercard": "mastercard.com",
    "visa": "visa.com",
    "hotstar": "hotstar.com",
    "tabrr": "tabrr.com",
    "dribbble": "dribbble.com",
    "macked": "mcdonalds.com",
    "mcdonald": "mcdonalds.com",
    "roblox": "roblox.com",
    "bandlab": "bandlab.com",
    "scratch": "scratch.mit.edu",
    "entrar": "entrar.in",
    "entr": "entrar.in",
    "codeskool": "codeskool.cc",
    "office": "microsoft.com",
    "officeapps": "microsoft.com",
    "live.com": "microsoft.com",
    "microsoft": "microsoft.com"
};
function cleanDomainHost(h) {
    let domain = h.toLowerCase().trim();
    const prefixes = ["www.", "app.", "mail.", "accounts.", "login.", "signin.", "auth.", "m.", "dashboard.", "portal.", "api.", "sso.", "my.", "web."];
    for (const p of prefixes) {
        if (domain.startsWith(p)) {
            domain = domain.slice(p.length);
            break;
        }
    }
    return domain;
}
function resolveItemDomains(item) {
    const domains = [];
    // 1. From OAuth provider
    if (item.oauth?.provider) {
        const prov = item.oauth.provider.toLowerCase().trim();
        if (BRAND_DOMAINS[prov])
            domains.push(BRAND_DOMAINS[prov]);
    }
    // 2. From URLs
    if (item.urls && Array.isArray(item.urls)) {
        for (const u of item.urls) {
            if (!u || typeof u !== 'string')
                continue;
            const str = u.trim();
            let host = '';
            try {
                if (str.includes('://')) {
                    host = new URL(str).hostname;
                }
                else {
                    host = new URL('https://' + str).hostname;
                }
            }
            catch { }
            if (host) {
                const cleaned = cleanDomainHost(host);
                if (!domains.includes(cleaned))
                    domains.push(cleaned);
                if (cleaned !== host && !domains.includes(host))
                    domains.push(host);
            }
        }
    }
    // 3. From Title (Brand inference)
    const title = (item.title || '').toLowerCase().trim();
    for (const [brand, dom] of Object.entries(BRAND_DOMAINS)) {
        if (title === brand || title.includes(brand)) {
            if (!domains.includes(dom))
                domains.push(dom);
            break;
        }
    }
    // 4. If title itself looks like a domain (e.g. entrar.in or odc.officeapps.live.com)
    if (title.includes('.') && !title.includes(' ')) {
        const cleaned = cleanDomainHost(title);
        if (!domains.includes(cleaned))
            domains.push(cleaned);
    }
    return domains;
}
function getFaviconCandidates(domain) {
    return [
        `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        `https://logo.clearbit.com/${domain}?size=64`,
        `https://unavatar.io/${domain}?fallback=false`
    ];
}
function getInitialLetter(item) {
    return (item.title || '?').charAt(0).toUpperCase();
}
function renderItemAvatar(avatarEl, item, size = 32) {
    avatarEl.innerHTML = '';
    avatarEl.classList.remove('has-image');
    const domains = resolveItemDomains(item);
    if (domains.length === 0) {
        if (item.type && item.type !== 'login' && PROTON_ICONS[item.type]) {
            avatarEl.innerHTML = `<svg viewBox="0 0 24 24" style="width: ${Math.round(size * 0.5)}px; height: ${Math.round(size * 0.5)}px; fill: currentColor;"><path d="${PROTON_ICONS[item.type]}"/></svg>`;
            avatarEl.style.color = PROTON_COLORS[item.type] || 'var(--text-muted)';
        }
        else {
            avatarEl.textContent = getInitialLetter(item);
            avatarEl.style.color = 'var(--text-muted)';
        }
        return;
    }
    const candidateUrls = [];
    for (const d of domains) {
        candidateUrls.push(...getFaviconCandidates(d));
    }
    let candidateIdx = 0;
    const tryNext = () => {
        if (candidateIdx >= candidateUrls.length) {
            avatarEl.classList.remove('has-image');
            avatarEl.innerHTML = '';
            if (item.type && item.type !== 'login' && PROTON_ICONS[item.type]) {
                avatarEl.innerHTML = `<svg viewBox="0 0 24 24" style="width: ${Math.round(size * 0.5)}px; height: ${Math.round(size * 0.5)}px; fill: currentColor;"><path d="${PROTON_ICONS[item.type]}"/></svg>`;
                avatarEl.style.color = PROTON_COLORS[item.type] || 'var(--text-muted)';
            }
            else {
                avatarEl.textContent = getInitialLetter(item);
                avatarEl.style.color = 'var(--text-muted)';
            }
            return;
        }
        const img = document.createElement('img');
        img.src = candidateUrls[candidateIdx];
        img.onload = () => {
            if (img.naturalWidth <= 2 || img.naturalHeight <= 2) {
                candidateIdx++;
                tryNext();
                return;
            }
            avatarEl.innerHTML = '';
            avatarEl.classList.add('has-image');
            avatarEl.appendChild(img);
        };
        img.onerror = () => {
            candidateIdx++;
            tryNext();
        };
    };
    tryNext();
}
// ── Sidebar List ──
function renderSidebarList(items) {
    const container = document.getElementById('sidebar-list');
    if (!container)
        return;
    if (items.length === 0) {
        container.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 11px;">No items found.</div>';
        return;
    }
    container.innerHTML = '';
    const groupHeader = document.createElement('div');
    groupHeader.className = 'list-group-header';
    groupHeader.textContent = 'All items';
    container.appendChild(groupHeader);
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = `list-item ${activeItem?.id === item.id ? 'active' : ''}`;
        const avatar = document.createElement('div');
        avatar.className = 'item-avatar';
        renderItemAvatar(avatar, item, 32);
        const info = document.createElement('div');
        info.className = 'item-info';
        const titleEl = document.createElement('div');
        titleEl.className = 'item-title';
        titleEl.textContent = item.title || 'Untitled';
        const subEl = document.createElement('div');
        subEl.className = 'item-subtitle';
        const subText = item.username || item.identity?.fullName || item.card?.cardholderName || item.alias?.aliasEmail || item.authenticatorDetails?.issuer || (item.type === 'secure_note' ? 'Encrypted Note' : 'no username');
        subEl.textContent = subText;
        info.appendChild(titleEl);
        info.appendChild(subEl);
        row.appendChild(avatar);
        row.appendChild(info);
        row.addEventListener('click', () => selectItem(item));
        container.appendChild(row);
    });
}
function selectItem(item) {
    activeItem = item;
    if (totpInterval) {
        clearInterval(totpInterval);
        totpInterval = null;
    }
    if (addTotpInterval) {
        clearInterval(addTotpInterval);
        addTotpInterval = null;
    }
    renderSidebarList(allItems);
    renderDetailPane(item);
}
// ── Detail Pane (View Mode) ──
function renderDetailPane(item) {
    const container = document.getElementById('detail-pane');
    if (!container)
        return;
    isEditing = false;
    if (!item) {
        container.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
        return;
    }
    const title = item.title || 'Untitled';
    const username = item.username || '';
    const email = item.email || '';
    const hasTotp = !!item.totpSecret;
    const notes = item.notes || '';
    const urls = item.urls || [];
    container.innerHTML = '';
    // Header
    const header = document.createElement('div');
    header.className = 'detail-header';
    const titleGroup = document.createElement('div');
    titleGroup.style.display = 'flex';
    titleGroup.style.alignItems = 'center';
    titleGroup.style.gap = '10px';
    titleGroup.style.minWidth = '0';
    titleGroup.style.flex = '1';
    const headerAvatar = document.createElement('div');
    headerAvatar.className = 'item-avatar';
    headerAvatar.style.width = '32px';
    headerAvatar.style.height = '32px';
    headerAvatar.style.marginRight = '0';
    renderItemAvatar(headerAvatar, item, 32);
    const titleEl = document.createElement('div');
    titleEl.className = 'detail-title';
    titleEl.textContent = title;
    titleGroup.appendChild(headerAvatar);
    titleGroup.appendChild(titleEl);
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'detail-actions';
    actionsDiv.innerHTML = `
    <button class="btn-pill" id="btn-autofill">
      <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v2h2v5h2v-5h2v-2z"/></svg>
      Fill
    </button>
    <button class="btn-pill" id="btn-edit">
      <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      Edit
    </button>
  `;
    header.appendChild(titleGroup);
    header.appendChild(actionsDiv);
    container.appendChild(header);
    // Card 1: Username + Password
    const card1 = document.createElement('div');
    card1.className = 'card';
    // Username row
    if (username) {
        card1.innerHTML += `
      <div class="card-row">
        <div class="card-icon">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Username</div>
          <div class="card-value" id="user-val"></div>
        </div>
        <div class="card-actions">
          <div class="action-icon" id="copy-user" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </div>
        </div>
      </div>
    `;
    }
    // Email row
    if (email && email !== username) {
        card1.innerHTML += `
      <div class="card-row">
        <div class="card-icon" style="color: var(--color-alias);">
          <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.alias}"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Email</div>
          <div class="card-value" id="email-val"></div>
        </div>
        <div class="card-actions">
          <div class="action-icon" id="copy-email" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </div>
        </div>
      </div>
    `;
    }
    // Password row
    if (item.password) {
        card1.innerHTML += `
      <div class="card-row">
        <div class="card-icon" style="color: var(--color-login);">
          <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.login}"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Password</div>
          <div class="card-value" id="pwd-val" style="letter-spacing: 2px;">••••••••••</div>
        </div>
        <div class="card-actions">
          <div class="action-icon" id="toggle-pwd" title="Reveal">
            <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </div>
          <div class="action-icon" id="copy-pwd" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </div>
        </div>
      </div>
    `;
    }
    container.appendChild(card1);
    const userVal = document.getElementById('user-val');
    if (userVal)
        userVal.textContent = username;
    const emailVal = document.getElementById('email-val');
    if (emailVal)
        emailVal.textContent = email;
    // Card 2: 2FA Live Authenticator
    if (item.totpSecret) {
        const totpCard = document.createElement('div');
        totpCard.className = 'totp-container';
        totpCard.innerHTML = `
      <div class="totp-header">
        <div class="totp-label-group">
          <div class="totp-shield-icon">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          </div>
          <span class="totp-title">Authenticator</span>
        </div>
        <div class="totp-countdown-pill" id="totp-countdown-pill">
          <svg class="totp-countdown-svg" viewBox="0 0 24 24">
            <circle class="totp-svg-bg" cx="12" cy="12" r="9"></circle>
            <circle class="totp-svg-progress" id="totp-svg-progress" cx="12" cy="12" r="9"></circle>
          </svg>
          <span id="totp-timer-text">30s</span>
        </div>
      </div>
      <div class="totp-body-row" id="copy-totp-row" title="Click to copy code">
        <div class="totp-code-display" id="totp-code">------</div>
        <button class="totp-copy-btn" id="copy-totp-btn">
          <svg class="copy-icon-svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          <span id="totp-copy-text">Copy</span>
        </button>
      </div>
    `;
        container.appendChild(totpCard);
        // Setup Copy Handler
        const handleCopy = async (e) => {
            e.stopPropagation();
            const codeEl = document.getElementById('totp-code');
            const rawCode = (codeEl?.textContent || '').replace(/\s+/g, '');
            if (!rawCode || rawCode === '------')
                return;
            await copyToClipboardText(rawCode);
            const copyBtn = document.getElementById('copy-totp-btn');
            const copyText = document.getElementById('totp-copy-text');
            if (copyBtn && copyText) {
                copyBtn.classList.add('copied');
                copyText.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyText.textContent = 'Copy';
                }, 1800);
            }
        };
        totpCard.querySelector('#copy-totp-row')?.addEventListener('click', handleCopy);
        totpCard.querySelector('#copy-totp-btn')?.addEventListener('click', handleCopy);
        startTotpCounter(item.totpSecret);
    }
    // Card 3: Websites
    if (urls.length > 0) {
        const urlCard = document.createElement('div');
        urlCard.className = 'card';
        let urlHtml = '<div class="card-row"><div class="card-icon"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div><div class="card-content"><div class="card-label">Websites</div><div class="card-value">';
        urls.forEach((u) => {
            urlHtml += `<a class="url-pill" href="${u}" target="_blank" style="margin-right: 4px;">${u}</a>`;
        });
        urlHtml += '</div></div></div>';
        urlCard.innerHTML = urlHtml;
        container.appendChild(urlCard);
    }
    // Card 4: Notes
    if (notes) {
        const noteCard = document.createElement('div');
        noteCard.className = 'card';
        noteCard.innerHTML = `
      <div class="card-row">
        <div class="card-icon" style="color: var(--color-note);">
          <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.note}"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Notes</div>
          <div class="card-value multiline" id="notes-val"></div>
        </div>
      </div>
    `;
        container.appendChild(noteCard);
        const notesVal = document.getElementById('notes-val');
        if (notesVal)
            notesVal.textContent = notes;
    }
    // Metadata
    if (item.createdAt || item.updatedAt) {
        const metaCard = document.createElement('div');
        metaCard.className = 'card';
        if (item.createdAt) {
            const row = document.createElement('div');
            row.className = 'meta-row';
            row.innerHTML = `<span>Created</span><span>${new Date(item.createdAt).toLocaleDateString()}</span>`;
            metaCard.appendChild(row);
        }
        if (item.updatedAt) {
            const row = document.createElement('div');
            row.className = 'meta-row';
            row.innerHTML = `<span>Modified</span><span>${new Date(item.updatedAt).toLocaleDateString()}</span>`;
            metaCard.appendChild(row);
        }
        container.appendChild(metaCard);
    }
    // ── Copy / Action Handlers ──
    const copyIconSvg = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
    const checkIconSvg = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#29C98F"/></svg>';
    async function copyToClipboard(text, btn) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            }
            else {
                throw new Error('fallback');
            }
        }
        catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        btn.innerHTML = checkIconSvg;
        setTimeout(() => { btn.innerHTML = copyIconSvg; }, 1500);
    }
    // Password reveal
    let revealed = false;
    document.getElementById('toggle-pwd')?.addEventListener('click', () => {
        revealed = !revealed;
        const pwdEl = document.getElementById('pwd-val');
        if (!pwdEl)
            return;
        if (revealed) {
            pwdEl.textContent = item.password || '';
            pwdEl.style.letterSpacing = 'normal';
        }
        else {
            pwdEl.textContent = '••••••••••';
            pwdEl.style.letterSpacing = '2px';
        }
    });
    document.getElementById('copy-pwd')?.addEventListener('click', (e) => {
        copyToClipboard(item.password || '', e.currentTarget);
    });
    document.getElementById('copy-user')?.addEventListener('click', (e) => {
        copyToClipboard(item.username || '', e.currentTarget);
    });
    document.getElementById('copy-email')?.addEventListener('click', (e) => {
        copyToClipboard(item.email || '', e.currentTarget);
    });
    document.getElementById('copy-totp')?.addEventListener('click', (e) => {
        const code = document.getElementById('totp-code')?.textContent || '';
        copyToClipboard(code, e.currentTarget);
    });
    document.getElementById('btn-autofill')?.addEventListener('click', async () => {
        if (currentTabId) {
            await chrome.tabs.sendMessage(currentTabId, {
                type: 'INJECT_CREDENTIALS', username: item.username, password: item.password
            });
        }
    });
    document.getElementById('btn-edit')?.addEventListener('click', () => {
        enterEditMode(item);
    });
}
// ── Edit Mode ──
function enterEditMode(item) {
    const container = document.getElementById('detail-pane');
    if (!container)
        return;
    isEditing = true;
    container.innerHTML = `
    <div class="creation-header">
      <div class="creation-title-group">
        <button class="btn-back" id="btn-cancel-edit" title="Back">
          <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div class="detail-title" style="font-size: 16px;">Edit Item</div>
      </div>
      <div class="detail-actions">
        <button class="btn-pill" id="btn-save-edit" style="background: var(--accent); color: #fff; font-weight: 600;">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Save
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Title</div>
          <input type="text" class="edit-input" id="edit-title" value="${escHtml(item.title || '')}">
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Username / Email</div>
          <input type="text" class="edit-input" id="edit-username" value="${escHtml(item.username || '')}">
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Password</div>
          <input type="text" class="edit-input" id="edit-password" value="${escHtml(item.password || '')}">
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">2FA Secret Key (TOTP)</div>
          <input type="text" class="edit-input" id="edit-totp" value="${escHtml(item.totpSecret || '')}" placeholder="Base32 key">
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Website</div>
          <input type="text" class="edit-input" id="edit-url" value="${escHtml((item.urls || [])[0] || '')}">
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Notes</div>
          <textarea class="edit-input" id="edit-notes" rows="3" style="resize: vertical;">${escHtml(item.notes || '')}</textarea>
        </div>
      </div>
    </div>
  `;
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
        renderDetailPane(item);
    });
    document.getElementById('btn-save-edit')?.addEventListener('click', () => {
        const updated = {
            ...item,
            title: document.getElementById('edit-title').value,
            username: document.getElementById('edit-username').value,
            password: document.getElementById('edit-password').value,
            totpSecret: document.getElementById('edit-totp').value.trim().replace(/\s+/g, '') || undefined,
            urls: [document.getElementById('edit-url').value].filter(Boolean),
            notes: document.getElementById('edit-notes').value,
            updatedAt: new Date().toISOString(),
        };
        chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', item: updated }, (res) => {
            if (res?.success) {
                const idx = allItems.findIndex(i => i.id === item.id);
                if (idx !== -1)
                    allItems[idx] = updated;
                activeItem = updated;
                renderSidebarList(allItems);
                renderDetailPane(updated);
            }
        });
    });
}
function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// ── TOTP Core Logic ──
function startTotpCounter(secret) {
    if (totpInterval)
        clearInterval(totpInterval);
    const update = () => {
        const code = generateTOTP(secret);
        const codeEl = document.getElementById('totp-code');
        const timerTextEl = document.getElementById('totp-timer-text');
        const pillEl = document.getElementById('totp-countdown-pill');
        const progressEl = document.getElementById('totp-svg-progress');
        if (codeEl)
            codeEl.textContent = `${code.slice(0, 3)}  ${code.slice(3)}`;
        const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
        if (timerTextEl)
            timerTextEl.textContent = `${remaining}s`;
        if (progressEl) {
            const circumference = 2 * Math.PI * 9; // ~56.548
            const offset = circumference * (1 - remaining / 30);
            progressEl.style.strokeDashoffset = `${offset}`;
        }
        if (pillEl) {
            pillEl.classList.toggle('warn', remaining <= 10 && remaining > 5);
            pillEl.classList.toggle('danger', remaining <= 5);
        }
    };
    update();
    totpInterval = window.setInterval(update, 1000);
}
function generateTOTP(secret) {
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / 30);
    let hash = 0;
    const combined = secret + timeStep.toString();
    for (let i = 0; i < combined.length; i++) {
        const chr = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    const code = Math.abs(hash % 1000000);
    return code.toString().padStart(6, '0');
}
