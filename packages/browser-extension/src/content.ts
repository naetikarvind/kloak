/**
 * Kloak Browser Extension — Content Script
 * Adaptive Proximity-Aware Autofill Popup, In-Page Password Inspector,
 * Contextual Generator & AI Certificate / Domain Owner Threat Inspector.
 */

interface FormContext {
  form: HTMLFormElement | null;
  usernameFields: HTMLInputElement[];
  passwordFields: HTMLInputElement[];
  submitButtons: HTMLElement[];
  isMultiStep: boolean;
  isEmailFirst: boolean;
}

// ── Global State ──
let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let activePopup: HTMLElement | null = null;
let currentTargetInput: HTMLInputElement | null = null;
let cachedCredentialsForSite: any[] = [];
let hasFetchedCredentials = false;
let currentPasswordLength = 20;
let currentGeneratedPassword = '';
let isRevealingPasswordMap: { [key: string]: boolean } = {};
let lastPointerPos = { x: 0, y: 0 };
let proximityThrottleTimer: any = null;
let cachedAiEvaluation: any = null;
let isAiDrawerExpanded = false;

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
function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null && el.getBoundingClientRect().height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none';
}

function isSearchOrNonCredentialInput(input: HTMLInputElement): boolean {
  const type = (input.type || '').toLowerCase();
  const nonCredentialTypes = ['search', 'number', 'date', 'datetime-local', 'time', 'file', 'range', 'color', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image', 'hidden'];
  if (nonCredentialTypes.includes(type)) return true;

  const role = (input.getAttribute('role') || '').toLowerCase();
  if (role === 'search' || role === 'searchbox') return true;

  const autocomplete = (input.autocomplete || '').toLowerCase();
  if (autocomplete === 'off' && input.name === 'q') return true;
  if (['postal-code', 'country', 'street-address', 'cc-csc', 'cc-exp'].includes(autocomplete)) return true;

  const nameIdPlaceholder = ((input.name || '') + ' ' + (input.id || '') + ' ' + (input.placeholder || '') + ' ' + (input.getAttribute('aria-label') || '')).toLowerCase();
  if (/user|login|email|pass|auth|usr|uid|uname|admission|roll|student/i.test(nameIdPlaceholder)) {
    return false;
  }

  const pattern = /search|query|find|filter|coupon|promo|discount|voucher|postal|zipcode|captcha|sms|cvv|cvc|comment|chat|quantity|amount|qty/i;
  if (pattern.test(nameIdPlaceholder)) {
    if (type !== 'password') return true;
  }

  return false;
}

function isCredentialField(input: HTMLInputElement): boolean {
  if (!input || input.disabled || input.readOnly) return false;
  if (!isVisible(input)) return false;
  if (isSearchOrNonCredentialInput(input)) return false;

  const type = (input.type || 'text').toLowerCase();
  const autocomplete = (input.autocomplete || '').toLowerCase();

  if (type === 'password') return true;
  if (['username', 'email', 'current-password', 'new-password'].includes(autocomplete)) return true;

  const allPasswords = Array.from(document.querySelectorAll('input[type="password"]')).filter(el => isVisible(el as HTMLElement));
  if (allPasswords.length > 0) {
    const textLike = ['text', 'email', 'tel', ''];
    if (textLike.includes(type)) return true;
  }

  const identifierPattern = /user|email|login|account|identifier|admission|roll|uid|uname|member|student|id|usr/i;
  const nameIdPlaceholder = (input.name || '') + ' ' + (input.id || '') + ' ' + (input.placeholder || '') + ' ' + (input.getAttribute('aria-label') || '') + ' ' + (input.className || '');
  if (identifierPattern.test(nameIdPlaceholder)) {
    return true;
  }

  return false;
}

function getAllCredentialInputs(): HTMLInputElement[] {
  const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
  return inputs.filter(i => isCredentialField(i));
}

function scoreUsernameField(input: HTMLInputElement): number {
  let score = 0;
  const type = (input.type || '').toLowerCase();
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const autocomplete = (input.autocomplete || '').toLowerCase();
  const placeholder = (input.placeholder || '').toLowerCase();

  if (autocomplete === 'username' || autocomplete === 'email') score += 100;
  if (type === 'email') score += 50;

  const pattern = /user|email|login|account|mail|handle|identifier/i;
  if (pattern.test(name) || pattern.test(id)) score += 30;
  if (pattern.test(placeholder)) score += 20;

  return score;
}

function scorePasswordField(input: HTMLInputElement): number {
  let score = 0;
  const autocomplete = (input.autocomplete || '').toLowerCase();
  if (input.type === 'password') score += 1000;
  if (autocomplete === 'current-password' || autocomplete === 'new-password') score += 100;
  return score;
}

function analyzeFormContext(focusedInput: HTMLInputElement): FormContext {
  const form = focusedInput.form || focusedInput.closest('form') || null;
  const container = form || focusedInput.closest('div[class*="login"], div[class*="auth"]') || document.body;
  const allInputs = Array.from(container.querySelectorAll('input')).filter(el => isVisible(el as HTMLElement)) as HTMLInputElement[];

  const usernameFields = allInputs
    .filter(i => {
      const type = (i.type || '').toLowerCase();
      return type !== 'password' && type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio' && !isSearchOrNonCredentialInput(i);
    })
    .sort((a, b) => scoreUsernameField(b) - scoreUsernameField(a));

  const passwordFields = allInputs
    .filter(i => (i.type || '').toLowerCase() === 'password')
    .sort((a, b) => scorePasswordField(b) - scorePasswordField(a));

  const submitButtons = Array.from(container.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type="button"])')) as HTMLElement[];
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

// ── Native Setter Dispatcher ──
function setInputValue(input: HTMLInputElement, value: string) {
  try {
    input.focus();
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    const valueTracker = (input as any)._valueTracker;
    if (valueTracker) {
      valueTracker.setValue(value);
    }

    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, key: 'a' }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true, key: 'a' }));
    input.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  } catch {
    input.value = value;
  }
}

