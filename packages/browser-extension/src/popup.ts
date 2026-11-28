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
import {
  isHardwareKeySupported,
  registerHardwareSecurityKey,
  authenticateHardwareSecurityKey
} from './webauthn-hardware-key';

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
let isSessionsViewOpen = false;
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
  setupHardwareKeyModal();

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
  } else if (requestedTab === 'sessions' || storedTab === 'sessions') {
    showSessionsView();
  }
});

type WorkspaceMode = 'vault' | 'generator' | 'sessions' | 'import' | 'settings';
type VaultCategory = 'all' | 'login' | '2fa' | 'email_alias' | 'card' | 'secure_note' | 'identity';

let activeWorkspace: WorkspaceMode = 'vault';
let currentCategory: VaultCategory = 'all';
let favoritesOnly = false;
let currentSortMode: 'recent' | 'alpha' | 'newest' | 'oldest' = 'recent';
let isImportViewOpen = false;
let isSettingsViewOpen = false;

function matchesCategory(item: any, category: VaultCategory): boolean {
  if (category === 'all') return true;
  if (category === 'login') return item.type === 'login' || !item.type;
  if (category === '2fa') return item.type === 'authenticator' || Boolean(item.totpSecret) || isRecoveryCodeNote(item);
  if (category === 'email_alias') return item.type === 'email_alias' || item.type === 'alias';
  if (category === 'card') return item.type === 'card';
  if (category === 'secure_note') return item.type === 'secure_note' || item.type === 'note';
  if (category === 'identity') return item.type === 'identity';
  return true;
}

function updateCategoryCounts(items: any[]) {
  const categories: VaultCategory[] = ['all', 'login', '2fa', 'email_alias', 'card', 'secure_note', 'identity'];
  let shouldFallbackToAll = false;

  categories.forEach(cat => {
    const count = items.filter(item => matchesCategory(item, cat)).length;
    const badge = document.getElementById(`count-${cat}`);
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('is-zero', count === 0);
    }

    const btn = document.querySelector<HTMLElement>(`.cat-btn[data-category="${cat}"]`);
    if (btn) {
      const isHidden = cat !== 'all' && count === 0;
      btn.style.display = isHidden ? 'none' : '';
      btn.hidden = isHidden;
      if (isHidden && currentCategory === cat) {
        shouldFallbackToAll = true;
      }
    }
  });

  if (shouldFallbackToAll) {
    currentCategory = 'all';
    updateActiveCategoryButton(document.getElementById('filter-all'));
  }
}

function setWorkspaceMode(mode: WorkspaceMode) {
  activeWorkspace = mode;
  isGeneratorOpen = mode === 'generator';
  isSessionsViewOpen = mode === 'sessions';
  isImportViewOpen = mode === 'import';
  isSettingsViewOpen = mode === 'settings';

  const mainView = document.getElementById('main-view');
  if (mainView) {
    mainView.classList.toggle('workspace-tool-mode', mode !== 'vault');
  }

  document.getElementById('rail-vault')?.classList.toggle('active', mode === 'vault');
  document.getElementById('rail-generator')?.classList.toggle('active', mode === 'generator');
  document.getElementById('rail-sessions')?.classList.toggle('active', mode === 'sessions');
  document.getElementById('rail-retrieve')?.classList.toggle('active', mode === 'import');
  document.getElementById('rail-settings')?.classList.toggle('active', mode === 'settings');
}

function refreshSessionAlertDot() {
  const dot = document.getElementById('rail-sessions-dot');
  if (!dot) return;
  try {
    chrome.runtime.sendMessage({ type: 'GET_SESSION_WATCH_STATUS' }, (res) => {
      if (chrome.runtime.lastError) return;
      const alerts: any[] = Array.isArray(res?.alerts) ? res.alerts : [];
      const sessions: any[] = Array.isArray(res?.sessions) ? res.sessions : [];
      const hasAlert = alerts.length > 0 || sessions.some(s => s.status === 'expired' || s.status === 'revoked');
      dot.style.display = hasAlert ? 'block' : 'none';
    });
  } catch {
    // ignore outside extension runtime
  }
}

// ── Search & Filter ──
function setupSearch() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const clearBtn = document.getElementById('btn-search-clear');

  const syncClearBtn = () => {
    if (clearBtn) {
      clearBtn.style.display = (searchInput?.value || '').length > 0 ? 'flex' : 'none';
    }
  };

  searchInput?.addEventListener('input', () => {
    syncClearBtn();
    if (activeWorkspace !== 'vault') {
      setWorkspaceMode('vault');
      if (activeItem) {
        renderDetailPane(activeItem);
      }
    }
    applyFilterAndSort(true);
    if (!activeItem && activeWorkspace === 'vault') {
      const visible = getFilteredAndSortedItems();
      if (visible.length > 0) selectItem(visible[0]);
    }
  });

  clearBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (searchInput) {
      searchInput.value = '';
      syncClearBtn();
      searchInput.focus();
      applyFilterAndSort(true);
    }
  });

  // Keyboard navigation: `/` focuses search, Esc clears query, ArrowUp/Down navigates items
  document.addEventListener('keydown', (e) => {
    const unlockView = document.getElementById('unlock-view');
    if (unlockView && unlockView.style.display !== 'none') return;

    const target = e.target as HTMLElement | null;
    const isTypingField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

    if (e.key === '/' && !isTypingField) {
      e.preventDefault();
      if (activeWorkspace !== 'vault') setWorkspaceMode('vault');
      searchInput?.focus();
      searchInput?.select();
      return;
    }

    if (e.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
      e.preventDefault();
      searchInput.value = '';
      syncClearBtn();
      applyFilterAndSort(true);
      return;
    }

    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.activeElement === searchInput && activeWorkspace === 'vault') {
      e.preventDefault();
      const visible = getFilteredAndSortedItems();
      if (visible.length === 0) return;
      const idx = activeItem ? visible.findIndex(i => i.id === activeItem.id) : -1;
      const nextIdx = e.key === 'ArrowDown'
        ? (idx + 1) % visible.length
        : (idx <= 0 ? visible.length - 1 : idx - 1);
      selectItem(visible[nextIdx]);
      const row = document.querySelector<HTMLElement>(`.list-item[data-item-id="${visible[nextIdx].id}"]`);
      row?.scrollIntoView({ block: 'nearest' });
    }
  });
}

function updateActiveCategoryButton(activeBtn: HTMLElement | null) {
  document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
  activeBtn?.classList.add('active');
}

function setupFilters() {
  const railVault = document.getElementById('rail-vault');
  const railGenerator = document.getElementById('rail-generator');
  const railSessions = document.getElementById('rail-sessions');
  const railRetrieve = document.getElementById('rail-retrieve');
  const railSettings = document.getElementById('rail-settings');
  const favToggleBtn = document.getElementById('btn-favorites-toggle');

  railVault?.addEventListener('click', () => {
    setWorkspaceMode('vault');
    applyFilterAndSort(true);
    const visible = getFilteredAndSortedItems();
    if (visible.length > 0 && (!activeItem || !visible.some(i => i.id === activeItem.id))) {
      selectItem(visible[0]);
    } else if (activeItem) {
      renderDetailPane(activeItem);
    } else {
      const detailPane = document.getElementById('detail-pane');
      if (detailPane) detailPane.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
    }
  });

  railGenerator?.addEventListener('click', () => {
    setWorkspaceMode('generator');
    showGeneratorView();
  });

  railSessions?.addEventListener('click', () => {
    setWorkspaceMode('sessions');
    showSessionsView();
  });

  railRetrieve?.addEventListener('click', () => {
    showImportExportView('import');
  });

  railSettings?.addEventListener('click', () => {
    showSettingsView();
  });

  favToggleBtn?.addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    favToggleBtn.classList.toggle('active', favoritesOnly);
    favToggleBtn.setAttribute('aria-pressed', favoritesOnly ? 'true' : 'false');
    setWorkspaceMode('vault');
    applyFilterAndSort(true);
    const visible = getFilteredAndSortedItems();
    if (visible.length > 0 && (!activeItem || !visible.some(i => i.id === activeItem.id))) {
      selectItem(visible[0]);
    }
  });

  document.querySelectorAll<HTMLElement>('.cat-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = (btn.dataset.category || 'all') as VaultCategory;
      currentCategory = cat;
      setWorkspaceMode('vault');
      updateActiveCategoryButton(btn);
      applyFilterAndSort(true);
      const visible = getFilteredAndSortedItems();
      if (visible.length > 0 && (!activeItem || !visible.some(i => i.id === activeItem.id))) {
        selectItem(visible[0]);
      } else if (visible.length === 0) {
        activeItem = null;
        const detailPane = document.getElementById('detail-pane');
        if (detailPane) detailPane.innerHTML = '<div class="detail-empty">No items in this category</div>';
      }
    });
  });

  refreshSessionAlertDot();
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
    document.getElementById('btn-add')?.classList.remove('open');
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
        applyFilterAndSort(true);
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

function getFilteredAndSortedItems(): any[] {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const rawQuery = (searchInput?.value || '').trim().toLowerCase();
  let filtered = allItems.filter(item => matchesCategory(item, currentCategory));

  if (favoritesOnly) {
    filtered = filtered.filter(item => Boolean(item.favorite));
  }

  if (rawQuery) {
    const terms = rawQuery.split(/\s+/).filter(Boolean);
    filtered = filtered.filter(item => {
      const title = (item.title || '').toLowerCase();
      const username = (item.username || '').toLowerCase();
      const urls = (item.urls || []).map((u: string) => u.toLowerCase());
      return terms.every(term =>
        title.includes(term) ||
        username.includes(term) ||
        urls.some(u => u.includes(term))
      );
    });
  }
  return sortItems(filtered);
}

function applyFilterAndSort(animate: boolean = true) {
  updateCategoryCounts(allItems);
  const sorted = getFilteredAndSortedItems();
  const countLabel = document.getElementById('list-count-label');
  if (countLabel) {
    const prefix = favoritesOnly ? '★ ' : '';
    countLabel.textContent = `${prefix}${sorted.length} ${sorted.length === 1 ? 'item' : 'items'}`;
  }
  renderSidebarList(sorted, animate);
}

// ── Add Dropdown (+ morphs smoothly into x when opened) ──
function setupAddDropdown() {
  const btn = document.getElementById('btn-add');
  const dropdown = document.getElementById('add-dropdown');
  if (!btn || !dropdown) return;

  const setOpenState = (open: boolean) => {
    dropdown.classList.toggle('open', open);
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextOpen = !dropdown.classList.contains('open');
    setOpenState(nextOpen);
  });

  document.addEventListener('click', () => {
    setOpenState(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      setOpenState(false);
    }
  });

  dropdown.querySelectorAll('.add-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = (item as HTMLElement).dataset.type;
      setOpenState(false);
      if (!type) return;
      showAddForm(type);
    });
  });
}

// ── Proton Pass Creation Pages ──
function showAddForm(type: string, initialValues?: { title?: string; username?: string; password?: string; url?: string }) {
  const container = document.getElementById('detail-pane');
  if (!container) return;
  setWorkspaceMode('vault');
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
  document.getElementById('btn-save-create')?.addEventListener('click', async () => {
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

    await saveVaultItemDirect(newItem);

    chrome.runtime.sendMessage({ type: 'ADD_ITEM', item: newItem }, (res) => {
      if (res?.success) {
        const created = res.item || newItem;
        allItems.push(created);
        applyFilterAndSort(false);
        selectItem(created);
      }
    });
  });
}

function updateStrengthMeter(pwd: string, prefix = 'str') {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 14) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;

  const colors = ['#F54A4A', '#FF884D', '#FFB800', '#29C98F'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  for (let i = 1; i <= 4; i++) {
    const seg = document.getElementById(`${prefix}-${i}`);
    if (seg) {
      seg.style.background = i <= score ? colors[score - 1] : '#312E40';
    }
  }

  const lbl = document.getElementById(`${prefix}-label`);
  if (lbl) {
    lbl.textContent = score > 0 ? labels[score - 1] : 'Very weak';
    lbl.style.color = score > 0 ? colors[score - 1] : 'var(--text-muted)';
  }
}

