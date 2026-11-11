/**
 * Kloak Browser Extension — Popup Logic
 * Authentic Proton Pass design: theme colors, category icons, add menu & credentials creator.
 */

import { renderFavicon, resolveItemDomains } from './favicon-service';
import {
  resolveServiceDomains,
  resolveServiceFromUrl,
  getAllKnownServiceNames,
  ServiceDomainInfo
} from './service-domain-service';
import { evaluateCredentialRisk, renderCircumferenceSvg } from './risk-assessment';

let allItems: any[] = [];
let activeItem: any = null;
let currentTabId: number | undefined;
let isEditing = false;
let totpInterval: number | null = null;
let addTotpInterval: number | null = null;

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

// ── Password Generator State & Functions ──
let isGeneratorOpen = false;
let genLength = 20;
let genUseUpper = true;
let genUseLower = true;
let genUseDigits = true;
let genUseSymbols = true;
let genAvoidAmbiguous = false;
let genMode: 'password' | 'passphrase' = 'password';
let genPassphraseWords = 4;
let currentGenPassword = '';
let passwordHistory: { password: string; timestamp: number }[] = [];

const WORDLIST = [
  'amber', 'anchor', 'apple', 'apron', 'arctic', 'arrow', 'atlas', 'autumn', 'bamboo', 'beacon',
  'breeze', 'bridge', 'bronze', 'canyon', 'castle', 'cedar', 'cipher', 'cloud', 'cobalt', 'comet',
  'copper', 'coral', 'cosmos', 'crater', 'crystal', 'delta', 'desert', 'diamond', 'dolphin', 'dragon',
  'echo', 'ember', 'falcon', 'feather', 'forest', 'fossil', 'galaxy', 'garden', 'glacier', 'granite',
  'harbor', 'haven', 'horizon', 'island', 'jasper', 'jungle', 'lagoon', 'lantern', 'lotus', 'lunar',
  'matrix', 'meadow', 'meteor', 'mirage', 'mountain', 'nebula', 'oasis', 'ocean', 'orbit', 'orchid',
  'peak', 'pearl', 'phoenix', 'planet', 'prism', 'pulse', 'pyramid', 'quantum', 'quartz', 'radar',
  'radiant', 'rainbow', 'raven', 'ripple', 'river', 'rocket', 'ruby', 'safari', 'sail', 'sapphire',
  'shadow', 'shield', 'sierra', 'silver', 'solar', 'spark', 'sphinx', 'spirit', 'spring', 'star',
  'stone', 'summit', 'sunset', 'temple', 'thunder', 'timber', 'topaz', 'torrent', 'tower', 'tulip',
  'valley', 'velvet', 'vessel', 'vertex', 'violet', 'vortex', 'voyage', 'wave', 'whisper', 'zenith'
];

function generatePassphrase(wordCount = 4, separator = '-'): string {
  const chosen: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const idx = Math.floor(Math.random() * WORDLIST.length);
    chosen.push(WORDLIST[idx]);
  }
  return chosen.join(separator);
}

function generateSecurePassword(): string {
  if (genMode === 'passphrase') {
    return generatePassphrase(genPassphraseWords, '-');
  }
  let chars = '';
  if (genUseLower) chars += genAvoidAmbiguous ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  if (genUseUpper) chars += genAvoidAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (genUseDigits) chars += genAvoidAmbiguous ? '23456789' : '0123456789';
  if (genUseSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const array = new Uint32Array(genLength);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < genLength; i++) {
    result += chars.charAt(array[i] % chars.length);
  }
  return result;
}

function calculateEntropy(pwd: string): { bits: number; label: string; score: number; color: string } {
  if (!pwd) return { bits: 0, label: 'None', score: 0, color: '#F54A4A' };
  let poolSize = 0;
  if (/[a-z]/.test(pwd)) poolSize += 26;
  if (/[A-Z]/.test(pwd)) poolSize += 26;
  if (/[0-9]/.test(pwd)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(pwd)) poolSize += 32;
  if (poolSize === 0) poolSize = 26;
  const bits = Math.round(pwd.length * Math.log2(poolSize));
  let label = 'Weak';
  let score = 1;
  let color = '#F54A4A';
  if (bits >= 90) {
    label = 'Very Strong';
    score = 4;
    color = '#29C98F';
  } else if (bits >= 65) {
    label = 'Strong';
    score = 3;
    color = '#29C98F';
  } else if (bits >= 45) {
    label = 'Good';
    score = 2;
    color = '#FFB800';
  }
  return { bits, label, score, color };
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;
  activeTabUrl = tab?.url || '';
  try {
    if (activeTabUrl.startsWith('http')) {
      activeDomain = new URL(activeTabUrl).hostname.replace('www.', '');
    }
  } catch { /* ignore */ }

  setupSearch();
  setupAddDropdown();
  setupSortDropdown();
  setupFilters();
  setupUnlockView();
  setupLockBtn();
  setupAccountRetrievalModal();

  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab = urlParams.get('tab');
  const stored = await chrome.storage?.local?.get(['defaultTab']);
  const storedTab = stored?.defaultTab;
  if (storedTab) {
    await chrome.storage?.local?.remove('defaultTab');
  }

  await loadLogins();

  if (requestedTab === 'generator' || storedTab === 'generator') {
    showGeneratorView();
  }
});

let currentSortMode: 'recent' | 'alpha' | 'newest' | 'oldest' = 'recent';

// ── Search & Filter ──
function setupSearch() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  searchInput?.addEventListener('input', () => {
    if (isGeneratorOpen) {
      isGeneratorOpen = false;
      document.getElementById('filter-generator')?.classList.remove('active');
      document.getElementById('filter-all')?.classList.add('active');
    }
    applyFilterAndSort();
  });
}

function setupFilters() {
  const filterAllBtn = document.getElementById('filter-all');
  const filterGenBtn = document.getElementById('filter-generator');
  const headerGenBtn = document.getElementById('btn-header-gen');

  filterAllBtn?.addEventListener('click', () => {
    isGeneratorOpen = false;
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    filterAllBtn.classList.add('active');
    filterGenBtn?.classList.remove('active');
    applyFilterAndSort();
    if (allItems.length > 0) {
      selectItem(allItems[0]);
    } else {
      const container = document.getElementById('detail-pane');
      if (container) container.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
    }
  });

  filterGenBtn?.addEventListener('click', () => {
    showGeneratorView();
  });

  headerGenBtn?.addEventListener('click', () => {
    showGeneratorView();
  });
}

// ── Sort Dropdown ──
function setupSortDropdown() {
  const btnSort = document.getElementById('btn-sort');
  const sortDropdown = document.getElementById('sort-dropdown');
  const sortWrapper = document.getElementById('sort-wrapper');
  if (!btnSort || !sortDropdown) return;

  btnSort.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('add-dropdown')?.classList.remove('open');
    const isOpen = sortDropdown.classList.toggle('open');
    sortWrapper?.classList.toggle('open', isOpen);
  });

  document.addEventListener('click', () => {
    sortDropdown.classList.remove('open');
    sortWrapper?.classList.remove('open');
  });

  const titles: Record<string, string> = {
    recent: 'Sort: Recently used',
    alpha: 'Sort: Alphabetical (A to Z)',
    newest: 'Sort: Newest to oldest',
    oldest: 'Sort: Oldest to newest'
  };

  const sortIcons: Record<string, string> = {
    recent: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>',
    alpha: '<path d="M9.25 5l-4.5 12h2.09l.94-2.75h4.44l.94 2.75h2.09L10.75 5h-1.5zm-.53 7.42l1.53-4.5 1.53 4.5H8.72zM15 15h6v1.75h-6V15zm0-3.5h6v1.75h-6V11.5zm0-3.5h6v1.75h-6V8z"/>',
    newest: '<path d="M19 15l-1.41-1.41L13 18.17V2h-2v16.17l-4.59-4.59L5 15l7 7 7-7z"/>',
    oldest: '<path d="M5 9l1.41 1.41L11 5.83V22h2V5.83l4.59 4.59L19 9l-7-7-7 7z"/>'
  };

  sortDropdown.querySelectorAll('.sort-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const sort = (item as HTMLElement).dataset.sort as 'recent' | 'alpha' | 'newest' | 'oldest';
      if (sort) {
        currentSortMode = sort;
        sortDropdown.querySelectorAll('.sort-item').forEach(si => si.classList.remove('active'));
        item.classList.add('active');

        btnSort.title = titles[sort] || 'Sort items';
        const btnIcon = document.getElementById('sort-btn-icon');
        if (btnIcon && sortIcons[sort]) btnIcon.innerHTML = sortIcons[sort];

        sortDropdown.classList.remove('open');
        sortWrapper?.classList.remove('open');
        applyFilterAndSort();
      }
    });
  });
}

function sortItems(items: any[]): any[] {
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
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const query = (searchInput?.value || '').toLowerCase();
  let filtered = allItems;
  if (query) {
    filtered = allItems.filter(item =>
      (item.title || '').toLowerCase().includes(query) ||
      (item.username || '').toLowerCase().includes(query) ||
      (item.urls || []).some((u: string) => u.toLowerCase().includes(query))
    );
  }
  const sorted = sortItems(filtered);
  renderSidebarList(sorted);
}