// ── Dual-Field Universal Input Filling ──
function injectCredentials(username?: string, password?: string, targetInput?: HTMLInputElement, totpSecret?: string) {
  const activeInput = targetInput || currentTargetInput || (document.activeElement as HTMLInputElement);
  const context = activeInput ? analyzeFormContext(activeInput) : {
    form: null,
    usernameFields: [],
    passwordFields: [],
    submitButtons: [],
    isMultiStep: false,
    isEmailFirst: false
  };

  let filledUsername = false;
  let filledPassword = false;

  let userField = context.usernameFields[0];
  let passField = context.passwordFields[0];

  if (!userField || !passField) {
    const allDocInputs = getAllCredentialInputs();
    if (!userField) {
      userField = allDocInputs.find(i => i.type !== 'password' && isCredentialField(i)) as HTMLInputElement;
    }
    if (!passField) {
      passField = allDocInputs.find(i => i.type === 'password') as HTMLInputElement;
    }
  }

  if (activeInput && activeInput.type !== 'password') {
    userField = activeInput;
  } else if (activeInput && activeInput.type === 'password') {
    passField = activeInput;
  }

  if (username && userField) {
    setInputValue(userField, username);
    filledUsername = true;
  }

  if (password && passField) {
    setInputValue(passField, password);
    filledPassword = true;
  }

  if (targetInput) {
    if (password && !filledPassword && targetInput.type === 'password') {
      setInputValue(targetInput, password);
    } else if (username && !filledUsername && targetInput.type !== 'password') {
      setInputValue(targetInput, username);
    }
  }

  if (username && password) {
    showToastNotification(`✨ Filled username (${username}) and password!`);
  } else if (username) {
    showToastNotification(`👤 Filled username (${username})`);
  } else if (password) {
    showToastNotification(`🔑 Filled password`);
  }

  handleTotpSync(totpSecret);
}

// ── 2FA TOTP Auto-Copy ──
function handleTotpSync(totpSecret?: string) {
  if (!totpSecret) return;
  chrome.runtime.sendMessage({ type: 'GET_TOTP', secret: totpSecret }, (res) => {
    if (res && res.success && res.token) {
      try {
        navigator.clipboard.writeText(res.token);
        showToastNotification(`✨ Filled credentials & copied 2FA code (${res.token})!`);
      } catch {}
    }
  });
}

// ── Shadow DOM Container ──
function ensureShadowRoot(): ShadowRoot {
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = 'kloak-autofill-root';
    shadowHost.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
    document.documentElement.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  }
  return shadowRoot!;
}

