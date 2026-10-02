/**
 * Kloak Browser Extension — Side Panel Logic
 * Full unlock/login support, search, quick copy, and autofill.
 */

let cachedSideItems: any[] = [];

async function checkDirectStatus(): Promise<{ isUnlocked: boolean; items?: any[] } | null> {
  try {
    const res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'vault.getItems'
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) {
      if (data.error.message && data.error.message.includes('locked')) {
        return { isUnlocked: false };
      }
      return null;
    }
    if (Array.isArray(data.result)) {
      return { isUnlocked: true, items: data.result };
    }
    return null;
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
    if (!res.ok) {
      return { success: false, error: 'Could not connect to Kloak daemon' };
    }
    const data = await res.json();
    if (data.error) {
      return { success: false, error: data.error.message || 'Incorrect master password' };
    }
    if (data.result && (data.result.success || data.result.status?.isUnlocked)) {
      return { success: true };
    }
    return { success: false, error: 'Unlock failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
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

document.addEventListener('DOMContentLoaded', () => {
  const unlockView = document.getElementById('side-unlock-view');
  const unlockedView = document.getElementById('side-unlocked-view');
  const unlockForm = document.getElementById('side-unlock-form') as HTMLFormElement;
  const pwdInput = document.getElementById('side-unlock-password') as HTMLInputElement;
  const togglePwdBtn = document.getElementById('btn-side-toggle-pwd');
  const eyeIcon = document.getElementById('side-eye-icon');
  const unlockError = document.getElementById('side-unlock-error');
  const submitBtn = document.getElementById('btn-side-submit-unlock') as HTMLButtonElement;
  const submitBtnText = document.getElementById('side-unlock-btn-text');
  const spinner = document.getElementById('side-unlock-spinner');
  const lockBtn = document.getElementById('btn-side-lock');
  const searchInput = document.getElementById('side-search') as HTMLInputElement;
  const container = document.getElementById('side-items');

  // Toggle password visibility
  togglePwdBtn?.addEventListener('click', () => {
    const isPassword = pwdInput.type === 'password';
    pwdInput.type = isPassword ? 'text' : 'password';
    if (eyeIcon) {
      eyeIcon.innerHTML = isPassword
        ? '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>'
        : '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
    }
  });

  const showLocked = () => {
    if (unlockView) unlockView.style.display = 'flex';
    if (unlockedView) unlockedView.style.display = 'none';
    if (lockBtn) lockBtn.style.display = 'none';
    if (unlockError) unlockError.style.display = 'none';
    if (pwdInput) {
      pwdInput.value = '';
      setTimeout(() => pwdInput.focus(), 60);
    }
  };

  const showUnlocked = (items: any[]) => {
    if (unlockView) unlockView.style.display = 'none';
    if (unlockedView) unlockedView.style.display = 'flex';
    if (lockBtn) lockBtn.style.display = 'flex';
    cachedSideItems = items;
    renderItems(items);
  };

  const renderItems = (items: any[]) => {
    if (!container) return;
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <span>No passwords found</span>
        </div>
      `;
      return;
    }

    items.forEach((item: any) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      let domain = '';
      if (item.urls && item.urls[0]) {
        try {
          domain = new URL(item.urls[0]).hostname;
        } catch {
          domain = item.urls[0];
        }
      } else {
        domain = item.title ? `${item.title.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : 'example.com';
      }

      card.innerHTML = `
        <div class="item-top">
          <div class="item-title-group">
            <img class="item-favicon" src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%236D4AFF\\'><path d=\\'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z\\'/></svg>'">
            <div style="overflow: hidden;">
              <div class="item-title">${item.title || 'Untitled'}</div>
              <div class="item-username">${item.username || 'No username'}</div>
            </div>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-card-action btn-fill" data-id="${item.id}" title="Autofill credentials">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span>Fill</span>
          </button>
          <button class="btn-card-action btn-copy-user" title="Copy username">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            <span>User</span>
          </button>
          <button class="btn-card-action btn-copy-pwd" title="Copy password">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            <span>Pass</span>
          </button>
        </div>
      `;

      // Fill button action
      card.querySelector('.btn-fill')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'INJECT_CREDENTIALS',
            username: item.username || '',
            password: item.password || ''
          });
        }
        const btn = card.querySelector('.btn-fill') as HTMLElement;
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '<span>Filled!</span>';
          setTimeout(() => { btn.innerHTML = orig; }, 1200);
        }
      });

      // Copy username action
      card.querySelector('.btn-copy-user')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (item.username) {
          await navigator.clipboard.writeText(item.username);
          const btn = card.querySelector('.btn-copy-user') as HTMLElement;
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<span>Copied!</span>';
            setTimeout(() => { btn.innerHTML = orig; }, 1200);
          }
        }
      });

      // Copy password action
      card.querySelector('.btn-copy-pwd')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (item.password) {
          await navigator.clipboard.writeText(item.password);
          const btn = card.querySelector('.btn-copy-pwd') as HTMLElement;
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<span>Copied!</span>';
            setTimeout(() => { btn.innerHTML = orig; }, 1200);
          }
        }
      });

      container.appendChild(card);
    });
  };

  const loadVault = async () => {
    // 1. Direct connection
    const direct = await checkDirectStatus();
    if (direct) {
      if (direct.isUnlocked) {
        showUnlocked(direct.items || []);
        return;
      } else {
        showLocked();
        return;
      }
    }

    // 2. Background worker fallback
    chrome.runtime.sendMessage({ type: 'SEARCH_VAULT', query: '' }, (res) => {
      if (res && res.isUnlocked) {
        showUnlocked(res.items || []);
      } else {
        showLocked();
      }
    });
  };

  // Submit unlock
  unlockForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = pwdInput?.value || '';
    if (!password) {
      if (unlockError) {
        unlockError.textContent = 'Please enter your master password.';
        unlockError.style.display = 'block';
      }
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (submitBtnText) submitBtnText.textContent = 'Unlocking...';
    if (spinner) spinner.style.display = 'inline-block';
    if (unlockError) unlockError.style.display = 'none';

    try {
      let success = false;
      let errMsg = '';

      // Direct HTTP RPC first
      const directRes = await unlockVaultDirect(password);
      if (directRes.success) {
        success = true;
      } else {
        errMsg = directRes.error || '';
        // Background fallback
        const bgRes: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'UNLOCK_VAULT', password }, (response) => {
            resolve(response);
          });
        });
        if (bgRes && bgRes.success) {
          success = true;
        } else if (bgRes && bgRes.error) {
          errMsg = bgRes.error;
        }
      }

      if (success) {
        if (pwdInput) pwdInput.value = '';
        await loadVault();
      } else {
        if (unlockError) {
          unlockError.textContent = errMsg || 'Incorrect master password. Please try again.';
          unlockError.style.display = 'block';
        }
        if (pwdInput) {
          pwdInput.select();
          pwdInput.focus();
        }
      }
    } catch (err: any) {
      if (unlockError) {
        unlockError.textContent = err.message || 'Unlock failed. Ensure Kloak is running.';
        unlockError.style.display = 'block';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitBtnText) submitBtnText.textContent = 'Unlock Vault';
      if (spinner) spinner.style.display = 'none';
    }
  });

  // Lock button
  lockBtn?.addEventListener('click', async () => {
    await lockVaultDirect();
    chrome.runtime.sendMessage({ type: 'LOCK_VAULT' }).catch(() => null);
    cachedSideItems = [];
    showLocked();
  });

  // Search filter
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      renderItems(cachedSideItems);
      return;
    }
    const filtered = cachedSideItems.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.username || '').toLowerCase().includes(q) ||
      (item.urls || []).some((u: string) => u.toLowerCase().includes(q))
    );
    renderItems(filtered);
  });

  // Initial load
  loadVault();
});