// ── Add Dropdown ──
function setupAddDropdown() {
  const btn = document.getElementById('btn-add');
  const dropdown = document.getElementById('add-dropdown');
  if (!btn || !dropdown) return;

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
      const type = (item as HTMLElement).dataset.type || 'login';
      dropdown.classList.remove('open');
      showAddForm(type);
    });
  });
}

// ── Proton Pass Creation Pages ──
function showAddForm(type: string, initialValues?: { title?: string; username?: string; password?: string; url?: string }) {
  const container = document.getElementById('detail-pane');
  if (!container) return;
  isGeneratorOpen = false;
  document.getElementById('filter-generator')?.classList.remove('active');
  document.getElementById('filter-all')?.classList.add('active');
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
  if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }

  const typeConfig: Record<string, { title: string; icon: string; color: string }> = {
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
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. GitHub, Google, Netflix" list="kloak-services-datalist" autocomplete="off">
            <datalist id="kloak-services-datalist"></datalist>
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
          <!-- Smart Domain Suggestions -->
          <div class="domain-suggestions-box" id="domain-suggestions-box" style="display: none;">
            <div class="domain-suggestions-header">
              <div class="domain-suggestions-title">
                <svg viewBox="0 0 24 24" class="sparkle-svg"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
                <span id="domain-suggestions-label">Suggested Domains:</span>
              </div>
              <span class="domain-suggestions-count" id="domain-suggestions-count">0</span>
            </div>
            <div class="domain-chips-container" id="domain-chips-container"></div>
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
  } else if (type === 'alias') {
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
  } else if (type === 'card') {
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
  } else if (type === 'note') {
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
  } else if (type === 'identity') {
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
  } else if (type === 'authenticator') {
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
    if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }
    if (activeItem) renderDetailPane(activeItem);
    else container.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
  });

  if (type === 'login') {
    const titleInput = document.getElementById('field-title') as HTMLInputElement;
    const pwdInput = document.getElementById('field-password') as HTMLInputElement;
    const strengthBox = document.getElementById('strength-box');
    const genPanel = document.getElementById('gen-panel');

    // ── 1. Service Quick-Picks Datalist ──
    const datalist = document.getElementById('kloak-services-datalist');
    if (datalist) {
      datalist.innerHTML = getAllKnownServiceNames()
        .map(name => `<option value="${name}"></option>`)
        .join('');
    }

    // ── 2. Smart Domain Intelligence & Suggestions Engine ──
    const suggestionsBox = document.getElementById('domain-suggestions-box');
    const suggestionsLabel = document.getElementById('domain-suggestions-label');
    const suggestionsCount = document.getElementById('domain-suggestions-count');
    const chipsContainer = document.getElementById('domain-chips-container');
    const urlContainer = document.getElementById('url-inputs-container');

    function getCurrentUrls(): string[] {
      const inputs = urlContainer?.querySelectorAll<HTMLInputElement>('.url-input');
      if (!inputs) return [];
      const list: string[] = [];
      inputs.forEach(inp => {
        const val = inp.value.trim();
        if (val) list.push(val);
      });
      return list;
    }

    function isDomainAdded(domain: string): boolean {
      const cleanTarget = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const current = getCurrentUrls();
      return current.some(u => {
        const clean = u.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        return clean === cleanTarget || clean.endsWith('.' + cleanTarget) || cleanTarget.endsWith('.' + clean);
      });
    }

    function applyDomainToForm(domain: string) {
      const targetUrl = domain.startsWith('http://') || domain.startsWith('https://')
        ? domain
        : `https://${domain}`;

      const inputs = urlContainer?.querySelectorAll<HTMLInputElement>('.url-input');
      let applied = false;
      if (inputs) {
        for (let i = 0; i < inputs.length; i++) {
          const inp = inputs[i];
          if (!inp.value.trim()) {
            inp.value = targetUrl;
            inp.dataset.autofilled = 'true';
            applied = true;
            break;
          }
        }
      }

      if (!applied) {
        addUrlInputRow(targetUrl);
      }

      if (titleInput) {
        updateDomainSuggestions(titleInput.value, false);
      }
    }

    function addUrlInputRow(initialVal: string = '') {
      if (!urlContainer) return;
      const row = document.createElement('div');
      row.className = 'multi-url-row';
      row.innerHTML = `
        <div class="card-icon" style="margin-right: 6px;">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
        <input type="text" class="edit-input url-input" placeholder="https://" value="${escHtml(initialVal)}">
        <div class="action-icon btn-del-url" style="color: var(--danger);"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>
      `;
      const urlInput = row.querySelector('.url-input') as HTMLInputElement;
      if (initialVal) {
        urlInput.dataset.autofilled = 'true';
      }
      bindUrlInput(urlInput);
      row.querySelector('.btn-del-url')?.addEventListener('click', () => {
        row.remove();
        if (titleInput) updateDomainSuggestions(titleInput.value, false);
      });
      urlContainer.appendChild(row);
    }

    function bindUrlInput(input: HTMLInputElement) {
      input.addEventListener('input', () => {
        delete input.dataset.autofilled;
        const val = input.value.trim();

        // Bi-directional inference: infer service title & logo from entered URL if title is blank or auto-inferred
        if (val && titleInput && (!titleInput.value.trim() || titleInput.dataset.autoinferred === 'true')) {
          const rev = resolveServiceFromUrl(val);
          if (rev) {
            titleInput.value = rev.displayName;
            titleInput.dataset.autoinferred = 'true';
            const avatarBox = document.getElementById('title-avatar-box');
            if (avatarBox) {
              renderFavicon(avatarBox, { title: rev.displayName, size: 24 });
            }
            updateDomainSuggestions(rev.displayName, false);
            return;
          }
        }

        if (titleInput && titleInput.value.trim()) {
          updateDomainSuggestions(titleInput.value, false);
        }
      });
    }

    function updateDomainSuggestions(query: string, autoFillPrimary: boolean = true) {
      if (!suggestionsBox || !chipsContainer) return;
      const clean = query.trim();
      if (!clean) {
        suggestionsBox.style.display = 'none';
        chipsContainer.innerHTML = '';
        return;
      }

      const match: ServiceDomainInfo | null = resolveServiceDomains(clean);
      if (!match || !match.domains || match.domains.length === 0) {
        suggestionsBox.style.display = 'none';
        chipsContainer.innerHTML = '';
        return;
      }

      // Auto-fill primary canonical URL if first input is empty or was previously auto-filled
      if (autoFillPrimary) {
        const firstUrlInput = urlContainer?.querySelector<HTMLInputElement>('.url-input');
        if (firstUrlInput) {
          const curVal = firstUrlInput.value.trim();
          if (!curVal || firstUrlInput.dataset.autofilled === 'true') {
            firstUrlInput.value = match.primaryUrl;
            firstUrlInput.dataset.autofilled = 'true';
          }
        }
      }

      if (suggestionsLabel) {
        suggestionsLabel.textContent = `${match.displayName} Domains:`;
      }
      if (suggestionsCount) {
        suggestionsCount.textContent = `${match.domains.length}`;
      }

      chipsContainer.innerHTML = '';
      match.domains.forEach(domain => {
        const added = isDomainAdded(domain);
        const chip = document.createElement('div');
        chip.className = `domain-chip ${added ? 'active' : ''}`;
        chip.title = added ? `Already added (${domain})` : `Click to add ${domain}`;
        chip.innerHTML = `
          <span class="chip-symbol">${added ? '✓' : '+'}</span>
          <span class="chip-text">${escHtml(domain)}</span>
        `;
        if (!added) {
          chip.addEventListener('click', (e) => {
            e.stopPropagation();
            applyDomainToForm(domain);
          });
        }
        chipsContainer.appendChild(chip);
      });

      suggestionsBox.style.display = 'block';
    }

    // Attach listeners to initial URL inputs
    urlContainer?.querySelectorAll<HTMLInputElement>('.url-input').forEach(inp => bindUrlInput(inp));

    if (initialValues?.title && titleInput) {
      titleInput.value = initialValues.title;
      const avatarBox = document.getElementById('title-avatar-box');
      if (avatarBox) {
        renderFavicon(avatarBox, {
          title: initialValues.title,
          urls: initialValues.url ? [initialValues.url] : [],
          size: 24
        });
      }
      updateDomainSuggestions(initialValues.title, !initialValues.url);
    } else if (initialValues?.url) {
      const urlInput = document.querySelector('.url-input') as HTMLInputElement;
      if (urlInput) urlInput.value = initialValues.url;
      const rev = resolveServiceFromUrl(initialValues.url);
      if (rev && titleInput) {
        titleInput.value = rev.displayName;
        titleInput.dataset.autoinferred = 'true';
        const avatarBox = document.getElementById('title-avatar-box');
        if (avatarBox) {
          renderFavicon(avatarBox, { title: rev.displayName, size: 24 });
        }
        updateDomainSuggestions(rev.displayName, false);
      }
    }

    if (initialValues?.username) {
      const userInput = document.getElementById('field-username') as HTMLInputElement;
      if (userInput) userInput.value = initialValues.username;
    }
    if (initialValues?.password && pwdInput) {
      pwdInput.value = initialValues.password;
      if (strengthBox) strengthBox.style.display = 'flex';
      updateStrengthMeter(initialValues.password);
    }

    titleInput?.addEventListener('input', () => {
      delete titleInput.dataset.autoinferred;
      const val = titleInput.value.trim();
      const avatarBox = document.getElementById('title-avatar-box');
      if (avatarBox && val.length >= 2) {
        renderFavicon(avatarBox, { title: val, size: 24 });
      }
      updateDomainSuggestions(val, true);
    });

    document.getElementById('btn-gen-alias')?.addEventListener('click', () => {
      const userInput = document.getElementById('field-username') as HTMLInputElement;
      if (userInput) {
        const t = titleInput?.value ? titleInput.value.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
        userInput.value = `${t}.${Math.random().toString(36).substring(2, 6)}@kloak.link`;
      }
    });

    document.getElementById('btn-toggle-create-pwd')?.addEventListener('click', () => {
      if (pwdInput) pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });

    pwdInput?.addEventListener('input', () => {
      const p = pwdInput.value;
      if (!p) {
        if (strengthBox) strengthBox.style.display = 'none';
        return;
      }
      if (strengthBox) strengthBox.style.display = 'flex';
      updateStrengthMeter(p);
    });

    document.getElementById('btn-toggle-gen-panel')?.addEventListener('click', () => {
      if (genPanel) {
        const isOpen = genPanel.style.display !== 'none';
        genPanel.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) generateAndSetPreview();
      }
    });

    const slider = document.getElementById('gen-length-slider') as HTMLInputElement;
    const numDisplay = document.getElementById('gen-length-num');
    slider?.addEventListener('input', () => {
      if (numDisplay) numDisplay.textContent = slider.value;
      generateAndSetPreview();
    });

    ['chk-upper', 'chk-lower', 'chk-digits', 'chk-symbols'].forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement;
      el?.addEventListener('change', () => {
        el.parentElement?.classList.toggle('active', el.checked);
        generateAndSetPreview();
      });
    });

    function generateAndSetPreview() {
      const len = parseInt(slider?.value || '20', 10);
      const upper = (document.getElementById('chk-upper') as HTMLInputElement)?.checked;
      const lower = (document.getElementById('chk-lower') as HTMLInputElement)?.checked;
      const digits = (document.getElementById('chk-digits') as HTMLInputElement)?.checked;
      const symbols = (document.getElementById('chk-symbols') as HTMLInputElement)?.checked;

      let chars = '';
      if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
      if (digits) chars += '0123456789';
      if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

      let pwd = '';
      for (let i = 0; i < len; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (pwdInput) {
        pwdInput.value = pwd;
        if (strengthBox) strengthBox.style.display = 'flex';
        updateStrengthMeter(pwd);
      }
    }

    document.getElementById('btn-regen-pwd')?.addEventListener('click', generateAndSetPreview);
    document.getElementById('btn-apply-pwd')?.addEventListener('click', () => {
      if (genPanel) genPanel.style.display = 'none';
    });

    const totpInput = document.getElementById('field-totp') as HTMLInputElement;
    const totpPreviewBox = document.getElementById('totp-preview-container');
    totpInput?.addEventListener('input', () => {
      const key = totpInput.value.trim().replace(/\s+/g, '');
      if (key.length >= 8) {
        if (totpPreviewBox) totpPreviewBox.style.display = 'block';
        startAddTotpLivePreview(key);
      } else {
        if (totpPreviewBox) totpPreviewBox.style.display = 'none';
        if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }
      }
    });

    document.getElementById('btn-add-more-url')?.addEventListener('click', () => {
      addUrlInputRow('');
    });
  }

  if (type === 'alias') {
    document.getElementById('btn-refresh-alias')?.addEventListener('click', () => {
      const aliasInput = document.getElementById('field-username') as HTMLInputElement;
      if (aliasInput) {
        aliasInput.value = `kloak.${Math.random().toString(36).substring(2, 7)}@kloak.link`;
      }
    });
  }

  if (type === 'card') {
    const cardInput = document.getElementById('field-cardnumber') as HTMLInputElement;
    cardInput?.addEventListener('input', () => {
      let v = cardInput.value.replace(/\D/g, '').substring(0, 16);
      cardInput.value = v.replace(/(\d{4})/g, '$1 ').trim();
    });

    const expInput = document.getElementById('field-expiry') as HTMLInputElement;
    expInput?.addEventListener('input', () => {
      let v = expInput.value.replace(/\D/g, '').substring(0, 4);
      if (v.length >= 2) expInput.value = `${v.substring(0, 2)}/${v.substring(2)}`;
      else expInput.value = v;
    });
  }

  // ── SAVE ACTION ──
  document.getElementById('btn-save-create')?.addEventListener('click', () => {
    if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }

    const title = (document.getElementById('field-title') as HTMLInputElement)?.value || 'Untitled';
    const notes = (document.getElementById('field-notes') as HTMLTextAreaElement)?.value || '';
    const newItem: any = {
      title,
      notes,
      urls: [],
      createdAt: new Date().toISOString()
    };

    if (type === 'login') {
      newItem.type = 'login';
      newItem.username = (document.getElementById('field-username') as HTMLInputElement)?.value || '';
      newItem.password = (document.getElementById('field-password') as HTMLInputElement)?.value || '';
      const totp = (document.getElementById('field-totp') as HTMLInputElement)?.value || '';
      if (totp) newItem.totpSecret = totp.replace(/\s+/g, '');

      const urlInputs = document.querySelectorAll('.url-input') as NodeListOf<HTMLInputElement>;
      urlInputs.forEach(u => {
        if (u.value.trim()) newItem.urls.push(u.value.trim());
      });
    } else if (type === 'alias') {
      const aliasMail = (document.getElementById('field-username') as HTMLInputElement)?.value || '';
      const fwd = (document.getElementById('field-forward') as HTMLInputElement)?.value || '';
      newItem.type = 'email_alias';
      newItem.username = aliasMail;
      newItem.alias = {
        aliasEmail: aliasMail,
        forwardTo: fwd,
        provider: 'DuckDuckGo'
      };
      newItem.notes = fwd ? `Forwarding to: ${fwd}\n${notes}` : notes;
    } else if (type === 'card') {
      const cardNum = (document.getElementById('field-cardnumber') as HTMLInputElement)?.value || '';
      const cardHolder = (document.getElementById('field-cardholder') as HTMLInputElement)?.value || '';
      const expiry = (document.getElementById('field-expiry') as HTMLInputElement)?.value || '';
      const cvv = (document.getElementById('field-cvv') as HTMLInputElement)?.value || '';
      const pin = (document.getElementById('field-pin') as HTMLInputElement)?.value || '';

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
    } else if (type === 'identity') {
      const fn = (document.getElementById('field-firstname') as HTMLInputElement)?.value || '';
      const ln = (document.getElementById('field-lastname') as HTMLInputElement)?.value || '';
      const em = (document.getElementById('field-email') as HTMLInputElement)?.value || '';
      const ph = (document.getElementById('field-phone') as HTMLInputElement)?.value || '';
      const addr = (document.getElementById('field-address') as HTMLInputElement)?.value || '';
      const city = (document.getElementById('field-city') as HTMLInputElement)?.value || '';
      const zip = (document.getElementById('field-zip') as HTMLInputElement)?.value || '';

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
    } else if (type === 'authenticator') {
      const issuer = (document.getElementById('field-auth-issuer') as HTMLInputElement)?.value || '';
      const secret = (document.getElementById('field-auth-secret') as HTMLInputElement)?.value || '';
      const algo = (document.getElementById('field-auth-algo') as HTMLSelectElement)?.value || 'TOTP';
      const digits = parseInt((document.getElementById('field-auth-digits') as HTMLSelectElement)?.value || '6', 10);
      const period = parseInt((document.getElementById('field-auth-period') as HTMLSelectElement)?.value || '30', 10);

      newItem.type = 'authenticator';
      newItem.username = issuer || undefined;
      newItem.totpSecret = secret.replace(/\s+/g, '') || undefined;
      newItem.authenticatorDetails = {
        issuer: issuer || undefined,
        algorithm: algo,
        digits,
        period
      };
    } else if (type === 'note') {
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

function updateStrengthMeter(pwd: string) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 14) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;

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

function startAddTotpLivePreview(secret: string) {
  if (addTotpInterval) clearInterval(addTotpInterval);

  const update = () => {
    const code = generateTOTP(secret);
    const codeEl = document.getElementById('totp-live-code');
    const timerEl = document.getElementById('totp-live-timer');
    if (codeEl) codeEl.textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
    if (timerEl) {
      const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
      timerEl.textContent = `⏱ ${remaining}s`;
    }
  };

  update();
  addTotpInterval = window.setInterval(update, 1000);
}

// ── Dedicated Password Generator View ──
function showGeneratorView() {
  const container = document.getElementById('detail-pane');
  if (!container) return;
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
  if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }

  isGeneratorOpen = true;
  activeItem = null;
  document.getElementById('filter-all')?.classList.remove('active');
  document.getElementById('filter-generator')?.classList.add('active');
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));

  if (!currentGenPassword) {
    currentGenPassword = generateSecurePassword();
  }

  renderGeneratorUI(container);
}