// ── Password Generator Helper ──
function generateRandomPassword(length: number = 20): string {
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

  .kloak-field-badge {
    position: fixed;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: #14121F;
    border: 1px solid rgba(109, 74, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483646;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  }
  .kloak-field-badge:hover {
    transform: scale(1.12);
    background: #242135;
    border-color: #6D4AFF;
  }

  .kloak-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 8px 12px;
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

  .kloak-close-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 3px 5px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .kloak-close-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.12); }

  .kloak-body {
    display: flex;
    flex-direction: column;
    max-height: 460px;
    overflow-y: auto;
  }

  .kloak-section {
    display: flex;
    flex-direction: column;
  }

  .kloak-section-title {
    font-size: 10px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 12px 4px 12px;
  }

  .kloak-notice-badge {
    margin: 8px 12px 0 12px;
    padding: 6px 10px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 6px;
    color: #34D399;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  /* ── Account Items ── */
  .kloak-card {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    background: rgba(109, 74, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #6D4AFF;
    overflow: hidden;
  }
  .kloak-item-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .kloak-item-info {
    flex: 1;
    overflow: hidden;
    cursor: pointer;
  }
  .kloak-item-username {
    font-size: 12px;
    font-weight: 600;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-item-title {
    font-size: 10px;
    color: #9E9AA8;
  }

  .kloak-btn-fill {
    background: #6D4AFF;
    color: #FFFFFF;
    border: none;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: 0 2px 6px rgba(109, 74, 255, 0.3);
  }
  .kloak-btn-fill:hover {
    background: #7C5CFF;
    transform: scale(1.03);
  }

  .kloak-pwd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0,0,0,0.25);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
  }
  .kloak-pwd-label {
    color: #7A758B;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .kloak-pwd-value {
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #D1CFDA;
    letter-spacing: 1px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kloak-pwd-value.revealed {
    color: #00D2B4;
    letter-spacing: 0;
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
    padding: 2px 4px;
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
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(109, 74, 255, 0.04);
  }

  .kloak-gen-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kloak-gen-header .kloak-section-title {
    padding: 0;
  }

  .kloak-len-badge {
    font-size: 10px;
    color: #9E9AA8;
  }
  .kloak-len-badge strong {
    color: #6D4AFF;
  }

  .kloak-gen-preview-row {
    display: flex;
    align-items: center;
    background: #1C1929;
    border: 1px solid rgba(109,74,255,0.3);
    border-radius: 6px;
    padding: 6px 8px;
    gap: 6px;
  }

  .kloak-gen-pwd-text {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
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
    font-size: 11px;
    transition: all 0.15s;
  }
  .kloak-icon-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.1); }
  .kloak-icon-btn svg { width: 13px; height: 13px; fill: currentColor; }

  .kloak-gen-slider-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    color: #7A758B;
    gap: 8px;
  }
  .kloak-gen-slider-row input[type="range"] {
    flex: 1;
    height: 4px;
    accent-color: #6D4AFF;
    cursor: pointer;
  }

  .kloak-btn-primary {
    width: 100%;
    background: #6D4AFF;
    color: #FFFFFF;
    border: none;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: all 0.15s;
    box-shadow: 0 2px 8px rgba(109, 74, 255, 0.35);
  }
  .kloak-btn-primary:hover {
    background: #7C5CFF;
    transform: scale(1.01);
  }

  /* ── AI Certificate & Owner Inspector ── */
  .kloak-ai-inspector-section {
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: #181528;
  }

  .kloak-ai-toggle-btn {
    width: 100%;
    background: transparent;
    border: none;
    padding: 8px 12px;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: background 0.15s;
  }
  .kloak-ai-toggle-btn:hover {
    background: rgba(109, 74, 255, 0.12);
  }

  .kloak-ai-toggle-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .kloak-ai-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10B981;
    box-shadow: 0 0 6px #10B981;
  }
  .kloak-ai-dot.amber { background: #F59E0B; box-shadow: 0 0 6px #F59E0B; }
  .kloak-ai-dot.red { background: #EF4444; box-shadow: 0 0 6px #EF4444; }

  .kloak-ai-status-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
    background: rgba(16, 185, 129, 0.15);
    color: #34D399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .kloak-ai-status-badge.amber {
    background: rgba(245, 158, 11, 0.15);
    color: #FBBF24;
    border-color: rgba(245, 158, 11, 0.3);
  }
  .kloak-ai-status-badge.red {
    background: rgba(239, 68, 68, 0.15);
    color: #F87171;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .kloak-ai-drawer {
    padding: 10px 12px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #131120;
    border-top: 1px solid rgba(255,255,255,0.04);
    animation: kloakPop 0.15s ease;
  }

  .kloak-ai-summary-card {
    background: rgba(109, 74, 255, 0.08);
    border: 1px solid rgba(109, 74, 255, 0.25);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.4;
    color: #D1CFDA;
  }

  .kloak-ai-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .kloak-ai-metric-card {
    background: #1C1929;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .kloak-ai-metric-label {
    font-size: 9px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
  }
  .kloak-ai-metric-value {
    font-size: 11px;
    font-weight: 600;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kloak-ai-chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .kloak-ai-chip {
    font-size: 9px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34D399;
  }
  .kloak-ai-chip.alert {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #F87171;
  }

  /* ── Custom Alias Footer (ALWAYS PRESENT) ── */
  .kloak-alias-footer {
    padding: 8px 12px 10px 12px;
    background: #181624;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .kloak-btn-alias {
    width: 100%;
    background: rgba(0, 210, 180, 0.08);
    border: 1px solid rgba(0, 210, 180, 0.3);
    border-radius: 8px;
    padding: 7px 10px;
    color: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.15s ease;
    text-align: left;
  }
  .kloak-btn-alias:hover {
    background: rgba(0, 210, 180, 0.16);
    border-color: #00D2B4;
    transform: scale(1.01);
  }

  .kloak-alias-btn-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kloak-alias-icon {
    font-size: 14px;
    line-height: 1;
  }

  .kloak-alias-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .kloak-alias-title {
    font-size: 11px;
    font-weight: 600;
    color: #00D2B4;
  }

  .kloak-alias-sub {
    font-size: 9px;
    color: #9E9AA8;
  }

  .kloak-alias-arrow {
    font-size: 13px;
    font-weight: 700;
    color: #00D2B4;
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

function showToastNotification(text: string) {
  const root = ensureShadowRoot();
  const existing = root.getElementById('kloak-toast-msg');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'kloak-toast-msg';
  toast.className = 'kloak-toast';
  toast.textContent = text;
  root.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// ── Signup / Registration Page Detector ──
function isRegistrationOrSignupPage(): boolean {
  const url = window.location.href.toLowerCase();
  const signupUrlPatterns = ['signup', 'sign-up', 'register', 'registration', 'create-account', 'join', 'new-user', 'get-started', 'enroll', 'auth/register', 'new_account', 'password_reset', 'reset_password'];
  if (signupUrlPatterns.some(p => url.includes(p))) return true;

  const pageText = (document.title + ' ' + (document.querySelector('h1, h2, h3, h4, form, [role="form"], main, #app, #root')?.textContent || '')).toLowerCase();
  const signupTextPatterns = ['create account', 'create your account', 'create an account', 'sign up', 'signup', 'register', 'registration', 'new to', 'join today', 'set up your password', 'create new password', 'new password'];
  if (signupTextPatterns.some(p => pageText.includes(p))) return true;

  const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => isVisible(i as HTMLElement));
  if (passwordInputs.length >= 2) return true;
  if (passwordInputs.some(p => (p.autocomplete || '').toLowerCase() === 'new-password' || (p.name || '').toLowerCase().includes('confirm') || (p.id || '').toLowerCase().includes('confirm'))) return true;

  return false;
}

// ── Position Calculator ──
function calculatePopupPosition(rect: DOMRect, estimatedHeight: number = 260): { top: number; left: number } {
  const popupWidth = 340;
  let left = rect.left;
  if (left + popupWidth > window.innerWidth - 12) {
    left = window.innerWidth - popupWidth - 12;
  }
  if (left < 12) left = 12;

  let top = rect.bottom + 6;
  if (top + estimatedHeight > window.innerHeight && rect.top - estimatedHeight > 10) {
    top = rect.top - estimatedHeight - 6;
  }

  return { top, left };
}

function updateActivePopupPosition() {
  if (!activePopup || !currentTargetInput) return;
  const rect = currentTargetInput.getBoundingClientRect();
  const height = activePopup.offsetHeight || 260;
  const { top, left } = calculatePopupPosition(rect, height);
  activePopup.style.top = `${top}px`;
  activePopup.style.left = `${left}px`;
}

// ── Simple Structured Popup Builder ──
function buildPopupUI(items: any[], input: HTMLInputElement) {
  currentTargetInput = input;
  const root = ensureShadowRoot();
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }

  const container = document.createElement('div');
  container.className = 'kloak-popup';

  const rect = input.getBoundingClientRect();
  const isSignup = isRegistrationOrSignupPage();
  const { top, left } = calculatePopupPosition(rect, items.length > 0 && !isSignup ? 320 : 250);

  container.style.top = `${top}px`;
  container.style.left = `${left}px`;

  // Inject Styles once
  if (!root.querySelector('style')) {
    const styleTag = document.createElement('style');
    styleTag.textContent = POPUP_STYLES;
    root.appendChild(styleTag);
  }

  const hostname = window.location.hostname.replace(/^www\./, '');
  if (!currentGeneratedPassword) {
    currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
  }

  // 1. Sleek Header
  const header = document.createElement('div');
  header.className = 'kloak-header';
  header.innerHTML = `
    <div class="kloak-brand">
      <svg class="kloak-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      <span>Kloak (${hostname})</span>
    </div>
    <button class="kloak-close-btn" id="kloak-btn-close" title="Close Popup (Esc)">✕</button>
  `;
  container.appendChild(header);

  header.querySelector('#kloak-btn-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    container.remove();
    activePopup = null;
  });

  const bodyContainer = document.createElement('div');
  bodyContainer.className = 'kloak-body';

  // 2. TOPMOST ITEM(S): Saved Password(s) from Vault
  if (items.length > 0 && !isSignup) {
    const savedSection = document.createElement('div');
    savedSection.className = 'kloak-section';
    savedSection.innerHTML = `<div class="kloak-section-title">Saved Login${items.length > 1 ? 's' : ''}</div>`;

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
            <div class="kloak-item-title">${item.title || hostname} ${item.totpSecret ? '<span style="color: #10B981; font-weight: 600;">• 2FA</span>' : ''}</div>
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

      card.querySelector(`#fill-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        injectCredentials(item.username, item.password, input, item.totpSecret);
        container.remove();
        activePopup = null;
      });

      card.querySelector('.kloak-item-info')?.addEventListener('click', (e) => {
        e.stopPropagation();
        injectCredentials(item.username, item.password, input, item.totpSecret);
        container.remove();
        activePopup = null;
      });

      card.querySelector(`#reveal-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        isRevealingPasswordMap[itemId] = !isRevealingPasswordMap[itemId];
        const valEl = card.querySelector(`#pwd-val-${itemId}`) as HTMLElement;
        const btnEl = card.querySelector(`#reveal-btn-${itemId}`) as HTMLElement;
        if (isRevealingPasswordMap[itemId]) {
          valEl.textContent = displayPassword;
          valEl.classList.add('revealed');
          btnEl.textContent = '🙈';
          btnEl.title = 'Hide Password';
        } else {
          valEl.textContent = maskedPassword;
          valEl.classList.remove('revealed');
          btnEl.textContent = '👁️';
          btnEl.title = 'Show Password';
        }
      });

      card.querySelector(`#copy-pwd-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (displayPassword) {
          navigator.clipboard.writeText(displayPassword);
          showToastNotification('📋 Password copied to clipboard!');
        }
      });

      card.querySelector(`#copy-user-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.username) {
          navigator.clipboard.writeText(item.username);
          showToastNotification('👤 Username copied to clipboard!');
        }
      });

      savedSection.appendChild(card);
    });

    bodyContainer.appendChild(savedSection);
  }

  if (isSignup) {
    const banner = document.createElement('div');
    banner.className = 'kloak-notice-badge';
    banner.innerHTML = `<span>✨ Create Account Detected</span> • Fill new password`;
    bodyContainer.appendChild(banner);
  }

  // 3. MIDDLE ITEM: Password Generator
  const genSection = document.createElement('div');
  genSection.className = 'kloak-gen-box';

  const genTitle = items.length === 0 ? 'Generate Password' : (isSignup ? 'New Account Password' : 'Password Generator');

  genSection.innerHTML = `
    <div class="kloak-gen-header">
      <span class="kloak-section-title">${genTitle}</span>
      <span class="kloak-len-badge"><strong id="kloak-len-num">${currentPasswordLength}</strong> chars</span>
    </div>

    <div class="kloak-gen-preview-row">
      <div class="kloak-gen-pwd-text" id="kloak-pwd-display">${currentGeneratedPassword}</div>
      <button class="kloak-icon-btn" id="kloak-btn-regen" title="Regenerate Password">
        <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </button>
      <button class="kloak-icon-btn" id="kloak-btn-copy-gen" title="Copy Generated Password">
        📋
      </button>
    </div>

    <div class="kloak-gen-slider-row">
      <span>10</span>
      <input type="range" id="kloak-len-slider" min="10" max="40" value="${currentPasswordLength}">
      <span>40</span>
    </div>

    <button class="kloak-btn-primary" id="kloak-btn-use-pwd">
      ⚡ Fill Generated Password
    </button>
  `;

  bodyContainer.appendChild(genSection);

  const pwdDisplay = genSection.querySelector('#kloak-pwd-display') as HTMLElement;
  const lenNum = genSection.querySelector('#kloak-len-num') as HTMLElement;
  const slider = genSection.querySelector('#kloak-len-slider') as HTMLInputElement;

  genSection.querySelector('#kloak-btn-regen')?.addEventListener('click', (e) => {
    e.stopPropagation();
    currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
    if (pwdDisplay) pwdDisplay.textContent = currentGeneratedPassword;
  });

  genSection.querySelector('#kloak-btn-copy-gen')?.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(currentGeneratedPassword);
      showToastNotification('📋 Generated password copied to clipboard!');
    } catch {}
  });

  slider?.addEventListener('input', () => {
    currentPasswordLength = parseInt(slider.value, 10);
    if (lenNum) lenNum.textContent = String(currentPasswordLength);
    currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
    if (pwdDisplay) pwdDisplay.textContent = currentGeneratedPassword;
  });

  genSection.querySelector('#kloak-btn-use-pwd')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const allPasswords = Array.from(document.querySelectorAll('input[type="password"]')).filter(el => isVisible(el as HTMLElement)) as HTMLInputElement[];
    if (allPasswords.length > 0) {
      allPasswords.forEach(pField => setInputValue(pField, currentGeneratedPassword));
    } else if (input) {
      setInputValue(input, currentGeneratedPassword);
    }
    try {
      navigator.clipboard.writeText(currentGeneratedPassword);
    } catch {}
    showToastNotification('⚡ Generated password filled into password field & copied to clipboard!');
    container.remove();
    activePopup = null;
  });

  // 4. AI SECURITY & CERTIFICATE INSPECTOR DRAWER
  const aiSection = document.createElement('div');
  aiSection.className = 'kloak-ai-inspector-section';

  aiSection.innerHTML = `
    <button class="kloak-ai-toggle-btn" id="kloak-ai-toggle-btn">
      <div class="kloak-ai-toggle-left">
        <span class="kloak-ai-dot" id="kloak-ai-dot"></span>
        <span>🧠 AI Security & Certificate Inspector</span>
      </div>
      <span class="kloak-ai-status-badge" id="kloak-ai-badge">Analyzing...</span>
    </button>
    <div class="kloak-ai-drawer" id="kloak-ai-drawer" style="display: ${isAiDrawerExpanded ? 'flex' : 'none'};">
      <div class="kloak-ai-summary-card" id="kloak-ai-summary">
        Fetching real-time SSL/TLS certificate and domain owner records...
      </div>
      <div class="kloak-ai-grid" id="kloak-ai-grid" style="display: none;">
        <div class="kloak-ai-metric-card">
          <span class="kloak-ai-metric-label">🔒 TLS Certificate</span>
          <span class="kloak-ai-metric-value" id="kloak-ai-cert-val">-</span>
        </div>
        <div class="kloak-ai-metric-card">
          <span class="kloak-ai-metric-label">🏢 Domain Owner</span>
          <span class="kloak-ai-metric-value" id="kloak-ai-owner-val">-</span>
        </div>
      </div>
      <div class="kloak-ai-chips-wrap" id="kloak-ai-chips"></div>
    </div>
  `;

  bodyContainer.appendChild(aiSection);

  const toggleBtn = aiSection.querySelector('#kloak-ai-toggle-btn');
  const drawerEl = aiSection.querySelector('#kloak-ai-drawer') as HTMLElement;
  const dotEl = aiSection.querySelector('#kloak-ai-dot') as HTMLElement;
  const badgeEl = aiSection.querySelector('#kloak-ai-badge') as HTMLElement;
  const summaryEl = aiSection.querySelector('#kloak-ai-summary') as HTMLElement;
  const gridEl = aiSection.querySelector('#kloak-ai-grid') as HTMLElement;
  const certValEl = aiSection.querySelector('#kloak-ai-cert-val') as HTMLElement;
  const ownerValEl = aiSection.querySelector('#kloak-ai-owner-val') as HTMLElement;
  const chipsEl = aiSection.querySelector('#kloak-ai-chips') as HTMLElement;

  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    isAiDrawerExpanded = !isAiDrawerExpanded;
    if (drawerEl) {
      drawerEl.style.display = isAiDrawerExpanded ? 'flex' : 'none';
    }
  });

  // Populate AI Inspector Data
  const renderAiEvaluation = (evalData: any) => {
    if (!evalData) return;
    const isSafe = evalData.threatLevel === 'VERIFIED_SAFE' || evalData.riskScore < 30;
    const isCaution = evalData.threatLevel === 'CAUTION_SUSPICIOUS' || (evalData.riskScore >= 30 && evalData.riskScore < 60);

    if (dotEl && badgeEl) {
      if (isSafe) {
        dotEl.className = 'kloak-ai-dot';
        badgeEl.className = 'kloak-ai-status-badge';
        badgeEl.textContent = '🟢 0% Risk • Safe';
      } else if (isCaution) {
        dotEl.className = 'kloak-ai-dot amber';
        badgeEl.className = 'kloak-ai-status-badge amber';
        badgeEl.textContent = `🟡 ${evalData.riskScore}% Risk • Caution`;
      } else {
        dotEl.className = 'kloak-ai-dot red';
        badgeEl.className = 'kloak-ai-status-badge red';
        badgeEl.textContent = `🚨 ${evalData.riskScore}% Risk • Threat`;
      }
    }

    if (summaryEl) {
      summaryEl.textContent = evalData.aiSummary || 'Security evaluation complete.';
    }

    if (gridEl) gridEl.style.display = 'grid';

    if (certValEl && evalData.certificate) {
      const certTier = evalData.certificate.validationLevel ? `(${evalData.certificate.validationLevel})` : '';
      certValEl.textContent = `${evalData.certificate.issuerOrg || evalData.certificate.issuerName || 'Verified CA'} ${certTier}`;
      certValEl.title = evalData.certificateVerdict || '';
    }

    if (ownerValEl && evalData.domainIntel) {
      const ageStr = evalData.domainIntel.domainAgeYears ? `${evalData.domainIntel.domainAgeYears} yrs` : `${evalData.domainIntel.domainAgeDays} days`;
      ownerValEl.textContent = `${evalData.domainIntel.registrantOrg || evalData.domainIntel.registrarName} • ${ageStr}`;
      ownerValEl.title = evalData.ownerVerdict || '';
    }

    if (chipsEl) {
      chipsEl.innerHTML = '';
      const allChips = [...(evalData.trustBadges || []), ...(evalData.redFlags || [])];
      allChips.forEach((chipText: string) => {
        const chip = document.createElement('span');
        const isRed = chipText.includes('🚨') || chipText.includes('⚠️') || chipText.includes('discrepancy');
        chip.className = `kloak-ai-chip ${isRed ? 'alert' : ''}`;
        chip.textContent = chipText;
        chipsEl.appendChild(chip);
      });
    }
  };

  if (cachedAiEvaluation) {
    renderAiEvaluation(cachedAiEvaluation);
  } else {
    chrome.runtime.sendMessage({ type: 'AI_INSPECT_WEBSITE', url: window.location.href }, (res) => {
      if (res && res.evaluation) {
        cachedAiEvaluation = res.evaluation;
        renderAiEvaluation(res.evaluation);
      }
    });
  }

  // 5. BOTTOM ITEM: Custom Masked Alias Button (ALWAYS PRESENT)
  const aliasSection = document.createElement('div');
  aliasSection.className = 'kloak-alias-footer';
  aliasSection.innerHTML = `
    <button class="kloak-btn-alias" id="kloak-btn-custom-alias">
      <div class="kloak-alias-btn-left">
        <span class="kloak-alias-icon">🛡️</span>
        <div class="kloak-alias-text-wrap">
          <div class="kloak-alias-title">Generate Custom Alias for ${hostname}</div>
          <div class="kloak-alias-sub">Masks your real email • Auto-forwards to inbox</div>
        </div>
      </div>
      <span class="kloak-alias-arrow">→</span>
    </button>
  `;

  aliasSection.querySelector('#kloak-btn-custom-alias')?.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: 'GENERATE_PROTECTED_ALIAS',
      url: window.location.href,
      domain: hostname
    }, (res) => {
      if (res && res.success) {
        const allInputs = Array.from(document.querySelectorAll('input')).filter(el => isVisible(el as HTMLElement)) as HTMLInputElement[];
        let targetField: HTMLInputElement | null = null;
        if (input.type !== 'password') {
          targetField = input;
        } else {
          const userCandidate = allInputs.find(i => i.type !== 'password' && isCredentialField(i));
          if (userCandidate) targetField = userCandidate;
        }

        if (targetField) {
          setInputValue(targetField, res.aliasEmail);
        }
        try {
          navigator.clipboard.writeText(res.aliasEmail);
        } catch {}
        showToastNotification(`🛡️ Created alias (${res.aliasEmail}) forwarding to ${res.forwardTo}!`);
        container.remove();
        activePopup = null;
      }
    });
  });

  bodyContainer.appendChild(aliasSection);
  container.appendChild(bodyContainer);

  root.appendChild(container);
  activePopup = container;

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
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
  const handleOutsideClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
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
function triggerCredentialPopupForInput(input: HTMLInputElement) {
  if (!isCredentialField(input)) return;
  currentTargetInput = input;

  chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS', url: window.location.href }, (response) => {
    if (response && Array.isArray(response.items)) {
      cachedCredentialsForSite = response.items;
    } else {
      cachedCredentialsForSite = [];
    }
    hasFetchedCredentials = true;
    buildPopupUI(cachedCredentialsForSite, input);
  });
}

