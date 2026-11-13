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

// ── Japanese Bento Box Popup Styles ──
const POPUP_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  
  /* ── Japanese Bento Box Frame ── */
  .kloak-popup {
    position: fixed;
    background: rgba(18, 16, 28, 0.96);
    border: 1px solid rgba(124, 92, 255, 0.35);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.72), 0 0 20px rgba(109, 74, 255, 0.16), inset 0 1px 0 rgba(255,255,255,0.08);
    color: #FFFFFF;
    z-index: 2147483647;
    font-size: 11.5px;
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    overflow: hidden;
    animation: kloakPop 0.14s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    width: 316px;
    transition: top 0.12s ease, left 0.12s ease;
    display: flex;
    flex-direction: column;
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

  /* ── Bento Header Compartment ── */
  .kloak-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .kloak-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9.5px;
    font-weight: 700;
    color: #9D99AA;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .kloak-brand-icon {
    width: 12px;
    height: 12px;
    fill: #7C5CFF;
  }

  .kloak-close-btn {
    background: transparent;
    border: none;
    color: #8C8899;
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
    padding: 2px 5px;
    border-radius: 4px;
    transition: all 0.14s;
  }
  .kloak-close-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.12); }

  /* ── Bento Context Awareness Bar ── */
  .kloak-bento-context-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 9px;
    font-size: 9px;
    background: rgba(109, 74, 255, 0.07);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: #B5A8FF;
  }
  .kloak-bento-context-left {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kloak-bento-context-tag {
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 700;
    text-transform: uppercase;
    background: rgba(16, 185, 129, 0.18);
    color: #34D399;
    border: 1px solid rgba(16, 185, 129, 0.35);
    flex-shrink: 0;
  }
  .kloak-bento-context-tag.info {
    background: rgba(109, 74, 255, 0.2);
    color: #A78BFA;
    border-color: rgba(109, 74, 255, 0.4);
  }

  /* ── Bento Main Body ── */
  .kloak-body {
    display: flex;
    flex-direction: column;
    padding: 7px;
    gap: 6px;
    max-height: 380px;
    overflow-y: auto;
  }

  .kloak-section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .kloak-section-title {
    font-size: 8.5px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 1px 2px 2px 2px;
  }

  .kloak-notice-badge {
    padding: 4px 8px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 5px;
    color: #34D399;
    font-size: 9.5px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ── Japanese Bento Credential Tray (Compact Compartment) ── */
  .kloak-bento-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 7px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .kloak-bento-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(109, 74, 255, 0.35);
  }

  /* Bento Top Strip: Identity + Fill All */
  .kloak-bento-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding-bottom: 2px;
  }
  .kloak-bento-id-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }
  .kloak-bento-avatar {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(255,255,255,0.06);
  }
  .kloak-bento-title {
    font-size: 11px;
    font-weight: 700;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-bento-service-tag {
    font-size: 8.5px;
    color: #8C8899;
    white-space: nowrap;
  }

  .kloak-bento-fill-all-btn {
    background: linear-gradient(135deg, #6D4AFF 0%, #7E5EFF 100%);
    color: #FFFFFF;
    border: none;
    border-radius: 5px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    transition: all 0.14s ease;
    box-shadow: 0 1px 6px rgba(109, 74, 255, 0.35);
  }
  .kloak-bento-fill-all-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(109, 74, 255, 0.55);
  }
  .kloak-bento-fill-all-btn.filled {
    background: #10B981 !important;
    box-shadow: 0 1px 6px rgba(16, 185, 129, 0.5) !important;
  }

  /* ── Stacked Horizontal Bento Textboxes ── */
  .kloak-bento-inputs {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kloak-bento-textbox {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.32);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 5px;
    padding: 3px 6px;
    gap: 5px;
    transition: all 0.14s ease;
    cursor: pointer;
  }
  .kloak-bento-textbox:hover {
    background: rgba(0, 0, 0, 0.42);
    border-color: rgba(109, 74, 255, 0.3);
  }
  .kloak-bento-textbox.highlighted {
    border-color: #10B981;
    background: rgba(16, 185, 129, 0.09);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.22);
  }

  .kloak-bento-label {
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #7A758B;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    padding: 1.5px 4px;
    flex-shrink: 0;
  }
  .kloak-bento-label.totp {
    color: #34D399;
    background: rgba(16, 185, 129, 0.18);
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .kloak-bento-val {
    flex: 1;
    font-size: 10px;
    color: #DCD9E6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .kloak-bento-val.mono {
    font-family: 'SF Mono', 'Fira Code', Menlo, monospace;
    font-size: 9.5px;
    letter-spacing: 0.5px;
  }
  .kloak-bento-val.revealed {
    color: #00D2B4;
    letter-spacing: 0;
  }
  .kloak-bento-val.totp-code {
    font-family: 'SF Mono', 'Fira Code', Menlo, monospace;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1.5px;
    color: #34D399;
  }

  .kloak-bento-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .kloak-bento-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #B2AFC2;
    cursor: pointer;
    padding: 1.5px 5px;
    border-radius: 3px;
    font-size: 8.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    transition: all 0.12s;
  }
  .kloak-bento-btn:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.18);
  }
  .kloak-bento-btn.fill-btn {
    background: rgba(16, 185, 129, 0.16);
    border-color: rgba(16, 185, 129, 0.35);
    color: #34D399;
  }
  .kloak-bento-btn.fill-btn:hover {
    background: #10B981;
    color: #FFFFFF;
  }
  .kloak-bento-btn.copied {
    color: #34D399;
    border-color: #10B981;
    background: rgba(16, 185, 129, 0.2);
  }

  .kloak-bento-timer-badge {
    font-size: 8px;
    font-weight: 700;
    color: #FBBF24;
    margin-right: 2px;
  }

  /* ── Shrunk Bottom Bento Compartments (Generator & Alias) ── */
  .kloak-bento-shelf {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }

  .kloak-bento-mini-tile {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 5px 7px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: all 0.14s ease;
    color: #D1CFDA;
    outline: none;
    font-family: inherit;
    text-align: left;
  }
  .kloak-bento-mini-tile:hover {
    background: rgba(109, 74, 255, 0.16);
    border-color: rgba(109, 74, 255, 0.4);
    color: #FFFFFF;
    transform: translateY(-1px);
  }
  .kloak-bento-mini-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .kloak-bento-mini-icon {
    font-size: 10px;
    line-height: 1;
  }
  .kloak-bento-mini-label {
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
  }
  .kloak-bento-mini-arrow {
    font-size: 9px;
    color: #7A758B;
  }

  /* ── Micro AI Status Footer ── */
  .kloak-bento-micro-ai {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 6px;
    font-size: 8.5px;
    color: #8C8899;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }
  .kloak-bento-ai-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #34D399;
    font-weight: 600;
  }
  .kloak-bento-ai-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #10B981;
    box-shadow: 0 0 4px #10B981;
  }
  .kloak-bento-ai-dot.amber { background: #F59E0B; box-shadow: 0 0 4px #F59E0B; }
  .kloak-bento-ai-dot.red { background: #EF4444; box-shadow: 0 0 4px #EF4444; }

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

// ── Webpage Input & Context Analyzer (Japanese Bento Context) ──
interface PageCredentialContext {
  hasOtpField: boolean;
  otpInputs: HTMLInputElement[];
  hasUsernameField: boolean;
  isUsernameFilled: boolean;
  usernameValue: string;
  hasPasswordField: boolean;
  isPasswordFilled: boolean;
  isTwoStepPage: boolean;
  contextSummary: string;
  contextTag: string;
}

function analyzePageContext(focusedInput?: HTMLInputElement): PageCredentialContext {
  const allInputs = Array.from(document.querySelectorAll('input')).filter(el => isVisible(el as HTMLElement)) as HTMLInputElement[];

  // 1. Detect OTP / TOTP / 2FA verification inputs
  const otpInputs = allInputs.filter(input => {
    const type = (input.type || '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'checkbox') return false;
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    const aria = (input.getAttribute('aria-label') || '').toLowerCase();

    if (autocomplete === 'one-time-code') return true;
    if (/(otp|totp|2fa|mfa|verification|security-code|two-step|auth-code)/i.test(`${name} ${id} ${placeholder} ${aria}`)) return true;
    if (input.maxLength === 6 && (input.inputMode === 'numeric' || input.pattern?.includes('[0-9]'))) return true;
    return false;
  });

  const hasOtpField = otpInputs.length > 0;

  // 2. Detect Username and Password inputs
  const passwordInputs = allInputs.filter(i => (i.type || '').toLowerCase() === 'password');
  const usernameInputs = allInputs.filter(i => {
    const type = (i.type || '').toLowerCase();
    return type !== 'password' && type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && !isSearchOrNonCredentialInput(i) && !otpInputs.includes(i);
  });

  const hasUsernameField = usernameInputs.length > 0;
  const usernameInput = usernameInputs[0];
  const isUsernameFilled = !!(usernameInput && usernameInput.value.trim().length > 0);
  const usernameValue = usernameInput ? usernameInput.value.trim() : '';

  const hasPasswordField = passwordInputs.length > 0;
  const passwordInput = passwordInputs[0];
  const isPasswordFilled = !!(passwordInput && passwordInput.value.length > 0);

  // 3. Detect Two-step / 2FA text on page
  const pageText = (document.title + ' ' + (document.querySelector('h1, h2, h3, h4, form, [role="form"], main')?.textContent || '')).toLowerCase();
  const isTwoStepPage = hasOtpField || /(two-factor|2-step|two-step|verification code|authenticator|enter the 6-digit|security code)/i.test(pageText);

  let contextSummary = 'Login form ready';
  let contextTag = 'READY';
  if (hasOtpField || (isTwoStepPage && !hasPasswordField)) {
    contextSummary = '2FA verification input detected';
    contextTag = '2FA ACTIVE';
  } else if (isUsernameFilled && !isPasswordFilled) {
    const displayUser = usernameValue.length > 14 ? usernameValue.slice(0, 12) + '…' : usernameValue;
    contextSummary = `Username detected (${displayUser})`;
    contextTag = 'MATCHED';
  } else if (isUsernameFilled && isPasswordFilled) {
    contextSummary = 'Credentials entered on page';
    contextTag = 'FILLED';
  } else if (hasPasswordField) {
    contextSummary = 'Login & Password fields ready';
    contextTag = 'AUTOFILL';
  }

  return {
    hasOtpField,
    otpInputs,
    hasUsernameField,
    isUsernameFilled,
    usernameValue,
    hasPasswordField,
    isPasswordFilled,
    isTwoStepPage,
    contextSummary,
    contextTag
  };
}

let activeTotpInterval: any = null;

// ── Solid Stable Position Calculator (Bento Proportions) ──
function calculatePopupPosition(rect: DOMRect, estimatedHeight: number = 200): { top: number; left: number } {
  const popupWidth = 316;
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
  const height = activePopup.offsetHeight || 200;
  const { top, left } = calculatePopupPosition(rect, height);
  activePopup.style.top = `${top}px`;
  activePopup.style.left = `${left}px`;
}

// ── Japanese Bento Box Popup Builder ──
function buildPopupUI(items: any[], input: HTMLInputElement) {
  currentTargetInput = input;
  const root = ensureShadowRoot();
  if (activePopup) {
    if (activeTotpInterval) {
      clearInterval(activeTotpInterval);
      activeTotpInterval = null;
    }
    activePopup.remove();
    activePopup = null;
  }

  const container = document.createElement('div');
  container.className = 'kloak-popup';

  const rect = input.getBoundingClientRect();
  const isSignup = isRegistrationOrSignupPage();
  const pageContext = analyzePageContext(input);

  const estimatedHeight = items.length > 0 && !isSignup
    ? (items[0]?.totpSecret || pageContext.hasOtpField ? 220 : 185)
    : 160;

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
  if (!currentGeneratedPassword) {
    currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
  }

  const cleanDismiss = () => {
    if (activeTotpInterval) {
      clearInterval(activeTotpInterval);
      activeTotpInterval = null;
    }
    container.remove();
    activePopup = null;
  };

  // 1. Bento Header Compartment
  const header = document.createElement('div');
  header.className = 'kloak-header';
  header.innerHTML = `
    <div class="kloak-brand">
      <svg class="kloak-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      <span>Kloak (${hostname})</span>
    </div>
    <button class="kloak-close-btn" id="kloak-btn-close" title="Close (Esc)">✕</button>
  `;
  container.appendChild(header);

  header.querySelector('#kloak-btn-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanDismiss();
  });

  // 2. Bento Context Bar (Page Aware)
  const contextBar = document.createElement('div');
  contextBar.className = 'kloak-bento-context-bar';
  const tagClass = pageContext.hasOtpField ? 'kloak-bento-context-tag' : 'kloak-bento-context-tag info';
  contextBar.innerHTML = `
    <div class="kloak-bento-context-left">
      <span>🎯</span>
      <span>${pageContext.contextSummary}</span>
    </div>
    <span class="${tagClass}">${pageContext.contextTag}</span>
  `;
  container.appendChild(contextBar);

  const bodyContainer = document.createElement('div');
  bodyContainer.className = 'kloak-body';

  // 3. Saved Login(s) Bento Tray with Stacked Horizontal Containers
  if (items.length > 0 && !isSignup) {
    const savedSection = document.createElement('div');
    savedSection.className = 'kloak-section';

    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'kloak-bento-card';
      card.tabIndex = 0;

      const itemId = item.id || `item-${idx}`;
      const isRevealed = !!isRevealingPasswordMap[itemId];
      const displayPassword = item.password || '';
      const maskedPassword = '••••••••••••';
      const hasTotp = !!item.totpSecret;

      let riskGaugeHtml = '';
      if (item.password) {
        const risk = evaluateCredentialRisk(item, items);
        riskGaugeHtml = `
          <div class="kloak-bento-risk-ring" title="${risk.label}: ${risk.score}% (${risk.entropyBits} bits entropy)" style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${renderCircumferenceSvg(risk.score, risk.color, 20, 2.2)}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="kloak-bento-card-top">
          <div class="kloak-bento-id-group">
            <div class="kloak-bento-avatar"></div>
            <span class="kloak-bento-title">${item.title || hostname}</span>
            <span class="kloak-bento-service-tag">• ${hostname}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${riskGaugeHtml}
            <button class="kloak-bento-fill-all-btn" id="fill-all-btn-${itemId}" title="1-Click Fill All Credentials">
              <span>⚡</span>
              <span class="btn-fill-text">Fill All</span>
            </button>
          </div>
        </div>

        <div class="kloak-bento-inputs">
          <!-- Horizontal Textbox 1: Username -->
          <div class="kloak-bento-textbox" id="box-user-${itemId}">
            <span class="kloak-bento-label">USER</span>
            <span class="kloak-bento-val" title="${item.username || 'No Username'}">${item.username || 'No Username'}</span>
            <div class="kloak-bento-actions">
              <button class="kloak-bento-btn fill-btn" id="fill-user-btn-${itemId}" title="Fill Username Only">⚡ Fill</button>
              <button class="kloak-bento-btn" id="copy-user-btn-${itemId}" title="Copy Username">📋</button>
            </div>
          </div>

          <!-- Horizontal Textbox 2: Password -->
          <div class="kloak-bento-textbox" id="box-pwd-${itemId}">
            <span class="kloak-bento-label">PASS</span>
            <span class="kloak-bento-val mono ${isRevealed ? 'revealed' : ''}" id="pwd-val-${itemId}">
              ${isRevealed ? displayPassword : maskedPassword}
            </span>
            <div class="kloak-bento-actions">
              <button class="kloak-bento-btn" id="reveal-btn-${itemId}" title="${isRevealed ? 'Hide Password' : 'Show Password'}">
                ${isRevealed ? '🙈' : '👁️'}
              </button>
              <button class="kloak-bento-btn fill-btn" id="fill-pwd-btn-${itemId}" title="Fill Password Only">⚡ Fill</button>
              <button class="kloak-bento-btn" id="copy-pwd-btn-${itemId}" title="Copy Password">📋</button>
            </div>
          </div>

          <!-- Horizontal Textbox 3: TOTP Code Filler (Context Aware) -->
          ${hasTotp ? `
            <div class="kloak-bento-textbox ${pageContext.hasOtpField ? 'highlighted' : ''}" id="box-totp-${itemId}">
              <span class="kloak-bento-label totp">2FA OTP</span>
              <span class="kloak-bento-val totp-code" id="totp-val-${itemId}">------</span>
              <span class="kloak-bento-timer-badge" id="totp-timer-${itemId}">⏳ 30s</span>
              <div class="kloak-bento-actions">
                <button class="kloak-bento-btn fill-btn" id="fill-totp-btn-${itemId}" title="Fill 2FA Code">⚡ Fill Code</button>
                <button class="kloak-bento-btn" id="copy-totp-btn-${itemId}" title="Copy 2FA Code">📋</button>
              </div>
            </div>
          ` : (pageContext.hasOtpField ? `
            <div class="kloak-bento-textbox" id="box-totp-${itemId}">
              <span class="kloak-bento-label totp">2FA OTP</span>
              <span class="kloak-bento-val" style="color: #8C8899; font-size: 9px;">No 2FA secret saved in vault</span>
              <div class="kloak-bento-actions">
                <button class="kloak-bento-btn" id="copy-user-btn-fallback-${itemId}" title="Fill Username">👤 User</button>
              </div>
            </div>
          ` : '')}
        </div>
      `;

      const avatarBox = card.querySelector('.kloak-bento-avatar') as HTMLElement;
      if (avatarBox) {
        renderFavicon(avatarBox, { item, size: 20 });
      }

      // ── Event Handlers: 1-Click Master Fill ──
      const triggerMasterFill = (e: Event) => {
        e.stopPropagation();
        const fillBtn = card.querySelector(`#fill-all-btn-${itemId}`) as HTMLElement;
        const fillText = fillBtn?.querySelector('.btn-fill-text');
        if (fillBtn) {
          fillBtn.classList.add('filled');
          if (fillText) fillText.textContent = 'Filled!';
        }
        injectCredentials(item.username, item.password, input, item.totpSecret);
        setTimeout(() => {
          cleanDismiss();
        }, 220);
      };

      card.querySelector(`#fill-all-btn-${itemId}`)?.addEventListener('click', triggerMasterFill);

      card.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          triggerMasterFill(e);
        }
      });

      // ── Event Handlers: Specific Username Filling & Copying ──
      card.querySelector(`#fill-user-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.username) {
          const userField = pageContext.hasUsernameField ? pageContext.usernameValue ? input : input : input;
          setInputValue(userField, item.username);
          showToastNotification(`👤 Filled username (${item.username})`);
          setTimeout(() => cleanDismiss(), 180);
        }
      });

      card.querySelector(`#copy-user-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.username) {
          navigator.clipboard.writeText(item.username);
          const btn = card.querySelector(`#copy-user-btn-${itemId}`) as HTMLElement;
          if (btn) {
            btn.classList.add('copied');
            btn.textContent = '✓';
            setTimeout(() => {
              btn.classList.remove('copied');
              btn.textContent = '📋';
            }, 1500);
          }
          showToastNotification('👤 Username copied!');
        }
      });

      // ── Event Handlers: Specific Password Filling & Copying ──
      card.querySelector(`#fill-pwd-btn-${itemId}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (displayPassword) {
          const allInputs = Array.from(document.querySelectorAll('input')).filter(el => isVisible(el as HTMLElement)) as HTMLInputElement[];
          const pwdField = allInputs.find(i => (i.type || '').toLowerCase() === 'password') || input;
          setInputValue(pwdField, displayPassword);
          showToastNotification('🔑 Filled password');
          setTimeout(() => cleanDismiss(), 180);
        }
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
          const btn = card.querySelector(`#copy-pwd-btn-${itemId}`) as HTMLElement;
          if (btn) {
            btn.classList.add('copied');
            btn.textContent = '✓';
            setTimeout(() => {
              btn.classList.remove('copied');
              btn.textContent = '📋';
            }, 1500);
          }
          showToastNotification('📋 Password copied!');
        }
      });

      // ── Event Handlers: TOTP Live Ticker & Code Filling ──
      if (hasTotp) {
        let currentTotpToken = '';

        const updateTotpDisplay = (token: string, secRemaining: number) => {
          currentTotpToken = token;
          const valEl = card.querySelector(`#totp-val-${itemId}`) as HTMLElement;
          const timerEl = card.querySelector(`#totp-timer-${itemId}`) as HTMLElement;
          if (valEl) {
            valEl.textContent = token.length === 6 ? `${token.slice(0, 3)} ${token.slice(3)}` : token;
          }
          if (timerEl) {
            timerEl.textContent = `⏳ ${secRemaining}s`;
          }
        };

        const fetchTotp = () => {
          chrome.runtime.sendMessage({ type: 'GET_TOTP', secret: item.totpSecret }, (res) => {
            if (res && res.success && res.token) {
              const sec = res.secondsRemaining ?? (30 - Math.floor((Date.now() / 1000) % 30));
              updateTotpDisplay(res.token, sec);
            }
          });
        };

        fetchTotp();
        activeTotpInterval = setInterval(() => {
          const sec = 30 - Math.floor((Date.now() / 1000) % 30);
          if (sec === 30 || !currentTotpToken) {
            fetchTotp();
          } else {
            const timerEl = card.querySelector(`#totp-timer-${itemId}`) as HTMLElement;
            if (timerEl) timerEl.textContent = `⏳ ${sec}s`;
          }
        }, 1000);

        const handleTotpFillAction = (e: Event) => {
          e.stopPropagation();
          const cleanToken = currentTotpToken.replace(/\s+/g, '');
          if (!cleanToken) return;

          if (pageContext.hasOtpField && pageContext.otpInputs.length > 0) {
            if (pageContext.otpInputs.length === 1) {
              setInputValue(pageContext.otpInputs[0], cleanToken);
            } else {
              pageContext.otpInputs.forEach((inp, idx) => {
                if (cleanToken[idx]) setInputValue(inp, cleanToken[idx]);
              });
            }
            showToastNotification(`✨ Filled 2FA code (${cleanToken}) into page!`);
            setTimeout(() => cleanDismiss(), 200);
          } else {
            navigator.clipboard.writeText(cleanToken);
            showToastNotification(`📋 2FA code (${cleanToken}) copied to clipboard!`);
          }
        };

        card.querySelector(`#fill-totp-btn-${itemId}`)?.addEventListener('click', handleTotpFillAction);

        card.querySelector(`#copy-totp-btn-${itemId}`)?.addEventListener('click', (e) => {
          e.stopPropagation();
          const cleanToken = currentTotpToken.replace(/\s+/g, '');
          if (cleanToken) {
            navigator.clipboard.writeText(cleanToken);
            const btn = card.querySelector(`#copy-totp-btn-${itemId}`) as HTMLElement;
            if (btn) {
              btn.classList.add('copied');
              btn.textContent = '✓';
              setTimeout(() => {
                btn.classList.remove('copied');
                btn.textContent = '📋';
              }, 1500);
            }
            showToastNotification(`📋 2FA code (${cleanToken}) copied!`);
          }
        });
      }

      savedSection.appendChild(card);
    });

    bodyContainer.appendChild(savedSection);
  }

  if (isSignup) {
    const banner = document.createElement('div');
    banner.className = 'kloak-notice-badge';
    banner.innerHTML = `<span>✨ Registration Form</span> • Auto-generate strong password`;
    bodyContainer.appendChild(banner);
  }

  // 4. Shrunk Bento Bottom Shelf: Small Password Generator & Alias Containers
  const shelfSection = document.createElement('div');
  shelfSection.className = 'kloak-bento-shelf';
  shelfSection.innerHTML = `
    <button class="kloak-bento-mini-tile" id="kloak-btn-open-gen" title="Generate Strong Password">
      <div class="kloak-bento-mini-left">
        <span class="kloak-bento-mini-icon">⚡</span>
        <span class="kloak-bento-mini-label">${items.length === 0 ? 'Gen Pass' : 'New Pass'}</span>
      </div>
      <span class="kloak-bento-mini-arrow">↗</span>
    </button>
    <button class="kloak-bento-mini-tile" id="kloak-btn-custom-alias" title="Create Protected Email Alias">
      <div class="kloak-bento-mini-left">
        <span class="kloak-bento-mini-icon">🥷</span>
        <span class="kloak-bento-mini-label">Mask Alias</span>
      </div>
      <span class="kloak-bento-mini-arrow">→</span>
    </button>
  `;
  bodyContainer.appendChild(shelfSection);

  shelfSection.querySelector('#kloak-btn-open-gen')?.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      chrome.runtime.sendMessage({
        type: 'OPEN_EXTENSION_GENERATOR',
        domain: window.location.hostname
      });
    } catch {}
    cleanDismiss();
  });

  shelfSection.querySelector('#kloak-btn-custom-alias')?.addEventListener('click', (e) => {
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
        showToastNotification(`🛡️ Alias (${res.aliasEmail}) autofilled & copied!`);
        cleanDismiss();
      }
    });
  });

  // 5. Micro AI Trust Footer (Ultra-Compact Single Line)
  const microAi = document.createElement('div');
  microAi.className = 'kloak-bento-micro-ai';
  microAi.innerHTML = `
    <span>Kloak Security</span>
    <div class="kloak-bento-ai-pill">
      <span class="kloak-bento-ai-dot" id="kloak-bento-ai-dot"></span>
      <span id="kloak-bento-ai-text">0% Risk • Safe</span>
    </div>
  `;
  bodyContainer.appendChild(microAi);

  const dotEl = microAi.querySelector('#kloak-bento-ai-dot') as HTMLElement;
  const textEl = microAi.querySelector('#kloak-bento-ai-text') as HTMLElement;

  if (cachedAiEvaluation) {
    if (dotEl && textEl) {
      const isSafe = cachedAiEvaluation.threatLevel === 'VERIFIED_SAFE' || cachedAiEvaluation.riskScore < 30;
      if (isSafe) {
        dotEl.className = 'kloak-bento-ai-dot';
        textEl.textContent = '0% Risk • Verified';
      } else {
        dotEl.className = 'kloak-bento-ai-dot amber';
        textEl.textContent = `${cachedAiEvaluation.riskScore}% Risk • Caution`;
      }
    }
  } else {
    chrome.runtime.sendMessage({ type: 'AI_INSPECT_WEBSITE', url: window.location.href }, (res) => {
      if (res && res.evaluation) {
        cachedAiEvaluation = res.evaluation;
        if (dotEl && textEl) {
          const isSafe = res.evaluation.threatLevel === 'VERIFIED_SAFE' || res.evaluation.riskScore < 30;
          if (isSafe) {
            dotEl.className = 'kloak-bento-ai-dot';
            textEl.textContent = '0% Risk • Verified';
          } else {
            dotEl.className = 'kloak-bento-ai-dot amber';
            textEl.textContent = `${res.evaluation.riskScore}% Risk • Caution`;
          }
        }
      }
    });
  }

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
      cleanDismiss();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // Close on click outside
  const handleOutsideClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target !== input && !shadowHost?.contains(target)) {
      cleanDismiss();
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
