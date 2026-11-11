/**
 * Kloak Browser Extension — Content Script
 * Compact Adaptive Autofill Popup, In-Page Password Inspector,
 * Contextual Generator & AI Certificate / Domain Owner Threat Inspector.
 */

import { renderFavicon } from './favicon-service';
import { evaluateCredentialRisk, renderCircumferenceSvg } from './risk-assessment';

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
let currentPasswordLength = 18;
let currentGeneratedPassword = '';
let isRevealingPasswordMap: { [key: string]: boolean } = {};
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
  if (!el || el.offsetParent === null) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

function isSearchOrNonCredentialInput(input: HTMLInputElement): boolean {
  if (!input) return true;
  const type = (input.type || 'text').toLowerCase();

  // 1. Definitively non-credential input types
  const nonCredentialTypes = [
    'search', 'number', 'date', 'datetime-local', 'time', 'month', 'week',
    'file', 'range', 'color', 'checkbox', 'radio', 'submit', 'button',
    'reset', 'image', 'hidden'
  ];
  if (nonCredentialTypes.includes(type)) return true;

  // 2. Passwords are never search fields
  if (type === 'password') return false;

  // 3. Search roles and input modes
  const role = (input.getAttribute('role') || '').toLowerCase();
  if (role === 'search' || role === 'searchbox' || role === 'combobox') return true;
  const inputMode = (input.getAttribute('inputmode') || '').toLowerCase();
  if (inputMode === 'search') return true;

  // 4. Form / Container context (HTML5 <search>, form[role="search"], form[action*="search"])
  const form = input.form || input.closest('form');
  if (form) {
    const formRole = (form.getAttribute('role') || '').toLowerCase();
    const formAction = (form.getAttribute('action') || '').toLowerCase();
    const formNameId = ((form.name || '') + ' ' + (form.id || '') + ' ' + (form.className || '')).toLowerCase();
    if (formRole === 'search' || formAction.includes('search') || formAction.includes('/find') || /\b(search|query|lookup)\b/i.test(formNameId)) {
      return true;
    }
  }

  // Inside <search>, <nav>, <header>, or search-specific wrappers when no password field is present
  const searchContainer = input.closest('search, [role="search"], header, nav, [class*="search"], [id*="search"]');
  if (searchContainer) {
    const hasPasswordInContainer = searchContainer.querySelector('input[type="password"]') !== null;
    if (!hasPasswordInContainer) return true;
  }

  // 5. Autocomplete hints that indicate non-credentials or search
  const autocomplete = (input.autocomplete || '').toLowerCase();
  const nonCredentialAutocompletes = [
    'off', 'postal-code', 'country', 'country-name', 'street-address',
    'address-line1', 'address-line2', 'address-level1', 'address-level2',
    'cc-name', 'cc-number', 'cc-csc', 'cc-exp', 'cc-exp-month', 'cc-exp-year',
    'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'tel', 'tel-national',
    'transaction-amount', 'transaction-currency', 'language', 'one-time-code'
  ];
  if (nonCredentialAutocompletes.includes(autocomplete)) {
    if (autocomplete === 'off') {
      const qPattern = /^(q|s|k|query|search|keyword|term|filter)$/i;
      if (qPattern.test(input.name || '') || qPattern.test(input.id || '')) return true;
    } else {
      return true;
    }
  }

  // 6. Aria autocomplete / combobox list hints (Google, YouTube, Amazon, GitHub, Algolia search)
  const ariaAutocomplete = (input.getAttribute('aria-autocomplete') || '').toLowerCase();
  if (ariaAutocomplete === 'list' || ariaAutocomplete === 'both') return true;

  // 7. Text attributes: strictly test for search / query / non-credential terms
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const placeholder = (input.placeholder || '').toLowerCase();
  const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
  const title = (input.title || '').toLowerCase();

  const searchKeywords = /\b(search|query|find|filter|lookup|omnibox|prompt|chat|message|comment|coupon|promo|discount|voucher|quantity|qty|amount|price|subject|title|note|tags?|headline|caption|city|zip|zipcode|postal)\b/i;

  if (searchKeywords.test(name) ||
      searchKeywords.test(id) ||
      searchKeywords.test(placeholder) ||
      searchKeywords.test(ariaLabel) ||
      searchKeywords.test(title)) {
    return true;
  }

  // Common short search parameter names: q, s, k, query
  if (/^(q|s|k|query|term|keyword|search_query)$/i.test(name) || /^(q|s|k|query|search)$/i.test(id)) {
    return true;
  }

  return false;
}