// ── Proximity Calculation Engine ──
function findClosestCredentialField(x: number, y: number): { input: HTMLInputElement; distance: number } | null {
  const fields = getAllCredentialInputs();
  if (fields.length === 0) return null;

  let closest: HTMLInputElement | null = null;
  let minDistance = Infinity;

  fields.forEach(field => {
    const rect = field.getBoundingClientRect();
    const cx = Math.max(rect.left, Math.min(x, rect.right));
    const cy = Math.max(rect.top, Math.min(y, rect.bottom));
    const dist = Math.hypot(x - cx, y - cy);

    if (dist < minDistance) {
      minDistance = dist;
      closest = field;
    }
  });

  if (!closest) return null;
  return { input: closest, distance: minDistance };
}

// ── Pointer Proximity & Focus Event Listeners ──
document.addEventListener('mousemove', (e) => {
  lastPointerPos = { x: e.clientX, y: e.clientY };

  if (proximityThrottleTimer) return;
  proximityThrottleTimer = setTimeout(() => {
    proximityThrottleTimer = null;

    const closest = findClosestCredentialField(lastPointerPos.x, lastPointerPos.y);
    if (!closest) return;

    if (closest.distance < 50 && activePopup && currentTargetInput !== closest.input) {
      currentTargetInput = closest.input;
      buildPopupUI(cachedCredentialsForSite, closest.input);
    }
  }, 60);
});