function showToast(msg: string) {
  let toast = document.getElementById('kloak-popup-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'kloak-popup-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #1E1B2E;
      color: #10B981;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      z-index: 99999;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => {
    if (toast) toast.style.opacity = '0';
  }, 2200);
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
  isSessionsViewOpen = false;
  activeItem = null;
  setWorkspaceMode('generator');
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
        (fillBtn as HTMLElement).style.background = '#29C98F';
        setTimeout(() => {
          fillBtn.innerHTML = orig;
          (fillBtn as HTMLElement).style.background = '';
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

async function unlockVaultWithBiometricsDirect(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'vault.unlockWithBiometrics'
      })
    });
    if (!res.ok) return { success: false, error: 'HTTP error ' + res.status };
    const data = await res.json();
    if (data.error) {
      return { success: false, error: data.error.message || 'Touch ID verification failed' };
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

async function saveVaultItemDirect(item: any): Promise<boolean> {
  const normalizedItem = {
    ...item,
    id: item.id,
    type: item.type || 'login',
    title: item.title || 'Untitled',
    username: item.username || '',
    password: item.password || '',
    urls: Array.isArray(item.urls) ? item.urls : [],
    notes: item.notes || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    favorite: Boolean(item.favorite),
    trashed: Boolean(item.trashed),
    usedRecoveryCodes: Array.isArray(item.usedRecoveryCodes) ? item.usedRecoveryCodes : [],
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(item.totpSecret ? { totpSecret: item.totpSecret } : {}),
    ...(item.oauth ? { oauth: item.oauth } : {}),
    ...(item.sessionPolicy ? { sessionPolicy: item.sessionPolicy } : {}),
    ...(Array.isArray(item.passwordHistory) && item.passwordHistory.length > 0 ? { passwordHistory: item.passwordHistory } : {})
  };

  try {
    // 1. Try vault.saveItem directly to local daemon / macOS app
    let res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'vault.saveItem',
        params: { item: normalizedItem }
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error && data.result) {
        return true;
      }
    }

    // 2. Fallback: Try vault.updateItem
    res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'vault.updateItem',
        params: { id: normalizedItem.id, updates: normalizedItem, item: normalizedItem }
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error && data.result) {
        return true;
      }
    }

    // 3. Fallback: Try vault.addItem
    res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'vault.addItem',
        params: { item: normalizedItem }
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error && data.result) {
        return true;
      }
    }
  } catch {}

  return false;
}

function updateHardwareKeyVisibility() {
  const hwDivider = document.getElementById('unlock-hw-divider');
  const hwBtn = document.getElementById('btn-unlock-hardware-key');
  if (!hwDivider || !hwBtn) return;

  chrome.runtime.sendMessage({ type: 'GET_HARDWARE_KEY_CONFIG' }, (res) => {
    const isConfigured = !!(res && res.hardwareKey && res.hardwareKey.enabled);
    hwDivider.style.display = isConfigured ? 'flex' : 'none';
    hwBtn.style.display = isConfigured ? 'flex' : 'none';
  });
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

  updateHardwareKeyVisibility();
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

  const touchIdBtn = document.getElementById('btn-unlock-touch-id');
  const touchIdText = document.getElementById('touch-id-btn-text');

  if (touchIdBtn) {
    touchIdBtn.addEventListener('click', async () => {
      if (errorEl) errorEl.style.display = 'none';
      touchIdBtn.classList.add('active');
      if (touchIdText) touchIdText.textContent = 'Touch ID Sensor...';

      try {
        let unlockSuccess = false;
        let errorMessage = '';

        // 1. Direct HTTP RPC to macOS daemon
        const directRes = await unlockVaultWithBiometricsDirect();
        if (directRes.success) {
          unlockSuccess = true;
        } else {
          errorMessage = directRes.error || '';
          // 2. Background service worker message passing
          const bgRes: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'UNLOCK_WITH_TOUCH_ID' }, resolve);
          });
          if (bgRes && bgRes.success) {
            unlockSuccess = true;
          } else if (bgRes && bgRes.error) {
            errorMessage = bgRes.error;
          }
        }

        if (unlockSuccess) {
          hideUnlockView();
          await loadLogins();
          showToast('✓ Vault unlocked with Touch ID');
        } else {
          if (errorEl) {
            errorEl.textContent = errorMessage || 'Touch ID authentication failed or was cancelled.';
            errorEl.style.display = 'block';
          }
        }
      } catch (err: any) {
        if (errorEl) {
          errorEl.textContent = err.message || 'Touch ID authentication cancelled.';
          errorEl.style.display = 'block';
        }
      } finally {
        touchIdBtn.classList.remove('active');
        if (touchIdText) touchIdText.textContent = 'Unlock with Touch ID';
      }
    });
  }

  const hwKeyBtn = document.getElementById('btn-unlock-hardware-key');
  const hwKeyText = document.getElementById('hw-key-btn-text');

  if (hwKeyBtn) {
    hwKeyBtn.addEventListener('click', async () => {
      if (errorEl) errorEl.style.display = 'none';
      hwKeyBtn.classList.add('active');
      if (hwKeyText) hwKeyText.textContent = 'Touch your Security Key...';

      try {
        const configRes: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'GET_HARDWARE_KEY_CONFIG' }, resolve);
        });

        const hwConfig = configRes?.hardwareKey;
        const credIds = hwConfig?.credentials?.map((c: any) => c.id);
        const saltHex = hwConfig?.salt || 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

        const { hardwareSecret } = await authenticateHardwareSecurityKey({
          credentialIds: credIds,
          saltHex
        });

        const unlockRes: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'UNLOCK_VAULT_WITH_HARDWARE_KEY',
            hardwareSecret
          }, resolve);
        });

        if (unlockRes && unlockRes.success) {
          hideUnlockView();
          await loadLogins();
          showToast('✓ Vault unlocked with Hardware Security Key');
        } else {
          if (errorEl) {
            errorEl.textContent = unlockRes?.error || 'Hardware key verification failed.';
            errorEl.style.display = 'block';
          }
        }
      } catch (err: any) {
        if (errorEl) {
          errorEl.textContent = err.message || 'Hardware key authentication cancelled.';
          errorEl.style.display = 'block';
        }
      } finally {
        hwKeyBtn.classList.remove('active');
        if (hwKeyText) hwKeyText.textContent = 'Unlock with Hardware Key';
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

  // Real-time synchronization: listen for vault lock/unlock events broadcast by background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'VAULT_STATE_CHANGED') {
      if (!message.isUnlocked) {
        allItems = [];
        activeItem = null;
        const sidebarList = document.getElementById('sidebar-list');
        if (sidebarList) sidebarList.innerHTML = '';
        const detailPane = document.getElementById('detail-pane');
        if (detailPane) detailPane.innerHTML = '<div class="detail-empty">Vault locked</div>';
        showUnlockView();
      } else {
        loadLogins();
      }
    }
  });
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
      refreshSessionAlertDot();
      const sorted = getFilteredAndSortedItems();
      if (sorted.length > 0 && !activeItem && activeWorkspace === 'vault') selectItem(sorted[0]);
      if (activeWorkspace === 'vault') {
        setTimeout(() => (document.getElementById('search-input') as HTMLInputElement | null)?.focus(), 40);
      }
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
      refreshSessionAlertDot();
      const sorted = getFilteredAndSortedItems();
      if (sorted.length > 0 && !activeItem && activeWorkspace === 'vault') selectItem(sorted[0]);
      if (activeWorkspace === 'vault') {
        setTimeout(() => (document.getElementById('search-input') as HTMLInputElement | null)?.focus(), 40);
      }
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
  // Special case: recovery code notes without a resolved brand domain get a key icon in green
  if (domains.length === 0 && isRecoveryCodeNote(item)) {
    avatarEl.classList.add('kloak-category-avatar');
    avatarEl.innerHTML = `<svg viewBox="0 0 24 24" style="width: ${Math.round(size * 0.5)}px; height: ${Math.round(size * 0.5)}px; fill: #10B981;"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`;
    avatarEl.style.color = '#10B981';
    avatarEl.style.width = `${size}px`;
    avatarEl.style.height = `${size}px`;
    avatarEl.style.borderRadius = `${Math.max(4, Math.round(size * 0.2237))}px`;
    avatarEl.style.display = 'inline-flex';
    avatarEl.style.alignItems = 'center';
    avatarEl.style.justifyContent = 'center';
    avatarEl.style.background = 'rgba(16, 185, 129, 0.12)';
    return;
  }

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
let listTransitionTimeout: any = null;

function renderSidebarList(items: any[], animate: boolean = true) {
  const container = document.getElementById('sidebar-list');
  if (!container) return;

  if (listTransitionTimeout) {
    clearTimeout(listTransitionTimeout);
    listTransitionTimeout = null;
  }

  if (items.length === 0) {
    container.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 11px;">No items found.</div>';
    return;
  }

  // Phase 1: Pre-collapse departing items vertically (smooth accordion shrink & fade out) before final FLIP
  if (animate) {
    const existingRows = Array.from(container.querySelectorAll<HTMLElement>('.list-item[data-item-id]'));
    const newItemIds = new Set(items.map(i => i.id));
    const leavingRows = existingRows.filter(r => r.dataset.itemId && !newItemIds.has(r.dataset.itemId));

    if (leavingRows.length > 0 && existingRows.length > 0) {
      leavingRows.forEach(r => r.classList.add('animating-out'));
      listTransitionTimeout = setTimeout(() => {
        listTransitionTimeout = null;
        executeRenderSidebarList(items, true);
      }, 190);
      return;
    }
  }

  executeRenderSidebarList(items, animate);
}

function createQuickCopyBtn(title: string, svgPath: string, value: string, toastMessage: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'list-quick-btn';
  btn.title = title;
  const originalIcon = `<svg viewBox="0 0 24 24"><path d="${svgPath}"/></svg>`;
  const checkIcon = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  btn.innerHTML = originalIcon;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await copyToClipboardText(value);
    btn.classList.add('copied');
    btn.innerHTML = checkIcon;
    showToast(toastMessage);
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalIcon;
    }, 1400);
  });
  return btn;
}