function formatPasswordHtml(pwd: string, mode: 'password' | 'passphrase'): string {
  if (mode === 'passphrase') {
    return pwd.split('-').map(w => `<span class="char-upper">${w}</span>`).join('<span class="char-symbol">-</span>');
  }
  let html = '';
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd[i];
    if (/[0-9]/.test(char)) {
      html += `<span class="char-digit">${char}</span>`;
    } else if (/[A-Z]/.test(char)) {
      html += `<span class="char-upper">${char}</span>`;
    } else if (/[^a-zA-Z0-9]/.test(char)) {
      html += `<span class="char-symbol">${char}</span>`;
    } else {
      html += `<span>${char}</span>`;
    }
  }
  return html;
}

function renderGeneratorUI(container: HTMLElement) {
  const entropy = calculateEntropy(currentGenPassword);
  const formattedPasswordHtml = formatPasswordHtml(currentGenPassword, genMode);

  container.innerHTML = `
    <div class="generator-view">
      <div class="detail-header" style="margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="card-icon" style="color: var(--accent); margin-right: 0;">
            <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
          </div>
          <div>
            <div class="detail-title" style="font-size: 16px;">Password Generator</div>
            <div style="font-size: 11px; color: var(--text-muted);">High-entropy random key generator</div>
          </div>
        </div>
      </div>

      <!-- Main Result & Strength Card -->
      <div class="gen-main-card">
        <div class="gen-display-row">
          <div class="gen-password-text" id="gen-live-text">${formattedPasswordHtml}</div>
          <div class="gen-actions-group">
            <button class="gen-btn-round" id="btn-view-regen" title="Regenerate Password">
              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="gen-btn-round" id="btn-view-copy" title="Copy to clipboard">
              <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            </button>
          </div>
        </div>

        <div class="gen-strength-meter">
          <div class="gen-strength-header">
            <span class="gen-strength-label" id="gen-strength-label-text" style="color: ${entropy.color};">${entropy.label}</span>
            <span class="gen-strength-entropy" id="gen-strength-entropy-text">${entropy.bits} bits of entropy</span>
          </div>
          <div class="gen-strength-track">
            <div class="gen-strength-seg" id="gen-str-seg-1" style="background: ${entropy.score >= 1 ? entropy.color : 'rgba(255,255,255,0.08)'};"></div>
            <div class="gen-strength-seg" id="gen-str-seg-2" style="background: ${entropy.score >= 2 ? entropy.color : 'rgba(255,255,255,0.08)'};"></div>
            <div class="gen-strength-seg" id="gen-str-seg-3" style="background: ${entropy.score >= 3 ? entropy.color : 'rgba(255,255,255,0.08)'};"></div>
            <div class="gen-strength-seg" id="gen-str-seg-4" style="background: ${entropy.score >= 4 ? entropy.color : 'rgba(255,255,255,0.08)'};"></div>
          </div>
        </div>
      </div>

      <!-- Main Action Buttons -->
      <div class="gen-actions-row">
        <button class="btn-gen-primary" id="btn-view-fill">
          <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
          Fill on Active Page
        </button>
        <div class="gen-sub-actions">
          <button class="btn-gen-sub" id="btn-view-copy-full">
            📋 Copy Password
          </button>
          <button class="btn-gen-sub" id="btn-view-save-login">
            ➕ Save as New Login
          </button>
        </div>
      </div>

      <!-- Config Card -->
      <div class="gen-config-card">
        <div class="gen-mode-toggle">
          <button class="gen-mode-btn ${genMode === 'password' ? 'active' : ''}" id="mode-btn-pwd">Password</button>
          <button class="gen-mode-btn ${genMode === 'passphrase' ? 'active' : ''}" id="mode-btn-phrase">Passphrase</button>
        </div>

        <!-- Password Controls -->
        <div id="gen-controls-pwd" style="display: ${genMode === 'password' ? 'flex' : 'none'}; flex-direction: column; gap: 12px;">
          <div class="gen-slider-wrapper">
            <div class="gen-slider-head">
              <span>Password Length</span>
              <span class="gen-len-val" id="gen-view-len-num">${genLength}</span>
            </div>
            <input type="range" class="gen-slider" id="gen-view-slider" min="8" max="64" value="${genLength}">
            <div class="gen-presets-row" id="gen-pwd-presets">
              <span class="gen-preset-chip ${genLength === 16 ? 'active' : ''}" data-len="16">16</span>
              <span class="gen-preset-chip ${genLength === 20 ? 'active' : ''}" data-len="20">20</span>
              <span class="gen-preset-chip ${genLength === 24 ? 'active' : ''}" data-len="24">24</span>
              <span class="gen-preset-chip ${genLength === 32 ? 'active' : ''}" data-len="32">32</span>
              <span class="gen-preset-chip ${genLength === 48 ? 'active' : ''}" data-len="48">48</span>
            </div>
          </div>

          <div class="gen-options-row" style="margin-top: 4px;">
            <label class="gen-chip ${genUseUpper ? 'active' : ''}" id="chip-v-upper"><input type="checkbox" ${genUseUpper ? 'checked' : ''} id="chk-v-upper"> A-Z</label>
            <label class="gen-chip ${genUseLower ? 'active' : ''}" id="chip-v-lower"><input type="checkbox" ${genUseLower ? 'checked' : ''} id="chk-v-lower"> a-z</label>
            <label class="gen-chip ${genUseDigits ? 'active' : ''}" id="chip-v-digits"><input type="checkbox" ${genUseDigits ? 'checked' : ''} id="chk-v-digits"> 0-9</label>
            <label class="gen-chip ${genUseSymbols ? 'active' : ''}" id="chip-v-symbols"><input type="checkbox" ${genUseSymbols ? 'checked' : ''} id="chk-v-symbols"> !@#$%</label>
            <label class="gen-chip ${genAvoidAmbiguous ? 'active' : ''}" id="chip-v-ambig" title="Avoid 1, l, I, 0, O"><input type="checkbox" ${genAvoidAmbiguous ? 'checked' : ''} id="chk-v-ambig"> Avoid Ambiguous</label>
          </div>
        </div>

        <!-- Passphrase Controls -->
        <div id="gen-controls-phrase" style="display: ${genMode === 'passphrase' ? 'flex' : 'none'}; flex-direction: column; gap: 12px;">
          <div class="gen-slider-wrapper">
            <div class="gen-slider-head">
              <span>Number of Words</span>
              <span class="gen-len-val" id="gen-view-words-num">${genPassphraseWords}</span>
            </div>
            <input type="range" class="gen-slider" id="gen-view-words-slider" min="3" max="8" value="${genPassphraseWords}">
            <div class="gen-presets-row" id="gen-phrase-presets">
              <span class="gen-preset-chip ${genPassphraseWords === 3 ? 'active' : ''}" data-words="3">3 words</span>
              <span class="gen-preset-chip ${genPassphraseWords === 4 ? 'active' : ''}" data-words="4">4 words</span>
              <span class="gen-preset-chip ${genPassphraseWords === 5 ? 'active' : ''}" data-words="5">5 words</span>
              <span class="gen-preset-chip ${genPassphraseWords === 6 ? 'active' : ''}" data-words="6">6 words</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Password History Card Placeholder -->
      <div id="gen-history-card-wrap"></div>
    </div>
  `;

  bindGeneratorEvents(container);
  updateHistoryUI(container);
}

