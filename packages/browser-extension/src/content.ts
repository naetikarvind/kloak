/**
 * Kloak Browser Extension — Content Script
 * Form field detection, floating Kloak badge, and secure credential injection.
 */

// Observer to scan for password inputs dynamically
const observer = new MutationObserver(() => {
  requestAnimationFrame(scanAndEnhanceForms);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// Run initial scan immediately and on load
scanAndEnhanceForms();
window.addEventListener('DOMContentLoaded', scanAndEnhanceForms);

function scanAndEnhanceForms() {
  const passwordInputs = document.querySelectorAll('input[type="password"]:not([data-kloak-attached])');

  passwordInputs.forEach((pwdInput) => {
    const input = pwdInput as HTMLInputElement;
    input.setAttribute('data-kloak-attached', 'true');
    attachKloakFieldBadge(input);
  });
}

function attachKloakFieldBadge(input: HTMLInputElement) {
  const container = document.createElement('div');
  container.className = 'kloak-field-icon-wrapper';
  container.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    cursor: pointer;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const icon = document.createElement('div');
  icon.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 6V12C4 17.52 7.42 22.61 12 24C16.58 22.61 20 17.52 20 12V6L12 2Z" fill="#6D4AFF"/>
      <path d="M12 7C10.34 7 9 8.34 9 10V12H8C7.45 12 7 12.45 7 13V17C7 17.55 7.45 18 8 18H16C16.55 18 17 17.55 17 17V13C17 12.45 16.55 12 16 12H15V10C15 8.34 13.66 7 12 7ZM10.5 10C10.5 9.17 11.17 8.5 12 8.5C12.83 8.5 13.5 9.17 13.5 10V12H10.5V10Z" fill="white"/>
    </svg>
  `;
  container.appendChild(icon);

  const parent = input.parentElement;
  if (parent) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(container);

    container.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerPopup(input);
    });
  }
}

// Auto-trigger on focus setup
let focusTimeout: number | null = null;
let currentPopup: HTMLElement | null = null;
let currentTargetInput: HTMLInputElement | null = null;

document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLInputElement;
  if (!target || target.tagName !== 'INPUT') return;

  const type = target.getAttribute('type')?.toLowerCase();
  const name = target.getAttribute('name')?.toLowerCase() || '';
  const autocomplete = target.getAttribute('autocomplete')?.toLowerCase() || '';

  const isPassword = type === 'password';
  const isUsername = type === 'text' || type === 'email' || 
                     autocomplete.includes('username') || 
                     name.includes('user') || name.includes('login') || name.includes('email');

  if (isPassword || isUsername) {
    if (focusTimeout) clearTimeout(focusTimeout);
    focusTimeout = window.setTimeout(() => {
      triggerPopup(target);
    }, 200);
  }
});

async function triggerPopup(input: HTMLInputElement) {
  if (currentPopup) {
    // If popup is already showing for this input, don't recreate
    if (currentTargetInput === input) return;
    closePopup();
  }
  currentTargetInput = input;
  await showAutofillMenu(input);
}

function closePopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  currentTargetInput = null;
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('scroll', onScrollDismiss, { capture: true });
  window.removeEventListener('resize', updatePopupPosition);
}

const onClickOutside = (ev: MouseEvent) => {
  if (currentPopup && !currentPopup.contains(ev.target as Node) && ev.target !== currentTargetInput) {
    closePopup();
  }
};

const onKeydown = (ev: KeyboardEvent) => {
  if (ev.key === 'Escape') {
    closePopup();
  }
};

const onScrollDismiss = (ev: Event) => {
  if (currentPopup && !currentPopup.contains(ev.target as Node)) {
    closePopup();
  }
};

function updatePopupPosition() {
  if (!currentPopup || !currentTargetInput) return;
  const rect = currentTargetInput.getBoundingClientRect();
  currentPopup.style.top = `${rect.bottom + 6}px`;
  currentPopup.style.left = `${rect.left}px`;
}

async function showAutofillMenu(targetInput: HTMLInputElement) {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_MATCHED_LOGINS',
    url: window.location.href
  }).catch(() => null);

  const isUnlocked = response?.isUnlocked !== false;
  const items = response?.items || [];

  // Inject keyframe animation if not already injected
  if (!document.getElementById('kloak-anim-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'kloak-anim-styles';
    styleTag.textContent = `
      @keyframes kloakPopupSpring {
        0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        60% { opacity: 1; transform: translateY(2px) scale(1.01); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes kloakRowFade {
        0% { opacity: 0; transform: translateX(-4px); }
        100% { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(styleTag);
  }

  const dropdown = document.createElement('div');
  dropdown.id = 'kloak-autofill-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    width: 280px;
    background: #16151D;
    backdrop-filter: blur(16px);
    border: 1px solid #2C293D;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.6);
    z-index: 2147483647;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    animation: kloakPopupSpring 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transform-origin: top left;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #6D4AFF;
    padding: 12px 12px 8px 12px;
    border-bottom: 1px solid #2C293D;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  header.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 6V12C4 17.52 7.42 22.61 12 24C16.58 22.61 20 17.52 20 12V6L12 2Z" fill="#6D4AFF"/>
      <path d="M12 7C10.34 7 9 8.34 9 10V12H8C7.45 12 7 12.45 7 13V17C7 17.55 7.45 18 8 18H16C16.55 18 17 17.55 17 17V13C17 12.45 16.55 12 16 12H15V10C15 8.34 13.66 7 12 7ZM10.5 10C10.5 9.17 11.17 8.5 12 8.5C12.83 8.5 13.5 9.17 13.5 10V12H10.5V10Z" fill="#16151D"/>
    </svg>
    <span>Kloak</span>
  `;
  dropdown.appendChild(header);

  const listContainer = document.createElement('div');
  listContainer.style.cssText = `
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `;

  if (!isUnlocked) {
    const lockedRow = document.createElement('div');
    lockedRow.style.cssText = `
      padding: 14px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
    `;
    lockedRow.innerHTML = `
      <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(109, 74, 255, 0.16); display: flex; align-items: center; justify-content: center; color: #6D4AFF; margin-bottom: 2px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
      </div>
      <div style="font-size: 13px; font-weight: 600; color: #ffffff;">Vault is locked</div>
      <div style="font-size: 11px; color: #9E9AA8; line-height: 1.4;">Open the Kloak companion app or extension to unlock.</div>
    `;
    listContainer.appendChild(lockedRow);
  } else if (items.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.style.cssText = 'padding: 12px 8px; font-size: 12px; color: #9E9AA8; text-align: center;';
    emptyRow.textContent = 'No saved logins for this site';
    listContainer.appendChild(emptyRow);
  } else {
    items.forEach((item: any, idx: number) => {
      const row = document.createElement('div');
      row.style.cssText = `
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        animation: kloakRowFade 0.2s ease forwards;
        animation-delay: ${idx * 0.03}s;
      `;
      row.onmouseenter = () => {
        row.style.background = 'rgba(109, 74, 255, 0.16)';
        row.style.transform = 'translateX(3px)';
      };
      row.onmouseleave = () => {
        row.style.background = 'transparent';
        row.style.transform = 'translateX(0)';
      };

      const domainMatch = item.urls && item.urls[0] ? new URL(item.urls[0]).hostname : null;
      const faviconUrl = domainMatch ? `https://www.google.com/s2/favicons?domain=${domainMatch}&sz=24` : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.title)}&sz=24`;

      const img = document.createElement('img');
      img.src = faviconUrl;
      img.style.cssText = 'width: 24px; height: 24px; border-radius: 4px; object-fit: contain;';

      const textContainer = document.createElement('div');
      textContainer.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;';

      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size: 13px; font-weight: 600; color: #ffffff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;';
      titleEl.textContent = item.title;

      const userEl = document.createElement('div');
      userEl.style.cssText = 'font-size: 11px; color: #9BA0A6; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-top: 2px;';
      userEl.textContent = item.username;

      textContainer.appendChild(titleEl);
      textContainer.appendChild(userEl);

      row.appendChild(img);
      row.appendChild(textContainer);

      row.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        injectCredentials(item.username, item.password);
        closePopup();
      };

      listContainer.appendChild(row);
    });
  }

  dropdown.appendChild(listContainer);
  document.body.appendChild(dropdown);
  currentPopup = dropdown;

  updatePopupPosition();

  // Attach event listeners for dismissal and repositioning
  setTimeout(() => {
    document.addEventListener('click', onClickOutside);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('scroll', onScrollDismiss, { capture: true });
    window.addEventListener('resize', updatePopupPosition);
  }, 50);
}

function injectCredentials(username?: string, password?: string) {
  if (username) {
    const userInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[autocomplete*="username"]') as NodeListOf<HTMLInputElement>;
    for (const input of userInputs) {
      if (input.offsetParent !== null) { // visible input
        input.value = username;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }

  if (password) {
    const pwdInputs = document.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>;
    for (const input of pwdInputs) {
      if (input.offsetParent !== null) {
        input.value = password;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
}

// Listen for background commands
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'INJECT_CREDENTIALS') {
    injectCredentials(msg.username, msg.password);
  }
});

// ── Automatic Form Submission & Password Modification Detection ──
function setupFormSubmissionDetector() {
  let lastUsername = '';
  let lastPassword = '';

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target || target.tagName !== 'INPUT') return;

    if (target.type === 'password' && target.value) {
      lastPassword = target.value;
      // Search for username in the same form or preceding visible inputs
      const form = target.form;
      if (form) {
        const userInp = form.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]') as HTMLInputElement;
        if (userInp && userInp.value) lastUsername = userInp.value;
      } else {
        const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"]')) as HTMLInputElement[];
        const visibleUserInp = allInputs.find(i => i.offsetParent !== null && i.value);
        if (visibleUserInp) lastUsername = visibleUserInp.value;
      }
    }
  }, true);

  const checkAndPrompt = () => {
    if (!lastPassword || lastPassword.length < 4) return;
    const usernameToSave = lastUsername || 'Account';
    const pwdToSave = lastPassword;

    chrome.runtime.sendMessage({
      type: 'CHECK_OR_PROMPT_SAVE',
      url: window.location.href,
      username: usernameToSave,
      password: pwdToSave
    }, (res) => {
      if (res && (res.action === 'save_new' || res.action === 'update_password')) {
        showSavePasswordPrompt(res);
      }
    });
  };

  document.addEventListener('submit', () => {
    setTimeout(checkAndPrompt, 100);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      if (target && target.type === 'password') {
        setTimeout(checkAndPrompt, 100);
      }
    }
  }, true);
}