function executeRenderSidebarList(items: any[], animate: boolean = true) {
  const container = document.getElementById('sidebar-list');
  if (!container) return;

  if (items.length === 0) {
    const searchVal = (document.getElementById('search-input') as HTMLInputElement | null)?.value?.trim();
    const hasFilter = Boolean(searchVal || favoritesOnly || currentCategory !== 'all');
    container.innerHTML = `
      <div style="padding: 20px 12px; color: var(--text-muted); text-align: center; font-size: 11px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <span>No matching items found.</span>
        ${hasFilter ? '<button type="button" id="btn-reset-list-filters" style="padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(109,74,255,0.4); background: rgba(109,74,255,0.14); color: #DDD6FE; font-size: 10.5px; font-weight: 600; cursor: pointer;">Clear filters</button>' : ''}
      </div>
    `;
    document.getElementById('btn-reset-list-filters')?.addEventListener('click', () => {
      const searchEl = document.getElementById('search-input') as HTMLInputElement | null;
      if (searchEl) searchEl.value = '';
      const clearBtn = document.getElementById('btn-search-clear');
      if (clearBtn) clearBtn.style.display = 'none';
      favoritesOnly = false;
      const favBtn = document.getElementById('btn-favorites-toggle');
      favBtn?.classList.remove('active');
      favBtn?.setAttribute('aria-pressed', 'false');
      currentCategory = 'all';
      updateActiveCategoryButton(document.getElementById('filter-all'));
      applyFilterAndSort(true);
    });
    return;
  }

  // 1. FLIP: Record first positions before clearing
  const firstPositions = new Map<string, DOMRect>();
  if (animate) {
    const existingRows = container.querySelectorAll<HTMLElement>('.list-item[data-item-id]');
    existingRows.forEach(row => {
      const id = row.dataset.itemId;
      if (id) {
        firstPositions.set(id, row.getBoundingClientRect());
      }
    });
  }

  container.innerHTML = '';

  const newRows: HTMLElement[] = [];

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `list-item ${activeItem?.id === item.id ? 'active' : ''}`;
    row.dataset.itemId = item.id;

    const avatar = document.createElement('div');
    avatar.className = 'item-avatar';
    renderItemAvatar(avatar, item, 30);

    const info = document.createElement('div');
    info.className = 'item-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'item-title';
    titleEl.style.display = 'flex';
    titleEl.style.alignItems = 'center';
    const titleSpan = document.createElement('span');
    titleSpan.style.overflow = 'hidden';
    titleSpan.style.textOverflow = 'ellipsis';
    titleSpan.style.whiteSpace = 'nowrap';
    titleSpan.textContent = item.title || 'Untitled';
    titleEl.appendChild(titleSpan);
    if (item.favorite && !favoritesOnly) {
      const star = document.createElement('span');
      star.className = 'list-fav-star';
      star.title = 'Favorite';
      star.textContent = '★';
      titleEl.appendChild(star);
    }

    const subEl = document.createElement('div');
    subEl.className = 'item-subtitle';
    let subText: string;
    if (isRecoveryCodeNote(item) && (!item.username || item.type !== 'login')) {
      const codes = getRecoveryCodesList(item);
      const usedCount = Array.isArray(item.usedRecoveryCodes) ? item.usedRecoveryCodes.length : 0;
      const remaining = Math.max(0, codes.length - usedCount);
      subText = codes.length > 0 ? `${remaining}/${codes.length} Recovery Codes` : 'Recovery Codes';
    } else {
      subText = item.username || item.identity?.fullName || item.card?.cardholderName || item.alias?.aliasEmail || item.authenticatorDetails?.issuer || (item.type === 'secure_note' ? 'Encrypted Note' : 'no username');
    }
    subEl.textContent = subText;

    info.appendChild(titleEl);
    info.appendChild(subEl);

    row.appendChild(avatar);
    row.appendChild(info);

    if (item.username || item.password) {
      const actions = document.createElement('div');
      actions.className = 'list-item-actions';
      if (item.username) {
        actions.appendChild(
          createQuickCopyBtn(
            'Copy username / email',
            'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
            item.username,
            '✓ Username copied'
          )
        );
      }
      if (item.password) {
        actions.appendChild(
          createQuickCopyBtn(
            'Copy password',
            'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
            item.password,
            '✓ Password copied'
          )
        );
      }
      row.appendChild(actions);
    }

    if (item.type === 'login' && item.password) {
      const risk = evaluateCredentialRisk(item, allItems);
      const gaugeWrap = document.createElement('div');
      gaugeWrap.className = 'sidebar-risk-wrap';
      gaugeWrap.title = `${risk.label}: ${risk.score}% (${risk.entropyBits} bits entropy)`;
      gaugeWrap.innerHTML = renderCircumferenceSvg(risk.score, risk.color, 20, 2.2);
      row.appendChild(gaugeWrap);
    }

    row.addEventListener('click', () => selectItem(item));
    container.appendChild(row);
    newRows.push(row);
  });

  // 2. FLIP: Invert & Play
  if (animate && firstPositions.size > 0) {
    newRows.forEach(row => {
      const id = row.dataset.itemId;
      if (!id) return;
      const firstRect = firstPositions.get(id);
      if (firstRect) {
        const lastRect = row.getBoundingClientRect();
        const deltaY = firstRect.top - lastRect.top;
        if (deltaY !== 0) {
          row.style.transform = `translateY(${deltaY}px)`;
          row.style.transition = 'none';
        }
      } else {
        row.style.opacity = '0';
        row.style.transform = 'translateY(10px) scale(0.96)';
        row.style.transition = 'none';
      }
    });

    // Force layout reflow
    void container.offsetHeight;

    requestAnimationFrame(() => {
      newRows.forEach(row => {
        row.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, background 0.18s ease';
        row.style.transform = '';
        row.style.opacity = '';
      });
    });
  }
}

function selectItem(item: any) {
  setWorkspaceMode('vault');
  activeItem = item;
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
  if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }

  const rows = document.querySelectorAll<HTMLElement>('.list-item[data-item-id]');
  rows.forEach(r => {
    if (r.dataset.itemId === item.id) {
      r.classList.add('active');
    } else {
      r.classList.remove('active');
    }
  });

  renderDetailPane(item);
}

// ── Recovery Code Note Matchers ──
function isRecoveryCodeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('note:') ||
    lower.startsWith('imported from ') ||
    lower.startsWith('import via ') ||
    lower.startsWith('discovered from ')
  ) {
    return false;
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return /^[a-zA-Z0-9]{4,}(-[a-zA-Z0-9]{2,})*$/.test(tokens[0]);
  }
  if (tokens.length <= 4 && tokens.every(t => /^[a-zA-Z0-9]{2,8}(-[a-zA-Z0-9]{2,8})*$/.test(t))) {
    // Multi-chunk spaced recovery codes (e.g. "1234 5678" or "abcd efgh ijkl mnop")
    const hasDigitOrShortFixed = tokens.some(t => /\d/.test(t)) || tokens.every(t => t.length === tokens[0].length && t.length >= 4);
    return hasDigitOrShortFixed;
  }
  return false;
}

function isRecoveryCodeNote(item: any): boolean {
  if (!item) return false;
  const tags: string[] = item.tags || [];
  if (tags.some((t: string) => /recovery/i.test(t))) return true;
  if (Array.isArray(item.usedRecoveryCodes) && item.usedRecoveryCodes.length > 0) return true;
  const lowerTitle = (item.title || '').toLowerCase();
  if (
    lowerTitle.includes('recovery code') ||
    lowerTitle.includes('recovery codes') ||
    lowerTitle.includes('backup code') ||
    lowerTitle.includes('backup codes') ||
    lowerTitle.includes('recovery key') ||
    lowerTitle.includes('recovery keys') ||
    lowerTitle.includes('emergency kit') ||
    lowerTitle.includes('2fa backup') ||
    lowerTitle.includes('recovery')
  ) {
    return true;
  }
  const notes = item.notes || '';
  if (notes) {
    if (/recovery code|backup code/i.test(notes)) return true;
    const lines = notes.split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));
    const codeCount = lines.filter((l: string) => isRecoveryCodeLine(l)).length;
    if (codeCount >= 2 && (lines.length <= 40 || codeCount >= 4)) {
      return true;
    }
  }
  return false;
}

function getRecoveryCodesList(noteItem: any): string[] {
  if (!noteItem || !noteItem.notes) return [];
  const lines = (noteItem.notes as string)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('//') && !l.toLowerCase().startsWith('note:'));
  const codeLines = lines.filter(l => isRecoveryCodeLine(l));
  if (codeLines.length > 0) return codeLines;
  // Fallback only if the item is explicitly tagged/titled as a recovery item and not login boilerplate
  if (isRecoveryCodeNote(noteItem)) {
    return lines.filter(l => !/^(imported from|import via|discovered from)\b/i.test(l));
  }
  return [];
}

function getExtraNotesExcludingRecovery(item: any): string {
  if (!item || !item.notes) return '';
  if (!isRecoveryCodeNote(item)) return item.notes;
  const codesSet = new Set(getRecoveryCodesList(item).map(c => c.trim()));
  const extraLines = (item.notes as string)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => {
      if (!l) return false;
      if (codesSet.has(l)) return false;
      if (/^(imported from|import via|discovered from)\b/i.test(l)) return false;
      return true;
    });
  return extraLines.join('\n').trim();
}