function updateGeneratorDisplay(container: HTMLElement) {
  const liveText = container.querySelector('#gen-live-text');
  if (liveText) {
    liveText.innerHTML = formatPasswordHtml(currentGenPassword, genMode);
  }

  const entropy = calculateEntropy(currentGenPassword);
  const labelText = container.querySelector('#gen-strength-label-text') as HTMLElement;
  if (labelText) {
    labelText.textContent = entropy.label;
    labelText.style.color = entropy.color;
  }

  const entropyText = container.querySelector('#gen-strength-entropy-text') as HTMLElement;
  if (entropyText) {
    entropyText.textContent = `${entropy.bits} bits of entropy`;
  }

  for (let i = 1; i <= 4; i++) {
    const seg = container.querySelector(`#gen-str-seg-${i}`) as HTMLElement;
    if (seg) {
      seg.style.background = entropy.score >= i ? entropy.color : 'rgba(255,255,255,0.08)';
    }
  }

  const lenNum = container.querySelector('#gen-view-len-num');
  if (lenNum) lenNum.textContent = String(genLength);

  const wordsNum = container.querySelector('#gen-view-words-num');
  if (wordsNum) wordsNum.textContent = String(genPassphraseWords);

  container.querySelectorAll('#gen-pwd-presets .gen-preset-chip').forEach(chip => {
    const len = (chip as HTMLElement).dataset.len;
    chip.classList.toggle('active', len === String(genLength));
  });

  container.querySelectorAll('#gen-phrase-presets .gen-preset-chip').forEach(chip => {
    const words = (chip as HTMLElement).dataset.words;
    chip.classList.toggle('active', words === String(genPassphraseWords));
  });
}

