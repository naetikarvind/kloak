"use strict";
/**
 * Kloak Browser Extension — Content Script
 * Adaptive Proximity-Aware Autofill Popup, In-Page Password Inspector & Contextual Generator
 */
// ── Global State ──
let shadowHost = null;
let shadowRoot = null;
let activePopup = null;
let currentTargetInput = null;
let cachedCredentialsForSite = [];
let hasFetchedCredentials = false;
let currentPasswordLength = 20;
let currentGeneratedPassword = '';
let isRevealingPasswordMap = {};
let lastPointerPos = { x: 0, y: 0 };
let proximityThrottleTimer = null;
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
    return el.offsetParent !== null && el.getBoundingClientRect().height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none';
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
    if (pattern.test(name) || pattern.test(id) || pattern.test(placeholder) || pattern.test(ariaLabel) || pattern.test(className)) {
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
    const container = input.form || input.closest('form') || input.closest('div[class*="login"], div[class*="auth"], div[class*="signin"], div[class*="signup"]') || document.body;
    const passwords = Array.from(container.querySelectorAll('input[type="password"]')).filter(el => isVisible(el));
    if (passwords.length > 0) {
        const textLike = ['text', 'email', ''];
        if (textLike.includes(type))
            return true;
    }
    if (type === 'email' || (type === 'text' && /user|email|login|account|identifier/i.test(input.name + input.id + input.placeholder))) {
        return true;
    }
    return false;
}
function getAllCredentialInputs() {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.filter(i => isCredentialField(i));
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
                showToastNotification(`✨ Filled credentials & copied 2FA code (${res.token})!`);
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
    background: #14121F;
    border: 1px solid rgba(109, 74, 255, 0.4);
    border-radius: 12px;
    box-shadow: 0 20px 48px rgba(0,0,0,0.65), 0 0 24px rgba(109, 74, 255, 0.2);
    color: #FFFFFF;
    z-index: 2147483647;
    font-size: 13px;
    backdrop-filter: blur(20px);
    overflow: hidden;
    animation: kloakPop 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    width: 340px;
    transition: top 0.15s ease, left 0.15s ease;
  }

  @keyframes kloakPop {
    0% { opacity: 0; transform: translateY(-4px) scale(0.97); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .kloak-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 8px 14px;
    background: #1C1929;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .kloak-brand {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 700;
    color: #A5A1B2;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .kloak-brand-icon {
    width: 14px;
    height: 14px;
    fill: #6D4AFF;
  }

  .kloak-target-indicator {
    font-size: 10px;
    background: rgba(109, 74, 255, 0.2);
    border: 1px solid rgba(109, 74, 255, 0.4);
    padding: 2px 6px;
    border-radius: 4px;
    color: #C4B5FD;
    text-transform: none;
    font-weight: 600;
  }

  .kloak-close-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 3px 5px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .kloak-close-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.12); }

  /* ── Account Items ── */
  .kloak-list {
    display: flex;
    flex-direction: column;
    max-height: 280px;
    overflow-y: auto;
  }

  .kloak-card {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: transparent;
    transition: background 0.15s;
  }
  .kloak-card:hover {
    background: rgba(109, 74, 255, 0.08);
  }

  .kloak-card-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .kloak-item-avatar {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: #242135;
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
  .kloak-item-title {
    font-size: 10px;
    color: #9E9AA8;
    margin-top: 1px;
  }

  .kloak-btn-fill {
    background: #6D4AFF;
    color: #FFFFFF;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    box-shadow: 0 2px 8px rgba(109, 74, 255, 0.35);
  }
  .kloak-btn-fill:hover { background: #7C5CFF; transform: scale(1.03); }

  /* ── Password Detail Row ── */
  .kloak-pwd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1C1929;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 12px;
    gap: 6px;
  }

  .kloak-pwd-label {
    font-size: 10px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
  }

  .kloak-pwd-value {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #E2E8F0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: text;
  }
  .kloak-pwd-value.revealed {
    color: #00D2B4;
  }

  .kloak-pwd-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .kloak-mini-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    padding: 3px 5px;
    border-radius: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    transition: all 0.15s;
  }
  .kloak-mini-btn:hover {
    color: #FFFFFF;
    background: rgba(255,255,255,0.12);
  }

  /* ── Generator Card ── */
  .kloak-gen-box {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kloak-gen-preview-row {
    display: flex;
    align-items: center;
    background: #1C1929;
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
    background: #242135;
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
    background: #2E2A42;
    border-color: rgba(109,74,255,0.4);
  }

  /* ── Toast Notification ── */
  .kloak-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #14121F;
    border: 1px solid #10B981;
    border-radius: 8px;
    padding: 10px 16px;
    color: #FFFFFF;
    font-size: 12px;
    font-weight: 500;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
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
// ── Position Calculator ──
function calculatePopupPosition(rect, estimatedHeight = 200) {
    const popupWidth = 340;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
    }
    if (left < 12)
        left = 12;
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight && rect.top - estimatedHeight > 10) {
        top = rect.top - estimatedHeight - 6;
    }
    return { top, left };
}
function updateActivePopupPosition() {
    if (!activePopup || !currentTargetInput)
        return;
    const rect = currentTargetInput.getBoundingClientRect();
    const height = activePopup.offsetHeight || 200;
    const { top, left } = calculatePopupPosition(rect, height);
    activePopup.style.top = `${top}px`;
    activePopup.style.left = `${left}px`;
}
// ── Adaptive Popup Builder ──
function buildPopupUI(items, input) {
    currentTargetInput = input;
    const root = ensureShadowRoot();
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
    }
    const container = document.createElement('div');
    container.className = 'kloak-popup';
    const rect = input.getBoundingClientRect();
    const estimatedHeight = items.length === 0 ? 190 : Math.min(items.length * 85 + 65, 340);
    const { top, left } = calculatePopupPosition(rect, estimatedHeight);
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    // Inject Styles once
    if (!root.querySelector('style')) {
        const styleTag = document.createElement('style');
        styleTag.textContent = POPUP_STYLES;
        root.appendChild(styleTag);
    }
    const hostname = window.location.hostname.replace(/^www\./, '');
    const isPasswordInput = input.type === 'password';
    // 1. Header with Active Target Indicator
    const header = document.createElement('div');
    header.className = 'kloak-header';
    header.innerHTML = `
    <div class="kloak-brand">
      <svg class="kloak-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      <span>Kloak (${hostname})</span>
      <span class="kloak-target-indicator">${isPasswordInput ? '🔑 Password Box' : '👤 Username Box'}</span>
    </div>
    <button class="kloak-close-btn" id="kloak-btn-close" title="Close Popup (Esc)">✕</button>
  `;
    container.appendChild(header);
    header.querySelector('#kloak-btn-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        container.remove();
        activePopup = null;
    });
    // 2. Body based on Match Count
    if (items.length > 0) {
        // ── Matched Credentials with Visible Passwords ──
        const list = document.createElement('div');
        list.className = 'kloak-list';
        items.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'kloak-card';
            const itemId = item.id || `item-${idx}`;
            const isRevealed = !!isRevealingPasswordMap[itemId];
            const avatarLetter = (item.title || item.username || '?').charAt(0).toUpperCase();
            const domainForIcon = item.urls?.[0] ? new URL(item.urls[0]).hostname : hostname;
            const displayPassword = item.password || '';
            const maskedPassword = '••••••••••••';
            card.innerHTML = `
        <div class="kloak-card-top">
          <div class="kloak-item-avatar">
            <img src="https://www.google.com/s2/favicons?domain=${domainForIcon}&sz=32" onerror="this.remove();">
            <span>${avatarLetter}</span>
          </div>
          <div class="kloak-item-info">
            <div class="kloak-item-username" title="${item.username || 'No Username'}">${item.username || 'No Username'}</div>
            <div class="kloak-item-title">${item.title || hostname} ${item.totpSecret ? '<span style="color: #10B981; font-weight: 600;">• 2FA Active</span>' : ''}</div>
          </div>
          <button class="kloak-btn-fill" id="fill-btn-${itemId}">Fill</button>
        </div>

        <div class="kloak-pwd-row">
          <span class="kloak-pwd-label">Pass</span>
          <span class="kloak-pwd-value ${isRevealed ? 'revealed' : ''}" id="pwd-val-${itemId}">
            ${isRevealed ? displayPassword : maskedPassword}
          </span>
          <div class="kloak-pwd-actions">
            <button class="kloak-mini-btn" id="reveal-btn-${itemId}" title="${isRevealed ? 'Hide Password' : 'Show Password'}">
              ${isRevealed ? '🙈' : '👁️'}
            </button>
            <button class="kloak-mini-btn" id="copy-pwd-btn-${itemId}" title="Copy Password">
              📋
            </button>
            <button class="kloak-mini-btn" id="copy-user-btn-${itemId}" title="Copy Username">
              👤
            </button>
          </div>
        </div>
      `;
            // Fill action
            card.querySelector(`#fill-btn-${itemId}`)?.addEventListener('click', (e) => {
                e.stopPropagation();
                injectCredentials(item.username, item.password, input, item.totpSecret);
                container.remove();
                activePopup = null;
            });
            // Reveal / Peek action
            card.querySelector(`#reveal-btn-${itemId}`)?.addEventListener('click', (e) => {
                e.stopPropagation();
                isRevealingPasswordMap[itemId] = !isRevealingPasswordMap[itemId];
                const valEl = card.querySelector(`#pwd-val-${itemId}`);
                const btnEl = card.querySelector(`#reveal-btn-${itemId}`);
                if (isRevealingPasswordMap[itemId]) {
                    valEl.textContent = displayPassword;
                    valEl.classList.add('revealed');
                    btnEl.textContent = '🙈';
                    btnEl.title = 'Hide Password';
                }
                else {
                    valEl.textContent = maskedPassword;
                    valEl.classList.remove('revealed');
                    btnEl.textContent = '👁️';
                    btnEl.title = 'Show Password';
                }
            });
            // Copy password
            card.querySelector(`#copy-pwd-btn-${itemId}`)?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (displayPassword) {
                    navigator.clipboard.writeText(displayPassword);
                    showToastNotification('📋 Password copied to clipboard!');
                }
            });
            // Copy username
            card.querySelector(`#copy-user-btn-${itemId}`)?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.username) {
                    navigator.clipboard.writeText(item.username);
                    showToastNotification('👤 Username copied to clipboard!');
                }
            });
            list.appendChild(card);
        });
        container.appendChild(list);
        // Footer with generator shortcut
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 8px 14px; background: #181624; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; font-size: 11px;';
        footer.innerHTML = `
      <span id="kloak-btn-alias" style="color: #00D2B4; cursor: pointer; font-weight: 600;">🛡️ Masked Alias</span>
      <span id="kloak-btn-new-pwd" style="color: #A78BFA; cursor: pointer; font-weight: 600;">⚡ Password Gen</span>
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
            buildPopupUI([], input); // Switch to generator mode
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
// ── Credential Fetcher ──
function triggerCredentialPopupForInput(input) {
    if (!isCredentialField(input))
        return;
    currentTargetInput = input;
    chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS', url: window.location.href }, (response) => {
        if (response && response.isUnlocked) {
            cachedCredentialsForSite = Array.isArray(response.items) ? response.items : [];
            hasFetchedCredentials = true;
            buildPopupUI(cachedCredentialsForSite, input);
        }
    });
}
// ── Proximity Calculation Engine ──
function findClosestCredentialField(x, y) {
    const fields = getAllCredentialInputs();
    if (fields.length === 0)
        return null;
    let closest = null;
    let minDistance = Infinity;
    fields.forEach(field => {
        const rect = field.getBoundingClientRect();
        // Distance to rectangle
        const cx = Math.max(rect.left, Math.min(x, rect.right));
        const cy = Math.max(rect.top, Math.min(y, rect.bottom));
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < minDistance) {
            minDistance = dist;
            closest = field;
        }
    });
    if (!closest)
        return null;
    return { input: closest, distance: minDistance };
}
// ── Pointer Proximity & Focus Event Listeners ──
document.addEventListener('mousemove', (e) => {
    lastPointerPos = { x: e.clientX, y: e.clientY };
    if (proximityThrottleTimer)
        return;
    proximityThrottleTimer = setTimeout(() => {
        proximityThrottleTimer = null;
        const closest = findClosestCredentialField(lastPointerPos.x, lastPointerPos.y);
        if (!closest)
            return;
        // If pointer is close to a field (within 50px) and popup is already active on a different field, re-anchor smoothly
        if (closest.distance < 50 && activePopup && currentTargetInput !== closest.input) {
            currentTargetInput = closest.input;
            buildPopupUI(cachedCredentialsForSite, closest.input);
        }
    }, 60);
});
document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && isCredentialField(target)) {
        triggerCredentialPopupForInput(target);
    }
});
document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && isCredentialField(target)) {
        triggerCredentialPopupForInput(target);
    }
});
window.addEventListener('scroll', () => {
    if (activePopup && currentTargetInput) {
        requestAnimationFrame(updateActivePopupPosition);
    }
}, { passive: true });
window.addEventListener('resize', () => {
    if (activePopup && currentTargetInput) {
        requestAnimationFrame(updateActivePopupPosition);
    }
}, { passive: true });
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
                injectCredentials(res.aliasEmail, undefined, currentTargetInput || undefined);
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