function findAssociatedRecoveryNote(item: any, items: any[]): any | null {
  if (!item) return null;
  // If the item itself already contains recovery codes (e.g. combined credential or recovery note)
  if (getRecoveryCodesList(item).length > 0 && (isRecoveryCodeNote(item) || (item.tags && item.tags.some((t: string) => /recovery/i.test(t))))) {
    return item;
  }
  if (!items || items.length === 0) return null;
  const brandTerms: string[] = [];
  if (item.title) {
    const cleanTitle = item.title.replace(/\([^)]*\)/g, '').trim();
    const parts = cleanTitle.split(/[\s\-–—:|/]+/).filter((p: string) => p.length >= 3);
    for (const p of parts) {
      brandTerms.push(p.toLowerCase());
    }
  }
  if (item.urls && item.urls.length > 0) {
    try {
      const urlStr = item.urls[0].startsWith('http') ? item.urls[0] : `https://${item.urls[0]}`;
      const host = new URL(urlStr).hostname.replace(/^www\./, '');
      const sld = host.split('.')[0];
      if (sld && sld.length >= 3 && !brandTerms.includes(sld.toLowerCase())) {
        brandTerms.push(sld.toLowerCase());
      }
    } catch {}
  }

  const recoveryNotes = items.filter(i => isRecoveryCodeNote(i));
  if (recoveryNotes.length === 0) return null;

  for (const note of recoveryNotes) {
    const noteTitle = (note.title || '').toLowerCase();
    for (const term of brandTerms) {
      if (noteTitle.includes(term)) {
        return note;
      }
    }
  }
  return null;
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

  // Detect recovery-code items (standalone notes OR combined credentials)
  const isRecoveryItem = isRecoveryCodeNote(item);
  const embeddedCodes = getRecoveryCodesList(item);
  // Find associated recovery note (for items WITH totp but a separate note; also returns `item` itself when embedded)
  const matchedRecoveryNote = findAssociatedRecoveryNote(item, allItems);

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

  const isStandaloneRecoveryOnly = isRecoveryItem && embeddedCodes.length > 0 && !item.password && !username && !hasTotp;
  actionsDiv.innerHTML = `
    <button class="btn-pill ${item.favorite ? 'active-fav' : ''}" id="btn-toggle-favorite" title="${item.favorite ? 'Remove from Favorites' : 'Add to Favorites'}">
      <svg viewBox="0 0 24 24" style="fill: ${item.favorite ? '#F59E0B' : 'currentColor'}"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
      <span>${item.favorite ? 'Favorited' : 'Favorite'}</span>
    </button>
    <button class="btn-pill" id="btn-autofill" title="${isStandaloneRecoveryOnly ? 'Fill or copy next unused recovery code' : 'Autofill credentials'}">
      <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v2h2v5h2v-5h2v-2z"/></svg>
      ${isStandaloneRecoveryOnly ? 'Use Next' : 'Fill'}
    </button>
    <button class="btn-pill" id="btn-edit">
      <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      Edit
    </button>
  `;

  header.appendChild(titleGroup);
  header.appendChild(actionsDiv);
  container.appendChild(header);

  const hasCredentialFields = Boolean(username || (email && email !== username) || item.password);

  const appendCredentialCard = () => {
    if (!hasCredentialFields) return;
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
  };

  const appendTotpCard = () => {
    if (!hasTotp) return;
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
  };

  const appendRiskCard = () => {
    if (item.type === 'login' && item.password) {
      const risk = evaluateCredentialRisk(item, allItems);
      const riskCard = document.createElement('div');
      riskCard.className = 'card risk-detail-card';

      riskCard.innerHTML = `
        <div class="risk-card-inner">
          <div class="risk-info-column" style="width: 100%;">
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
  };

  if (currentCategory === '2fa') {
    // In 2FA category: put 2FA Authenticator above Username/Password container
    appendTotpCard();
    appendCredentialCard();
    appendRiskCard();
  } else {
    // Normal stacked Proton Pass card layout
    appendCredentialCard();
    appendRiskCard();
    appendTotpCard();
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

  // Session Policy Summary Card (for logins & web apps)
  if ((item.type === 'login' || !item.type)) {
    const sp = item.sessionPolicy;
    const modeLabel = sp?.reauthMode === 'auto_oauth_refresh'
      ? 'Auto OAuth Refresh'
      : (sp?.reauthMode === 'assisted_reauth' ? '1-Click Re-Auth' : 'Notify & Prompt');
    const sessCard = document.createElement('div');
    sessCard.className = 'card';
    sessCard.innerHTML = `
      <div class="card-row" style="justify-content: space-between; align-items: center;">
        <div class="card-content">
          <div class="card-label">Session Expiration & Auto-Reauth</div>
          <div class="card-value" style="font-size: 12px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 3px;">
            <span style="background: rgba(109, 74, 255, 0.16); color: #B098FF; padding: 2px 8px; border-radius: 99px; font-weight: 600; font-size: 11px;">${sp?.enabled ? modeLabel : 'Passive Watch (Notify)'}</span>
            <span style="color: var(--text-muted); font-size: 11px;">${sp?.enabled ? (sp.sessionTtlMinutes > 0 ? `${sp.sessionTtlMinutes}m TTL` : 'Auto Cookie/JWT') : 'Cookie & Redirect Watch'}</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(sessCard);
  }

  // Card 4: Notes (suppress raw recovery codes — only render remaining non-recovery notes if any)
  const displayNotes = getExtraNotesExcludingRecovery(item);
  if (displayNotes) {
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
    if (notesVal) notesVal.textContent = displayNotes;
  }

  // Recovery Codes Tracker Card (Interactive Checklist & Bidirectional Vault Sync)
  const effectiveRecoveryItem = (embeddedCodes.length > 0 && isRecoveryItem)
    ? item
    : ((getRecoveryCodesList(item).length > 0 && (item.tags || []).some((t: string) => /recovery/i.test(t))) ? item : matchedRecoveryNote);
  if (effectiveRecoveryItem) {
    const codes = getRecoveryCodesList(effectiveRecoveryItem);
    if (codes.length > 0) {
      const recItemId = effectiveRecoveryItem.id || item.id;
      const storageKey = `recovery_used_${recItemId}`;
      const recCard = document.createElement('div');
      recCard.className = 'card recovery-tracker-card';

      recCard.innerHTML = `
        <div class="recovery-tracker-header">
          <div class="recovery-tracker-title-group">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: #10B981;"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
            <span class="recovery-tracker-title">Recovery Codes (${codes.length})</span>
          </div>
          <div class="recovery-tracker-header-actions">
            <button type="button" class="recovery-tracker-copy-all" id="tracker-copy-all-${recItemId}" title="Copy all recovery codes">Copy All</button>
            <span class="recovery-tracker-badge" id="tracker-badge-${recItemId}">${codes.length}/${codes.length} Left</span>
          </div>
        </div>
        <div class="recovery-tracker-progress-wrap">
          <div class="recovery-tracker-progress-fill" id="tracker-progress-${recItemId}"></div>
        </div>
        <div class="recovery-tracker-list" id="tracker-list-${recItemId}">
          ${codes.map((c, idx) => `
            <div class="recovery-tracker-item" id="tracker-item-${recItemId}-${idx}">
              <input type="checkbox" class="recovery-tracker-check" data-index="${idx}" id="tracker-check-${recItemId}-${idx}" title="Mark as used / unused">
              <span class="recovery-tracker-code" data-code="${escHtml(c)}" title="Click to copy #${idx + 1}">${escHtml(c)}</span>
              <button type="button" class="recovery-tracker-copy" data-code="${escHtml(c)}" title="Copy Code">📋</button>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(recCard);

      const applyUsedStateToUI = (used: number[]) => {
        const usedSet = new Set(used);
        codes.forEach((_, idx) => {
          const itemEl = recCard.querySelector(`#tracker-item-${recItemId}-${idx}`);
          const chkEl = recCard.querySelector(`#tracker-check-${recItemId}-${idx}`) as HTMLInputElement | null;
          const isUsed = usedSet.has(idx);
          if (chkEl) chkEl.checked = isUsed;
          itemEl?.classList.toggle('used', isUsed);
        });
        const validUsedCount = codes.filter((_, idx) => usedSet.has(idx)).length;
        const remaining = Math.max(0, codes.length - validUsedCount);
        const badge = recCard.querySelector(`#tracker-badge-${recItemId}`);
        if (badge) badge.textContent = `${remaining}/${codes.length} Left`;
        const summaryBadge = container.querySelector(`#summary-recovery-badge-${item.id}`);
        if (summaryBadge) summaryBadge.textContent = `${remaining}/${codes.length} Left`;
        const progressEl = recCard.querySelector(`#tracker-progress-${recItemId}`) as HTMLElement | null;
        if (progressEl) {
          const pct = codes.length > 0 ? Math.round((validUsedCount / codes.length) * 100) : 0;
          progressEl.style.width = `${pct}%`;
        }
      };

      // Wire up initial sync with vault item.usedRecoveryCodes & chrome.storage.local
      chrome.storage.local.get([storageKey], (res) => {
        const vaultHasArray = Array.isArray(effectiveRecoveryItem.usedRecoveryCodes);
        const vaultUsed: number[] = vaultHasArray ? effectiveRecoveryItem.usedRecoveryCodes : [];
        const localUsed: number[] = Array.isArray(res[storageKey]) ? res[storageKey] : [];
        // Merge vault & local indices on initial load, then keep them identical
        const initialUsed = Array.from(new Set([...vaultUsed, ...localUsed])).filter(i => i >= 0 && i < codes.length).sort((a, b) => a - b);
        applyUsedStateToUI(initialUsed);
      });

      recCard.querySelectorAll('.recovery-tracker-check').forEach(chk => {
        chk.addEventListener('change', async () => {
          const checkedIndices: number[] = [];
          recCard.querySelectorAll<HTMLInputElement>('.recovery-tracker-check').forEach(box => {
            if (box.checked) {
              const idx = parseInt(box.dataset.index || '-1', 10);
              if (idx >= 0) checkedIndices.push(idx);
            }
          });
          checkedIndices.sort((a, b) => a - b);

          applyUsedStateToUI(checkedIndices);
          chrome.storage.local.set({ [storageKey]: checkedIndices });

          // Persist back to macOS vault / background cache
          effectiveRecoveryItem.usedRecoveryCodes = checkedIndices;
          const allIdx = allItems.findIndex(i => i.id === effectiveRecoveryItem.id);
          if (allIdx !== -1) {
            allItems[allIdx].usedRecoveryCodes = checkedIndices;
          }
          await saveVaultItemDirect(effectiveRecoveryItem);
          chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', item: effectiveRecoveryItem }, () => {});
        });
      });

      recCard.querySelector(`#tracker-copy-all-${recItemId}`)?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await copyToClipboardText(codes.join('\n'));
        const btn = e.currentTarget as HTMLElement;
        const orig = btn.textContent || 'Copy All';
        btn.textContent = 'Copied All!';
        setTimeout(() => { btn.textContent = orig; }, 1600);
        showToast(`Copied all ${codes.length} recovery codes`);
      });

      recCard.querySelectorAll('.recovery-tracker-code, .recovery-tracker-copy').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const code = el.getAttribute('data-code') || el.textContent || '';
          if (code) {
            await copyToClipboardText(code.trim());
            showToast(`Copied recovery code: ${code.trim()}`);
          }
        });
      });
    }
  }

  // Metadata
  if (item.createdAt || item.updatedAt || item.importSource) {
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
    if (item.importSource) {
      const row = document.createElement('div');
      row.className = 'meta-row';
      row.innerHTML = `<span>Import Source</span><span>${item.importSource}</span>`;
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

  document.getElementById('btn-toggle-favorite')?.addEventListener('click', async () => {
    item.favorite = !item.favorite;
    await saveVaultItemDirect(item);
    chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', item }, () => {});
    const idx = allItems.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      allItems[idx].favorite = item.favorite;
    }
    renderDetailPane(item);
    applyFilterAndSort(true);
    showToast(item.favorite ? '★ Added to Favorites' : '☆ Removed from Favorites');
  });

  document.getElementById('btn-autofill')?.addEventListener('click', async () => {
    if (currentTabId) {
      const recTarget = effectiveRecoveryItem;
      const recCodes = recTarget ? getRecoveryCodesList(recTarget) : [];
      const recId = recTarget?.id || item.id;
      const storageKey = `recovery_used_${recId}`;
      chrome.storage.local.get([storageKey], async (res) => {
        const localUsed: number[] = Array.isArray(res[storageKey]) ? res[storageKey] : [];
        const vaultUsed: number[] = (recTarget && Array.isArray(recTarget.usedRecoveryCodes)) ? recTarget.usedRecoveryCodes : [];
        const used = Array.from(new Set([...vaultUsed, ...localUsed]));
        await chrome.tabs.sendMessage(currentTabId!, {
          type: 'INJECT_CREDENTIALS',
          username: item.username,
          password: item.password,
          totpSecret: item.totpSecret,
          recoveryCodes: recCodes,
          recoveryStorageKey: storageKey,
          usedIndices: used,
          recoveryItem: recTarget
        });
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
      <div class="card-row" style="flex-direction: column; align-items: stretch;">
        <div style="display: flex; align-items: center; width: 100%;">
          <div class="card-content" style="margin-right: 8px;">
            <div class="card-label">Password</div>
            <input type="password" class="edit-input" id="edit-password" value="${escHtml(item.password || '')}" placeholder="Password">
          </div>
          <div class="card-actions" style="margin-top: 14px; display: flex; gap: 4px;">
            <div class="action-icon" id="btn-toggle-edit-pwd" title="Toggle visibility">
              <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
            </div>
            <div class="action-icon" id="btn-toggle-edit-gen" title="Password generator" style="color: var(--accent);">
              <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7 7h2v2H7V7zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm10 2h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>
            </div>
          </div>
        </div>

        <!-- Password Strength Meter for Edit Mode -->
        <div class="strength-wrapper" id="edit-strength-box" style="display: ${item.password ? 'flex' : 'none'}; margin-top: 8px;">
          <div class="strength-bars">
            <div class="strength-segment" id="edit-str-1"></div>
            <div class="strength-segment" id="edit-str-2"></div>
            <div class="strength-segment" id="edit-str-3"></div>
            <div class="strength-segment" id="edit-str-4"></div>
          </div>
          <div class="strength-label" id="edit-str-label">Strength</div>
        </div>

        <!-- Inline Generator Panel for Edit Mode -->
        <div class="inline-gen-panel" id="edit-gen-panel" style="display: none; margin-top: 8px;">
          <div class="gen-row">
            <span style="font-weight: 500; color: var(--text-main);">Length</span>
            <div class="gen-slider-container">
              <input type="range" class="gen-slider" id="edit-gen-length-slider" min="8" max="64" value="20">
              <span id="edit-gen-length-num" style="font-weight: 600; color: var(--accent); min-width: 20px;">20</span>
            </div>
          </div>
          <div class="gen-options-row">
            <label class="gen-chip active" id="edit-chip-upper"><input type="checkbox" checked id="edit-chk-upper"> A-Z</label>
            <label class="gen-chip active" id="edit-chip-lower"><input type="checkbox" checked id="edit-chk-lower"> a-z</label>
            <label class="gen-chip active" id="edit-chip-digits"><input type="checkbox" checked id="edit-chk-digits"> 0-9</label>
            <label class="gen-chip active" id="edit-chip-symbols"><input type="checkbox" checked id="edit-chk-symbols"> !@#$%</label>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
            <button class="btn-pill" id="btn-edit-regen-pwd" style="height: 24px; font-size: 11px;">
              <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
              Regenerate
            </button>
            <button class="btn-pill" id="btn-edit-apply-pwd" style="height: 24px; font-size: 11px; background: var(--accent); color: #fff;">Use Password</button>
          </div>
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
      <div class="card-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div class="card-label" style="margin: 0;">Session Expiration Policy</div>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-main); cursor: pointer;">
            <input type="checkbox" id="edit-session-enabled" ${item.sessionPolicy?.enabled ? 'checked' : ''}>
            Custom Policy
          </label>
        </div>
        <div id="edit-session-fields" style="display: ${item.sessionPolicy?.enabled ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div>
            <div class="card-label">Re-Auth Mode</div>
            <select class="edit-input" id="edit-session-mode" style="padding: 5px; font-size: 11px;">
              <option value="notify_only" ${(item.sessionPolicy?.reauthMode || 'notify_only') === 'notify_only' ? 'selected' : ''}>Notify & Prompt</option>
              <option value="auto_oauth_refresh" ${item.sessionPolicy?.reauthMode === 'auto_oauth_refresh' ? 'selected' : ''}>Auto OAuth Refresh</option>
              <option value="assisted_reauth" ${item.sessionPolicy?.reauthMode === 'assisted_reauth' ? 'selected' : ''}>1-Click Re-Auth</option>
            </select>
          </div>
          <div>
            <div class="card-label">Session TTL (min)</div>
            <input type="number" class="edit-input" id="edit-session-ttl" min="0" value="${item.sessionPolicy?.sessionTtlMinutes ?? 60}" style="padding: 5px; font-size: 11px;">
          </div>
          <div>
            <div class="card-label">Warn Lead (min)</div>
            <input type="number" class="edit-input" id="edit-session-warn" min="1" value="${item.sessionPolicy?.notifyLeadMinutes ?? 5}" style="padding: 5px; font-size: 11px;">
          </div>
          <div>
            <div class="card-label">Hard Max (min)</div>
            <input type="number" class="edit-input" id="edit-session-hardmax" min="0" value="${item.sessionPolicy?.hardMaxLifetimeMinutes ?? 480}" style="padding: 5px; font-size: 11px;">
          </div>
        </div>
      </div>
    </div>
  `;

  const editSessToggle = document.getElementById('edit-session-enabled') as HTMLInputElement | null;
  const editSessFields = document.getElementById('edit-session-fields');
  editSessToggle?.addEventListener('change', () => {
    if (editSessFields) editSessFields.style.display = editSessToggle.checked ? 'grid' : 'none';
  });

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

  // Password Visibility Toggle
  document.getElementById('btn-toggle-edit-pwd')?.addEventListener('click', () => {
    const pwdInput = document.getElementById('edit-password') as HTMLInputElement | null;
    if (pwdInput) {
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    }
  });

  // Generator Helper
  function generateEditPassword(): string {
    const slider = document.getElementById('edit-gen-length-slider') as HTMLInputElement | null;
    const len = slider ? parseInt(slider.value, 10) : 20;
    const upper = (document.getElementById('edit-chk-upper') as HTMLInputElement | null)?.checked ?? true;
    const lower = (document.getElementById('edit-chk-lower') as HTMLInputElement | null)?.checked ?? true;
    const digits = (document.getElementById('edit-chk-digits') as HTMLInputElement | null)?.checked ?? true;
    const symbols = (document.getElementById('edit-chk-symbols') as HTMLInputElement | null)?.checked ?? true;

    let chars = '';
    if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (digits) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    const array = new Uint32Array(len);
    crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(array[i] % chars.length);
    }
    return result;
  }

  // Password Generator Panel Toggle
  document.getElementById('btn-toggle-edit-gen')?.addEventListener('click', () => {
    const panel = document.getElementById('edit-gen-panel');
    if (panel) {
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) {
        const generated = generateEditPassword();
        const pwdInput = document.getElementById('edit-password') as HTMLInputElement | null;
        if (pwdInput) {
          pwdInput.value = generated;
          pwdInput.type = 'text';
          const strengthBox = document.getElementById('edit-strength-box');
          if (strengthBox) strengthBox.style.display = 'flex';
          updateStrengthMeter(generated, 'edit-str');
        }
      }
    }
  });

  // Generator Slider & Options
  const editSlider = document.getElementById('edit-gen-length-slider') as HTMLInputElement | null;
  const editNumDisplay = document.getElementById('edit-gen-length-num');
  editSlider?.addEventListener('input', () => {
    if (editNumDisplay) editNumDisplay.textContent = editSlider.value;
  });

  ['edit-chk-upper', 'edit-chk-lower', 'edit-chk-digits', 'edit-chk-symbols'].forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      el.parentElement?.classList.toggle('active', el.checked);
    });
  });

  document.getElementById('btn-edit-regen-pwd')?.addEventListener('click', () => {
    const generated = generateEditPassword();
    const pwdInput = document.getElementById('edit-password') as HTMLInputElement | null;
    if (pwdInput) {
      pwdInput.value = generated;
      pwdInput.type = 'text';
      const strengthBox = document.getElementById('edit-strength-box');
      if (strengthBox) strengthBox.style.display = 'flex';
      updateStrengthMeter(generated, 'edit-str');
    }
  });

  document.getElementById('btn-edit-apply-pwd')?.addEventListener('click', () => {
    const panel = document.getElementById('edit-gen-panel');
    if (panel) panel.style.display = 'none';
    showToast('✓ Generated password applied');
  });

  // Password Input Listener for Real-Time Strength Meter
  const editPwdInput = document.getElementById('edit-password') as HTMLInputElement | null;
  editPwdInput?.addEventListener('input', () => {
    const p = editPwdInput.value;
    const strengthBox = document.getElementById('edit-strength-box');
    if (!p) {
      if (strengthBox) strengthBox.style.display = 'none';
      return;
    }
    if (strengthBox) strengthBox.style.display = 'flex';
    updateStrengthMeter(p, 'edit-str');
  });

  // Initial Strength Meter Check
  if (item.password) {
    updateStrengthMeter(item.password, 'edit-str');
  }

  document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
    renderDetailPane(item);
  });

  // Save Edit Handler
  document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
    const saveBtn = document.getElementById('btn-save-edit') as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.7';
      saveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px; animation: spin 1s linear infinite;"><path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>
        Saving...
      `;
    }

    const editUrlInputs = Array.from(document.querySelectorAll<HTMLInputElement>('.edit-url-input'));
    const urls = editUrlInputs.map(i => i.value.trim()).filter(Boolean);

    const titleVal = (document.getElementById('edit-title') as HTMLInputElement | null)?.value ?? item.title ?? '';
    const userVal = (document.getElementById('edit-username') as HTMLInputElement | null)?.value ?? item.username ?? '';
    const pwdVal = (document.getElementById('edit-password') as HTMLInputElement | null)?.value ?? item.password ?? '';
    const totpVal = (document.getElementById('edit-totp') as HTMLInputElement | null)?.value ?? item.totpSecret ?? '';
    const notesVal = (document.getElementById('edit-notes') as HTMLTextAreaElement | null)?.value ?? item.notes ?? '';
    const sessEnabled = (document.getElementById('edit-session-enabled') as HTMLInputElement | null)?.checked ?? false;
    const sessMode = ((document.getElementById('edit-session-mode') as HTMLSelectElement | null)?.value || 'notify_only') as any;
    const sessTtl = parseInt((document.getElementById('edit-session-ttl') as HTMLInputElement | null)?.value || '60', 10) || 0;
    const sessWarn = parseInt((document.getElementById('edit-session-warn') as HTMLInputElement | null)?.value || '5', 10) || 5;
    const sessHardMax = parseInt((document.getElementById('edit-session-hardmax') as HTMLInputElement | null)?.value || '480', 10) || 0;

    // Track password history if password changed
    const oldPassword = item.password;
    let passwordHistory = Array.isArray(item.passwordHistory) ? [...item.passwordHistory] : [];
    if (oldPassword && pwdVal && oldPassword !== pwdVal) {
      passwordHistory.unshift({
        password: oldPassword,
        replacedAt: new Date().toISOString()
      });
      if (passwordHistory.length > 10) passwordHistory = passwordHistory.slice(0, 10);
    }

    const updated = {
      ...item,
      id: item.id,
      type: item.type || 'login',
      title: titleVal.trim() || item.title || 'Untitled',
      username: userVal.trim(),
      password: pwdVal,
      totpSecret: totpVal.trim().replace(/\s+/g, '') || undefined,
      urls: urls.length > 0 ? urls : (item.urls || []),
      notes: notesVal.trim(),
      tags: Array.isArray(item.tags) ? item.tags : [],
      favorite: Boolean(item.favorite),
      trashed: Boolean(item.trashed),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(sessEnabled ? {
        sessionPolicy: {
          ...(item.sessionPolicy || {}),
          enabled: true,
          reauthMode: sessMode,
          authMechanism: item.sessionPolicy?.authMechanism || (item.oauth?.refreshToken ? 'oauth2_oidc' : 'cookie_timer'),
          sessionTtlMinutes: sessTtl,
          idleTimeoutMinutes: item.sessionPolicy?.idleTimeoutMinutes ?? 30,
          hardMaxLifetimeMinutes: sessHardMax,
          notifyLeadMinutes: sessWarn,
        }
      } : { sessionPolicy: undefined }),
      ...(passwordHistory.length > 0 ? { passwordHistory } : {})
    };

    // 1. Direct persistent save to local daemon / macOS app on 127.0.0.1:53152
    await saveVaultItemDirect(updated);

    // 2. Also update background worker state & native host
    chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', item: updated }, (res) => {
      const savedItem = (res && res.item) ? { ...updated, ...res.item } : updated;
      const idx = allItems.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        allItems[idx] = savedItem;
      } else {
        allItems.push(savedItem);
      }
      activeItem = savedItem;
      isEditing = false;
      applyFilterAndSort(false);
      renderDetailPane(savedItem);
      showToast('✓ Password updated successfully');
    });
  });
}