function isCredentialField(input: HTMLInputElement): boolean {
  if (!input || input.disabled || input.readOnly) return false;
  if (!isVisible(input)) return false;
  if (isSearchOrNonCredentialInput(input)) return false;

  const type = (input.type || 'text').toLowerCase();
  const autocomplete = (input.autocomplete || '').toLowerCase();

  // 1. Password inputs are always credential fields
  if (type === 'password') return true;

  // 2. Explicit credential autocomplete attributes
  if (['username', 'email', 'current-password', 'new-password'].includes(autocomplete)) {
    return true;
  }

  // 3. Explicit input type="email"
  if (type === 'email') {
    return true;
  }

  // 4. Input shares a form or auth container with a visible password field
  const form = input.form || input.closest('form') || input.closest('div[class*="login"], div[class*="auth"], div[class*="signin"], div[class*="signup"], div[id*="login"], div[id*="auth"]');
  if (form) {
    const passwordInSameContainer = form.querySelector('input[type="password"]');
    if (passwordInSameContainer && isVisible(passwordInSameContainer as HTMLElement)) {
      if (['text', 'email', 'tel', ''].includes(type)) {
        const nameId = ((input.name || '') + ' ' + (input.id || '')).toLowerCase();
        if (!/^(firstname|lastname|fname|lname|first_name|last_name|phone|mobile)$/i.test(nameId)) {
          return true;
        }
      }
    }
  }

  // 5. Strict identifier patterns with word boundaries (NEVER match substring "id" inside other words!)
  const strictIdentifierPattern = /\b(user|username|user_name|user_id|userid|email|mail|login|login_id|loginid|account|account_name|member_id|student_id|roll_no|admission_no|identifier|usr|uname)\b/i;

  const checkText = (input.name || '') + ' ' + (input.id || '') + ' ' + (input.placeholder || '') + ' ' + (input.getAttribute('aria-label') || '');
  if (strictIdentifierPattern.test(checkText)) {
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
        showToastNotification(`✨ Filled & copied 2FA (${res.token})!`);
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
function generateRandomPassword(length: number = 18): string {
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

// ── Compact In-Page Popup Styles ──
const POPUP_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  
  .kloak-popup {
    position: fixed;
    background: #14121F;
    border: 1px solid rgba(109, 74, 255, 0.45);
    border-radius: 12px;
    box-shadow: 0 16px 44px rgba(0,0,0,0.7), 0 0 24px rgba(109, 74, 255, 0.2);
    color: #FFFFFF;
    z-index: 2147483647;
    font-size: 12px;
    backdrop-filter: blur(24px);
    overflow: hidden;
    animation: kloakPop 0.14s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    width: 330px;
    transition: top 0.12s ease, left 0.12s ease;
  }

  @keyframes kloakPop {
    0% { opacity: 0; transform: translateY(-3px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .kloak-field-badge {
    position: fixed;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: #14121F;
    border: 1px solid rgba(109, 74, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483646;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .kloak-field-badge:hover {
    transform: scale(1.1);
    background: #242135;
    border-color: #6D4AFF;
  }

  .kloak-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #1C1929;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .kloak-brand {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    font-weight: 700;
    color: #A5A1B2;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .kloak-brand-icon {
    width: 13px;
    height: 13px;
    fill: #6D4AFF;
  }

  .kloak-close-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .kloak-close-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.12); }

  .kloak-body {
    display: flex;
    flex-direction: column;
    max-height: 420px;
    overflow-y: auto;
    padding: 8px;
    gap: 7px;
  }

  .kloak-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .kloak-section-title {
    font-size: 9px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 2px 4px 2px;
  }

  .kloak-notice-badge {
    padding: 5px 9px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 6px;
    color: #34D399;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ── Modern Credential Tile Design ── */
  .kloak-tile {
    background: #1C1A29;
    border: 1px solid rgba(109, 74, 255, 0.28);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    cursor: pointer;
    outline: none;
  }
  .kloak-tile:hover, .kloak-tile:focus-visible {
    background: #232034;
    border-color: #7E5EFF;
    box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 16px rgba(109, 74, 255, 0.28);
    transform: translateY(-1px);
  }

  /* Tile Top Row: Identity + Fill Action */
  .kloak-tile-top {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .kloak-tile-avatar {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(255,255,255,0.06);
  }
  .kloak-tile-info {
    flex: 1;
    overflow: hidden;
    min-width: 0;
  }
  .kloak-tile-username {
    font-size: 12px;
    font-weight: 700;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-tile-meta-row {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 1px;
  }
  .kloak-tile-domain {
    font-size: 9.5px;
    color: #A5A1B2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-tile-2fa-badge {
    font-size: 8px;
    font-weight: 700;
    color: #10B981;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .kloak-tile-fill-btn {
    background: linear-gradient(135deg, #6D4AFF 0%, #7E5EFF 100%);
    color: #FFFFFF;
    border: none;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    transition: all 0.16s ease;
    box-shadow: 0 2px 8px rgba(109, 74, 255, 0.4);
  }
  .kloak-tile-fill-btn:hover {
    background: linear-gradient(135deg, #7C5CFF 0%, #8F72FF 100%);
    transform: scale(1.03);
    box-shadow: 0 4px 12px rgba(109, 74, 255, 0.6);
  }
  .kloak-tile-fill-btn.filled-success {
    background: #10B981 !important;
    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.5) !important;
  }

  /* ── Security & Risk Health Sub-Tile (Circumference Ring + Stats) ── */
  .kloak-tile-risk-card {
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 7px;
    padding: 7px 9px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .kloak-tile-gauge-box {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .kloak-tile-risk-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .kloak-tile-risk-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .kloak-tile-risk-title {
    font-size: 10.5px;
    font-weight: 700;
    color: #FFFFFF;
    letter-spacing: 0.2px;
  }
  .kloak-tile-risk-pill {
    font-size: 8px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .kloak-tile-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .kloak-tile-chip {
    font-size: 9px;
    padding: 2px 5px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: #C3C0CD;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
  }
  .kloak-tile-chip.alert {
    background: rgba(239, 68, 68, 0.16);
    border-color: rgba(239, 68, 68, 0.35);
    color: #FFA5A5;
  }
  .kloak-tile-chip.success {
    background: rgba(16, 185, 129, 0.16);
    border-color: rgba(16, 185, 129, 0.35);
    color: #34D399;
  }

  /* ── Password Bar with Peek & Copy ── */
  .kloak-tile-pwd-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.22);
    border-radius: 6px;
    padding: 4px 8px;
    gap: 6px;
  }
  .kloak-tile-pwd-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }
  .kloak-tile-pwd-label {
    font-size: 8px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .kloak-tile-pwd-val {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 10px;
    color: #D1CFDA;
    letter-spacing: 0.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 120px;
  }
  .kloak-tile-pwd-val.revealed {
    color: #00D2B4;
    letter-spacing: 0;
  }
  .kloak-tile-pwd-actions {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .kloak-tile-action-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #D1CFDA;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    transition: all 0.15s;
  }
  .kloak-tile-action-btn:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .kloak-tile-action-btn.copied {
    color: #34D399;
    border-color: #10B981;
    background: rgba(16, 185, 129, 0.18);
  }

  /* ── Action Tiles ── */
  .kloak-gen-btn-box {
    padding: 0;
  }

  .kloak-btn-generator {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #252233;
    border: 1px solid rgba(109, 74, 255, 0.35);
    border-radius: 6px;
    padding: 6px 8px;
    color: #FFFFFF;
    cursor: pointer;
    transition: all 0.16s ease;
    font-family: inherit;
    text-align: left;
    box-sizing: border-box;
  }
  .kloak-btn-generator:hover {
    background: #2E2942;
    border-color: #6D4AFF;
    box-shadow: 0 2px 8px rgba(109, 74, 255, 0.25);
    transform: translateY(-1px);
  }
  .kloak-btn-generator:active {
    transform: translateY(0);
  }

  .kloak-gen-btn-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .kloak-gen-key-icon {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: rgba(109, 74, 255, 0.2);
    color: #A78BFA;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
  }
  .kloak-gen-btn-texts {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .kloak-gen-btn-title {
    font-size: 11px;
    font-weight: 600;
    color: #F3F4F6;
  }
  .kloak-gen-btn-sub {
    font-size: 9px;
    color: #9E9AA8;
  }
  .kloak-gen-btn-arrow {
    font-size: 11px;
    color: #A78BFA;
    font-weight: 600;
    opacity: 0.8;
  }

  /* ── Compact AI Certificate & Owner Inspector ── */
  .kloak-ai-inspector-section {
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: #181528;
  }

  .kloak-ai-toggle-btn {
    width: 100%;
    background: transparent;
    border: none;
    padding: 6px 10px;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    transition: background 0.15s;
  }
  .kloak-ai-toggle-btn:hover {
    background: rgba(109, 74, 255, 0.12);
  }

  .kloak-ai-toggle-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .kloak-ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10B981;
    box-shadow: 0 0 5px #10B981;
  }
  .kloak-ai-dot.amber { background: #F59E0B; box-shadow: 0 0 5px #F59E0B; }
  .kloak-ai-dot.red { background: #EF4444; box-shadow: 0 0 5px #EF4444; }

  .kloak-ai-status-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
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
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: #131120;
    border-top: 1px solid rgba(255,255,255,0.04);
    animation: kloakPop 0.14s ease;
  }

  .kloak-ai-summary-card {
    background: rgba(109, 74, 255, 0.08);
    border: 1px solid rgba(109, 74, 255, 0.25);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 10px;
    line-height: 1.35;
    color: #D1CFDA;
  }

  .kloak-ai-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .kloak-ai-metric-card {
    background: #1C1929;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 5px;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .kloak-ai-metric-label {
    font-size: 8px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
  }
  .kloak-ai-metric-value {
    font-size: 10px;
    font-weight: 600;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kloak-ai-chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 1px;
  }

  .kloak-ai-chip {
    font-size: 8px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34D399;
  }
  .kloak-ai-chip.alert {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #F87171;
  }

  /* ── Compact Custom Alias Footer (ALWAYS PRESENT) ── */
  .kloak-alias-footer {
    padding: 6px 10px;
    background: #181624;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .kloak-btn-alias {
    width: 100%;
    background: rgba(0, 210, 180, 0.08);
    border: 1px solid rgba(0, 210, 180, 0.3);
    border-radius: 6px;
    padding: 5px 8px;
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
  }

  .kloak-alias-btn-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .kloak-alias-icon {
    font-size: 12px;
    line-height: 1;
  }

  .kloak-alias-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .kloak-alias-title {
    font-size: 10px;
    font-weight: 600;
    color: #00D2B4;
  }

  .kloak-alias-sub {
    font-size: 8px;
    color: #9E9AA8;
  }

  .kloak-alias-arrow {
    font-size: 11px;
    font-weight: 700;
    color: #00D2B4;
  }

  /* ── Toast Notification ── */
  .kloak-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #14121F;
    border: 1px solid #10B981;
    border-radius: 6px;
    padding: 8px 12px;
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    z-index: 2147483647;
    animation: kloakPop 0.15s ease;
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

// ── Solid Stable Position Calculator ──
function calculatePopupPosition(rect: DOMRect, estimatedHeight: number = 280): { top: number; left: number } {
  const popupWidth = 330;
  let left = rect.left;
  if (left + popupWidth > window.innerWidth - 10) {
    left = window.innerWidth - popupWidth - 10;
  }
  if (left < 10) left = 10;

  let top = rect.bottom + 4;
  if (top + estimatedHeight > window.innerHeight && rect.top - estimatedHeight > 10) {
    top = rect.top - estimatedHeight - 4;
  }

  return { top, left };
}

function updateActivePopupPosition() {
  if (!activePopup || !currentTargetInput) return;
  const rect = currentTargetInput.getBoundingClientRect();
  const height = activePopup.offsetHeight || 280;
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
  const { top, left } = calculatePopupPosition(rect, items.length > 0 && !isSignup ? 320 : 180);

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

  // 2. TOPMOST ITEM(S): Saved Password(s) from Vault in Modern Tile Design
  if (items.length > 0 && !isSignup) {
    const savedSection = document.createElement('div');
    savedSection.className = 'kloak-section';
    savedSection.innerHTML = `<div class="kloak-section-title">Saved Login${items.length > 1 ? 's' : ''}</div>`;

    items.forEach((item, idx) => {
      const tile = document.createElement('div');
      tile.className = 'kloak-tile';
      tile.tabIndex = 0; // keyboard navigable

      const itemId = item.id || `item-${idx}`;
      const isRevealed = !!isRevealingPasswordMap[itemId];
      const displayPassword = item.password || '';
      const maskedPassword = '••••••••••••';

      // Evaluate risk & generate circular circumference gauge
      const risk = evaluateCredentialRisk(item, items);
      // Circumference gauge: 38px diameter, 3.2px stroke (prominent Security & Risk Health card)
      const circumferenceGaugeHtml = renderCircumferenceSvg(risk.score, risk.color, 38, 3.2);

      const pillLabel = risk.riskLevel === 'low' ? 'LOW RISK' : (risk.riskLevel === 'medium' ? 'MEDIUM RISK' : 'HIGH RISK');
      const pillBg = risk.riskLevel === 'low' ? 'rgba(16, 185, 129, 0.16)' : (risk.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.16)' : 'rgba(239, 68, 68, 0.16)');
      const pillBorder = risk.riskLevel === 'low' ? 'rgba(16, 185, 129, 0.35)' : (risk.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(239, 68, 68, 0.35)');

      const uniqueChipHtml = risk.isReused
        ? `<span class="kloak-tile-chip alert">⚠️ Reused (${risk.reusedCount + 1} sites)</span>`
        : `<span class="kloak-tile-chip success">✓ Unique password</span>`;

      const twoFaChipHtml = risk.has2FA
        ? `<span class="kloak-tile-chip success">🛡️ 2FA Active</span>`
        : `<span class="kloak-tile-chip alert">⚠️ No 2FA</span>`;

      tile.innerHTML = `
        <div class="kloak-tile-top">
          <div class="kloak-tile-avatar"></div>
          <div class="kloak-tile-info">
            <div class="kloak-tile-username" title="${item.username || 'No Username'}">${item.username || 'No Username'}</div>
            <div class="kloak-tile-meta-row">
              <span class="kloak-tile-domain" title="${item.title || hostname}">${item.title || hostname}</span>
              ${item.totpSecret ? '<span class="kloak-tile-2fa-badge">2FA</span>' : ''}
            </div>
          </div>
          <button class="kloak-tile-fill-btn" id="fill-btn-${itemId}" title="1-Click Fill Credentials">
            <span>⚡</span>
            <span class="btn-fill-text">Fill</span>
          </button>
        </div>

        <div class="kloak-tile-risk-card" title="Security Health: ${risk.score}% (${risk.label})">
          <div class="kloak-tile-gauge-box">
            ${circumferenceGaugeHtml}
          </div>
          <div class="kloak-tile-risk-body">
            <div class="kloak-tile-risk-header">
              <span class="kloak-tile-risk-title">Security & Risk Health</span>
              <span class="kloak-tile-risk-pill" style="color: ${risk.color}; background: ${pillBg}; border: 1px solid ${pillBorder};">${pillLabel}</span>
            </div>
            <div class="kloak-tile-chips">
              <span class="kloak-tile-chip">🔐 ${risk.entropyBits} bits entropy</span>
              ${uniqueChipHtml}
              ${twoFaChipHtml}
            </div>
          </div>
        </div>

        <div class="kloak-tile-pwd-bar">
          <div class="kloak-tile-pwd-left">
            <span class="kloak-tile-pwd-label">Pass</span>
            <span class="kloak-tile-pwd-val ${isRevealed ? 'revealed' : ''}" id="pwd-val-${itemId}">
              ${isRevealed ? displayPassword : maskedPassword}
            </span>
          </div>
          <div class="kloak-tile-pwd-actions">
            <button class="kloak-tile-action-btn" id="reveal-btn-${itemId}" title="${isRevealed ? 'Hide Password' : 'Show Password'}">
              ${isRevealed ? '🙈' : '👁️'}
            </button>
            <button class="kloak-tile-action-btn" id="copy-pwd-btn-${itemId}" title="Copy Password">
              <span>📋</span>
              <span class="copy-text">Pass</span>
            </button>
            <button class="kloak-tile-action-btn" id="copy-user-btn-${itemId}" title="Copy Username">
              <span>👤</span>
              <span class="copy-text">User</span>
            </button>
          </div>
        </div>
      `;

      const avatarBox = tile.querySelector('.kloak-tile-avatar') as HTMLElement;
      if (avatarBox) {
        renderFavicon(avatarBox, { item, size: 28 });
      }

      // Smooth 1-Click Filling with Visual Checkmark Feedback
      const triggerFill = (e: Event) => {
        e.stopPropagation();
        const fillBtn = tile.querySelector(`#fill-btn-${itemId}`) as HTMLElement;
        const fillText = fillBtn?.querySelector('.btn-fill-text');
        if (fillBtn) {
          fillBtn.classList.add('filled-success');
          if (fillText) fillText.textContent = 'Filled!';
        }
        injectCredentials(item.username, item.password, input, item.totpSecret);
        setTimeout(() => {
          container.remove();
          activePopup = null;
        }, 220);
      };

      tile.querySelector(`#fill-btn-${itemId}`)?.addEventListener('click', triggerFill);
      tile.querySelector('.kloak-tile-info')?.addEventListener('click', triggerFill);

      tile.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          triggerFill(e);
        }
      });

      tile.querySelector(`#reveal-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        isRevealingPasswordMap[itemId] = !isRevealingPasswordMap[itemId];
        const valEl = tile.querySelector(`#pwd-val-${itemId}`) as HTMLElement;
        const btnEl = tile.querySelector(`#reveal-btn-${itemId}`) as HTMLElement;
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

      tile.querySelector(`#copy-pwd-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (displayPassword) {
          navigator.clipboard.writeText(displayPassword);
          const btn = tile.querySelector(`#copy-pwd-btn-${itemId}`) as HTMLElement;
          if (btn) {
            btn.classList.add('copied');
            const txt = btn.querySelector('.copy-text');
            if (txt) txt.textContent = 'Copied!';
            setTimeout(() => {
              btn.classList.remove('copied');
              if (txt) txt.textContent = 'Pass';
            }, 1800);
          }
          showToastNotification('📋 Password copied to clipboard!');
        }
      });

      tile.querySelector(`#copy-user-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.username) {
          navigator.clipboard.writeText(item.username);
          const btn = tile.querySelector(`#copy-user-btn-${itemId}`) as HTMLElement;
          if (btn) {
            btn.classList.add('copied');
            const txt = btn.querySelector('.copy-text');
            if (txt) txt.textContent = 'Copied!';
            setTimeout(() => {
              btn.classList.remove('copied');
              if (txt) txt.textContent = 'User';
            }, 1800);
          }
          showToastNotification('👤 Username copied to clipboard!');
        }
      });

      savedSection.appendChild(tile);
    });

    bodyContainer.appendChild(savedSection);
  }

  if (isSignup) {
    const banner = document.createElement('div');
    banner.className = 'kloak-notice-badge';
    banner.innerHTML = `<span>✨ Create Account Detected</span> • Fill password`;
    bodyContainer.appendChild(banner);
  }

  // 3. MIDDLE ITEM: Password Generator Button (Opens Extension Generator Tab)
  const genSection = document.createElement('div');
  genSection.className = 'kloak-gen-btn-box';

  const genTitle = items.length === 0 ? 'Generate Strong Password' : (isSignup ? 'New Account Password' : 'Password Generator');

  genSection.innerHTML = `
    <button class="kloak-btn-generator" id="kloak-btn-open-gen" title="Open Password Generator tab in Kloak Extension">
      <div class="kloak-gen-btn-left">
        <span class="kloak-gen-key-icon">⚡</span>
        <div class="kloak-gen-btn-texts">
          <div class="kloak-gen-btn-title">${genTitle}</div>
          <div class="kloak-gen-btn-sub">Open Generator in Kloak App</div>
        </div>
      </div>
      <span class="kloak-gen-btn-arrow">↗</span>
    </button>
  `;

  bodyContainer.appendChild(genSection);

  genSection.querySelector('#kloak-btn-open-gen')?.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      chrome.runtime.sendMessage({
        type: 'OPEN_EXTENSION_GENERATOR',
        domain: window.location.hostname
      });
    } catch {}
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
        <span>🧠 AI Security Inspector</span>
      </div>
      <span class="kloak-ai-status-badge" id="kloak-ai-badge">Analyzing...</span>
    </button>
    <div class="kloak-ai-drawer" id="kloak-ai-drawer" style="display: ${isAiDrawerExpanded ? 'flex' : 'none'};">
      <div class="kloak-ai-summary-card" id="kloak-ai-summary">
        Fetching TLS certificate and domain owner records...
      </div>
      <div class="kloak-ai-grid" id="kloak-ai-grid" style="display: none;">
        <div class="kloak-ai-metric-card">
          <span class="kloak-ai-metric-label">🔒 Certificate</span>
          <span class="kloak-ai-metric-value" id="kloak-ai-cert-val">-</span>
        </div>
        <div class="kloak-ai-metric-card">
          <span class="kloak-ai-metric-label">🏢 Domain</span>
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
      const ageStr = evalData.domainIntel.domainAgeYears ? `${evalData.domainIntel.domainAgeYears} yrs` : `${evalData.domainIntel.domainAgeDays}d`;
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
          <div class="kloak-alias-sub">Masks real email • Auto-forwards to inbox</div>
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

// ── Rock-Solid Direct Focus Event Listeners (NO JITTERING) ──
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
        <svg viewBox="0 0 24 24" width="11" height="11" fill="#6D4AFF">
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
      const iconSize = 18;
      const top = rect.top + (rect.height - iconSize) / 2;
      const left = rect.right - iconSize - 5;
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
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: linear-gradient(135deg, rgba(24, 16, 16, 0.96), rgba(38, 20, 20, 0.96));
    border: 1px solid rgba(239, 68, 68, 0.6);
    backdrop-filter: blur(16px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.25);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #f3f4f6;
    max-width: 90vw;
    width: auto;
  `;

  const domainDisplay = analysis?.targetDomain || aiEvaluation?.domain || window.location.hostname;
  const riskScore = aiEvaluation?.riskScore || analysis?.riskScore || 65;
  const certDetail = aiEvaluation?.certificate ? `Cert: ${aiEvaluation.certificate.issuerOrg}` : '';
  const domainAge = aiEvaluation?.domainIntel ? `Age: ${aiEvaluation.domainIntel.domainAgeDays}d` : '';
  const reasonSummary = aiEvaluation?.aiSummary || analysis?.reasons?.[0] || 'Potential phishing or unverified login form';

  banner.innerHTML = `
    <div style="font-size: 20px; line-height: 1;">⚠️</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <div style="font-size: 12px; font-weight: 700; color: #fca5a5; display: flex; align-items: center; gap: 6px;">
        Kloak AI Threat Shield (${domainDisplay})
        <span style="font-size: 9px; background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 5px; border-radius: 99px; color: #f87171;">Risk: ${riskScore}%</span>
        ${certDetail ? `<span style="font-size: 9px; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 4px; color: #d1d5db;">${certDetail}</span>` : ''}
        ${domainAge ? `<span style="font-size: 9px; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 4px; color: #d1d5db;">${domainAge}</span>` : ''}
      </div>
      <div style="font-size: 10px; color: #d1d5db;">
        ${reasonSummary}
      </div>
    </div>
    <button id="kloak-btn-protect" style="
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
    ">🛡️ Masked Alias</button>
    <button id="kloak-threat-close" style="
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 14px;
      cursor: pointer;
      padding: 3px;
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

// ── Auto Password Save Bar Styles ──
const SAVE_BAR_STYLES = `
  .kloak-save-bar {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(60px);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: linear-gradient(135deg, rgba(17, 15, 28, 0.97), rgba(22, 18, 36, 0.97));
    border: 1px solid rgba(109, 74, 255, 0.5);
    border-radius: 12px;
    box-shadow: 0 16px 44px rgba(0,0,0,0.7), 0 0 24px rgba(109, 74, 255, 0.2);
    backdrop-filter: blur(16px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-width: 320px;
    max-width: 480px;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: all;
  }
  .kloak-save-bar.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  .kloak-save-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: linear-gradient(135deg, #6D4AFF, #4D35CC);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .kloak-save-icon svg {
    width: 15px;
    height: 15px;
    fill: #fff;
  }
  .kloak-save-text {
    flex: 1;
    min-width: 0;
  }
  .kloak-save-title {
    font-size: 12px;
    font-weight: 700;
    color: #f5f4fb;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-save-subtitle {
    font-size: 10px;
    color: #9E9AA8;
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-save-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .kloak-save-btn {
    border: none;
    border-radius: 7px;
    padding: 5px 11px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kloak-save-btn.primary {
    background: linear-gradient(135deg, #6D4AFF, #5038DD);
    color: #fff;
    box-shadow: 0 2px 8px rgba(109, 74, 255, 0.4);
  }
  .kloak-save-btn.primary:hover {
    background: linear-gradient(135deg, #7D5AFF, #6048EE);
    transform: translateY(-1px);
  }
  .kloak-save-btn.secondary {
    background: rgba(255,255,255,0.07);
    color: #A09AB8;
    border: 1px solid rgba(255,255,255,0.12);
  }
  .kloak-save-btn.secondary:hover {
    background: rgba(255,255,255,0.12);
    color: #fff;
  }
  .kloak-save-btn.update {
    background: linear-gradient(135deg, #10B981, #059669);
    color: #fff;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
  }
  .kloak-save-btn.update:hover {
    background: linear-gradient(135deg, #34D399, #10B981);
    transform: translateY(-1px);
  }
  .kloak-save-dismiss {
    background: transparent;
    border: none;
    color: #9E9AA8;
    font-size: 16px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.15s ease;
    flex-shrink: 0;
  }
  .kloak-save-dismiss:hover { color: #fff; }
`;

// ── Auto Password Save Bar State ──
let activeSaveBar: HTMLElement | null = null;
let saveDismissTimer: number | null = null;

// ── Save Prompt Bar Builder ──
function showSaveBar(opts: {
  action: 'save_new' | 'update_password';
  domain: string;
  username: string;
  password: string;
  existingItem?: any;
}) {
  const root = ensureShadowRoot();

  if (activeSaveBar) {
    activeSaveBar.remove();
    activeSaveBar = null;
    if (saveDismissTimer) { clearTimeout(saveDismissTimer); saveDismissTimer = null; }
  }

  // Inject styles once
  if (!root.querySelector('#kloak-save-bar-style')) {
    const st = document.createElement('style');
    st.id = 'kloak-save-bar-style';
    st.textContent = SAVE_BAR_STYLES;
    root.appendChild(st);
  }

  const isUpdate = opts.action === 'update_password';
  const titleText = isUpdate
    ? `Update saved password?`
    : `Save login to Kloak?`;
  const subtitleText = isUpdate
    ? `${opts.domain} · ${opts.username || 'Password changed'}`
    : `${opts.domain}${opts.username ? ` · ${opts.username}` : ''}`;

  const bar = document.createElement('div');
  bar.className = 'kloak-save-bar';
  bar.innerHTML = `
    <div class="kloak-save-icon">
      <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
    </div>
    <div class="kloak-save-text">
      <div class="kloak-save-title">${titleText}</div>
      <div class="kloak-save-subtitle">${subtitleText}</div>
    </div>
    <div class="kloak-save-actions">
      <button class="kloak-save-btn ${isUpdate ? 'update' : 'primary'}" id="kloak-save-confirm">
        ${isUpdate ? '✓ Update' : '💾 Save'}
      </button>
      <button class="kloak-save-btn secondary" id="kloak-save-never">Never</button>
    </div>
    <button class="kloak-save-dismiss" id="kloak-save-dismiss" title="Dismiss">✕</button>
  `;

  root.appendChild(bar);
  activeSaveBar = bar;

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.classList.add('visible');
    });
  });

  // Auto-dismiss after 18 seconds
  saveDismissTimer = window.setTimeout(() => dismissSaveBar(), 18000);

  bar.querySelector('#kloak-save-confirm')?.addEventListener('click', () => {
    if (isUpdate && opts.existingItem) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_ITEM',
        item: { ...opts.existingItem, password: opts.password }
      }, () => {
        showToastNotification('🔑 Password updated in Kloak!');
      });
    } else {
      const hostname = opts.domain.replace(/^www\./, '');
      const newItem = {
        type: 'login',
        title: hostname.charAt(0).toUpperCase() + hostname.slice(1),
        username: opts.username,
        password: opts.password,
        urls: [window.location.href],
        notes: '',
        createdAt: new Date().toISOString()
      };
      chrome.runtime.sendMessage({ type: 'ADD_ITEM', item: newItem }, () => {
        showToastNotification('✅ Login saved to Kloak!');
      });
    }
    dismissSaveBar();
  });

  bar.querySelector('#kloak-save-dismiss')?.addEventListener('click', () => dismissSaveBar());
  bar.querySelector('#kloak-save-never')?.addEventListener('click', () => {
    // Mark domain as "never save" in session storage to suppress this page
    try { sessionStorage.setItem(`kloak-never-save-${opts.domain}`, '1'); } catch {}
    dismissSaveBar();
  });
}