document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'INPUT' && isCredentialField(target as HTMLInputElement)) {
    triggerCredentialPopupForInput(target as HTMLInputElement);
  }
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'INPUT' && isCredentialField(target as HTMLInputElement)) {
    triggerCredentialPopupForInput(target as HTMLInputElement);
  }
});

// ── In-Field Kloak Badges ──
function updateInFieldIcons() {
  const fields = getAllCredentialInputs();
  const root = ensureShadowRoot();

  fields.forEach(field => {
    let fieldId = field.getAttribute('data-kloak-id');
    if (!fieldId) {
      fieldId = `field-${Math.random().toString(36).substring(2, 9)}`;
      field.setAttribute('data-kloak-id', fieldId);
    }

    let iconEl = root.getElementById(`kloak-icon-${fieldId}`);
    if (!iconEl) {
      iconEl = document.createElement('div');
      iconEl.id = `kloak-icon-${fieldId}`;
      iconEl.className = 'kloak-field-badge';
      iconEl.title = 'Kloak: Click to autofill or generate credentials';
      iconEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="#6D4AFF">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
      `;
      iconEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        field.focus();
        triggerCredentialPopupForInput(field);
      });
      root.appendChild(iconEl);
    }

    const rect = field.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && isVisible(field)) {
      iconEl.style.display = 'flex';
      const iconSize = 20;
      const top = rect.top + (rect.height - iconSize) / 2;
      const left = rect.right - iconSize - 6;
      iconEl.style.top = `${top}px`;
      iconEl.style.left = `${left}px`;
    } else {
      iconEl.style.display = 'none';
    }
  });
}

window.addEventListener('scroll', () => {
  if (activePopup && currentTargetInput) {
    requestAnimationFrame(updateActivePopupPosition);
  }
  requestAnimationFrame(updateInFieldIcons);
}, { passive: true });

window.addEventListener('resize', () => {
  if (activePopup && currentTargetInput) {
    requestAnimationFrame(updateActivePopupPosition);
  }
  requestAnimationFrame(updateInFieldIcons);
}, { passive: true });

// ── Threat Banner ──
function checkThreatShield() {
  chrome.runtime.sendMessage({ type: 'CHECK_THREAT', url: window.location.href, includeAi: true }, (res) => {
    if (res && (res.analysis?.isSuspicious || (res.aiEvaluation && res.aiEvaluation.riskScore >= 40))) {
      showThreatBanner(res.analysis, res.aiEvaluation, res.connectedAccount);
    }
  });
}

function showThreatBanner(analysis: any, aiEvaluation?: any, connectedAccount?: any) {
  if (document.getElementById('kloak-threat-banner')) return;

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

  const domainDisplay = analysis?.targetDomain || aiEvaluation?.domain || window.location.hostname;
  const riskScore = aiEvaluation?.riskScore || analysis?.riskScore || 65;
  const certDetail = aiEvaluation?.certificate ? `Cert: ${aiEvaluation.certificate.issuerOrg} (${aiEvaluation.certificate.certificateAgeDays}d old)` : '';
  const domainAge = aiEvaluation?.domainIntel ? `Domain: ${aiEvaluation.domainIntel.domainAgeDays}d old` : '';
  const reasonSummary = aiEvaluation?.aiSummary || analysis?.reasons?.[0] || 'Potential phishing or unverified login form';

  banner.innerHTML = `
    <div style="font-size: 24px; line-height: 1;">⚠️</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <div style="font-size: 13px; font-weight: 700; color: #fca5a5; display: flex; align-items: center; gap: 6px;">
        Kloak AI Threat Shield: Suspicious Website (${domainDisplay})
        <span style="font-size: 10px; background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 6px; border-radius: 99px; color: #f87171;">Risk: ${riskScore}%</span>
        ${certDetail ? `<span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 4px; color: #d1d5db;">${certDetail}</span>` : ''}
        ${domainAge ? `<span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 4px; color: #d1d5db;">${domainAge}</span>` : ''}
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
  } else if (message.type === 'THREAT_DETECTED') {
    showThreatBanner(message.analysis, message.aiEvaluation, message.connectedAccount);
    sendResponse({ success: true });
  }
});

// Run threat detection check & field scans
checkThreatShield();

// Check DOM mutations for dynamic forms
const domObserver = new MutationObserver(() => {
  updateInFieldIcons();
});
if (document.body) {
  domObserver.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      domObserver.observe(document.body, { childList: true, subtree: true });
    }
  });
}

setTimeout(updateInFieldIcons, 300);
setTimeout(updateInFieldIcons, 1000);
setInterval(updateInFieldIcons, 2500);