function updateHistoryUI(container: HTMLElement) {
  const wrap = container.querySelector('#gen-history-card-wrap');
  if (!wrap) return;

  if (passwordHistory.length === 0) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = `
    <div class="gen-history-card">
      <div class="gen-history-head">
        <span>Recent Passwords</span>
        <span style="font-size: 9px; cursor: pointer; color: var(--text-muted);" id="btn-clear-history">Clear</span>
      </div>
      <div class="gen-history-list">
        ${passwordHistory.slice(0, 4).map(h => `
          <div class="gen-history-item">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;">${h.password}</span>
            <button class="kloak-mini-btn btn-copy-hist" data-pwd="${h.password}" title="Copy">📋</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  wrap.querySelector('#btn-clear-history')?.addEventListener('click', () => {
    passwordHistory = [];
    updateHistoryUI(container);
  });

  wrap.querySelectorAll('.btn-copy-hist').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pwd = (b as HTMLElement).dataset.pwd;
      if (pwd) {
        await copyToClipboardText(pwd);
        b.textContent = '✓';
        setTimeout(() => { b.textContent = '📋'; }, 1200);
      }
    });
  });
}

function bindGeneratorEvents(container: HTMLElement) {
  const regenBtn = container.querySelector('#btn-view-regen');
  const copyBtn = container.querySelector('#btn-view-copy');
  const copyFullBtn = container.querySelector('#btn-view-copy-full');
  const fillBtn = container.querySelector('#btn-view-fill');
  const saveLoginBtn = container.querySelector('#btn-view-save-login');

  const doRegenerate = () => {
    if (currentGenPassword && !passwordHistory.some(h => h.password === currentGenPassword)) {
      passwordHistory.unshift({ password: currentGenPassword, timestamp: Date.now() });
      if (passwordHistory.length > 10) passwordHistory.pop();
    }
    currentGenPassword = generateSecurePassword();
    if (regenBtn) {
      regenBtn.classList.add('spinning');
      setTimeout(() => regenBtn.classList.remove('spinning'), 400);
    }
    updateGeneratorDisplay(container);
    updateHistoryUI(container);
  };

  regenBtn?.addEventListener('click', doRegenerate);

  const doCopy = async (btn: HTMLElement | null) => {
    if (currentGenPassword) {
      await copyToClipboardText(currentGenPassword);
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = `✓ Copied!`;
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
      }
    }
  };

  copyBtn?.addEventListener('click', () => doCopy(copyBtn as HTMLElement));
  copyFullBtn?.addEventListener('click', () => doCopy(copyFullBtn as HTMLElement));

  fillBtn?.addEventListener('click', async () => {
    if (currentGenPassword) {
      await copyToClipboardText(currentGenPassword);
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          type: 'INJECT_GENERATED_PASSWORD',
          password: currentGenPassword
        }).catch(() => null);
      }
      if (fillBtn) {
        const orig = fillBtn.innerHTML;
        fillBtn.innerHTML = `✓ Filled into page & copied!`;
        fillBtn.style.background = '#29C98F';
        setTimeout(() => {
          fillBtn.innerHTML = orig;
          fillBtn.style.background = '';
        }, 1800);
      }
    }
  });

  saveLoginBtn?.addEventListener('click', () => {
    const formattedTitle = activeDomain ? (activeDomain.charAt(0).toUpperCase() + activeDomain.slice(1).split('.')[0]) : 'New Login';
    showAddForm('login', {
      title: formattedTitle,
      password: currentGenPassword,
      url: activeTabUrl
    });
  });

  // Mode toggles
  const modePwdBtn = container.querySelector('#mode-btn-pwd');
  const modePhraseBtn = container.querySelector('#mode-btn-phrase');
  const pwdControls = container.querySelector('#gen-controls-pwd') as HTMLElement;
  const phraseControls = container.querySelector('#gen-controls-phrase') as HTMLElement;

  modePwdBtn?.addEventListener('click', () => {
    if (genMode !== 'password') {
      genMode = 'password';
      modePwdBtn.classList.add('active');
      modePhraseBtn?.classList.remove('active');
      if (pwdControls) pwdControls.style.display = 'flex';
      if (phraseControls) phraseControls.style.display = 'none';
      currentGenPassword = generateSecurePassword();
      updateGeneratorDisplay(container);
    }
  });

  modePhraseBtn?.addEventListener('click', () => {
    if (genMode !== 'passphrase') {
      genMode = 'passphrase';
      modePhraseBtn.classList.add('active');
      modePwdBtn?.classList.remove('active');
      if (pwdControls) pwdControls.style.display = 'none';
      if (phraseControls) phraseControls.style.display = 'flex';
      currentGenPassword = generateSecurePassword();
      updateGeneratorDisplay(container);
    }
  });

  // Password Length Slider & Presets
  const slider = container.querySelector('#gen-view-slider') as HTMLInputElement;
  slider?.addEventListener('input', () => {
    genLength = parseInt(slider.value, 10);
    currentGenPassword = generateSecurePassword();
    updateGeneratorDisplay(container);
  });

  // Passphrase Words Slider & Presets
  const wordsSlider = container.querySelector('#gen-view-words-slider') as HTMLInputElement;
  wordsSlider?.addEventListener('input', () => {
    genPassphraseWords = parseInt(wordsSlider.value, 10);
    currentGenPassword = generateSecurePassword();
    updateGeneratorDisplay(container);
  });

  container.querySelectorAll('#gen-pwd-presets .gen-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const len = (chip as HTMLElement).dataset.len;
      if (len) {
        genLength = parseInt(len, 10);
        if (slider) slider.value = String(genLength);
        currentGenPassword = generateSecurePassword();
        updateGeneratorDisplay(container);
      }
    });
  });

  container.querySelectorAll('#gen-phrase-presets .gen-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const words = (chip as HTMLElement).dataset.words;
      if (words) {
        genPassphraseWords = parseInt(words, 10);
        if (wordsSlider) wordsSlider.value = String(genPassphraseWords);
        currentGenPassword = generateSecurePassword();
        updateGeneratorDisplay(container);
      }
    });
  });

  // Checkboxes
  const bindCheck = (id: string, propSetter: (v: boolean) => void) => {
    const chk = container.querySelector(`#${id}`) as HTMLInputElement;
    chk?.addEventListener('change', () => {
      chk.parentElement?.classList.toggle('active', chk.checked);
      propSetter(chk.checked);

      // Guard: Ensure at least one character set remains checked
      if (!genUseUpper && !genUseLower && !genUseDigits && !genUseSymbols) {
        genUseLower = true;
        const lowerChk = container.querySelector('#chk-v-lower') as HTMLInputElement;
        if (lowerChk) {
          lowerChk.checked = true;
          lowerChk.parentElement?.classList.add('active');
        }
      }

      currentGenPassword = generateSecurePassword();
      updateGeneratorDisplay(container);
    });
  };

  bindCheck('chk-v-upper', v => genUseUpper = v);
  bindCheck('chk-v-lower', v => genUseLower = v);
  bindCheck('chk-v-digits', v => genUseDigits = v);
  bindCheck('chk-v-symbols', v => genUseSymbols = v);
  bindCheck('chk-v-ambig', v => genAvoidAmbiguous = v);
}

// ── Global Copy Helper ──
async function copyToClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* ignore */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

// ── Smart Contextual Suggestions (Matching macOS helper) ──
function renderSmartSuggestions(items: any[]) {
  const container = document.getElementById('suggested-container');
  const titleEl = document.getElementById('suggested-title');
  const listEl = document.getElementById('suggested-list');
  if (!container || !titleEl || !listEl) return;

  if (!activeDomain) {
    container.style.display = 'none';
    return;
  }

  const cleanDomain = activeDomain.toLowerCase();
  const domainPrefix = cleanDomain.split('.')[0];

  const matched = items.filter(item => {
    const titleMatch = (item.title || '').toLowerCase().includes(domainPrefix);
    const urlMatch = (item.urls || []).some((u: string) => {
      try {
        return new URL(u).hostname.replace('www.', '').toLowerCase() === cleanDomain;
      } catch {
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

async function fetchVaultItemsDirect(): Promise<{ isUnlocked: boolean; items: any[] } | null> {
  try {
    const statusRes = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'vault.status' })
    });
    if (!statusRes.ok) return null;
    const statusData = await statusRes.json();
    if (!statusData?.result?.isUnlocked) {
      return { isUnlocked: false, items: [] };
    }

    const itemsRes = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'vault.getItems' })
    });
    if (!itemsRes.ok) return { isUnlocked: true, items: [] };
    const itemsData = await itemsRes.json();
    return {
      isUnlocked: true,
      items: Array.isArray(itemsData?.result) ? itemsData.result : []
    };
  } catch {
    return null;
  }
}