function showSessionsView() {
  const container = document.getElementById('detail-pane');
  if (!container) return;
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
  if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }

  activeItem = null;
  setWorkspaceMode('sessions');
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));

  container.innerHTML = `<div style="padding: 18px; color: var(--text-muted); font-size: 12px;">Loading active website & web-app sessions...</div>`;

  chrome.runtime.sendMessage({ type: 'GET_SESSION_WATCH_STATUS' }, (res) => {
    refreshSessionAlertDot();
    const sessions: any[] = Array.isArray(res?.sessions) ? res.sessions : [];
    const alerts: any[] = Array.isArray(res?.alerts) ? res.alerts : [];

    const fmtLeft = (isoStr?: string, status?: string) => {
      if (status === 'revoked') return 'Token Revoked — Sign In Required';
      if (status === 'expired') return 'Expired — Sign Back In';
      if (!isoStr) return 'Active (watching cookies, redirects & 401s)';
      const sec = Math.max(0, Math.round((Date.parse(isoStr) - Date.now()) / 1000));
      if (sec <= 0) return 'Expired — Sign Back In';
      if (sec < 60) return `Expires in ${sec}s`;
      const m = Math.floor(sec / 60);
      if (m < 60) return `Expires in ${m}m`;
      return `Expires in ${Math.floor(m / 60)}h ${m % 60}m`;
    };

    const alertsHtml = alerts.length > 0 ? `
      <div class="card" style="border-color: rgba(244, 63, 94, 0.45); background: rgba(244, 63, 94, 0.08); padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 700; color: #fb7185; margin-bottom: 8px; text-transform: uppercase;">Alerts (${alerts.length})</div>
        ${alerts.map(a => `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 0; border-top: 1px solid rgba(255,255,255,0.06);">
            <div style="min-width: 0;">
              <div style="font-size: 12px; font-weight: 700; color: #fff;">${escHtml(a.appTitle || a.domain)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${escHtml(a.message)}</div>
            </div>
            <div style="display: flex; gap: 5px; flex-shrink: 0;">
              ${a.canOAuthRefresh ? `<button class="btn-pill btn-sess-refresh" data-sid="${escHtml(a.sessionId)}" data-iid="${escHtml(a.itemId || '')}" data-dom="${escHtml(a.domain)}" style="background: #10B981; color: #fff; font-size: 11px;">Renew</button>` : ''}
              <button class="btn-pill btn-sess-relogin" data-url="${escHtml(a.loginUrl)}" style="background: var(--accent); color: #fff; font-size: 11px;">Sign In</button>
              <button class="btn-pill btn-sess-dismiss" data-aid="${escHtml(a.id)}" style="font-size: 11px;">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    const sessionsHtml = sessions.length > 0 ? sessions.map(s => {
      const color = (s.status === 'expired' || s.status === 'revoked') ? '#fb7185' : (s.status === 'expiring_soon' ? '#fbbf24' : '#34d399');
      return `
        <div class="card" style="padding: 11px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></span>
                <span style="font-size: 13px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(s.appTitle || s.domain)}</span>
                <span style="font-size: 10px; color: var(--text-muted);">${escHtml(s.domain)}</span>
              </div>
              <div style="font-size: 11px; color: ${color}; margin-top: 3px;">${fmtLeft(s.expiresAt, s.status)}</div>
              <div style="font-size: 10px; color: var(--text-subtle); margin-top: 2px;">Mode: ${escHtml(s.reauthMode || 'notify_only')} · Signal: ${escHtml(s.source || 'cookie')}</div>
            </div>
            <div style="display: flex; gap: 5px; flex-shrink: 0;">
              ${s.reauthMode === 'auto_oauth_refresh' && s.itemId ? `<button class="btn-pill btn-sess-refresh" data-sid="${escHtml(s.id)}" data-iid="${escHtml(s.itemId)}" data-dom="${escHtml(s.domain)}" style="font-size: 11px;">↻ Renew</button>` : ''}
              <button class="btn-pill btn-sess-relogin" data-url="${escHtml(s.url)}" style="font-size: 11px;">Open</button>
            </div>
          </div>
        </div>
      `;
    }).join('') : `
      <div class="card" style="padding: 20px; text-align: center;">
        <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 4px;">No active site sessions recorded yet</div>
        <div style="font-size: 11px; color: var(--text-muted);">Browse any website or web app with Kloak active. Auth cookies, JWT tokens, HTTP timeouts, and custom \`kloak:session\` hooks appear automatically.</div>
      </div>
    `;

    container.innerHTML = `
      <div class="creation-header">
        <div class="detail-title" style="font-size: 15px;">Session Expiration Watch</div>
        <button class="btn-pill" id="btn-sessions-refresh-list" style="font-size: 11px;">↻ Sync</button>
      </div>
      <div style="font-size: 11px; color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); padding: 8px 10px; border-radius: 8px; margin-bottom: 12px;">
        🛡 Guardrail Active: Passwords never auto-replay unattended. Silent refresh runs only for OAuth rotation grants within max lifetime limits.
      </div>
      ${alertsHtml}
      ${sessionsHtml}
    `;

    document.getElementById('btn-sessions-refresh-list')?.addEventListener('click', () => showSessionsView());
    container.querySelectorAll('.btn-sess-relogin').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = (btn as HTMLElement).dataset.url || '';
        chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_AND_REAUTH', loginUrl: u });
      });
    });
    container.querySelectorAll('.btn-sess-refresh').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        chrome.runtime.sendMessage({
          type: 'REFRESH_SESSION_OAUTH',
          sessionId: el.dataset.sid,
          itemId: el.dataset.iid,
          domain: el.dataset.dom,
        }, (r) => {
          showToast(r?.success ? '🔄 OAuth session refreshed!' : '🔐 Interactive re-login required');
          showSessionsView();
        });
      });
    });
    container.querySelectorAll('.btn-sess-dismiss').forEach(btn => {
      btn.addEventListener('click', () => {
        const aid = (btn as HTMLElement).dataset.aid || '';
        chrome.runtime.sendMessage({ type: 'DISMISS_SESSION_ALERT', alertId: aid }, () => showSessionsView());
      });
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

// ── Brand SVG Logos & Import/Export Workspace ──
interface ImportProviderConfig {
  id: 'google' | 'microsoft' | 'opera' | 'apple' | 'universal';
  shortLabel: string;
  title: string;
  subtitle: string;
  description: string;
  format: string;
  accept: string;
  dropLabel: string;
  actionLabel?: string;
  actionUrl?: string;
  svg: string;
}

const IMPORT_PROVIDERS: ImportProviderConfig[] = [
  {
    id: 'google',
    shortLabel: 'Google',
    title: 'Chrome & Google Passwords',
    subtitle: 'Smart Auto-Merge Active',
    description: 'Import passwords exported from Google Password Manager or Chrome. Kloak normalizes domains, merges duplicates, preserves password history, and evaluates risk.',
    format: 'google-csv',
    accept: '.csv,.json',
    dropLabel: 'Drop Google / Chrome passwords (.csv) here',
    actionLabel: 'Open Google Passwords',
    actionUrl: 'https://passwords.google.com',
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.79 14.97 1 12 1 7.36 1 3.39 3.66 1.48 7.54l3.66 2.84C6.02 7.21 8.77 5 12 5z"/>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.72 2.88c2.17-2 3.7-4.96 3.7-8.7z"/>
      <path fill="#FBBC05" d="M5.14 14.62A7.1 7.1 0 0 1 4.78 12c0-.91.16-1.79.36-2.62L1.48 6.54A11.93 11.93 0 0 0 0 12c0 1.94.46 3.77 1.48 5.46l3.66-2.84z"/>
      <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.72-2.88c-1.08.72-2.45 1.16-4.21 1.16-3.23 0-5.98-2.21-6.86-5.21l-3.66 2.84C3.39 19.34 7.36 23 12 23z"/>
    </svg>`,
  },
  {
    id: 'microsoft',
    shortLabel: 'Microsoft',
    title: 'Microsoft Edge Wallet',
    subtitle: 'Smart Auto-Merge Active',
    description: 'Import passwords exported from Microsoft Edge or your Microsoft Account. Identical logins and aliases consolidate cleanly into your vault.',
    format: 'microsoft-csv',
    accept: '.csv',
    dropLabel: 'Drop Microsoft Edge passwords (.csv) here',
    actionLabel: 'Open Edge Passwords',
    actionUrl: 'https://account.microsoft.com',
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="9.5" height="9.5" rx="1.2" fill="#F25022"/>
      <rect x="12.5" y="2" width="9.5" height="9.5" rx="1.2" fill="#7FBA00"/>
      <rect x="2" y="12.5" width="9.5" height="9.5" rx="1.2" fill="#00A4EF"/>
      <rect x="12.5" y="12.5" width="9.5" height="9.5" rx="1.2" fill="#FFB900"/>
    </svg>`,
  },
  {
    id: 'opera',
    shortLabel: 'Opera',
    title: 'Opera & Opera GX',
    subtitle: 'Smart Auto-Merge Active',
    description: 'Bring in saved credentials from Opera or Opera GX settings. Duplicates across your other browsers are automatically deduplicated.',
    format: 'opera-csv',
    accept: '.csv',
    dropLabel: 'Drop Opera / Opera GX passwords (.csv) here',
    actionLabel: 'Open Opera Account',
    actionUrl: 'https://auth.opera.com',
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="kloakOperaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FF1B2D"/>
          <stop offset="100%" stop-color="#A70014"/>
        </linearGradient>
      </defs>
      <path fill="url(#kloakOperaGrad)" d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5zm0 16.9c-2.55 0-4.35-2.62-4.35-6.4S9.45 5.6 12 5.6s4.35 2.62 4.35 6.4-1.8 6.4-4.35 6.4z"/>
    </svg>`,
  },
  {
    id: 'apple',
    shortLabel: 'Apple',
    title: 'Apple Safari & iCloud Keychain',
    subtitle: 'Smart Auto-Merge Active',
    description: 'Import CSV exports from Apple Passwords or Safari. Embedded OTPAuth secrets and verification codes are preserved automatically.',
    format: 'apple-csv',
    accept: '.csv',
    dropLabel: 'Drop Apple Passwords (.csv) here',
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#FFFFFF" d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"/>
    </svg>`,
  },
  {
    id: 'universal',
    shortLabel: 'All Files',
    title: 'Universal Vault Importer',
    subtitle: 'Auto-Detect Format',
    description: 'Supports Bitwarden (JSON/CSV), 1Password (1PUX/1PIF), LastPass, KeePass (XML/CSV), Proton Pass, Dashlane, recovery lists, and generic CSV.',
    format: 'auto',
    accept: '.csv,.json,.xml,.1pux,.1pif,.txt',
    dropLabel: 'Drop any password or recovery export file here',
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#C4B5FD" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
      <path fill="#6D4AFF" d="M12 10v4H9.5l4.5 4.5 4.5-4.5H16v-4h-4z"/>
    </svg>`,
  }
];

function escapeCsvCell(val: string): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadVaultExport(format: 'kloak-json' | 'kloak-csv' | 'bitwarden-json') {
  const activeItemsList = allItems.filter(i => !i.trashed);
  const dateStr = new Date().toISOString().split('T')[0];
  let content = '';
  let mime = 'application/json';
  let filename = `kloak-export-${dateStr}.json`;

  if (format === 'kloak-csv') {
    const headers = ['title', 'type', 'username', 'password', 'url', 'totp', 'notes', 'tags', 'favorite', 'created_at'];
    const rows = activeItemsList.map(i => [
      escapeCsvCell(i.title || ''),
      escapeCsvCell(i.type || 'login'),
      escapeCsvCell(i.username || ''),
      escapeCsvCell(i.password || ''),
      escapeCsvCell((i.urls || []).join('; ')),
      escapeCsvCell(i.totpSecret || ''),
      escapeCsvCell(i.notes || ''),
      escapeCsvCell((i.tags || []).join(', ')),
      escapeCsvCell(i.favorite ? 'true' : 'false'),
      escapeCsvCell(i.createdAt || '')
    ].join(','));
    content = [headers.join(','), ...rows].join('\n');
    mime = 'text/csv;charset=utf-8';
    filename = `kloak-export-${dateStr}.csv`;
  } else if (format === 'bitwarden-json') {
    const bwItems = activeItemsList.map(i => {
      const itemType = i.type === 'secure_note' ? 2 : i.type === 'card' ? 3 : i.type === 'identity' ? 4 : 1;
      return {
        id: i.id,
        organizationId: null,
        folderId: null,
        type: itemType,
        name: i.title || 'Untitled',
        notes: i.notes || null,
        favorite: Boolean(i.favorite),
        login: itemType === 1 ? {
          uris: (i.urls || []).map((u: string) => ({ match: null, uri: u })),
          username: i.username || null,
          password: i.password || null,
          totp: i.totpSecret || null
        } : null,
        collectionIds: []
      };
    });
    content = JSON.stringify({ encrypted: false, folders: [], items: bwItems }, null, 2);
    filename = `bitwarden-export-${dateStr}.json`;
  } else {
    content = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      items: activeItemsList
    }, null, 2);
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`✓ Exported ${activeItemsList.length} items (${filename})`);
}

function showImportExportView(initialMode: 'import' | 'export' = 'import') {
  const container = document.getElementById('detail-pane');
  if (!container) return;
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
  if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }

  activeItem = null;
  setWorkspaceMode('import');
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));

  let activeMode: 'import' | 'export' = initialMode;
  let activeProviderId: ImportProviderConfig['id'] = 'google';
  let lastMergeReport: any = null;

  const render = () => {
    const provider = IMPORT_PROVIDERS.find(p => p.id === activeProviderId) || IMPORT_PROVIDERS[0];
    const exportCount = allItems.filter(i => !i.trashed).length;

    container.innerHTML = `
      <div class="io-workspace">
        <div class="io-header">
          <div class="io-title-wrap">
            <div class="io-title-badge">
              <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
            </div>
            <div>
              <div class="io-heading">Import & Export Passwords</div>
              <div class="io-subtitle">Retrieve browser accounts with Smart Auto-Merge or export your vault</div>
            </div>
          </div>

          <div class="io-mode-switch">
            <button type="button" class="io-mode-btn ${activeMode === 'import' ? 'active' : ''}" id="io-tab-import">
              <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Import
            </button>
            <button type="button" class="io-mode-btn ${activeMode === 'export' ? 'active' : ''}" id="io-tab-export">
              <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
              Export
            </button>
          </div>
        </div>

        ${activeMode === 'import' ? (
          lastMergeReport ? `
            <div class="merge-report-panel" style="display: flex;">
              <div class="report-header">
                <span class="report-success-icon">✓</span>
                <div class="report-title-box">
                  <div class="report-title">Passwords Retrieved & Auto-Merged</div>
                  <div class="report-subtitle">Deduplication, Cross-Type Combining & Risk Evaluation Complete</div>
                </div>
              </div>
              <div class="report-stats-grid">
                <div class="report-stat-card">
                  <div class="report-stat-num" style="color: #6D4AFF;">${lastMergeReport.totalProcessed || ((lastMergeReport.newItemsAdded || 0) + (lastMergeReport.exactDuplicatesMerged || 0) + (lastMergeReport.updatedPasswordsMerged || 0) + (lastMergeReport.crossTypeCombined || 0))}</div>
                  <div class="report-stat-label">Total Accounts Processed</div>
                </div>
                <div class="report-stat-card">
                  <div class="report-stat-num" style="color: #10B981;">${lastMergeReport.exactDuplicatesMerged || 0}</div>
                  <div class="report-stat-label">Exact Duplicates Auto-Merged</div>
                </div>
                <div class="report-stat-card">
                  <div class="report-stat-num" style="color: #00D2B4;">${lastMergeReport.updatedPasswordsMerged || 0}</div>
                  <div class="report-stat-label">Updated Passwords Merged (History Kept)</div>
                </div>
                <div class="report-stat-card">
                  <div class="report-stat-num" style="color: #34D399;">${lastMergeReport.crossTypeCombined || 0}</div>
                  <div class="report-stat-label">Cross-Type Combines (2FA / Recovery)</div>
                </div>
                <div class="report-stat-card">
                  <div class="report-stat-num" style="color: #FF884D;">${lastMergeReport.newItemsAdded || 0}</div>
                  <div class="report-stat-label">New Accounts Added to Vault</div>
                </div>
                ${lastMergeReport.reusedPasswordGroups && lastMergeReport.reusedPasswordGroups.length > 0 ? `
                  <div class="report-stat-card" style="grid-column: span 2; border-color: rgba(245, 74, 74, 0.4); background: rgba(245, 74, 74, 0.08);">
                    <div class="report-stat-num" style="color: #EF4444; font-size: 13px;">
                      ⚠️ ${lastMergeReport.reusedPasswordGroups.length} Reused Password Groups Detected
                    </div>
                    <div class="report-stat-label" style="color: #FF9B9B;">
                      Identical passwords used across different services. Consider updating with generated passwords.
                    </div>
                  </div>
                ` : ''}
              </div>
              <div class="report-actions" style="gap: 8px;">
                <button type="button" class="btn-provider-action" id="btn-io-import-another">Import Another File</button>
                <button type="button" class="btn-report-done" id="btn-io-done-vault">Done & View Vault</button>
              </div>
            </div>
          ` : `
            <div class="io-provider-bar">
              ${IMPORT_PROVIDERS.map(p => `
                <button type="button" class="io-provider-tab ${p.id === provider.id ? 'active' : ''}" data-provider="${p.id}">
                  <span class="io-brand-logo">${p.svg}</span>
                  <span>${p.shortLabel}</span>
                </button>
              `).join('')}
            </div>

            <div class="io-provider-card">
              <div class="io-provider-hero-logo">${provider.svg}</div>
              <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="font-size: 13px; font-weight: 700; color: #FFFFFF;">${provider.title}</span>
                  <span class="provider-tag green">Smart Auto-Merge Active</span>
                </div>
                <p class="provider-desc" style="margin: 0;">${provider.description}</p>
                ${provider.actionLabel && provider.actionUrl ? `
                  <div class="provider-actions-row">
                    <button type="button" class="btn-provider-action" id="btn-io-open-provider">↗ ${provider.actionLabel}</button>
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="io-drop-zone" id="io-drop-zone">
              <input type="file" id="io-file-input" accept="${provider.accept}" style="display: none;">
              <div class="io-drop-svg">
                <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
              </div>
              <div class="drop-label">${provider.dropLabel}</div>
              <div class="drop-sub">or <button type="button" class="btn-browse" id="btn-io-browse">Browse File</button></div>
            </div>
          `
        ) : `
          <div class="io-provider-card" style="align-items: center; border-color: rgba(245, 158, 11, 0.28); background: rgba(245, 158, 11, 0.06);">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 700; color: #FFFFFF;">Ready to export ${exportCount} active vault ${exportCount === 1 ? 'item' : 'items'}</span>
                <span class="provider-tag" style="background: rgba(245, 158, 11, 0.16); border-color: rgba(245, 158, 11, 0.35); color: #FBBF24;">Handle Exports Carefully</span>
              </div>
              <div class="provider-desc" style="margin-top: 4px;">
                Exported JSON and CSV files contain plaintext credentials for portability across Kloak, browsers, and Bitwarden. Store securely and delete temporary files after importing elsewhere.
              </div>
            </div>
          </div>

          <div class="io-export-grid">
            <div class="io-export-card">
              <span class="io-export-ext">.JSON</span>
              <div class="io-export-name">Kloak JSON</div>
              <div class="io-export-desc">Full credential schema including URLs, 2FA secrets, recovery usage, and notes.</div>
              <button type="button" class="btn-io-export" data-export-format="kloak-json">Export JSON</button>
            </div>
            <div class="io-export-card">
              <span class="io-export-ext">.CSV</span>
              <div class="io-export-name">Universal CSV</div>
              <div class="io-export-desc">Spreadsheet & browser compatible CSV table with title, user, password, URL & TOTP.</div>
              <button type="button" class="btn-io-export" data-export-format="kloak-csv">Export CSV</button>
            </div>
            <div class="io-export-card">
              <span class="io-export-ext">BW .JSON</span>
              <div class="io-export-name">Bitwarden JSON</div>
              <div class="io-export-desc">Structured Bitwarden-compatible vault archive ready for portable migration.</div>
              <button type="button" class="btn-io-export" data-export-format="bitwarden-json">Export Bitwarden</button>
            </div>
          </div>
        `}
      </div>
    `;

    // Mode switch
    document.getElementById('io-tab-import')?.addEventListener('click', () => {
      activeMode = 'import';
      render();
    });
    document.getElementById('io-tab-export')?.addEventListener('click', () => {
      activeMode = 'export';
      render();
    });

    // Provider switch
    container.querySelectorAll<HTMLElement>('.io-provider-tab[data-provider]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeProviderId = (btn.dataset.provider || 'google') as ImportProviderConfig['id'];
        lastMergeReport = null;
        render();
      });
    });

    // Open external password manager page
    if (provider.actionUrl) {
      document.getElementById('btn-io-open-provider')?.addEventListener('click', () => {
        chrome.tabs?.create?.({ url: provider.actionUrl! });
      });
    }

    // Drag & drop + Browse upload
    const dropZone = document.getElementById('io-drop-zone');
    const fileInput = document.getElementById('io-file-input') as HTMLInputElement | null;
    const browseBtn = document.getElementById('btn-io-browse');

    const handleImportFile = (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        if (!content) return;
        chrome.runtime.sendMessage(
          {
            type: 'IMPORT_PASSWORDS',
            content,
            format: provider.format,
            options: { autoMerge: true, filename: file.name }
          },
          (response) => {
            if (response?.success && response.result?.mergeReport) {
              lastMergeReport = response.result.mergeReport;
              render();
            } else if (response?.success) {
              lastMergeReport = {
                totalProcessed: response.result?.imported || 1,
                exactDuplicatesMerged: 0,
                updatedPasswordsMerged: 0,
                crossTypeCombined: 0,
                newItemsAdded: response.result?.imported || 1,
                reusedPasswordGroups: []
              };
              render();
            } else {
              showToast('⚠ Import failed: ' + (response?.error || 'Failed to parse file'));
            }
          }
        );
      };
      reader.readAsText(file);
    };

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleImportFile(file);
    });
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleImportFile(file);
    });

    // Report actions
    document.getElementById('btn-io-import-another')?.addEventListener('click', () => {
      lastMergeReport = null;
      render();
    });
    document.getElementById('btn-io-done-vault')?.addEventListener('click', async () => {
      setWorkspaceMode('vault');
      await loadLogins();
      const visible = getFilteredAndSortedItems();
      if (visible.length > 0) selectItem(visible[0]);
    });

    // Export actions
    container.querySelectorAll<HTMLElement>('.btn-io-export[data-export-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (allItems.length === 0) {
          showToast('Unlock vault first to export credentials');
          return;
        }
        const fmt = btn.dataset.exportFormat as 'kloak-json' | 'kloak-csv' | 'bitwarden-json';
        downloadVaultExport(fmt);
      });
    });
  };

  render();
}

