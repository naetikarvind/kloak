"use strict";
(() => {
  // src/content.ts
  var shadowHost = null;
  var shadowRoot = null;
  var activePopup = null;
  var currentTargetInput = null;
  var cachedCredentialsForSite = [];
  var hasFetchedCredentials = false;
  var currentPasswordLength = 20;
  var currentGeneratedPassword = "";
  var isRevealingPasswordMap = {};
  var lastPointerPos = { x: 0, y: 0 };
  var proximityThrottleTimer = null;
  function pushActiveUrl() {
    chrome.runtime.sendMessage({
      type: "PUSH_ACTIVE_URL",
      url: window.location.href,
      tabId: -1
    });
  }
  window.addEventListener("load", pushActiveUrl);
  window.addEventListener("focus", pushActiveUrl);
  function isVisible(el) {
    return el.offsetParent !== null && el.getBoundingClientRect().height > 0 && window.getComputedStyle(el).visibility !== "hidden" && window.getComputedStyle(el).display !== "none";
  }
  function isSearchOrNonCredentialInput(input) {
    const type = (input.type || "").toLowerCase();
    const nonCredentialTypes = ["search", "number", "date", "datetime-local", "time", "file", "range", "color", "checkbox", "radio", "submit", "button", "reset", "image", "hidden"];
    if (nonCredentialTypes.includes(type)) return true;
    const role = (input.getAttribute("role") || "").toLowerCase();
    if (role === "search" || role === "searchbox") return true;
    const autocomplete = (input.autocomplete || "").toLowerCase();
    if (autocomplete === "off" && input.name === "q") return true;
    if (["postal-code", "country", "street-address", "cc-csc", "cc-exp"].includes(autocomplete)) return true;
    const nameIdPlaceholder = ((input.name || "") + " " + (input.id || "") + " " + (input.placeholder || "") + " " + (input.getAttribute("aria-label") || "")).toLowerCase();
    if (/user|login|email|pass|auth|usr|uid|uname|admission|roll|student/i.test(nameIdPlaceholder)) {
      return false;
    }
    const pattern = /search|query|find|filter|coupon|promo|discount|voucher|postal|zipcode|captcha|sms|cvv|cvc|comment|chat|quantity|amount|qty/i;
    if (pattern.test(nameIdPlaceholder)) {
      if (type !== "password") return true;
    }
    return false;
  }
  function isCredentialField(input) {
    if (!input || input.disabled || input.readOnly) return false;
    if (!isVisible(input)) return false;
    if (isSearchOrNonCredentialInput(input)) return false;
    const type = (input.type || "text").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    if (type === "password") return true;
    if (["username", "email", "current-password", "new-password"].includes(autocomplete)) return true;
    const allPasswords = Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => isVisible(el));
    if (allPasswords.length > 0) {
      const textLike = ["text", "email", "tel", ""];
      if (textLike.includes(type)) return true;
    }
    const identifierPattern = /user|email|login|account|identifier|admission|roll|uid|uname|member|student|id|usr/i;
    const nameIdPlaceholder = (input.name || "") + " " + (input.id || "") + " " + (input.placeholder || "") + " " + (input.getAttribute("aria-label") || "") + " " + (input.className || "");
    if (identifierPattern.test(nameIdPlaceholder)) {
      return true;
    }
    return false;
  }
  function getAllCredentialInputs() {
    const inputs = Array.from(document.querySelectorAll("input"));
    return inputs.filter((i) => isCredentialField(i));
  }
  function setInputValue(el, val) {
    if (!el) return;
    try {
      el.focus();
    } catch {
    }
    const lastValue = el.value;
    el.value = val;
    const tracker = el._valueTracker;
    if (tracker) {
      tracker.setValue(lastValue);
    }
    const prototypeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (prototypeSetter) {
      prototypeSetter.call(el, val);
    }
    try {
      el.dispatchEvent(new Event("focus", { bubbles: true, composed: true }));
      el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertReplacementText", data: val }));
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    } catch (e) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function injectCredentials(username, password, targetInput, totpSecret) {
    const allPasswords = Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => isVisible(el));
    const allInputs = Array.from(document.querySelectorAll("input")).filter((el) => isVisible(el));
    let userField = null;
    let passField = null;
    if (targetInput) {
      if (targetInput.type === "password") {
        passField = targetInput;
      } else {
        userField = targetInput;
      }
    }
    if (!passField) {
      if (userField) {
        const container = userField.form || userField.closest("form") || userField.closest('div[class*="login"], div[class*="auth"], div[class*="signin"], div[class*="card"], div[class*="form"], div[class*="container"]') || userField.parentElement?.parentElement || document.body;
        const passwordsInContainer = Array.from(container.querySelectorAll('input[type="password"]')).filter((el) => isVisible(el));
        if (passwordsInContainer.length > 0) {
          passField = passwordsInContainer[0];
        }
      }
      if (!passField && allPasswords.length > 0) {
        passField = allPasswords[0];
      }
    }
    if (!userField) {
      if (passField) {
        const container = passField.form || passField.closest("form") || passField.closest('div[class*="login"], div[class*="auth"], div[class*="signin"], div[class*="card"], div[class*="form"], div[class*="container"]') || passField.parentElement?.parentElement || document.body;
        const inputsInContainer = Array.from(container.querySelectorAll("input")).filter((i) => i !== passField && isCredentialField(i));
        if (inputsInContainer.length > 0) {
          userField = inputsInContainer[0];
        }
      }
      if (!userField) {
        const candidates = allInputs.filter((i) => i.type !== "password" && isCredentialField(i));
        if (candidates.length > 0) {
          userField = candidates[0];
        }
      }
    }
    let filledUsername = false;
    let filledPassword = false;
    if (username && userField) {
      setInputValue(userField, username);
      filledUsername = true;
    }
    if (password && passField) {
      setInputValue(passField, password);
      filledPassword = true;
    }
    if (targetInput) {
      if (password && !filledPassword && targetInput.type === "password") {
        setInputValue(targetInput, password);
      } else if (username && !filledUsername && targetInput.type !== "password") {
        setInputValue(targetInput, username);
      }
    }
    if (username && password) {
      showToastNotification(`\u2728 Filled username (${username}) and password!`);
    } else if (username) {
      showToastNotification(`\u{1F464} Filled username (${username})`);
    } else if (password) {
      showToastNotification(`\u{1F511} Filled password`);
    }
    handleTotpSync(totpSecret);
  }
  function handleTotpSync(totpSecret) {
    if (!totpSecret) return;
    chrome.runtime.sendMessage({ type: "GET_TOTP", secret: totpSecret }, (res) => {
      if (res && res.success && res.token) {
        try {
          navigator.clipboard.writeText(res.token);
          showToastNotification(`\u2728 Filled credentials & copied 2FA code (${res.token})!`);
        } catch {
        }
      }
    });
  }
  function ensureShadowRoot() {
    if (!shadowHost) {
      shadowHost = document.createElement("div");
      shadowHost.id = "kloak-autofill-root";
      shadowHost.style.cssText = "all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";
      document.documentElement.appendChild(shadowHost);
      shadowRoot = shadowHost.attachShadow({ mode: "open" });
    }
    return shadowRoot;
  }
  function generateRandomPassword(length = 20) {
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?";
    const charset = lower + upper + digits + symbols;
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += charset[randomBytes[i] % charset.length];
    }
    return pwd;
  }
  var POPUP_STYLES = `
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
    width: 330px;
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
    max-height: 420px;
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

  /* \u2500\u2500 Account Items \u2500\u2500 */
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
    gap: 8px;
    cursor: pointer;
  }

  .kloak-item-avatar {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: #242135;
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .kloak-item-avatar img { width: 16px; height: 16px; border-radius: 3px; }
  .kloak-item-avatar span { font-size: 11px; font-weight: 700; color: #6D4AFF; }

  .kloak-item-info {
    flex: 1;
    min-width: 0;
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
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    box-shadow: 0 2px 8px rgba(109, 74, 255, 0.35);
  }
  .kloak-btn-fill:hover { background: #7C5CFF; transform: scale(1.03); }

  /* \u2500\u2500 Password Detail Row \u2500\u2500 */
  .kloak-pwd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1C1929;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    padding: 4px 8px;
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
    font-size: 11px;
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
    gap: 3px;
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

  /* \u2500\u2500 Generator Card \u2500\u2500 */
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

  /* \u2500\u2500 Custom Alias Footer (ALWAYS PRESENT) \u2500\u2500 */
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

  /* \u2500\u2500 Toast Notification \u2500\u2500 */
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
    const existing = root.getElementById("kloak-toast-msg");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "kloak-toast-msg";
    toast.className = "kloak-toast";
    toast.textContent = text;
    root.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }
  function isRegistrationOrSignupPage() {
    const url = window.location.href.toLowerCase();
    const signupUrlPatterns = ["signup", "sign-up", "register", "registration", "create-account", "join", "new-user", "get-started", "enroll", "auth/register", "new_account", "password_reset", "reset_password"];
    if (signupUrlPatterns.some((p) => url.includes(p))) return true;
    const pageText = (document.title + " " + (document.querySelector('h1, h2, h3, h4, form, [role="form"], main, #app, #root')?.textContent || "")).toLowerCase();
    const signupTextPatterns = ["create account", "create your account", "create an account", "sign up", "signup", "register", "registration", "new to", "join today", "set up your password", "create new password", "new password"];
    if (signupTextPatterns.some((p) => pageText.includes(p))) return true;
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter((i) => isVisible(i));
    if (passwordInputs.length >= 2) return true;
    if (passwordInputs.some((p) => (p.autocomplete || "").toLowerCase() === "new-password" || (p.name || "").toLowerCase().includes("confirm") || (p.id || "").toLowerCase().includes("confirm"))) return true;
    return false;
  }
  function calculatePopupPosition(rect, estimatedHeight = 220) {
    const popupWidth = 330;
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
    const height = activePopup.offsetHeight || 220;
    const { top, left } = calculatePopupPosition(rect, height);
    activePopup.style.top = `${top}px`;
    activePopup.style.left = `${left}px`;
  }
  function buildPopupUI(items, input) {
    currentTargetInput = input;
    const root = ensureShadowRoot();
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    const container = document.createElement("div");
    container.className = "kloak-popup";
    const rect = input.getBoundingClientRect();
    const isSignup = isRegistrationOrSignupPage();
    const { top, left } = calculatePopupPosition(rect, items.length > 0 && !isSignup ? 300 : 230);
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    if (!root.querySelector("style")) {
      const styleTag = document.createElement("style");
      styleTag.textContent = POPUP_STYLES;
      root.appendChild(styleTag);
    }
    const hostname = window.location.hostname.replace(/^www\./, "");
    if (!currentGeneratedPassword) {
      currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
    }
    const header = document.createElement("div");
    header.className = "kloak-header";
    header.innerHTML = `
    <div class="kloak-brand">
      <svg class="kloak-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      <span>Kloak (${hostname})</span>
    </div>
    <button class="kloak-close-btn" id="kloak-btn-close" title="Close Popup (Esc)">\u2715</button>
  `;
    container.appendChild(header);
    header.querySelector("#kloak-btn-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      container.remove();
      activePopup = null;
    });
    const bodyContainer = document.createElement("div");
    bodyContainer.className = "kloak-body";
    if (items.length > 0 && !isSignup) {
      const savedSection = document.createElement("div");
      savedSection.className = "kloak-section";
      savedSection.innerHTML = `<div class="kloak-section-title">Saved Login${items.length > 1 ? "s" : ""}</div>`;
      items.forEach((item, idx) => {
        const card = document.createElement("div");
        card.className = "kloak-card";
        const itemId = item.id || `item-${idx}`;
        const isRevealed = !!isRevealingPasswordMap[itemId];
        const avatarLetter = (item.title || item.username || "?").charAt(0).toUpperCase();
        const domainForIcon = item.urls?.[0] ? new URL(item.urls[0]).hostname : hostname;
        const displayPassword = item.password || "";
        const maskedPassword = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
        card.innerHTML = `
        <div class="kloak-card-top">
          <div class="kloak-item-avatar">
            <img src="https://www.google.com/s2/favicons?domain=${domainForIcon}&sz=32" onerror="this.remove();">
            <span>${avatarLetter}</span>
          </div>
          <div class="kloak-item-info">
            <div class="kloak-item-username" title="${item.username || "No Username"}">${item.username || "No Username"}</div>
            <div class="kloak-item-title">${item.title || hostname} ${item.totpSecret ? '<span style="color: #10B981; font-weight: 600;">\u2022 2FA</span>' : ""}</div>
          </div>
          <button class="kloak-btn-fill" id="fill-btn-${itemId}">Fill</button>
        </div>

        <div class="kloak-pwd-row">
          <span class="kloak-pwd-label">Pass</span>
          <span class="kloak-pwd-value ${isRevealed ? "revealed" : ""}" id="pwd-val-${itemId}">
            ${isRevealed ? displayPassword : maskedPassword}
          </span>
          <div class="kloak-pwd-actions">
            <button class="kloak-mini-btn" id="reveal-btn-${itemId}" title="${isRevealed ? "Hide Password" : "Show Password"}">
              ${isRevealed ? "\u{1F648}" : "\u{1F441}\uFE0F"}
            </button>
            <button class="kloak-mini-btn" id="copy-pwd-btn-${itemId}" title="Copy Password">
              \u{1F4CB}
            </button>
            <button class="kloak-mini-btn" id="copy-user-btn-${itemId}" title="Copy Username">
              \u{1F464}
            </button>
          </div>
        </div>
      `;
        card.querySelector(`#fill-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          injectCredentials(item.username, item.password, input, item.totpSecret);
          container.remove();
          activePopup = null;
        });
        card.querySelector(".kloak-item-info")?.addEventListener("click", (e) => {
          e.stopPropagation();
          injectCredentials(item.username, item.password, input, item.totpSecret);
          container.remove();
          activePopup = null;
        });
        card.querySelector(`#reveal-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          isRevealingPasswordMap[itemId] = !isRevealingPasswordMap[itemId];
          const valEl = card.querySelector(`#pwd-val-${itemId}`);
          const btnEl = card.querySelector(`#reveal-btn-${itemId}`);
          if (isRevealingPasswordMap[itemId]) {
            valEl.textContent = displayPassword;
            valEl.classList.add("revealed");
            btnEl.textContent = "\u{1F648}";
            btnEl.title = "Hide Password";
          } else {
            valEl.textContent = maskedPassword;
            valEl.classList.remove("revealed");
            btnEl.textContent = "\u{1F441}\uFE0F";
            btnEl.title = "Show Password";
          }
        });
        card.querySelector(`#copy-pwd-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (displayPassword) {
            navigator.clipboard.writeText(displayPassword);
            showToastNotification("\u{1F4CB} Password copied to clipboard!");
          }
        });
        card.querySelector(`#copy-user-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (item.username) {
            navigator.clipboard.writeText(item.username);
            showToastNotification("\u{1F464} Username copied to clipboard!");
          }
        });
        savedSection.appendChild(card);
      });
      bodyContainer.appendChild(savedSection);
    }
    if (isSignup) {
      const banner = document.createElement("div");
      banner.className = "kloak-notice-badge";
      banner.innerHTML = `<span>\u2728 Create Account Detected</span> \u2022 Fill new password`;
      bodyContainer.appendChild(banner);
    }
    const genSection = document.createElement("div");
    genSection.className = "kloak-gen-box";
    const genTitle = items.length === 0 ? "Generate Password" : isSignup ? "New Account Password" : "Password Generator";
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
        \u{1F4CB}
      </button>
    </div>

    <div class="kloak-gen-slider-row">
      <span>10</span>
      <input type="range" id="kloak-len-slider" min="10" max="40" value="${currentPasswordLength}">
      <span>40</span>
    </div>

    <button class="kloak-btn-primary" id="kloak-btn-use-pwd">
      \u26A1 Fill Generated Password
    </button>
  `;
    bodyContainer.appendChild(genSection);
    const pwdDisplay = genSection.querySelector("#kloak-pwd-display");
    const lenNum = genSection.querySelector("#kloak-len-num");
    const slider = genSection.querySelector("#kloak-len-slider");
    genSection.querySelector("#kloak-btn-regen")?.addEventListener("click", (e) => {
      e.stopPropagation();
      currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
      if (pwdDisplay) pwdDisplay.textContent = currentGeneratedPassword;
    });
    genSection.querySelector("#kloak-btn-copy-gen")?.addEventListener("click", (e) => {
      e.stopPropagation();
      try {
        navigator.clipboard.writeText(currentGeneratedPassword);
        showToastNotification("\u{1F4CB} Generated password copied to clipboard!");
      } catch {
      }
    });
    slider?.addEventListener("input", () => {
      currentPasswordLength = parseInt(slider.value, 10);
      if (lenNum) lenNum.textContent = String(currentPasswordLength);
      currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
      if (pwdDisplay) pwdDisplay.textContent = currentGeneratedPassword;
    });
    genSection.querySelector("#kloak-btn-use-pwd")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const allPasswords = Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => isVisible(el));
      if (allPasswords.length > 0) {
        allPasswords.forEach((pField) => setInputValue(pField, currentGeneratedPassword));
      } else if (input) {
        setInputValue(input, currentGeneratedPassword);
      }
      try {
        navigator.clipboard.writeText(currentGeneratedPassword);
      } catch {
      }
      showToastNotification("\u26A1 Generated password filled into password field & copied to clipboard!");
      container.remove();
      activePopup = null;
    });
    const aliasSection = document.createElement("div");
    aliasSection.className = "kloak-alias-footer";
    aliasSection.innerHTML = `
    <button class="kloak-btn-alias" id="kloak-btn-custom-alias">
      <div class="kloak-alias-btn-left">
        <span class="kloak-alias-icon">\u{1F6E1}\uFE0F</span>
        <div class="kloak-alias-text-wrap">
          <div class="kloak-alias-title">Generate Custom Alias for ${hostname}</div>
          <div class="kloak-alias-sub">Masks your real email \u2022 Auto-forwards to inbox</div>
        </div>
      </div>
      <span class="kloak-alias-arrow">\u2192</span>
    </button>
  `;
    aliasSection.querySelector("#kloak-btn-custom-alias")?.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: "GENERATE_PROTECTED_ALIAS",
        url: window.location.href,
        domain: hostname
      }, (res) => {
        if (res && res.success) {
          const allInputs = Array.from(document.querySelectorAll("input")).filter((el) => isVisible(el));
          let targetField = null;
          if (input.type !== "password") {
            targetField = input;
          } else {
            const userCandidate = allInputs.find((i) => i.type !== "password" && isCredentialField(i));
            if (userCandidate) targetField = userCandidate;
          }
          if (targetField) {
            setInputValue(targetField, res.aliasEmail);
          }
          try {
            navigator.clipboard.writeText(res.aliasEmail);
          } catch {
          }
          showToastNotification(`\u{1F6E1}\uFE0F Created alias (${res.aliasEmail}) forwarding to ${res.forwardTo}!`);
          container.remove();
          activePopup = null;
        }
      });
    });
    bodyContainer.appendChild(aliasSection);
    container.appendChild(bodyContainer);
    root.appendChild(container);
    activePopup = container;
    const handleKeyDown = (e) => {
      if (!activePopup) {
        document.removeEventListener("keydown", handleKeyDown);
        return;
      }
      if (e.key === "Escape") {
        activePopup.remove();
        activePopup = null;
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const handleOutsideClick = (e) => {
      const target = e.target;
      if (target !== input && !shadowHost?.contains(target)) {
        if (activePopup) {
          activePopup.remove();
          activePopup = null;
        }
        document.removeEventListener("mousedown", handleOutsideClick);
      }
    };
    setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick);
    }, 100);
  }
  function triggerCredentialPopupForInput(input) {
    if (!isCredentialField(input)) return;
    currentTargetInput = input;
    chrome.runtime.sendMessage({ type: "GET_CREDENTIALS", url: window.location.href }, (response) => {
      if (response && Array.isArray(response.items)) {
        cachedCredentialsForSite = response.items;
      } else {
        cachedCredentialsForSite = [];
      }
      hasFetchedCredentials = true;
      buildPopupUI(cachedCredentialsForSite, input);
    });
  }
  function findClosestCredentialField(x, y) {
    const fields = getAllCredentialInputs();
    if (fields.length === 0) return null;
    let closest = null;
    let minDistance = Infinity;
    fields.forEach((field) => {
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
  document.addEventListener("mousemove", (e) => {
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
  document.addEventListener("focusin", (e) => {
    const target = e.target;
    if (target && target.tagName === "INPUT" && isCredentialField(target)) {
      triggerCredentialPopupForInput(target);
    }
  });
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.tagName === "INPUT" && isCredentialField(target)) {
      triggerCredentialPopupForInput(target);
    }
  });
  function updateInFieldIcons() {
    const fields = getAllCredentialInputs();
    const root = ensureShadowRoot();
    fields.forEach((field) => {
      let fieldId = field.getAttribute("data-kloak-id");
      if (!fieldId) {
        fieldId = `field-${Math.random().toString(36).substring(2, 9)}`;
        field.setAttribute("data-kloak-id", fieldId);
      }
      let iconEl = root.getElementById(`kloak-icon-${fieldId}`);
      if (!iconEl) {
        iconEl = document.createElement("div");
        iconEl.id = `kloak-icon-${fieldId}`;
        iconEl.className = "kloak-field-badge";
        iconEl.title = "Kloak: Click to autofill or generate credentials";
        iconEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="#6D4AFF">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
      `;
        iconEl.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          field.focus();
          triggerCredentialPopupForInput(field);
        });
        root.appendChild(iconEl);
      }
      const rect = field.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && isVisible(field)) {
        iconEl.style.display = "flex";
        const iconSize = 20;
        const top = rect.top + (rect.height - iconSize) / 2;
        const left = rect.right - iconSize - 6;
        iconEl.style.top = `${top}px`;
        iconEl.style.left = `${left}px`;
      } else {
        iconEl.style.display = "none";
      }
    });
  }
  window.addEventListener("scroll", () => {
    if (activePopup && currentTargetInput) {
      requestAnimationFrame(updateActivePopupPosition);
    }
    requestAnimationFrame(updateInFieldIcons);
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (activePopup && currentTargetInput) {
      requestAnimationFrame(updateActivePopupPosition);
    }
    requestAnimationFrame(updateInFieldIcons);
  }, { passive: true });
  function checkThreatShield() {
    chrome.runtime.sendMessage({ type: "CHECK_THREAT", url: window.location.href }, (res) => {
      if (res && res.analysis && res.analysis.isSuspicious) {
        showThreatBanner(res.analysis, res.connectedAccount);
      }
    });
  }
  function showThreatBanner(analysis, connectedAccount) {
    if (document.getElementById("kloak-threat-banner")) return;
    const banner = document.createElement("div");
    banner.id = "kloak-threat-banner";
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
    const reasonSummary = analysis.reasons?.[0] || "Potential phishing or unverified login form";
    banner.innerHTML = `
    <div style="font-size: 24px; line-height: 1;">\u26A0\uFE0F</div>
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
    ">\u{1F6E1}\uFE0F Protect with Masked Alias</button>
    <button id="kloak-threat-close" style="
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
    ">\u2715</button>
  `;
    document.body.appendChild(banner);
    banner.querySelector("#kloak-threat-close")?.addEventListener("click", () => {
      banner.remove();
    });
    banner.querySelector("#kloak-btn-protect")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "GENERATE_PROTECTED_ALIAS",
        url: window.location.href,
        domain: domainDisplay
      }, (res) => {
        if (res && res.success) {
          injectCredentials(res.aliasEmail, void 0, currentTargetInput || void 0);
          showToastNotification(`\u{1F6E1}\uFE0F Protected alias (${res.aliasEmail}) autofilled!`);
          banner.remove();
        }
      });
    });
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "INJECT_CREDENTIALS") {
      injectCredentials(message.username, message.password);
      sendResponse({ success: true });
    }
  });
  checkThreatShield();
  var domObserver = new MutationObserver(() => {
    updateInFieldIcons();
  });
  if (document.body) {
    domObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body) {
        domObserver.observe(document.body, { childList: true, subtree: true });
      }
    });
  }
  setTimeout(updateInFieldIcons, 300);
  setTimeout(updateInFieldIcons, 1e3);
  setInterval(updateInFieldIcons, 2500);
})();