async function unlockVaultDirect(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'vault.unlock',
        params: { masterPassword: password }
      })
    });
    if (!res.ok) return { success: false, error: 'HTTP error ' + res.status };
    const data = await res.json();
    if (data.error) {
      return { success: false, error: data.error.message || 'Incorrect master password' };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Connection failed' };
  }
}

async function lockVaultDirect(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'vault.lock'
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

function showUnlockView(statusMessage?: string) {
  const unlockView = document.getElementById('unlock-view');
  if (unlockView) {
    unlockView.style.display = 'flex';
  }
  const pwdInput = document.getElementById('unlock-password') as HTMLInputElement;
  if (pwdInput) {
    pwdInput.value = '';
    setTimeout(() => pwdInput.focus(), 60);
  }
  const errorEl = document.getElementById('unlock-error');
  if (errorEl) errorEl.style.display = 'none';

  const statusEl = document.getElementById('unlock-daemon-status');
  if (statusEl) {
    statusEl.textContent = statusMessage || 'Connected to local Kloak daemon';
  }
}

function hideUnlockView() {
  const unlockView = document.getElementById('unlock-view');
  if (unlockView) {
    unlockView.style.display = 'none';
  }
}

function setupUnlockView() {
  const form = document.getElementById('unlock-form') as HTMLFormElement;
  const pwdInput = document.getElementById('unlock-password') as HTMLInputElement;
  const toggleBtn = document.getElementById('btn-toggle-unlock-pwd');
  const eyeIcon = document.getElementById('eye-icon-unlock');
  const errorEl = document.getElementById('unlock-error');
  const submitBtn = document.getElementById('btn-submit-unlock') as HTMLButtonElement;
  const btnText = document.getElementById('unlock-btn-text');
  const spinner = document.getElementById('unlock-spinner');

  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      if (eyeIcon) {
        eyeIcon.innerHTML = isPassword
          ? '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>'
          : '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = pwdInput?.value || '';
      if (!password) {
        if (errorEl) {
          errorEl.textContent = 'Please enter your master password.';
          errorEl.style.display = 'block';
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Unlocking...';
      if (spinner) spinner.style.display = 'inline-block';
      if (errorEl) errorEl.style.display = 'none';

      try {
        let unlockSuccess = false;
        let errorMessage = '';

        // 1. Try Direct HTTP RPC first
        const directRes = await unlockVaultDirect(password);
        if (directRes.success) {
          unlockSuccess = true;
        } else {
          errorMessage = directRes.error || '';
          // 2. Fall back to Background Service Worker message passing
          const bgRes: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'UNLOCK_VAULT', password }, (response) => {
              resolve(response);
            });
          });
          if (bgRes && bgRes.success) {
            unlockSuccess = true;
          } else if (bgRes && bgRes.error) {
            errorMessage = bgRes.error;
          }
        }

        if (unlockSuccess) {
          hideUnlockView();
          if (pwdInput) pwdInput.value = '';
          await loadLogins();
        } else {
          if (errorEl) {
            errorEl.textContent = errorMessage || 'Incorrect master password. Please try again.';
            errorEl.style.display = 'block';
          }
          if (pwdInput) {
            pwdInput.select();
            pwdInput.focus();
          }
        }
      } catch (err: any) {
        if (errorEl) {
          errorEl.textContent = err.message || 'Unlock failed. Ensure Kloak is running.';
          errorEl.style.display = 'block';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'Unlock Vault';
        if (spinner) spinner.style.display = 'none';
      }
    });
  }
}

function setupLockBtn() {
  const lockBtn = document.getElementById('btn-lock');
  if (lockBtn) {
    lockBtn.addEventListener('click', async () => {
      await lockVaultDirect();
      chrome.runtime.sendMessage({ type: 'LOCK_VAULT' }).catch(() => null);
      allItems = [];
      activeItem = null;
      const sidebarList = document.getElementById('sidebar-list');
      if (sidebarList) sidebarList.innerHTML = '';
      const detailPane = document.getElementById('detail-pane');
      if (detailPane) detailPane.innerHTML = '<div class="detail-empty">Vault locked</div>';
      showUnlockView();
    });
  }
}

// ── Load Logins ──
async function loadLogins(retryCount = 0) {
  // 1. Try local HTTP direct connection first (instant, robust across all browsers)
  const direct = await fetchVaultItemsDirect();
  if (direct) {
    if (direct.isUnlocked) {
      hideUnlockView();
      allItems = direct.items;
      renderSmartSuggestions(allItems);
      applyFilterAndSort();
      const sorted = sortItems(allItems);
      if (sorted.length > 0 && !activeItem && !isGeneratorOpen) selectItem(sorted[0]);
      return;
    } else {
      // Vault is locked! Show unlock view
      showUnlockView();
      return;
    }
  }

  // 2. Fall back to background service worker message
  chrome.runtime.sendMessage({ type: 'SEARCH_VAULT', query: '' }, (searchRes) => {
    if (searchRes && searchRes.isUnlocked) {
      hideUnlockView();
      allItems = searchRes.items || [];
      renderSmartSuggestions(allItems);
      applyFilterAndSort();
      const sorted = sortItems(allItems);
      if (sorted.length > 0 && !activeItem && !isGeneratorOpen) selectItem(sorted[0]);
    } else {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (statusRes) => {
        if (statusRes && statusRes.isUnlocked && retryCount < 2) {
          setTimeout(() => loadLogins(retryCount + 1), 300);
        } else {
          showUnlockView();
        }
      });
    }
  });
}

// ── Brand Recognition & Favicon Engine ──

function renderItemAvatar(avatarEl: HTMLElement, item: any, size: number = 32) {
  avatarEl.innerHTML = '';
  avatarEl.classList.remove('has-image');

  const domains = resolveItemDomains({
    urls: item.urls,
    title: item.title,
    oauthProvider: item.oauthProvider || item.oauth?.provider,
    domain: item.domain
  });

  // Non-login items without domains render Proton Category Icon
  if (domains.length === 0 && item.type && item.type !== 'login' && (PROTON_ICONS as any)[item.type]) {
    avatarEl.classList.add('kloak-category-avatar');
    avatarEl.innerHTML = `<svg viewBox="0 0 24 24" style="width: ${Math.round(size * 0.5)}px; height: ${Math.round(size * 0.5)}px; fill: currentColor;"><path d="${(PROTON_ICONS as any)[item.type]}"/></svg>`;
    avatarEl.style.color = (PROTON_COLORS as any)[item.type] || 'var(--text-muted)';
    avatarEl.style.width = `${size}px`;
    avatarEl.style.height = `${size}px`;
    avatarEl.style.borderRadius = `${Math.max(4, Math.round(size * 0.2237))}px`;
    avatarEl.style.display = 'inline-flex';
    avatarEl.style.alignItems = 'center';
    avatarEl.style.justifyContent = 'center';
    avatarEl.style.background = 'var(--bg-card)';
    return;
  }

  // Unified JEV AI Favicon squircle
  renderFavicon(avatarEl, { item, size });
}

// ── Sidebar List ──
function renderSidebarList(items: any[]) {
  const container = document.getElementById('sidebar-list');
  if (!container) return;

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

    if (item.type === 'login' && item.password) {
      const risk = evaluateCredentialRisk(item, items);
      const gaugeWrap = document.createElement('div');
      gaugeWrap.className = 'sidebar-risk-wrap';
      gaugeWrap.title = `${risk.label}: ${risk.score}% (${risk.entropyBits} bits entropy)`;
      gaugeWrap.innerHTML = renderCircumferenceSvg(risk.score, risk.color, 20, 2.2);
      row.appendChild(gaugeWrap);
    }

    row.addEventListener('click', () => selectItem(item));
    container.appendChild(row);
  });
}

function selectItem(item: any) {
  isGeneratorOpen = false;
  activeItem = item;
  document.getElementById('filter-generator')?.classList.remove('active');
  document.getElementById('filter-all')?.classList.add('active');
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
  if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }
  renderSidebarList(allItems);
  renderDetailPane(item);
}