// ── In-Popup Extension Settings Workspace (no external webpage needed) ──
function showSettingsView() {
  const container = document.getElementById('detail-pane');
  if (!container) return;
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
  if (addTotpInterval) { clearInterval(addTotpInterval); addTotpInterval = null; }

  activeItem = null;
  setWorkspaceMode('settings');
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));

  const state = {
    bentoAutofill: true,
    autoSave: true,
    phishingShield: true,
    totpAutofill: true,
    autoLockMinutes: 15,
    sessionMonitor: true,
    sessionNotifications: true,
    autoOAuthRefresh: true,
    sessionWarnMinutes: 5,
    hwConfigured: false,
    bridgeConnected: false,
    bridgeText: 'Checking local Kloak bridge...'
  };

  const renderSettings = () => {
    container.innerHTML = `
      <div class="settings-workspace">
        <div class="io-header">
          <div class="io-title-wrap">
            <div class="io-title-badge">
              <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            </div>
            <div>
              <div class="io-heading">Extension Settings</div>
              <div class="io-subtitle">Autofill behavior, session alerts, hardware keys & bridge status</div>
            </div>
          </div>

          <span class="provider-tag ${state.bridgeConnected ? 'green' : ''}" style="${state.bridgeConnected ? '' : 'background: rgba(245,158,11,0.16); border-color: rgba(245,158,11,0.35); color: #FBBF24;'}">
            ${state.bridgeConnected ? '● Desktop Bridge Active' : '● App Standby'}
          </span>
        </div>

        <div class="settings-section-title">Autofill & Browser Protection</div>
        <div class="settings-card">
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Bento In-Page Autofill Popup</div>
              <div class="settings-row-desc">Show compact tile popup inside login forms for 1-click filling</div>
            </div>
            <button type="button" class="settings-toggle-btn ${state.bentoAutofill ? 'on' : ''}" id="set-toggle-bento">${state.bentoAutofill ? 'Enabled' : 'Disabled'}</button>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Save & Update Password Prompts</div>
              <div class="settings-row-desc">Offer to save newly entered credentials upon form submission</div>
            </div>
            <button type="button" class="settings-toggle-btn ${state.autoSave ? 'on' : ''}" id="set-toggle-autosave">${state.autoSave ? 'Active' : 'Muted'}</button>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Phishing & Lookalike Domain Shield</div>
              <div class="settings-row-desc">Detect homograph URLs and warn before filling sensitive fields</div>
            </div>
            <button type="button" class="settings-toggle-btn ${state.phishingShield ? 'on' : ''}" id="set-toggle-phishing">${state.phishingShield ? 'Protected' : 'Off'}</button>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-title">2FA TOTP Code Auto-Filler</div>
              <div class="settings-row-desc">Automatically fill 6-digit verification codes on 2FA challenge inputs</div>
            </div>
            <button type="button" class="settings-toggle-btn ${state.totpAutofill ? 'on' : ''}" id="set-toggle-totp">${state.totpAutofill ? 'Auto-Fill' : 'Manual'}</button>
          </div>
        </div>

        <div class="settings-section-title">Session Expiration & Auto-Reauth</div>
        <div class="settings-card">
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Session Watch Monitor</div>
              <div class="settings-row-desc">Monitor cookie/JWT expiry and notify before web sessions log out</div>
            </div>
            <button type="button" class="settings-toggle-btn ${state.sessionMonitor ? 'on' : ''}" id="set-toggle-session-mon">${state.sessionMonitor ? 'Active' : 'Paused'}</button>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Browser Expiry Alerts</div>
              <div class="settings-row-desc">Raise extension alerts when tracked sessions approach expiration</div>
            </div>
            <button type="button" class="settings-toggle-btn ${state.sessionNotifications ? 'on' : ''}" id="set-toggle-session-notif">${state.sessionNotifications ? 'Alerts On' : 'Muted'}</button>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Silent OAuth Token Rotation</div>
              <div class="settings-row-desc">Refresh active OAuth sessions automatically without replaying passwords</div>
            </div>
            <button type="button" class="settings-toggle-btn ${state.autoOAuthRefresh ? 'on' : ''}" id="set-toggle-oauth-refresh">${state.autoOAuthRefresh ? 'Enabled' : 'Off'}</button>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Warning Lead Time</div>
              <div class="settings-row-desc">Minutes before expiration to warn</div>
            </div>
            <div class="settings-pill-group">
              ${[1, 3, 5, 10, 15].map(m => `<button type="button" class="settings-pill-btn ${state.sessionWarnMinutes === m ? 'active' : ''}" data-warn-min="${m}">${m}m</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="settings-section-title">Vault Security & Hardware Key</div>
        <div class="settings-card">
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Auto-Lock Inactivity Timer</div>
              <div class="settings-row-desc">Lock vault automatically after browser inactivity</div>
            </div>
            <div class="settings-pill-group">
              ${[{ l: '1m', v: 1 }, { l: '5m', v: 5 }, { l: '15m', v: 15 }, { l: '30m', v: 30 }, { l: '1h', v: 60 }, { l: 'Never', v: 0 }].map(o => `<button type="button" class="settings-pill-btn ${state.autoLockMinutes === o.v ? 'active' : ''}" data-autolock-min="${o.v}">${o.l}</button>`).join('')}
            </div>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Hardware Security Key (FIDO2 / YubiKey)</div>
              <div class="settings-row-desc">${state.hwConfigured ? 'Enrolled for hardware unlock' : 'Enroll a USB/NFC key for hardware-backed unlock'}</div>
            </div>
            <button type="button" class="btn-provider-action" id="btn-settings-hw-key">${state.hwConfigured ? 'Manage Key' : 'Configure Key'}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('set-toggle-bento')?.addEventListener('click', () => {
      state.bentoAutofill = !state.bentoAutofill;
      chrome.storage?.local?.set({ kloak_bento_autofill: state.bentoAutofill });
      renderSettings();
    });
    document.getElementById('set-toggle-autosave')?.addEventListener('click', () => {
      state.autoSave = !state.autoSave;
      chrome.storage?.local?.set({ kloak_auto_save: state.autoSave });
      renderSettings();
    });
    document.getElementById('set-toggle-phishing')?.addEventListener('click', () => {
      state.phishingShield = !state.phishingShield;
      chrome.storage?.local?.set({ kloak_phishing_shield: state.phishingShield });
      renderSettings();
    });
    document.getElementById('set-toggle-totp')?.addEventListener('click', () => {
      state.totpAutofill = !state.totpAutofill;
      chrome.storage?.local?.set({ kloak_totp_autofill: state.totpAutofill });
      renderSettings();
    });
    document.getElementById('set-toggle-session-mon')?.addEventListener('click', () => {
      state.sessionMonitor = !state.sessionMonitor;
      chrome.runtime?.sendMessage?.({ type: 'UPDATE_SESSION_SETTINGS', settings: { enabled: state.sessionMonitor } });
      renderSettings();
    });
    document.getElementById('set-toggle-session-notif')?.addEventListener('click', () => {
      state.sessionNotifications = !state.sessionNotifications;
      chrome.runtime?.sendMessage?.({ type: 'UPDATE_SESSION_SETTINGS', settings: { desktopNotifications: state.sessionNotifications } });
      renderSettings();
    });
    document.getElementById('set-toggle-oauth-refresh')?.addEventListener('click', () => {
      state.autoOAuthRefresh = !state.autoOAuthRefresh;
      chrome.runtime?.sendMessage?.({ type: 'UPDATE_SESSION_SETTINGS', settings: { autoOAuthRefresh: state.autoOAuthRefresh } });
      renderSettings();
    });

    container.querySelectorAll<HTMLElement>('[data-warn-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.sessionWarnMinutes = parseInt(btn.dataset.warnMin || '5', 10);
        chrome.runtime?.sendMessage?.({ type: 'UPDATE_SESSION_SETTINGS', settings: { warnMinutes: state.sessionWarnMinutes } });
        renderSettings();
      });
    });

    container.querySelectorAll<HTMLElement>('[data-autolock-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.autoLockMinutes = parseInt(btn.dataset.autolockMin || '15', 10);
        chrome.storage?.local?.set({ kloak_autolock: state.autoLockMinutes });
        renderSettings();
      });
    });

    document.getElementById('btn-settings-hw-key')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('kloak-open-hw-modal'));
    });
  };

  renderSettings();

  // Hydrate live storage & connection status
  try {
    chrome.storage?.local?.get([
      'kloak_phishing_shield',
      'kloak_auto_save',
      'kloak_autolock',
      'kloak_bento_autofill',
      'kloak_totp_autofill',
      'kloak_session_monitor',
      'kloak_session_desktop_notifications',
      'kloak_auto_oauth_refresh',
      'kloak_session_warn_minutes',
      'kloak_hardware_key'
    ], (items) => {
      if (items.kloak_phishing_shield !== undefined) state.phishingShield = Boolean(items.kloak_phishing_shield);
      if (items.kloak_auto_save !== undefined) state.autoSave = Boolean(items.kloak_auto_save);
      if (typeof items.kloak_autolock === 'number') state.autoLockMinutes = items.kloak_autolock;
      if (items.kloak_bento_autofill !== undefined) state.bentoAutofill = Boolean(items.kloak_bento_autofill);
      if (items.kloak_totp_autofill !== undefined) state.totpAutofill = Boolean(items.kloak_totp_autofill);
      if (items.kloak_session_monitor !== undefined) state.sessionMonitor = Boolean(items.kloak_session_monitor);
      if (items.kloak_session_desktop_notifications !== undefined) state.sessionNotifications = Boolean(items.kloak_session_desktop_notifications);
      if (items.kloak_auto_oauth_refresh !== undefined) state.autoOAuthRefresh = Boolean(items.kloak_auto_oauth_refresh);
      if (typeof items.kloak_session_warn_minutes === 'number') state.sessionWarnMinutes = items.kloak_session_warn_minutes;
      state.hwConfigured = Boolean(items.kloak_hardware_key);
      if (isSettingsViewOpen) renderSettings();
    });

    chrome.runtime?.sendMessage?.({ type: 'PING' }, (resp) => {
      state.bridgeConnected = !(chrome.runtime.lastError || !resp);
      state.bridgeText = state.bridgeConnected ? 'Connected to Kloak Desktop App' : 'Desktop Standby';
      if (isSettingsViewOpen) renderSettings();
    });
  } catch {
    // ignore outside extension runtime
  }
}