function dismissSaveBar() {
  if (activeSaveBar) {
    activeSaveBar.classList.remove('visible');
    const bar = activeSaveBar;
    activeSaveBar = null;
    setTimeout(() => bar.remove(), 280);
  }
  if (saveDismissTimer) { clearTimeout(saveDismissTimer); saveDismissTimer = null; }
}

// ── Form Submission Credential Capture ──
// Captures credentials when a login/signup form is submitted.

interface CapturedCredentials {
  username: string;
  password: string;
  capturedAt: number;
}

let lastCaptured: CapturedCredentials | null = null;
let lastSaveCheckUrl: string | null = null;

function captureFormCredentials(form?: HTMLFormElement | null): CapturedCredentials | null {
  // Find password field
  const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'))
    .filter(el => isVisible(el as HTMLElement)) as HTMLInputElement[];

  if (passwordFields.length === 0) return null;

  // Prefer confirm-password field if there are two, otherwise use the first
  const passwordField = passwordFields.find(f =>
    !/(confirm|repeat|verify|retype)/i.test(f.name + f.id + f.placeholder)
  ) || passwordFields[0];

  const password = passwordField.value.trim();
  if (!password || password.length < 6) return null;

  // Find username/email field
  const ctx = analyzeFormContext(passwordField);
  const usernameField = ctx.usernameFields[0] || getAllCredentialInputs().find(i => i.type !== 'password');
  const username = usernameField?.value.trim() || '';

  return { username, password, capturedAt: Date.now() };
}

