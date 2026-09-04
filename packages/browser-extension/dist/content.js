"use strict";
/**
 * Kloak Browser Extension — Content Script
 * Smart Autofill, Adaptive Shadow DOM Popup & Contextual Password Generator
 */
// ── State ──
let shadowHost = null;
let shadowRoot = null;
let activePopup = null;
let currentFocusedInput = null;
let currentPasswordLength = 20;
let currentGeneratedPassword = '';
// ── Active URL Sync ──
function pushActiveUrl() {
    chrome.runtime.sendMessage({
        type: 'PUSH_ACTIVE_URL',
        url: window.location.href,
        tabId: -1
    });
}
window.addEventListener('load', pushActiveUrl);
window.addEventListener('focus', pushActiveUrl);
// ── Smart Field Detection & Filtering ──
function isVisible(el) {
    return el.offsetParent !== null && el.getBoundingClientRect().height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
}
function isSearchOrNonCredentialInput(input) {
    const type = (input.type || '').toLowerCase();
    const nonCredentialTypes = ['search', 'number', 'tel', 'date', 'datetime-local', 'time', 'file', 'range', 'color', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image', 'hidden'];
    if (nonCredentialTypes.includes(type))
        return true;
    const role = (input.getAttribute('role') || '').toLowerCase();
    if (role === 'search' || role === 'searchbox' || role === 'combobox')
        return true;
    const autocomplete = (input.autocomplete || '').toLowerCase();
    if (autocomplete === 'off' && input.name === 'q')
        return true;
    if (['postal-code', 'country', 'street-address', 'cc-number', 'cc-csc', 'cc-exp', 'tel'].includes(autocomplete))
        return true;
    const pattern = /search|query|find|filter|coupon|promo|discount|voucher|postal|zipcode|captcha|verification|sms|cvv|cvc|card-number|phone|comment|chat|message|quantity|amount|qty/i;
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const className = (input.className || '').toLowerCase();
    // If explicit search patterns match, exclude
    if (pattern.test(name) || pattern.test(id) || pattern.test(placeholder) || pattern.test(ariaLabel) || pattern.test(className)) {
        // If it's a password field, don't exclude even if className has something weird
        if (type !== 'password')
            return true;
    }
    return false;
}
function isCredentialField(input) {
    if (!isVisible(input))
        return false;
    if (isSearchOrNonCredentialInput(input))
        return false;
    const type = (input.type || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    if (type === 'password')
        return true;
    if (['username', 'email', 'current-password', 'new-password'].includes(autocomplete))
        return true;
    // Check if input is adjacent to a password field in the same form or container
    const container = input.form || input.closest('form') || input.closest('div[class*="login"], div[class*="auth"], div[class*="signin"], div[class*="signup"]') || document.body;
    const passwords = Array.from(container.querySelectorAll('input[type="password"]')).filter(el => isVisible(el));
    if (passwords.length > 0) {
        const textLike = ['text', 'email', ''];
        if (textLike.includes(type))
            return true;
    }
    // Multi-step login identifiers (e.g. Google, Apple email-only step)
    if (type === 'email' || (type === 'text' && /user|email|login|account|identifier/i.test(input.name + input.id + input.placeholder))) {
        return true;
    }
    return false;
}
function scoreUsernameField(input) {
    let score = 0;
    const type = (input.type || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    if (autocomplete === 'username' || autocomplete === 'email')
        score += 100;
    if (type === 'email')
        score += 50;
    const pattern = /user|email|login|account|mail|handle|identifier/i;
    if (pattern.test(name) || pattern.test(id))
        score += 30;
    if (pattern.test(placeholder))
        score += 20;
    return score;
}
function scorePasswordField(input) {
    let score = 0;
    const autocomplete = (input.autocomplete || '').toLowerCase();
    if (input.type === 'password')
        score += 1000;
    if (autocomplete === 'current-password' || autocomplete === 'new-password')
        score += 100;
    return score;
}
function analyzeFormContext(focusedInput) {
    const form = focusedInput.form || focusedInput.closest('form') || null;
    const container = form || focusedInput.closest('div[class*="login"], div[class*="auth"]') || document.body;
    const allInputs = Array.from(container.querySelectorAll('input')).filter(el => isVisible(el));
    const usernameFields = allInputs
        .filter(i => {
        const type = (i.type || '').toLowerCase();
        return type !== 'password' && type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio' && !isSearchOrNonCredentialInput(i);
    })
        .sort((a, b) => scoreUsernameField(b) - scoreUsernameField(a));
    const passwordFields = allInputs
        .filter(i => (i.type || '').toLowerCase() === 'password')
        .sort((a, b) => scorePasswordField(b) - scorePasswordField(a));
    const submitButtons = Array.from(container.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type="button"])'));
    const isMultiStep = allInputs.length === 1;
    const isEmailFirst = usernameFields.length > 0 && passwordFields.length === 0;
    return {
        form,
        usernameFields,
        passwordFields,
        submitButtons,
        isMultiStep,
        isEmailFirst
    };
}
// ── Smart Credential Injection ──
function setInputValue(el, val) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
        descriptor.set.call(el, val);
    }
    else {
        el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
}
function injectCredentials(username, password, targetInput, totpSecret) {
    let context = null;
    if (targetInput) {
        context = analyzeFormContext(targetInput);
    }
    else {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT') {
            context = analyzeFormContext(activeElement);
        }
    }
    if (targetInput) {
        if (targetInput.type === 'password' && password) {
            setInputValue(targetInput, password);
            handleTotpSync(totpSecret);
            return;
        }
        else if (username && targetInput.type !== 'password') {
            setInputValue(targetInput, username);
            if (password && context && context.passwordFields.length > 0) {
                setInputValue(context.passwordFields[0], password);
            }
            handleTotpSync(totpSecret);
            return;
        }
    }
    if (context) {
        if (username && context.usernameFields.length > 0) {
            setInputValue(context.usernameFields[0], username);
        }
        if (password && context.passwordFields.length > 0) {
            setInputValue(context.passwordFields[0], password);
        }
    }
    handleTotpSync(totpSecret);
}
// ── 2FA TOTP Auto-Copy ──
function handleTotpSync(totpSecret) {
    if (!totpSecret)
        return;
    chrome.runtime.sendMessage({ type: 'GET_TOTP', secret: totpSecret }, (res) => {
        if (res && res.success && res.token) {
            try {
                navigator.clipboard.writeText(res.token);
                showToastNotification(`✨ Filled credentials & copied 2FA code (${res.token}) to clipboard!`);
            }
            catch { }
        }
    });
}
// ── Shadow DOM Container ──
function ensureShadowRoot() {
    if (!shadowHost) {
        shadowHost = document.createElement('div');
        shadowHost.id = 'kloak-autofill-root';
        shadowHost.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
        document.documentElement.appendChild(shadowHost);
        shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    }
    return shadowRoot;
}
// ── Password Generator Helper ──
function generateRandomPassword(length = 20) {
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const charset = lower + upper + digits + symbols;
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    let pwd = '';
    for (let i = 0; i < length; i++) {
        pwd += charset[randomBytes[i] % charset.length];
    }
    return pwd;
}
// ── In-Page Popup Styles ──
const POPUP_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  
  .kloak-popup {
    position: fixed;
    background: #181622;
    border: 1px solid rgba(109, 74, 255, 0.35);
    border-radius: 12px;
    box-shadow: 0 16px 36px rgba(0,0,0,0.55), 0 0 16px rgba(109, 74, 255, 0.15);
    color: #FFFFFF;
    z-index: 2147483647;
    font-size: 13px;
    backdrop-filter: blur(16px);
    overflow: hidden;
    animation: kloakPop 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    width: 320px;
  }

  @keyframes kloakPop {
    0% { opacity: 0; transform: translateY(-6px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .kloak-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px 7px 12px;
    background: #201D2E;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .kloak-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #9E9AA8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .kloak-brand-icon {
    width: 14px;
    height: 14px;
    fill: #6D4AFF;
  }

  .kloak-close-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .kloak-close-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.1); }

  /* ── Account Items ── */
  .kloak-list {
    display: flex;
    flex-direction: column;
    max-height: 240px;
    overflow-y: auto;
  }

  .kloak-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    gap: 10px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: all 0.15s ease;
  }
  .kloak-item:hover, .kloak-item.selected {
    background: rgba(109, 74, 255, 0.18);
    border-left: 3px solid #6D4AFF;
    padding-left: 9px;
  }

  .kloak-item-avatar {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: #262335;
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .kloak-item-avatar img { width: 18px; height: 18px; border-radius: 3px; }
  .kloak-item-avatar span { font-size: 12px; font-weight: 700; color: #6D4AFF; }

  .kloak-item-info {
    flex: 1;
    min-width: 0;
  }
  .kloak-item-username {
    font-size: 13px;
    font-weight: 600;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-item-sub {
    font-size: 11px;
    color: #9E9AA8;
    margin-top: 1px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .kloak-btn-fill {
    background: #6D4AFF;
    color: #FFFFFF;
    border: none;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .kloak-btn-fill:hover { background: #7C5CFF; transform: scale(1.03); }

  /* ── 0-Match Generator Card ── */
  .kloak-gen-box {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kloak-gen-preview-row {
    display: flex;
    align-items: center;
    background: #232032;
    border: 1px solid rgba(109,74,255,0.3);
    border-radius: 8px;
    padding: 7px 10px;
    gap: 8px;
  }

  .kloak-gen-pwd-text {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    font-weight: 600;
    color: #00D2B4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: all;
  }

  .kloak-icon-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    padding: 3px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .kloak-icon-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.1); }
  .kloak-icon-btn svg { width: 14px; height: 14px; fill: currentColor; }

  .kloak-gen-slider-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: #9E9AA8;
    gap: 10px;
  }
  .kloak-gen-slider-row input[type="range"] {
    flex: 1;
    accent-color: #6D4AFF;
    cursor: pointer;
  }

  .kloak-action-row {
    display: flex;
    gap: 6px;
  }

  .kloak-btn-secondary {
    flex: 1;
    background: #262335;
    color: #FFFFFF;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.15s;
  }
  .kloak-btn-secondary:hover {
    background: #312D45;
    border-color: rgba(109,74,255,0.4);
  }

  /* ── Toast Notification ── */
  .kloak-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #181622;
    border: 1px solid #10B981;
    border-radius: 8px;
    padding: 10px 14px;
    color: #FFFFFF;
    font-size: 12px;
    font-weight: 500;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    z-index: 2147483647;
    animation: kloakPop 0.2s ease;
  }
`;
function showToastNotification(text) {
    const root = ensureShadowRoot();
    const existing = root.getElementById('kloak-toast-msg');
    if (existing)
        existing.remove();
    const toast = document.createElement('div');
    toast.id = 'kloak-toast-msg';
    toast.className = 'kloak-toast';
    toast.textContent = text;
    root.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3500);
}
// ── Adaptive Popup Builder ──
function buildPopupUI(items, rect, input) {
    const root = ensureShadowRoot();
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
    }
    const container = document.createElement('div');
    container.className = 'kloak-popup';
    // Calculate coordinates (flip above if near bottom)
    const popupWidth = 320;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 10) {
        left = window.innerWidth - popupWidth - 10;
    }
    if (left < 10)
        left = 10;
    let top = rect.bottom + 6;
    const estimatedHeight = items.length === 0 ? 190 : (items.length === 1 ? 110 : Math.min(items.length * 52 + 50, 290));
    if (top + estimatedHeight > window.innerHeight && rect.top - estimatedHeight > 10) {
        top = rect.top - estimatedHeight - 6;
    }
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    // Inject Styles once
    if (!root.querySelector('style')) {
        const styleTag = document.createElement('style');
        styleTag.textContent = POPUP_STYLES;
        root.appendChild(styleTag);
    }
    const hostname = window.location.hostname.replace(/^www\./, '');
    // 1. Header
    const header = document.createElement('div');
    header.className = 'kloak-header';
    header.innerHTML = `
    <div class="kloak-brand">
      <svg class="kloak-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      <span>Kloak (${hostname})</span>
    </div>
    <button class="kloak-close-btn" id="kloak-btn-close">✕</button>
  `;
    container.appendChild(header);
    header.querySelector('#kloak-btn-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        container.remove();
        activePopup = null;
    });
    // 2. Body based on Match Count
    if (items.length > 0) {
        // ── Matched Credentials List ──
        const list = document.createElement('div');
        list.className = 'kloak-list';
        items.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = `kloak-item ${idx === 0 ? 'selected' : ''}`;
            const avatarLetter = (item.title || item.username || '?').charAt(0).toUpperCase();
            const domainForIcon = item.urls?.[0] ? new URL(item.urls[0]).hostname : hostname;
            row.innerHTML = `
        <div class="kloak-item-avatar">
          <img src="https://www.google.com/s2/favicons?domain=${domainForIcon}&sz=32" onerror="this.remove();">
          <span>${avatarLetter}</span>
        </div>
        <div class="kloak-item-info">
          <div class="kloak-item-username">${item.username || 'No Username'}</div>
          <div class="kloak-item-sub">
            <span>••••••••</span>
            ${item.totpSecret ? '<span style="color: #29C98F; font-size: 10px;">• 2FA</span>' : ''}
          </div>
        </div>
        <button class="kloak-btn-fill">Fill</button>
      `;
            const fillAction = () => {
                injectCredentials(item.username, item.password, input, item.totpSecret);
                container.remove();
                activePopup = null;
            };
            row.addEventListener('click', fillAction);
            list.appendChild(row);
        });
        container.appendChild(list);
        // Footer with generator shortcut
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 8px 12px; background: #1C1927; border-top: 1px solid rgba(255,255,255,0.04); display: flex; justify-content: space-between; font-size: 11px;';
        footer.innerHTML = `
      <span id="kloak-btn-alias" style="color: #00D2B4; cursor: pointer; font-weight: 500;">🛡️ Masked Alias</span>
      <span id="kloak-btn-new-pwd" style="color: #6D4AFF; cursor: pointer; font-weight: 500;">⚡ Password Gen</span>
    `;
        container.appendChild(footer);
        footer.querySelector('#kloak-btn-alias')?.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({
                type: 'GENERATE_PROTECTED_ALIAS',
                url: window.location.href,
                domain: hostname
            }, (res) => {
                if (res && res.success) {
                    injectCredentials(res.aliasEmail, undefined, input);
                    showToastNotification(`🛡️ Created alias (${res.aliasEmail}) forwarding to ${res.forwardTo}`);
                    container.remove();
                    activePopup = null;
                }
            });
        });
        footer.querySelector('#kloak-btn-new-pwd')?.addEventListener('click', (e) => {
            e.stopPropagation();
            buildPopupUI([], rect, input); // Switch to generator mode
        });
    }
    else {
        // ── 0 Matches: Strong Password Generator & Alias Creator ──
        const genBox = document.createElement('div');
        genBox.className = 'kloak-gen-box';
        if (!currentGeneratedPassword) {
            currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
        }
        genBox.innerHTML = `
      <div style="font-size: 11px; color: #9E9AA8; font-weight: 500;">No saved passwords found for this site.</div>
      
      <div class="kloak-gen-preview-row">
        <div class="kloak-gen-pwd-text" id="kloak-pwd-display">${currentGeneratedPassword}</div>
        <button class="kloak-icon-btn" id="kloak-btn-regen" title="Regenerate">
          <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        </button>
      </div>

      <div class="kloak-gen-slider-row">
        <span>Length: <strong id="kloak-len-num" style="color: #6D4AFF;">${currentPasswordLength}</strong></span>
        <input type="range" id="kloak-len-slider" min="8" max="48" value="${currentPasswordLength}">
      </div>

      <div class="kloak-action-row">
        <button class="kloak-btn-secondary" id="kloak-btn-use-pwd" style="background: #6D4AFF; border-color: transparent;">
          Fill Password
        </button>
        <button class="kloak-btn-secondary" id="kloak-btn-gen-alias">
          🛡️ Masked Alias
        </button>
      </div>
    `;
        container.appendChild(genBox);
        const pwdDisplay = genBox.querySelector('#kloak-pwd-display');
        const lenNum = genBox.querySelector('#kloak-len-num');
        const slider = genBox.querySelector('#kloak-len-slider');
        genBox.querySelector('#kloak-btn-regen')?.addEventListener('click', (e) => {
            e.stopPropagation();
            currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
            if (pwdDisplay)
                pwdDisplay.textContent = currentGeneratedPassword;
        });
        slider?.addEventListener('input', () => {
            currentPasswordLength = parseInt(slider.value, 10);
            if (lenNum)
                lenNum.textContent = String(currentPasswordLength);
            currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
            if (pwdDisplay)
                pwdDisplay.textContent = currentGeneratedPassword;
        });
        genBox.querySelector('#kloak-btn-use-pwd')?.addEventListener('click', (e) => {
            e.stopPropagation();
            injectCredentials(undefined, currentGeneratedPassword, input);
            try {
                navigator.clipboard.writeText(currentGeneratedPassword);
                showToastNotification('⚡ Generated password filled & copied to clipboard!');
            }
            catch { }
            container.remove();
            activePopup = null;
        });
        genBox.querySelector('#kloak-btn-gen-alias')?.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({
                type: 'GENERATE_PROTECTED_ALIAS',
                url: window.location.href,
                domain: hostname
            }, (res) => {
                if (res && res.success) {
                    injectCredentials(res.aliasEmail, undefined, input);
                    showToastNotification(`🛡️ Protected alias (${res.aliasEmail}) filled!`);
                    container.remove();
                    activePopup = null;
                }
            });
        });
    }
    root.appendChild(container);
    activePopup = container;
    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!activePopup) {
            document.removeEventListener('keydown', handleKeyDown);
            return;
        }
        if (e.key === 'Escape') {
            activePopup.remove();
            activePopup = null;
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Close on click outside
    const handleOutsideClick = (e) => {
        const target = e.target;
        if (target !== input && !shadowHost?.contains(target)) {
            if (activePopup) {
                activePopup.remove();
                activePopup = null;
            }
            document.removeEventListener('mousedown', handleOutsideClick);
        }
    };
    setTimeout(() => {
        document.addEventListener('mousedown', handleOutsideClick);
    }, 100);
}
// ── Focus Trigger ──
function handleFieldFocus(input) {
    if (!isCredentialField(input))
        return;
    currentFocusedInput = input;
    const rect = input.getBoundingClientRect();
    chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS', url: window.location.href }, (response) => {
        if (response && response.isUnlocked) {
            const items = Array.isArray(response.items) ? response.items : [];
            buildPopupUI(items, rect, input);
        }
    });
}
document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT') {
        handleFieldFocus(target);
    }
});
// ── Threat Banner ──
function checkThreatShield() {
    chrome.runtime.sendMessage({ type: 'CHECK_THREAT', url: window.location.href }, (res) => {
        if (res && res.analysis && res.analysis.isSuspicious) {
            showThreatBanner(res.analysis, res.connectedAccount);
        }
    });
}
function showThreatBanner(analysis, connectedAccount) {
    if (document.getElementById('kloak-threat-banner'))
        return;
    const banner = document.createElement('div');
    banner.id = 'kloak-threat-banner';
    banner.style.cssText = `
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: linear-gradient(135deg, rgba(24, 16, 16, 0.96), rgba(38, 20, 20, 0.96));
    border: 1px solid rgba(239, 68, 68, 0.6);
    backdrop-filter: blur(16px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.25);
    border-radius: 12px;
    padding: 12px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #f3f4f6;
    max-width: 90vw;
    width: auto;
  `;
    const domainDisplay = analysis.targetDomain || window.location.hostname;
    const reasonSummary = analysis.reasons?.[0] || 'Potential phishing or unverified login form';
    banner.innerHTML = `
    <div style="font-size: 24px; line-height: 1;">⚠️</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <div style="font-size: 13px; font-weight: 700; color: #fca5a5; display: flex; align-items: center; gap: 6px;">
        Kloak Threat Shield: Suspicious Website (${domainDisplay})
        <span style="font-size: 10px; background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 6px; border-radius: 99px; color: #f87171;">Risk: ${analysis.riskScore || 65}%</span>
      </div>
      <div style="font-size: 11px; color: #d1d5db;">
        ${reasonSummary}. Protect your real email with a custom disposable alias.
      </div>
    </div>
    <button id="kloak-btn-protect" style="
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
    ">🛡️ Protect with Masked Alias</button>
    <button id="kloak-threat-close" style="
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
    ">✕</button>
  `;
    document.body.appendChild(banner);
    banner.querySelector('#kloak-threat-close')?.addEventListener('click', () => {
        banner.remove();
    });
    banner.querySelector('#kloak-btn-protect')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            type: 'GENERATE_PROTECTED_ALIAS',
            url: window.location.href,
            domain: domainDisplay
        }, (res) => {
            if (res && res.success) {
                injectCredentials(res.aliasEmail, undefined, currentFocusedInput || undefined);
                showToastNotification(`🛡️ Protected alias (${res.aliasEmail}) autofilled!`);
                banner.remove();
            }
        });
    });
}
// ── Injected Credential Listener ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INJECT_CREDENTIALS') {
        injectCredentials(message.username, message.password);
        sendResponse({ success: true });
    }
});
// Run threat detection check
checkThreatShield();