setupFormSubmissionDetector();

function showSavePasswordPrompt(details: any) {
  // Remove existing prompt if any
  const existing = document.getElementById('kloak-save-prompt');
  if (existing) existing.remove();

  const isUpdate = details.action === 'update_password';
  const domain = details.domain || window.location.hostname;
  const username = details.username || '';
  const password = details.password || '';

  const toast = document.createElement('div');
  toast.id = 'kloak-save-prompt';
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    width: 320px;
    background: #16151D;
    border: 1px solid #6D4AFF;
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.7);
    z-index: 2147483647;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: kloakPopupSpring 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(109,74,255,0.2); display: flex; align-items: center; justify-content: center; color: #6D4AFF;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6V12C4 17.52 7.42 22.61 12 24C16.58 22.61 20 17.52 20 12V6L12 2Z" fill="#6D4AFF"/><path d="M12 7C10.34 7 9 8.34 9 10V12H8C7.45 12 7 12.45 7 13V17C7 17.55 7.45 18 8 18H16C16.55 18 17 17.55 17 17V13C17 12.45 16.55 12 16 12H15V10C15 8.34 13.66 7 12 7ZM10.5 10C10.5 9.17 11.17 8.5 12 8.5C12.83 8.5 13.5 9.17 13.5 10V12H10.5V10Z" fill="#16151D"/></svg>
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 700; color: #fff;">${isUpdate ? 'Update password?' : 'Save password to Kloak?'}</div>
        <div style="font-size: 11px; color: #9E9AA8; margin-top: 1px;">${domain}</div>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 8px 10px; font-size: 12px; display: flex; justify-content: space-between;">
      <span style="color: #9E9AA8;">Account:</span>
      <span style="font-weight: 600; color: #fff;">${username}</span>
    </div>

    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
      <button id="kloak-btn-dismiss" style="background: transparent; border: 1px solid #2C293D; border-radius: 6px; padding: 6px 12px; color: #9E9AA8; font-size: 12px; cursor: pointer; font-family: inherit;">
        Never
      </button>
      <button id="kloak-btn-save" style="background: #6D4AFF; border: none; border-radius: 6px; padding: 6px 16px; color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;">
        ${isUpdate ? 'Update' : 'Save'}
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  toast.querySelector('#kloak-btn-dismiss')?.addEventListener('click', () => {
    toast.remove();
  });

  toast.querySelector('#kloak-btn-save')?.addEventListener('click', () => {
    if (isUpdate && details.item) {
      const updated = { ...details.item, password, updatedAt: new Date().toISOString() };
      chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', item: updated }, () => {
        showSuccessNotification('Password updated in Kloak ✓');
      });
    } else {
      const newItem = {
        title: domain,
        username,
        password,
        urls: [window.location.origin],
        createdAt: new Date().toISOString()
      };
      chrome.runtime.sendMessage({ type: 'ADD_ITEM', item: newItem }, () => {
        showSuccessNotification('Saved to Kloak ✓');
      });
    }
    toast.remove();
  });

  setTimeout(() => {
    if (document.body.contains(toast)) toast.remove();
  }, 15000);
}

function showSuccessNotification(msg: string) {
  const note = document.createElement('div');
  note.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: #211F2D;
    border: 1px solid #29C98F;
    color: #29C98F;
    font-family: "Inter", sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 16px;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    z-index: 2147483647;
    animation: kloakPopupSpring 0.2s ease forwards;
  `;
  note.textContent = msg;
  document.body.appendChild(note);
  setTimeout(() => { note.remove(); }, 2500);
}