function triggerSaveCheck(credentials: CapturedCredentials) {
  const url = window.location.href;
  const domain = window.location.hostname.replace(/^www\./, '');

  // Don't prompt again for same URL within 5 seconds
  if (lastSaveCheckUrl === url && Date.now() - (lastCaptured?.capturedAt || 0) < 5000) return;

  // Respect "Never save" session setting
  try {
    if (sessionStorage.getItem(`kloak-never-save-${domain}`)) return;
  } catch {}

  lastSaveCheckUrl = url;
  lastCaptured = credentials;

  chrome.runtime.sendMessage({
    type: 'CHECK_OR_PROMPT_SAVE',
    url,
    username: credentials.username,
    password: credentials.password
  }, (resp) => {
    if (!resp || resp.action === 'none') return;
    showSaveBar({
      action: resp.action,
      domain: resp.domain || domain,
      username: resp.username || credentials.username,
      password: resp.password || credentials.password,
      existingItem: resp.item
    });
  });
}

// ── Form Submit Interception ──
function attachFormSubmitListeners() {
  // 1. Listen for form submit events (covers traditional forms)
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    const creds = captureFormCredentials(form);
    if (creds) triggerSaveCheck(creds);
  }, { capture: true });

  // 2. Listen for button clicks on submit buttons (covers JS-driven forms)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const isSubmit = target.matches('button[type="submit"], input[type="submit"]') ||
      target.matches('button:not([type="button"])') ||
      target.closest('button[type="submit"], button:not([type="button"])') !== null;

    if (!isSubmit) return;

    // Delay slightly so the form values are fully populated before we read them
    setTimeout(() => {
      const creds = captureFormCredentials();
      if (creds) triggerSaveCheck(creds);
    }, 100);
  }, { capture: true });

  // 3. Listen for Enter keydown on credential fields (single-page / multi-step flows)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLInputElement;
    if (!target || target.tagName !== 'INPUT') return;
    if (!isCredentialField(target)) return;

    setTimeout(() => {
      const creds = captureFormCredentials();
      if (creds) triggerSaveCheck(creds);
    }, 150);
  }, { capture: true });

  // 4. SPA / XHR navigation: fire on URL change after form fill
  let lastKnownUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastKnownUrl) {
      lastKnownUrl = currentUrl;
      // URL changed - likely navigated after login. Check if we have recent credentials.
      if (lastCaptured && Date.now() - lastCaptured.capturedAt < 8000) {
        triggerSaveCheck(lastCaptured);
        lastCaptured = null;
      }
      // New page - reset credentials
      setTimeout(() => { lastCaptured = null; }, 1000);
    }
  }, 500);

  // Cleanup interval on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(urlCheckInterval);
    // Trigger save check on page navigation with captured credentials
    if (lastCaptured && Date.now() - lastCaptured.capturedAt < 8000) {
      triggerSaveCheck(lastCaptured);
    }
  });
}

// Start the save interceptors
attachFormSubmitListeners();

// ── Injected Credential Listener ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_CREDENTIALS') {
    injectCredentials(message.username, message.password);
    sendResponse({ success: true });
  } else if (message.type === 'INJECT_GENERATED_PASSWORD') {
    if (message.password) {
      const pwds = Array.from(document.querySelectorAll('input[type="password"]')).filter(el => isVisible(el as HTMLElement)) as HTMLInputElement[];
      if (pwds.length > 0) {
        pwds.forEach(p => setInputValue(p, message.password));
      } else if (currentTargetInput) {
        setInputValue(currentTargetInput, message.password);
      }
      showToastNotification('⚡ Generated password filled into page!');
    }
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
