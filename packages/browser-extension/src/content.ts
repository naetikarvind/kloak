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
let allVaultItems: any[] = [];
let hasFetchedCredentials = false;
let currentPasswordLength = 18;
let currentGeneratedPassword = '';
let isRevealingPasswordMap: { [key: string]: boolean } = {};
let cachedAiEvaluation: any = null;
let isAiDrawerExpanded = false;
let activeLockedPollTimer: any = null;

// Initial sync of all vault items for cross-referencing recovery notes
chrome.runtime.sendMessage({ type: 'SEARCH_VAULT', query: '' }, (res) => {
  if (res && Array.isArray(res.items)) {
    allVaultItems = res.items;
  }
});

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

  // 4.5 Allow explicit OTP / 2FA / Recovery Code fields before generic keyword/autocomplete exclusions
  if (isOtpInput(input) || isRecoveryCodeInput(input)) return false;

  // 5. Autocomplete hints that indicate non-credentials or search
  const autocomplete = (input.autocomplete || '').toLowerCase();
  const nonCredentialAutocompletes = [
    'off', 'postal-code', 'country', 'country-name', 'street-address',
    'address-line1', 'address-line2', 'address-level1', 'address-level2',
    'cc-name', 'cc-number', 'cc-csc', 'cc-exp', 'cc-exp-month', 'cc-exp-year',
    'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'tel', 'tel-national',
    'transaction-amount', 'transaction-currency', 'language'
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

  // 2. Explicit credential autocomplete attributes & OTP / Recovery Code inputs
  if (['username', 'email', 'current-password', 'new-password', 'one-time-code'].includes(autocomplete)) {
    return true;
  }
  if (isOtpInput(input) || isRecoveryCodeInput(input)) {
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

function isOtpInput(input?: HTMLInputElement | null): boolean {
  if (!input) return false;
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
}

function isRecoveryCodeInput(input?: HTMLInputElement | null): boolean {
  if (!input) return false;
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const placeholder = (input.placeholder || '').toLowerCase();
  const aria = (input.getAttribute('aria-label') || '').toLowerCase();
  return /(recovery|backup|emergency|rescue)/i.test(`${name} ${id} ${placeholder} ${aria}`);
}

// ── Dual-Field Universal Input Filling ──
function markRecoveryCodeUsedAndSync(recoveryItem: any, recoveryStorageKey: string | undefined, newUsed: number[]) {
  const cleanUsed = Array.from(new Set(newUsed)).sort((a, b) => a - b);
  if (recoveryStorageKey) {
    chrome.storage.local.set({ [recoveryStorageKey]: cleanUsed });
  }
  if (recoveryItem && recoveryItem.id) {
    const updatedItem = { ...recoveryItem, usedRecoveryCodes: cleanUsed };
    const idx = allVaultItems.findIndex(i => i.id === updatedItem.id);
    if (idx !== -1) allVaultItems[idx] = updatedItem;
    chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', item: updatedItem }, () => {});
  }
}

function injectCredentials(username?: string, password?: string, targetInput?: HTMLInputElement, totpSecret?: string, recoveryCodes?: string[], recoveryStorageKey?: string, usedIndices?: number[], recoveryItem?: any) {
  const activeInput = targetInput || currentTargetInput || (document.activeElement as HTMLInputElement);
  const pageContext = analyzePageContext(activeInput);
  const isTargetRecovery = isRecoveryCodeInput(activeInput) || (!isOtpInput(activeInput) && pageContext.hasRecoveryField && !pageContext.hasPasswordField && !pageContext.hasUsernameField);
  const isTargetOtp = !isTargetRecovery && (isOtpInput(activeInput) || (pageContext.hasOtpField && !pageContext.hasPasswordField && !pageContext.hasUsernameField));

  // 1. Context autofill: Recovery Code field detected
  if (isTargetRecovery && recoveryCodes && recoveryCodes.length > 0) {
    const targetRecField = (activeInput && isRecoveryCodeInput(activeInput)) ? activeInput : pageContext.recoveryInputs[0];
    if (targetRecField) {
      const used = usedIndices || [];
      const nextIdx = recoveryCodes.findIndex((_, idx) => !used.includes(idx));
      const targetIdx = nextIdx !== -1 ? nextIdx : 0;
      const codeToUse = recoveryCodes[targetIdx];
      if (codeToUse) {
        setInputValue(targetRecField, codeToUse);
        try { navigator.clipboard.writeText(codeToUse); } catch {}
        const newUsed = Array.from(new Set([...used, targetIdx])).sort((a, b) => a - b);
        markRecoveryCodeUsedAndSync(recoveryItem, recoveryStorageKey, newUsed);
        showToastNotification(`✨ Filled recovery code #${targetIdx + 1} (${codeToUse})!`);
        return;
      }
    }
  }

  // 2. Context autofill: OTP / 2FA field detected
  if (isTargetOtp && totpSecret) {
    handleTotpSync(totpSecret, activeInput);
    return;
  }

  const context = activeInput && !isTargetOtp && !isTargetRecovery ? analyzeFormContext(activeInput) : {
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

  if (!isTargetOtp && !isTargetRecovery) {
    if (!userField || !passField) {
      const allDocInputs = getAllCredentialInputs().filter(i => !isOtpInput(i) && !isRecoveryCodeInput(i));
      if (!userField) {
        userField = allDocInputs.find(i => i.type !== 'password' && isCredentialField(i)) as HTMLInputElement;
      }
      if (!passField) {
        passField = allDocInputs.find(i => i.type === 'password') as HTMLInputElement;
      }
    }

    if (activeInput && activeInput.type !== 'password' && !isOtpInput(activeInput) && !isRecoveryCodeInput(activeInput)) {
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

    if (targetInput && !isOtpInput(targetInput) && !isRecoveryCodeInput(targetInput)) {
      if (password && !filledPassword && targetInput.type === 'password') {
        setInputValue(targetInput, password);
      } else if (username && !filledUsername && targetInput.type !== 'password') {
        setInputValue(targetInput, username);
      }
    }
  }

  // Also sync / auto-fill TOTP if login form has 2FA or user has TOTP enabled
  if (totpSecret) {
    handleTotpSync(totpSecret, activeInput);
  }

  if (username && password) {
    showToastNotification(`✨ Filled username (${username}) and password!`);
  } else if (username && !isTargetOtp && !isTargetRecovery) {
    showToastNotification(`👤 Filled username (${username})`);
  } else if (password && !isTargetOtp && !isTargetRecovery) {
    showToastNotification(`🔑 Filled password`);
  }
}

// ── 2FA TOTP Auto-Copy ──
function handleTotpSync(totpSecret?: string, targetInput?: HTMLInputElement) {
  if (!totpSecret) return;
  chrome.runtime.sendMessage({ type: 'GET_TOTP', secret: totpSecret }, (res) => {
    if (res && res.success && res.token) {
      const cleanToken = res.token.replace(/\s+/g, '');
      try {
        navigator.clipboard.writeText(cleanToken);
      } catch {}

      const activeInp = targetInput || currentTargetInput || (document.activeElement as HTMLInputElement);
      const isTargetOtp = isOtpInput(activeInp);
      const pageContext = analyzePageContext(targetInput);

      if (isTargetOtp && activeInp) {
        setInputValue(activeInp, cleanToken);
        showToastNotification(`✨ Filled 2FA code (${cleanToken}) into page!`);
      } else if (pageContext.hasOtpField && pageContext.otpInputs.length > 0) {
        if (pageContext.otpInputs.length === 1) {
          setInputValue(pageContext.otpInputs[0], cleanToken);
        } else {
          pageContext.otpInputs.forEach((inp, i) => {
            if (cleanToken[i]) setInputValue(inp, cleanToken[i]);
          });
        }
        showToastNotification(`✨ Filled 2FA code (${cleanToken}) into page!`);
      } else {
        showToastNotification(`✨ Copied 2FA code (${cleanToken}) to clipboard!`);
      }
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
    max-height: 480px;
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

  /* ── Japanese Bento 2FA Authenticator & Recovery Containers ── */
  .kloak-bento-auth-container {
    background: linear-gradient(135deg, rgba(41, 201, 143, 0.08) 0%, rgba(20, 18, 30, 0.85) 100%);
    border: 1px solid rgba(41, 201, 143, 0.3);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    transition: all 0.15s ease;
    margin-top: 4px;
  }
  .kloak-bento-auth-container:hover {
    background: linear-gradient(135deg, rgba(41, 201, 143, 0.14) 0%, rgba(28, 26, 42, 0.95) 100%);
    border-color: rgba(41, 201, 143, 0.55);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.35);
  }
  .kloak-bento-auth-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .kloak-bento-auth-icon {
    width: 14px;
    height: 14px;
    fill: #29C98F;
    flex-shrink: 0;
  }
  .kloak-bento-auth-title {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #29C98F;
  }
  .kloak-bento-auth-code {
    font-family: 'SF Mono', 'Fira Code', Menlo, monospace;
    font-size: 13px;
    font-weight: 700;
    color: #FFFFFF;
    letter-spacing: 2px;
    text-shadow: 0 0 8px rgba(41, 201, 143, 0.4);
  }
  .kloak-bento-auth-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .kloak-bento-auth-countdown {
    font-family: 'SF Mono', monospace;
    font-size: 8.5px;
    font-weight: 700;
    color: #29C98F;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(41, 201, 143, 0.25);
    padding: 1.5px 5px;
    border-radius: 8px;
  }
  .kloak-bento-auth-countdown.warn {
    color: #F59E0B;
    border-color: rgba(245, 158, 11, 0.4);
  }
  .kloak-bento-auth-countdown.danger {
    color: #EF4444;
    border-color: rgba(239, 68, 68, 0.4);
  }
  .kloak-bento-auth-copy-pill {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    background: rgba(41, 201, 143, 0.2);
    border: 1px solid rgba(41, 201, 143, 0.35);
    color: #29C98F;
    padding: 2px 5px;
    border-radius: 4px;
    transition: all 0.12s;
  }
  .kloak-bento-auth-copy-pill.copied {
    background: #10B981;
    color: #FFFFFF;
  }

  /* ── Japanese Bento Recovery Codes Container ── */
  .kloak-bento-recovery-container {
    background: rgba(18, 16, 28, 0.85);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    margin-top: 4px;
  }
  .kloak-bento-recovery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 3px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .kloak-bento-recovery-title-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .kloak-bento-recovery-title {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #34D399;
  }
  .kloak-bento-recovery-badge {
    font-size: 8px;
    font-weight: 700;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34D399;
    padding: 1px 4px;
    border-radius: 6px;
  }
  .kloak-bento-recovery-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 85px;
    overflow-y: auto;
    padding-right: 2px;
  }
  .kloak-bento-recovery-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 4px;
    padding: 2px 5px;
    gap: 6px;
    transition: background 0.12s;
  }
  .kloak-bento-recovery-item:hover {
    background: rgba(0, 0, 0, 0.45);
    border-color: rgba(16, 185, 129, 0.2);
  }
  .kloak-bento-recovery-item.used {
    opacity: 0.45;
  }
  .kloak-bento-recovery-item.used .kloak-bento-recovery-code {
    text-decoration: line-through;
  }
  .kloak-bento-recovery-checkbox {
    cursor: pointer;
    accent-color: #10B981;
    width: 11px;
    height: 11px;
  }
  .kloak-bento-recovery-code {
    font-family: 'SF Mono', 'Fira Code', Menlo, monospace;
    font-size: 9.5px;
    color: #E2E8F0;
    letter-spacing: 0.8px;
    flex: 1;
    cursor: pointer;
  }
  .kloak-bento-recovery-copy {
    background: transparent;
    border: none;
    color: #94A3B8;
    cursor: pointer;
    font-size: 8.5px;
    padding: 1px 3px;
    border-radius: 2px;
  }
  .kloak-bento-recovery-copy:hover {
    color: #FFFFFF;
    background: rgba(255,255,255,0.08);
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

  /* ── Smart Unlock & Reveal Animations ── */
  @keyframes bentoRevealIn {
    0% { opacity: 0; transform: translateY(12px) scale(0.97); filter: blur(3px); }
    60% { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0px); }
    100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
  }
  @keyframes bentoUnlockPulse {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); border-color: #10B981; }
    50% { box-shadow: 0 0 18px 4px rgba(16, 185, 129, 0.4); border-color: #10B981; }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); border-color: rgba(109, 74, 255, 0.35); }
  }
  @keyframes bentoBadgeFlip {
    0% { transform: rotateX(90deg); opacity: 0; }
    100% { transform: rotateX(0deg); opacity: 1; }
  }
  .kloak-bento-reveal { animation: bentoRevealIn 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .kloak-bento-unlock-success { animation: bentoUnlockPulse 0.4s ease-out forwards; }
  .kloak-bento-badge-flip { animation: bentoBadgeFlip 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

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

function refreshBentoPopupWithAnimation(input: HTMLInputElement) {
  if (!activePopup) return;

  const lockedCard = activePopup.querySelector('.kloak-bento-card') as HTMLElement | null;
  const touchText = activePopup.querySelector('#bento-touch-text');
  if (lockedCard) {
    lockedCard.classList.add('kloak-bento-unlock-success');
    if (touchText) touchText.textContent = '✓ Unlocked!';
    lockedCard.style.borderColor = '#10B981';
    lockedCard.style.background = 'rgba(16, 185, 129, 0.12)';
  }

  chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS', url: window.location.href }, (credRes) => {
    const newItems = (credRes && Array.isArray(credRes.items)) ? credRes.items : [];
    cachedCredentialsForSite = newItems;
    chrome.runtime.sendMessage({ type: 'SEARCH_VAULT', query: '' }, (vaultRes) => {
      if (vaultRes && Array.isArray(vaultRes.items)) {
        allVaultItems = vaultRes.items;
      }
      const effectiveItems = resolveFallbackSiteItems(input, newItems);
      setTimeout(() => {
        buildPopupUI(effectiveItems, input, true, true);
        showToastNotification(`✓ Vault unlocked • ${effectiveItems.length} credential${effectiveItems.length === 1 ? '' : 's'} available`);
      }, 180);
    });
  });
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
  hasRecoveryField: boolean;
  recoveryInputs: HTMLInputElement[];
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

  // 1. Detect Recovery / Backup code inputs vs OTP / TOTP inputs
  const recoveryInputs = allInputs.filter(input => {
    const type = (input.type || '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'checkbox') return false;
    return isRecoveryCodeInput(input);
  });
  const hasRecoveryField = recoveryInputs.length > 0;

  const otpInputs = allInputs.filter(input => {
    if (recoveryInputs.includes(input)) return false;
    return isOtpInput(input);
  });
  const hasOtpField = otpInputs.length > 0;

  // 2. Detect Username and Password inputs
  const passwordInputs = allInputs.filter(i => (i.type || '').toLowerCase() === 'password');
  const usernameInputs = allInputs.filter(i => {
    const type = (i.type || '').toLowerCase();
    return type !== 'password' && type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && !isSearchOrNonCredentialInput(i) && !otpInputs.includes(i) && !recoveryInputs.includes(i);
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

  const focusedIsRecovery = isRecoveryCodeInput(focusedInput);
  const focusedIsOtp = !focusedIsRecovery && isOtpInput(focusedInput);

  let contextSummary = 'Login form ready';
  let contextTag = 'READY';
  if (focusedIsRecovery || (hasRecoveryField && !hasPasswordField && !focusedIsOtp)) {
    contextSummary = 'Recovery / backup code input detected';
    contextTag = 'RECOVERY';
  } else if (focusedIsOtp || hasOtpField || (isTwoStepPage && !hasPasswordField)) {
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
    hasRecoveryField,
    recoveryInputs,
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

// ── Lightweight Client-Side TOTP Generator ──
async function generateTOTP(base32Secret: string): Promise<string> {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanSecret = base32Secret.replace(/\s+/g, '').toUpperCase();
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of cleanSecret) {
    if (char === '=') continue;
    const charIdx = base32Chars.indexOf(char);
    if (charIdx === -1) continue;
    value = (value << 5) | charIdx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const keyBuffer = new Uint8Array(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(4, counter, false);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer));
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1_000_000;
  return code.toString().padStart(6, '0');
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
  if (isRecoveryCodeNote(noteItem)) {
    return lines.filter(l => !/^(imported from|import via|discovered from)\b/i.test(l));
  }
  return [];
}

function findAssociatedRecoveryNote(item: any, allItems: any[]): any | null {
  if (!item) return null;
  // If the item itself already has recovery codes (e.g. combined credential or recovery note)
  if (getRecoveryCodesList(item).length > 0 && (isRecoveryCodeNote(item) || (item.tags && item.tags.some((t: string) => /recovery/i.test(t))))) {
    return item;
  }
  if (!allItems || allItems.length === 0) return null;
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
  try {
    const host = window.location.hostname.replace(/^www\./, '');
    const sld = host.split('.')[0];
    if (sld && sld.length >= 3 && !brandTerms.includes(sld.toLowerCase())) {
      brandTerms.push(sld.toLowerCase());
    }
  } catch {}

  const recoveryNotes = allItems.filter(i => isRecoveryCodeNote(i));
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

// ── Japanese Bento Box Popup Builder ──
function buildPopupUI(items: any[], input: HTMLInputElement, isUnlocked: boolean = true, animateReveal: boolean = false) {
  currentTargetInput = input;
  const root = ensureShadowRoot();
  if (activePopup) {
    if (activeTotpInterval) {
      clearInterval(activeTotpInterval);
      activeTotpInterval = null;
    }
    if (activeLockedPollTimer) {
      clearInterval(activeLockedPollTimer);
      activeLockedPollTimer = null;
    }
    activePopup.remove();
    activePopup = null;
  }

  const container = document.createElement('div');
  container.className = 'kloak-popup';

  const rect = input.getBoundingClientRect();
  const isSignup = isRegistrationOrSignupPage();
  const pageContext = analyzePageContext(input);

  // Smart Sizing: compact (standard: 185px), medium (+60px with TOTP), tall (+130px more with Recovery)
  const firstItemHasTotp = items.length > 0 && Boolean(items[0]?.totpSecret);
  const firstItemRecoveryNote = items.length > 0
    ? findAssociatedRecoveryNote(items[0], allVaultItems)
    : null;
  const firstItemHasRecovery = Boolean(firstItemRecoveryNote);

  let estimatedHeight = 185;
  if (!isUnlocked) {
    estimatedHeight = 210;
  } else if (isSignup) {
    estimatedHeight = 160;
  } else if (items.length > 0) {
    if (firstItemHasRecovery) {
      estimatedHeight = 185 + 60 + 130; // Tall (+130px more, scrollable: 375px)
    } else if (firstItemHasTotp) {
      estimatedHeight = 185 + 60; // Medium (+60px: 245px)
    } else {
      estimatedHeight = 185; // Compact (standard height: 185px)
    }
  }

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
    if (activeLockedPollTimer) {
      clearInterval(activeLockedPollTimer);
      activeLockedPollTimer = null;
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
  const tagClass = !isUnlocked
    ? 'kloak-bento-context-tag'
    : ((pageContext.hasOtpField || pageContext.hasRecoveryField) ? 'kloak-bento-context-tag' : 'kloak-bento-context-tag info');
  contextBar.innerHTML = `
    <div class="kloak-bento-context-left">
      <span>${!isUnlocked ? '🔒' : '🎯'}</span>
      <span>${!isUnlocked ? 'Kloak Vault is Locked' : pageContext.contextSummary}</span>
    </div>
    <span class="${tagClass} ${animateReveal ? 'kloak-bento-badge-flip' : ''}">${!isUnlocked ? 'Locked' : pageContext.contextTag}</span>
  `;
  container.appendChild(contextBar);

  const bodyContainer = document.createElement('div');
  bodyContainer.className = `kloak-body ${animateReveal ? 'kloak-bento-reveal' : ''}`;

  // 3. Saved Login(s) Bento Tray with Stacked Horizontal Containers
  if (isUnlocked && items.length > 0 && !isSignup) {
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

      const matchedRecovery = findAssociatedRecoveryNote(item, allVaultItems);
      const recoveryCodes = matchedRecovery ? getRecoveryCodesList(matchedRecovery) : [];

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

        ${(item.username || displayPassword) ? `
        <div class="kloak-bento-inputs">
          ${item.username ? `
          <!-- Horizontal Textbox 1: Username -->
          <div class="kloak-bento-textbox" id="box-user-${itemId}">
            <span class="kloak-bento-label">USER</span>
            <span class="kloak-bento-val" title="${item.username}">${item.username}</span>
            <div class="kloak-bento-actions">
              <button class="kloak-bento-btn fill-btn" id="fill-user-btn-${itemId}" title="Fill Username Only">⚡ Fill</button>
              <button class="kloak-bento-btn" id="copy-user-btn-${itemId}" title="Copy Username">📋</button>
            </div>
          </div>
          ` : ''}

          ${displayPassword ? `
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
          ` : ''}
        </div>
        ` : ''}

        <!-- Bento Authenticator Container (When item has totpSecret) -->
        ${hasTotp ? `
          <!-- 1. Authenticator container: live TOTP code, auto-copies when clicked -->
          <div class="kloak-bento-auth-container" id="bento-auth-container-${itemId}" title="Click to copy live 2FA code">
            <div class="kloak-bento-auth-left">
              <svg class="kloak-bento-auth-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
              <div style="display: flex; flex-direction: column;">
                <span class="kloak-bento-auth-title">Authenticator</span>
                <span class="kloak-bento-auth-code" id="bento-auth-code-${itemId}">------</span>
              </div>
            </div>
            <div class="kloak-bento-auth-right">
              <span class="kloak-bento-auth-countdown" id="bento-auth-timer-${itemId}">⏳ 30s</span>
              <span class="kloak-bento-auth-copy-pill" id="bento-auth-copy-${itemId}">Copy</span>
            </div>
          </div>
        ` : (pageContext.hasOtpField && (!matchedRecovery || recoveryCodes.length === 0) ? `
          <div class="kloak-bento-textbox" id="box-totp-${itemId}">
            <span class="kloak-bento-label totp">2FA OTP</span>
            <span class="kloak-bento-val" style="color: #8C8899; font-size: 9px;">No 2FA secret saved in vault</span>
            <div class="kloak-bento-actions">
              <button class="kloak-bento-btn" id="copy-user-btn-fallback-${itemId}" title="Fill Username">👤 User</button>
            </div>
          </div>
        ` : '')}

        <!-- Bento Recovery Codes Container (When recovery codes exist) -->
        ${(matchedRecovery && recoveryCodes.length > 0) ? `
          <div class="kloak-bento-recovery-container" id="bento-recovery-container-${itemId}">
            <div class="kloak-bento-recovery-header">
              <div class="kloak-bento-recovery-title-group">
                <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: #10B981;"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                <span class="kloak-bento-recovery-title">Recovery Codes</span>
              </div>
              <span class="kloak-bento-recovery-badge" id="bento-recovery-badge-${itemId}">${recoveryCodes.length} Codes</span>
            </div>
            <div class="kloak-bento-recovery-list" id="bento-recovery-list-${itemId}">
              ${recoveryCodes.map((c, cIdx) => `
                <div class="kloak-bento-recovery-item" data-index="${cIdx}" id="rec-item-${itemId}-${cIdx}">
                  <input type="checkbox" class="kloak-bento-recovery-checkbox" data-index="${cIdx}" id="rec-check-${itemId}-${cIdx}">
                  <span class="kloak-bento-recovery-code" data-code="${c}" data-index="${cIdx}" title="Click to fill or copy">${c}</span>
                  <button class="kloak-bento-recovery-copy" data-code="${c}" data-index="${cIdx}" title="Copy Code">📋</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
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
        const recItemId = matchedRecovery ? (matchedRecovery.id || itemId) : itemId;
        const storageKey = `recovery_used_${recItemId}`;
        chrome.storage.local.get([storageKey], (res) => {
          const localUsed: number[] = res[storageKey] || [];
          const vaultUsed: number[] = (matchedRecovery && Array.isArray(matchedRecovery.usedRecoveryCodes)) ? matchedRecovery.usedRecoveryCodes : [];
          const used: number[] = Array.from(new Set([...localUsed, ...vaultUsed]));
          injectCredentials(item.username, item.password, input, item.totpSecret, recoveryCodes, storageKey, used, matchedRecovery || item);
        });
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

      // ── Event Handlers: Bento 2FA (Authenticator & Recovery Codes) ──
      if (hasTotp) {
        let currentTotpToken = '';

        const updateTotpDisplay = (token: string, secRemaining: number) => {
          currentTotpToken = token;
          const codeEl = card.querySelector(`#bento-auth-code-${itemId}`) as HTMLElement | null;
          const timerEl = card.querySelector(`#bento-auth-timer-${itemId}`) as HTMLElement | null;
          if (codeEl) {
            codeEl.textContent = token.length === 6 ? `${token.slice(0, 3)} ${token.slice(3)}` : token;
          }
          if (timerEl) {
            timerEl.textContent = `⏳ ${secRemaining}s`;
            timerEl.classList.toggle('warn', secRemaining <= 10 && secRemaining > 5);
            timerEl.classList.toggle('danger', secRemaining <= 5);
          }
        };

        const generateAndRefresh = async () => {
          const sec = 30 - Math.floor((Date.now() / 1000) % 30);
          try {
            const token = await generateTOTP(item.totpSecret);
            updateTotpDisplay(token, sec);
          } catch {
            updateTotpDisplay('------', sec);
          }
        };

        generateAndRefresh();
        activeTotpInterval = setInterval(() => {
          const sec = 30 - Math.floor((Date.now() / 1000) % 30);
          if (sec === 30 || !currentTotpToken) {
            generateAndRefresh();
          } else {
            const timerEl = card.querySelector(`#bento-auth-timer-${itemId}`) as HTMLElement | null;
            if (timerEl) {
              timerEl.textContent = `⏳ ${sec}s`;
              timerEl.classList.toggle('warn', sec <= 10 && sec > 5);
              timerEl.classList.toggle('danger', sec <= 5);
            }
          }
        }, 1000);

        // Click on Authenticator container auto-copies live TOTP code
        const authContainer = card.querySelector(`#bento-auth-container-${itemId}`) as HTMLElement | null;
        authContainer?.addEventListener('click', async (e) => {
          e.stopPropagation();
          let cleanToken = currentTotpToken.replace(/\s+/g, '');
          if (!cleanToken || cleanToken === '------') {
            cleanToken = await generateTOTP(item.totpSecret);
          }
          if (cleanToken) {
            await navigator.clipboard.writeText(cleanToken);
            const copyPill = card.querySelector(`#bento-auth-copy-${itemId}`) as HTMLElement | null;
            if (copyPill) {
              copyPill.classList.add('copied');
              copyPill.textContent = 'Copied!';
              setTimeout(() => {
                copyPill.classList.remove('copied');
                copyPill.textContent = 'Copy';
              }, 1600);
            }
            showToastNotification(`🛡️ 2FA code (${cleanToken}) copied!`);

            if (pageContext.hasOtpField && pageContext.otpInputs.length > 0) {
              if (pageContext.otpInputs.length === 1) {
                setInputValue(pageContext.otpInputs[0], cleanToken);
              } else {
                pageContext.otpInputs.forEach((inp, i) => {
                  if (cleanToken[i]) setInputValue(inp, cleanToken[i]);
                });
              }
              showToastNotification(`✨ Filled 2FA code (${cleanToken}) into page!`);
              setTimeout(() => cleanDismiss(), 250);
            }
          }
        });
      }

      // Setup Recovery Codes Container & Usage Tracking in chrome.storage.local
      if (matchedRecovery && recoveryCodes.length > 0) {
        const recItemId = matchedRecovery.id || itemId;
        const storageKey = `recovery_used_${recItemId}`;
        const recoveryContainer = card.querySelector(`#bento-recovery-container-${itemId}`) as HTMLElement | null;
        if (recoveryContainer) {
          const applyUsedState = (used: number[]) => {
            const usedSet = new Set(used);
            recoveryCodes.forEach((_, cIdx) => {
              const itemRow = recoveryContainer.querySelector(`#rec-item-${itemId}-${cIdx}`);
              const checkbox = recoveryContainer.querySelector(`#rec-check-${itemId}-${cIdx}`) as HTMLInputElement | null;
              const isUsed = usedSet.has(cIdx);
              if (checkbox) checkbox.checked = isUsed;
              itemRow?.classList.toggle('used', isUsed);
            });
            const badge = recoveryContainer.querySelector(`#bento-recovery-badge-${itemId}`);
            if (badge) {
              const validCount = recoveryCodes.filter((_, cIdx) => usedSet.has(cIdx)).length;
              const remaining = Math.max(0, recoveryCodes.length - validCount);
              badge.textContent = `${remaining}/${recoveryCodes.length} Left`;
            }
          };

          chrome.storage.local.get([storageKey], (res) => {
            const localUsed: number[] = Array.isArray(res[storageKey]) ? res[storageKey] : [];
            const vaultUsed: number[] = Array.isArray(matchedRecovery.usedRecoveryCodes) ? matchedRecovery.usedRecoveryCodes : [];
            const used: number[] = Array.from(new Set([...localUsed, ...vaultUsed])).filter(i => i >= 0 && i < recoveryCodes.length).sort((a, b) => a - b);
            applyUsedState(used);
          });

          recoveryContainer.querySelectorAll('.kloak-bento-recovery-checkbox').forEach(cb => {
            cb.addEventListener('click', (e) => {
              e.stopPropagation();
            });
            cb.addEventListener('change', (e) => {
              e.stopPropagation();
              const checkedIndices: number[] = [];
              recoveryContainer.querySelectorAll<HTMLInputElement>('.kloak-bento-recovery-checkbox').forEach(box => {
                if (box.checked) {
                  const idx = parseInt(box.dataset.index || '-1', 10);
                  if (idx >= 0) checkedIndices.push(idx);
                }
              });
              checkedIndices.sort((a, b) => a - b);
              applyUsedState(checkedIndices);
              markRecoveryCodeUsedAndSync(matchedRecovery, storageKey, checkedIndices);
            });
          });

          recoveryContainer.querySelectorAll('.kloak-bento-recovery-code, .kloak-bento-recovery-copy').forEach(el => {
            el.addEventListener('click', async (e) => {
              e.stopPropagation();
              const codeText = el.getAttribute('data-code') || el.textContent || '';
              const codeIdx = parseInt(el.getAttribute('data-index') || '-1', 10);
              const isCopyBtn = el.classList.contains('kloak-bento-recovery-copy');
              if (codeText) {
                const clean = codeText.trim();
                try { await navigator.clipboard.writeText(clean); } catch {}
                const recTargetField = (currentTargetInput && isRecoveryCodeInput(currentTargetInput) && isVisible(currentTargetInput))
                  ? currentTargetInput
                  : pageContext.recoveryInputs.find(r => isVisible(r));
                if (!isCopyBtn && recTargetField) {
                  setInputValue(recTargetField, clean);
                  if (codeIdx >= 0) {
                    const checkedIndices: number[] = [codeIdx];
                    recoveryContainer.querySelectorAll<HTMLInputElement>('.kloak-bento-recovery-checkbox').forEach(box => {
                      if (box.checked) {
                        const idx = parseInt(box.dataset.index || '-1', 10);
                        if (idx >= 0) checkedIndices.push(idx);
                      }
                    });
                    const nextUsed = Array.from(new Set(checkedIndices)).sort((a, b) => a - b);
                    applyUsedState(nextUsed);
                    markRecoveryCodeUsedAndSync(matchedRecovery, storageKey, nextUsed);
                  }
                  showToastNotification(`✨ Filled recovery code: ${clean}`);
                  setTimeout(() => cleanDismiss(), 220);
                } else {
                  showToastNotification(`📋 Copied recovery code: ${clean}`);
                }
              }
            });
          });
        }
      }

      savedSection.appendChild(card);
    });

    bodyContainer.appendChild(savedSection);
  }

  if (!isUnlocked) {
    if (activeLockedPollTimer) clearInterval(activeLockedPollTimer);
    activeLockedPollTimer = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (statusRes) => {
        if (statusRes && statusRes.isUnlocked && activePopup && currentTargetInput) {
          if (activeLockedPollTimer) {
            clearInterval(activeLockedPollTimer);
            activeLockedPollTimer = null;
          }
          refreshBentoPopupWithAnimation(currentTargetInput);
        }
      });
    }, 1200);

    const lockedCard = document.createElement('div');
    lockedCard.className = 'kloak-bento-card';
    lockedCard.style.padding = '12px 14px';
    lockedCard.style.background = 'rgba(24, 24, 34, 0.92)';
    lockedCard.style.border = '1px solid rgba(109, 74, 255, 0.35)';
    lockedCard.style.borderRadius = '10px';
    lockedCard.style.display = 'flex';
    lockedCard.style.flexDirection = 'column';
    lockedCard.style.gap = '10px';

    lockedCard.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px;">🔒</span>
          <span style="font-size: 12px; font-weight: 600; color: #FFFFFF;">Unlock to Autofill</span>
        </div>
        <span style="font-size: 9.5px; color: #A1A1AA; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">Touch ID Ready</span>
      </div>

      <button type="button" class="kloak-bento-touch-btn" id="bento-btn-touch-id" title="Touch your Mac's Touch ID sensor to unlock" style="width: 100%; height: 36px; background: linear-gradient(135deg, #6D4AFF 0%, #9333EA 100%); border: none; border-radius: 6px; color: #FFFFFF; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 10px rgba(109, 74, 255, 0.4);">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
          <path d="M2 12a10 10 0 0 1 18-6"/>
          <path d="M2 16h.01"/>
          <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
          <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
          <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
          <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
        </svg>
        <span id="bento-touch-text">Unlock with Touch ID</span>
      </button>

      <form id="bento-unlock-form" style="display: flex; gap: 6px; margin: 0; align-items: center;">
        <input type="password" id="bento-pwd-input" placeholder="Or Master Password" style="flex: 1; height: 28px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #FFFFFF; font-size: 11px; padding: 0 8px; outline: none;">
        <button type="submit" id="bento-pwd-btn" style="height: 28px; padding: 0 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; color: #FFFFFF; font-size: 11px; font-weight: 500; cursor: pointer;">Unlock</button>
      </form>
      <div id="bento-unlock-err" style="display: none; color: #F87171; font-size: 10px; line-height: 1.2;"></div>
    `;

    bodyContainer.appendChild(lockedCard);

    const touchBtn = lockedCard.querySelector('#bento-btn-touch-id') as HTMLButtonElement;
    const touchText = lockedCard.querySelector('#bento-touch-text') as HTMLElement;
    const errEl = lockedCard.querySelector('#bento-unlock-err') as HTMLElement;
    const unlockForm = lockedCard.querySelector('#bento-unlock-form') as HTMLFormElement;
    const pwdInput = lockedCard.querySelector('#bento-pwd-input') as HTMLInputElement;

    touchBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (errEl) errEl.style.display = 'none';
      if (touchText) touchText.textContent = 'Touch Sensor...';
      touchBtn.disabled = true;

      chrome.runtime.sendMessage({ type: 'UNLOCK_WITH_TOUCH_ID' }, (res) => {
        touchBtn.disabled = false;
        if (touchText) touchText.textContent = 'Unlock with Touch ID';

        if (res && res.success) {
          refreshBentoPopupWithAnimation(input);
        } else {
          if (errEl) {
            errEl.textContent = res?.error || 'Touch ID failed or was cancelled.';
            errEl.style.display = 'block';
          }
        }
      });
    });

    unlockForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pwd = pwdInput?.value || '';
      if (!pwd) return;
      if (errEl) errEl.style.display = 'none';

      chrome.runtime.sendMessage({ type: 'UNLOCK_VAULT', password: pwd }, (res) => {
        if (res && res.success) {
          refreshBentoPopupWithAnimation(input);
        } else {
          if (errEl) {
            errEl.textContent = res?.error || 'Incorrect master password.';
            errEl.style.display = 'block';
          }
        }
      });
    });
  } else {
    if (activeLockedPollTimer) {
      clearInterval(activeLockedPollTimer);
      activeLockedPollTimer = null;
    }
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
function resolveFallbackSiteItems(input: HTMLInputElement, baseItems: any[]): any[] {
  if (baseItems.length > 0) return baseItems;
  if (!isOtpInput(input) && !isRecoveryCodeInput(input)) return baseItems;
  if (!allVaultItems || allVaultItems.length === 0) return baseItems;
  const host = window.location.hostname.replace(/^www\./, '').toLowerCase();
  const sld = host.split('.')[0];
  if (!sld || sld.length < 3) return baseItems;
  return allVaultItems.filter(it => {
    const title = (it.title || '').toLowerCase();
    const has2faOrRec = Boolean(it.totpSecret) || isRecoveryCodeNote(it);
    return has2faOrRec && title.includes(sld);
  });
}

function triggerCredentialPopupForInput(input: HTMLInputElement) {
  if (!isCredentialField(input)) return;
  currentTargetInput = input;

  chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS', url: window.location.href }, (response) => {
    if (response && Array.isArray(response.items)) {
      cachedCredentialsForSite = response.items;
    } else {
      cachedCredentialsForSite = [];
    }
    const isUnlocked = response ? response.isUnlocked !== false : true;
    hasFetchedCredentials = true;

    if (allVaultItems.length === 0 && isUnlocked) {
      chrome.runtime.sendMessage({ type: 'SEARCH_VAULT', query: '' }, (vaultRes) => {
        if (vaultRes && Array.isArray(vaultRes.items)) {
          allVaultItems = vaultRes.items;
        }
        const effectiveItems = resolveFallbackSiteItems(input, cachedCredentialsForSite);
        buildPopupUI(effectiveItems, input, isUnlocked);
      });
    } else {
      const effectiveItems = resolveFallbackSiteItems(input, cachedCredentialsForSite);
      buildPopupUI(effectiveItems, input, isUnlocked);
    }
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
    injectCredentials(
      message.username,
      message.password,
      undefined,
      message.totpSecret,
      message.recoveryCodes,
      message.recoveryStorageKey,
      message.usedIndices,
      message.recoveryItem
    );
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
  } else if (message.type === 'VAULT_STATE_CHANGED') {
    if (message.isUnlocked && activePopup && currentTargetInput) {
      refreshBentoPopupWithAnimation(currentTargetInput);
    }
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