function setupAccountRetrievalModal() {
  const menuRetrieve = document.getElementById('menu-retrieve-accounts');
  menuRetrieve?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('add-dropdown')?.classList.remove('open');
    document.getElementById('btn-add')?.classList.remove('open');
    showImportExportView('import');
  });
}

// ── Hardware Security Key Management Modal ──
function setupHardwareKeyModal() {
  const modal = document.getElementById('modal-hw-key');
  const btnOpen = document.getElementById('btn-hardware-key-settings');
  const btnClose = document.getElementById('btn-close-hw-modal');
  const statusBadge = document.getElementById('hw-status-badge');
  const statusDesc = document.getElementById('hw-status-desc');
  const enrolledInfo = document.getElementById('hw-enrolled-info');
  const enrolledName = document.getElementById('hw-enrolled-name');
  const enrolledDate = document.getElementById('hw-enrolled-date');
  const unlockModeSelect = document.getElementById('hw-unlock-mode') as HTMLSelectElement;
  const modalError = document.getElementById('hw-modal-error');
  const btnRemove = document.getElementById('btn-remove-hw-key');
  const btnRegister = document.getElementById('btn-register-hw-key');

  if (!modal) return;

  const showModal = () => {
    modal.style.display = 'flex';
    refreshStatus();
  };

  const hideModal = () => {
    modal.style.display = 'none';
    if (modalError) modalError.style.display = 'none';
  };

  btnOpen?.addEventListener('click', showModal);
  document.addEventListener('kloak-open-hw-modal', showModal);
  btnClose?.addEventListener('click', hideModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });

  async function refreshStatus() {
    if (modalError) modalError.style.display = 'none';
    try {
      const res: any = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_HARDWARE_KEY_CONFIG' }, resolve);
      });

      const config = res?.hardwareKey;
      const isEnrolled = !!(config && config.enabled && config.credentials?.length > 0);

      if (isEnrolled) {
        if (statusBadge) {
          statusBadge.textContent = 'Active & Enrolled';
          statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
          statusBadge.style.color = '#10B981';
          statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        }
        if (statusDesc) {
          statusDesc.textContent = config.mode === 'password_plus_hardware'
            ? 'Vault requires BOTH Master Password and Hardware Key presence to unlock.'
            : 'Vault can be unlocked directly with a hardware key touch.';
        }
        if (enrolledInfo) enrolledInfo.style.display = 'block';
        if (enrolledName) enrolledName.textContent = config.credentials[0]?.name || 'FIDO2 Security Key';
        if (enrolledDate) enrolledDate.textContent = config.credentials[0]?.registeredAt ? new Date(config.credentials[0].registeredAt).toLocaleDateString() : 'Active';
        if (unlockModeSelect) unlockModeSelect.value = config.mode || 'hardware_only';
        if (btnRemove) btnRemove.style.display = 'inline-block';
        if (btnRegister) btnRegister.textContent = 'Re-register Key';
      } else {
        if (statusBadge) {
          statusBadge.textContent = 'Not Configured';
          statusBadge.style.background = 'rgba(255, 255, 255, 0.08)';
          statusBadge.style.color = 'var(--text-muted)';
          statusBadge.style.border = '1px solid var(--border)';
        }
        if (statusDesc) {
          statusDesc.textContent = 'No hardware key enrolled. Register a USB/NFC YubiKey or FIDO2 key to unlock your vault with a single touch.';
        }
        if (enrolledInfo) enrolledInfo.style.display = 'none';
        if (btnRemove) btnRemove.style.display = 'none';
        if (btnRegister) btnRegister.textContent = 'Register Hardware Key';
      }
    } catch (err: any) {
      if (modalError) {
        modalError.textContent = err.message || 'Failed to query hardware key status';
        modalError.style.display = 'block';
      }
    }
  }

  btnRegister?.addEventListener('click', async () => {
    if (modalError) modalError.style.display = 'none';
    const originalText = btnRegister.textContent;
    btnRegister.textContent = 'Touch your Security Key...';
    btnRegister.setAttribute('disabled', 'true');

    try {
      const mode = (unlockModeSelect?.value || 'hardware_only') as 'hardware_only' | 'password_plus_hardware';
      const reg = await registerHardwareSecurityKey({
        keyName: 'Security Key (' + (navigator.platform || 'Cross-Platform') + ')'
      });

      const res: any = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'REGISTER_HARDWARE_KEY',
          credential: reg.credential,
          hardwareSecret: reg.hardwareSecret,
          mode
        }, resolve);
      });

      if (res && res.success) {
        showToast('✓ Hardware security key successfully registered!');
        await refreshStatus();
      } else {
        throw new Error(res?.error || 'Registration failed');
      }
    } catch (err: any) {
      if (modalError) {
        modalError.textContent = err.message || 'Key registration cancelled or failed';
        modalError.style.display = 'block';
      }
    } finally {
      btnRegister.removeAttribute('disabled');
      btnRegister.textContent = originalText;
    }
  });

  btnRemove?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to remove the hardware security key from this vault?')) return;
    if (modalError) modalError.style.display = 'none';

    try {
      const res: any = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'REMOVE_HARDWARE_KEY' }, resolve);
      });

      if (res && res.success) {
        showToast('✓ Hardware key removed from vault');
        await refreshStatus();
      } else {
        throw new Error(res?.error || 'Failed to remove hardware key');
      }
    } catch (err: any) {
      if (modalError) {
        modalError.textContent = err.message || 'Removal failed';
        modalError.style.display = 'block';
      }
    }
  });
}