// ── Detail Pane (View Mode) ──
function renderDetailPane(item: any) {
  const container = document.getElementById('detail-pane');
  if (!container) return;
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
  if (userVal) userVal.textContent = username;
  const emailVal = document.getElementById('email-val');
  if (emailVal) emailVal.textContent = email;

  // Security Risk & Health Assessment Card with Circular Circumference Gauge
  if (item.type === 'login' && item.password) {
    const risk = evaluateCredentialRisk(item, allItems);
    const riskCard = document.createElement('div');
    riskCard.className = 'card risk-detail-card';

    const circumferenceSvg = renderCircumferenceSvg(risk.score, risk.color, 52, 4.5);

    riskCard.innerHTML = `
      <div class="risk-card-inner">
        <div class="risk-gauge-container">
          ${circumferenceSvg}
        </div>
        <div class="risk-info-column">
          <div class="risk-header-row">
            <span class="risk-title">Security & Risk Health</span>
            <span class="risk-status-pill" style="background: ${risk.color}22; color: ${risk.color}; border: 1px solid ${risk.color}55;">
              ${risk.label}
            </span>
          </div>
          <div class="risk-chips-wrap">
            <span class="risk-chip">🔐 ${risk.entropyBits} bits entropy</span>
            <span class="risk-chip ${risk.isReused ? 'alert' : ''}">${risk.isReused ? `⚠️ Reused on ${risk.reusedCount + 1} sites` : '✓ Unique password'}</span>
            <span class="risk-chip ${risk.has2FA ? 'success' : ''}">${risk.has2FA ? '🛡️ 2FA Active' : '⚠️ No 2FA'}</span>
          </div>
          ${item.passwordHistory && item.passwordHistory.length > 0 ? `
            <div class="risk-history-info">
              <span>🕒 ${item.passwordHistory.length} previous password${item.passwordHistory.length > 1 ? 's' : ''} archived in history</span>
            </div>
          ` : ''}
          ${item.importSource ? `
            <div class="risk-source-info">
              <span>📥 Source: <strong>${item.importSource}</strong></span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    container.appendChild(riskCard);
  }

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
    const handleCopy = async (e: Event) => {
      e.stopPropagation();
      const codeEl = document.getElementById('totp-code');
      const rawCode = (codeEl?.textContent || '').replace(/\s+/g, '');
      if (!rawCode || rawCode === '------') return;
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
    urls.forEach((u: string) => {
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
    if (notesVal) notesVal.textContent = notes;
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

  async function copyToClipboard(text: string, btn: HTMLElement) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else { throw new Error('fallback'); }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    btn.innerHTML = checkIconSvg;
    setTimeout(() => { btn.innerHTML = copyIconSvg; }, 1500);
  }

  // Password reveal
  let revealed = false;
  document.getElementById('toggle-pwd')?.addEventListener('click', () => {
    revealed = !revealed;
    const pwdEl = document.getElementById('pwd-val');
    if (!pwdEl) return;
    if (revealed) {
      pwdEl.textContent = item.password || '';
      pwdEl.style.letterSpacing = 'normal';
    } else {
      pwdEl.textContent = '••••••••••';
      pwdEl.style.letterSpacing = '2px';
    }
  });

  document.getElementById('copy-pwd')?.addEventListener('click', (e) => {
    copyToClipboard(item.password || '', e.currentTarget as HTMLElement);
  });
  document.getElementById('copy-user')?.addEventListener('click', (e) => {
    copyToClipboard(item.username || '', e.currentTarget as HTMLElement);
  });
  document.getElementById('copy-email')?.addEventListener('click', (e) => {
    copyToClipboard(item.email || '', e.currentTarget as HTMLElement);
  });
  document.getElementById('copy-totp')?.addEventListener('click', (e) => {
    const code = document.getElementById('totp-code')?.textContent || '';
    copyToClipboard(code, e.currentTarget as HTMLElement);
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
function enterEditMode(item: any) {
  const container = document.getElementById('detail-pane');
  if (!container) return;
  isEditing = true;

  const currentUrls: string[] = item.urls && item.urls.length > 0 ? item.urls : [''];

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
          <div class="card-label">Title / Service</div>
          <input type="text" class="edit-input" id="edit-title" value="${escHtml(item.title || '')}" list="kloak-edit-services-datalist" autocomplete="off">
          <datalist id="kloak-edit-services-datalist"></datalist>
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
      <div class="card-row" style="flex-direction: column; align-items: stretch;">
        <div class="card-label" style="margin-bottom: 6px;">Websites</div>
        <div id="edit-urls-container">
          ${currentUrls.map((u, i) => `
            <div class="multi-url-row" style="margin-bottom: 6px;">
              <div class="card-icon" style="margin-right: 6px;">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </div>
              <input type="text" class="edit-input edit-url-input" placeholder="https://" value="${escHtml(u)}">
              ${i > 0 ? `<div class="action-icon btn-del-edit-url" style="color: var(--danger);"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>` : ''}
            </div>
          `).join('')}
        </div>
        <!-- Smart Domain Suggestions in Edit Mode -->
        <div class="domain-suggestions-box" id="edit-domain-suggestions-box" style="display: none;">
          <div class="domain-suggestions-header">
            <div class="domain-suggestions-title">
              <svg viewBox="0 0 24 24" class="sparkle-svg"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
              <span id="edit-domain-suggestions-label">Suggested Domains:</span>
            </div>
            <span class="domain-suggestions-count" id="edit-domain-suggestions-count">0</span>
          </div>
          <div class="domain-chips-container" id="edit-domain-chips-container"></div>
        </div>
        <button class="btn-add-inline" id="btn-edit-add-more-url">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Add another website
        </button>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Notes</div>
          <textarea class="edit-input" id="edit-notes" rows="3" style="resize: vertical;">${escHtml(item.notes || '')}</textarea>
        </div>
      </div>
    </div>
  `;

  // 1. Populate Datalist
  const editDatalist = document.getElementById('kloak-edit-services-datalist');
  if (editDatalist) {
    editDatalist.innerHTML = getAllKnownServiceNames()
      .map(name => `<option value="${name}"></option>`)
      .join('');
  }

  // 2. Wire Domain Suggestions for Edit Mode
  const editTitleInput = document.getElementById('edit-title') as HTMLInputElement;
  const editUrlsContainer = document.getElementById('edit-urls-container');
  const editSuggestionsBox = document.getElementById('edit-domain-suggestions-box');
  const editSuggestionsLabel = document.getElementById('edit-domain-suggestions-label');
  const editSuggestionsCount = document.getElementById('edit-domain-suggestions-count');
  const editChipsContainer = document.getElementById('edit-domain-chips-container');

  function getEditUrls(): string[] {
    const inputs = editUrlsContainer?.querySelectorAll<HTMLInputElement>('.edit-url-input');
    if (!inputs) return [];
    const list: string[] = [];
    inputs.forEach(inp => {
      const val = inp.value.trim();
      if (val) list.push(val);
    });
    return list;
  }

  function isEditDomainAdded(domain: string): boolean {
    const cleanTarget = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const current = getEditUrls();
    return current.some(u => {
      const clean = u.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      return clean === cleanTarget || clean.endsWith('.' + cleanTarget) || cleanTarget.endsWith('.' + clean);
    });
  }

  function applyDomainToEditForm(domain: string) {
    const targetUrl = domain.startsWith('http://') || domain.startsWith('https://')
      ? domain
      : `https://${domain}`;

    const inputs = editUrlsContainer?.querySelectorAll<HTMLInputElement>('.edit-url-input');
    let applied = false;
    if (inputs) {
      for (let i = 0; i < inputs.length; i++) {
        const inp = inputs[i];
        if (!inp.value.trim()) {
          inp.value = targetUrl;
          applied = true;
          break;
        }
      }
    }

    if (!applied) {
      addEditUrlInputRow(targetUrl);
    }

    if (editTitleInput) {
      updateEditDomainSuggestions(editTitleInput.value);
    }
  }

  function addEditUrlInputRow(initialVal: string = '') {
    if (!editUrlsContainer) return;
    const row = document.createElement('div');
    row.className = 'multi-url-row';
    row.style.marginBottom = '6px';
    row.innerHTML = `
      <div class="card-icon" style="margin-right: 6px;">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      </div>
      <input type="text" class="edit-input edit-url-input" placeholder="https://" value="${escHtml(initialVal)}">
      <div class="action-icon btn-del-edit-url" style="color: var(--danger);"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>
    `;
    const urlInput = row.querySelector('.edit-url-input') as HTMLInputElement;
    bindEditUrlInput(urlInput);
    row.querySelector('.btn-del-edit-url')?.addEventListener('click', () => {
      row.remove();
      if (editTitleInput) updateEditDomainSuggestions(editTitleInput.value);
    });
    editUrlsContainer.appendChild(row);
  }

  function bindEditUrlInput(input: HTMLInputElement) {
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (val && editTitleInput && !editTitleInput.value.trim()) {
        const rev = resolveServiceFromUrl(val);
        if (rev) {
          editTitleInput.value = rev.displayName;
          updateEditDomainSuggestions(rev.displayName);
          return;
        }
      }
      if (editTitleInput && editTitleInput.value.trim()) {
        updateEditDomainSuggestions(editTitleInput.value);
      }
    });
  }

  function updateEditDomainSuggestions(query: string) {
    if (!editSuggestionsBox || !editChipsContainer) return;
    const clean = query.trim();
    if (!clean) {
      editSuggestionsBox.style.display = 'none';
      editChipsContainer.innerHTML = '';
      return;
    }

    const match: ServiceDomainInfo | null = resolveServiceDomains(clean);
    if (!match || !match.domains || match.domains.length === 0) {
      editSuggestionsBox.style.display = 'none';
      editChipsContainer.innerHTML = '';
      return;
    }

    if (editSuggestionsLabel) {
      editSuggestionsLabel.textContent = `${match.displayName} Domains:`;
    }
    if (editSuggestionsCount) {
      editSuggestionsCount.textContent = `${match.domains.length}`;
    }

    editChipsContainer.innerHTML = '';
    match.domains.forEach(domain => {
      const added = isEditDomainAdded(domain);
      const chip = document.createElement('div');
      chip.className = `domain-chip ${added ? 'active' : ''}`;
      chip.title = added ? `Already added (${domain})` : `Click to add ${domain}`;
      chip.innerHTML = `
        <span class="chip-symbol">${added ? '✓' : '+'}</span>
        <span class="chip-text">${escHtml(domain)}</span>
      `;
      if (!added) {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          applyDomainToEditForm(domain);
        });
      }
      editChipsContainer.appendChild(chip);
    });

    editSuggestionsBox.style.display = 'block';
  }

  // Bind initial edit url inputs & del buttons
  editUrlsContainer?.querySelectorAll<HTMLInputElement>('.edit-url-input').forEach(inp => bindEditUrlInput(inp));
  editUrlsContainer?.querySelectorAll('.btn-del-edit-url').forEach(btn => {
    btn.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).closest('.multi-url-row')?.remove();
      if (editTitleInput) updateEditDomainSuggestions(editTitleInput.value);
    });
  });

  document.getElementById('btn-edit-add-more-url')?.addEventListener('click', () => {
    addEditUrlInputRow('');
  });

  editTitleInput?.addEventListener('input', () => {
    updateEditDomainSuggestions(editTitleInput.value);
  });

  if (item.title) {
    updateEditDomainSuggestions(item.title);
  }

  document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
    renderDetailPane(item);
  });

  document.getElementById('btn-save-edit')?.addEventListener('click', () => {
    const editUrlInputs = Array.from(document.querySelectorAll<HTMLInputElement>('.edit-url-input'));
    const urls = editUrlInputs.map(i => i.value.trim()).filter(Boolean);

    const updated = {
      ...item,
      title: (document.getElementById('edit-title') as HTMLInputElement).value,
      username: (document.getElementById('edit-username') as HTMLInputElement).value,
      password: (document.getElementById('edit-password') as HTMLInputElement).value,
      totpSecret: (document.getElementById('edit-totp') as HTMLInputElement).value.trim().replace(/\s+/g, '') || undefined,
      urls,
      notes: (document.getElementById('edit-notes') as HTMLTextAreaElement).value,
      updatedAt: new Date().toISOString(),
    };

    chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', item: updated }, (res) => {
      if (res?.success) {
        const idx = allItems.findIndex(i => i.id === item.id);
        if (idx !== -1) allItems[idx] = updated;
        activeItem = updated;
        renderSidebarList(allItems);
        renderDetailPane(updated);
      }
    });
  });
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── TOTP Core Logic ──
function startTotpCounter(secret: string) {
  if (totpInterval) clearInterval(totpInterval);

  const update = () => {
    const code = generateTOTP(secret);
    const codeEl = document.getElementById('totp-code');
    const timerTextEl = document.getElementById('totp-timer-text');
    const pillEl = document.getElementById('totp-countdown-pill');
    const progressEl = document.getElementById('totp-svg-progress') as HTMLElement | null;

    if (codeEl) codeEl.textContent = `${code.slice(0, 3)}  ${code.slice(3)}`;

    const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    if (timerTextEl) timerTextEl.textContent = `${remaining}s`;

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

function generateTOTP(secret: string): string {
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

// ── Account Retrieval & Smart Auto-Merging Modal ──
function setupAccountRetrievalModal() {
  const modal = document.getElementById('account-retrieve-modal');
  const btnOpenHeader = document.getElementById('btn-retrieve-accounts');
  const menuRetrieve = document.getElementById('menu-retrieve-accounts');
  const btnClose = document.getElementById('btn-close-retrieve-modal');
  const btnDone = document.getElementById('btn-merge-report-done');

  if (!modal) return;

  const openModal = () => {
    modal.style.display = 'flex';
    document.getElementById('add-dropdown')?.classList.remove('open');
    switchTab('google');
    const reportPanel = document.getElementById('merge-report-panel');
    if (reportPanel) reportPanel.style.display = 'none';
  };

  const closeModal = () => {
    modal.style.display = 'none';
  };

  btnOpenHeader?.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal();
  });

  menuRetrieve?.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal();
  });

  btnClose?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  btnDone?.addEventListener('click', async () => {
    closeModal();
    await loadLogins();
  });

  // Tab switching
  const tabs = modal.querySelectorAll('.modal-tab');
  const panels: Record<string, HTMLElement | null> = {
    google: document.getElementById('panel-google'),
    microsoft: document.getElementById('panel-microsoft'),
    opera: document.getElementById('panel-opera'),
    apple: document.getElementById('panel-apple'),
    universal: document.getElementById('panel-universal')
  };

  function switchTab(tabKey: string) {
    tabs.forEach(t => {
      const isMatch = t.getAttribute('data-tab') === tabKey;
      t.classList.toggle('active', isMatch);
    });
    Object.keys(panels).forEach(k => {
      if (panels[k]) {
        panels[k]!.style.display = k === tabKey ? 'flex' : 'none';
      }
    });
    const reportPanel = document.getElementById('merge-report-panel');
    if (reportPanel) reportPanel.style.display = 'none';
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      const tabKey = t.getAttribute('data-tab') || 'google';
      switchTab(tabKey);
    });
  });

  // Provider direct actions
  document.getElementById('btn-open-google-passwords')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://passwords.google.com' });
  });
  document.getElementById('btn-open-ms-passwords')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://account.microsoft.com' });
  });
  document.getElementById('btn-open-opera-passwords')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://auth.opera.com' });
  });

  // Drop zone helper
  const setupDropZone = (
    dropZoneId: string,
    fileInputId: string,
    browseBtnId: string,
    format: string
  ) => {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId) as HTMLInputElement;
    const browseBtn = document.getElementById(browseBtnId);

    if (!dropZone || !fileInput) return;

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        processFile(files[0], format);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        processFile(fileInput.files[0], format);
      }
    });
  };

  setupDropZone('drop-zone-google', 'file-input-google', 'btn-browse-google', 'google-csv');
  setupDropZone('drop-zone-microsoft', 'file-input-microsoft', 'btn-browse-microsoft', 'microsoft-csv');
  setupDropZone('drop-zone-opera', 'file-input-opera', 'btn-browse-opera', 'opera-csv');
  setupDropZone('drop-zone-apple', 'file-input-apple', 'btn-browse-apple', 'apple-csv');
  setupDropZone('drop-zone-universal', 'file-input-universal', 'btn-browse-universal', 'auto');

  async function processFile(file: File, format: string) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      chrome.runtime.sendMessage(
        {
          type: 'IMPORT_PASSWORDS',
          content,
          format,
          options: { autoMerge: true }
        },
        async (response) => {
          if (response?.success && response.result?.mergeReport) {
            displayMergeReport(response.result.mergeReport);
          } else if (response?.success) {
            displayMergeReport({
              totalProcessed: response.result.imported || 1,
              exactDuplicatesMerged: 0,
              updatedPasswordsMerged: 0,
              newItemsAdded: response.result.imported || 1,
              reusedPasswordGroups: []
            });
          } else {
            alert('Import error: ' + (response?.error || 'Failed to parse file'));
          }
        }
      );
    };
    reader.readAsText(file);
  }

  function displayMergeReport(report: any) {
    Object.keys(panels).forEach(k => {
      if (panels[k]) panels[k]!.style.display = 'none';
    });

    const reportPanel = document.getElementById('merge-report-panel');
    const statsGrid = document.getElementById('report-stats-grid');
    if (!reportPanel || !statsGrid) return;

    statsGrid.innerHTML = `
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #6D4AFF;">${report.totalProcessed || (report.newItemsAdded + report.exactDuplicatesMerged + report.updatedPasswordsMerged)}</div>
        <div class="report-stat-label">Total Accounts Processed</div>
      </div>
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #10B981;">${report.exactDuplicatesMerged || 0}</div>
        <div class="report-stat-label">Exact Duplicates Auto-Merged</div>
      </div>
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #00D2B4;">${report.updatedPasswordsMerged || 0}</div>
        <div class="report-stat-label">Updated Passwords Merged (History Kept)</div>
      </div>
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #FF884D;">${report.newItemsAdded || 0}</div>
        <div class="report-stat-label">New Accounts Added to Vault</div>
      </div>
    `;

    if (report.reusedPasswordGroups && report.reusedPasswordGroups.length > 0) {
      statsGrid.innerHTML += `
        <div class="report-stat-card" style="grid-column: span 2; border-color: rgba(245, 74, 74, 0.4); background: rgba(245, 74, 74, 0.08);">
          <div class="report-stat-num" style="color: #EF4444; font-size: 13px;">
            ⚠️ ${report.reusedPasswordGroups.length} Reused Password Groups Detected
          </div>
          <div class="report-stat-label" style="color: #FF9B9B;">
            Identical passwords used across different services. Consider updating with generated passwords.
          </div>
        </div>
      `;
    }

    reportPanel.style.display = 'flex';
  }
}
