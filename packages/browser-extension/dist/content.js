"use strict";
// /Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/browser-extension/src/content.ts
// 1. Push Active URL on load and focus
function pushActiveUrl() {
    chrome.runtime.sendMessage({
        type: 'PUSH_ACTIVE_URL',
        url: window.location.href,
        tabId: -1 // background will use sender.tab.id
    });
}
window.addEventListener('load', pushActiveUrl);
window.addEventListener('focus', pushActiveUrl);
document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT') {
        const input = target;
        const type = input.type.toLowerCase();
        if (type === 'password' || type === 'email' || type === 'text') {
            pushActiveUrl();
        }
    }
});
// 2. Smart Form Context Analysis
function isVisible(el) {
    return el.offsetParent !== null && el.getBoundingClientRect().height > 0;
}
function scoreUsernameField(input) {
    let score = 0;
    const type = input.type.toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    if (autocomplete === 'username' || autocomplete === 'email')
        score += 100;
    if (type === 'email')
        score += 50;
    const pattern = /user|email|login|account|mail|handle/i;
    if (pattern.test(name) || pattern.test(id))
        score += 30;
    if (pattern.test(placeholder))
        score += 20;
    // Is immediately preceding a password input
    const allInputs = Array.from(document.querySelectorAll('input'));
    const idx = allInputs.indexOf(input);
    if (idx !== -1 && idx < allInputs.length - 1) {
        const nextInput = allInputs[idx + 1];
        if (nextInput.type === 'password') {
            score += 40;
        }
    }
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
    const form = focusedInput.form || null;
    const container = form || document.body;
    const allInputs = Array.from(container.querySelectorAll('input')).filter(isVisible);
    const usernameFields = allInputs
        .filter(i => {
        const type = i.type.toLowerCase();
        return type !== 'password' && type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio';
    })
        .sort((a, b) => scoreUsernameField(b) - scoreUsernameField(a));
    const passwordFields = allInputs
        .filter(i => i.type === 'password')
        .sort((a, b) => scorePasswordField(b) - scorePasswordField(a));
    const submitButtons = Array.from(container.querySelectorAll('button[type="submit"], input[type="submit"]'));
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
// 4. Smart injectCredentials
function injectCredentials(username, password, targetInput) {
    let context = null;
    if (targetInput) {
        context = analyzeFormContext(targetInput);
    }
    else {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT') {
            context = analyzeFormContext(activeElement);
        }
        else {
            const allInputs = Array.from(document.querySelectorAll('input')).filter(isVisible);
            if (allInputs.length > 0) {
                context = analyzeFormContext(allInputs[0]);
            }
        }
    }
    const setInputValue = (el, val) => {
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (descriptor && descriptor.set) {
            descriptor.set.call(el, val);
        }
        else {
            el.value = val;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    };
    if (targetInput) {
        if (targetInput.type === 'password' && password) {
            setInputValue(targetInput, password);
            return;
        }
        else if (username) {
            setInputValue(targetInput, username);
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
}
// 5. Autofill Dropdown UI & 3. Multi-step form handling
let activeDropdown = null;
let currentFocusedInput = null;
let awaitingPasswordField = false;
let pendingPassword = '';
function createDropdownUI(items, rect) {
    if (activeDropdown) {
        activeDropdown.remove();
    }
    const dropdown = document.createElement('div');
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.zIndex = '2147483647';
    dropdown.style.backgroundColor = '#fff';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '4px';
    dropdown.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.width = `${Math.max(rect.width, 200)}px`;
    dropdown.style.fontFamily = 'sans-serif';
    dropdown.style.fontSize = '14px';
    if (items.length === 0) {
        const noItems = document.createElement('div');
        noItems.textContent = `No passwords saved for ${window.location.hostname}`;
        noItems.style.padding = '8px 12px';
        noItems.style.color = '#666';
        noItems.style.fontSize = '12px';
        dropdown.appendChild(noItems);
    }
    else {
        items.sort((a, b) => (b.score || 0) - (a.score || 0));
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.style.padding = '8px 12px';
            row.style.cursor = 'pointer';
            row.style.borderBottom = '1px solid #eee';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.addEventListener('mouseenter', () => row.style.backgroundColor = '#f5f5f5');
            row.addEventListener('mouseleave', () => row.style.backgroundColor = 'transparent');
            const text = document.createElement('span');
            text.textContent = item.username || 'No Username';
            row.appendChild(text);
            if (index === 0 && item.exactMatch) {
                const icon = document.createElement('span');
                icon.textContent = '✦';
                icon.style.color = '#4CAF50';
                icon.style.marginLeft = '8px';
                row.appendChild(icon);
            }
            row.addEventListener('click', () => {
                if (!currentFocusedInput)
                    return;
                const context = analyzeFormContext(currentFocusedInput);
                if (context.isEmailFirst) {
                    injectCredentials(item.username, undefined, currentFocusedInput);
                    awaitingPasswordField = true;
                    pendingPassword = item.password;
                    const observer = new MutationObserver((mutations, obs) => {
                        const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(isVisible);
                        if (passwordInputs.length > 0) {
                            obs.disconnect();
                            awaitingPasswordField = false;
                            injectCredentials(undefined, pendingPassword, passwordInputs[0]);
                            pendingPassword = '';
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                    setTimeout(() => {
                        observer.disconnect();
                        awaitingPasswordField = false;
                        pendingPassword = '';
                    }, 5000);
                }
                else {
                    injectCredentials(item.username, item.password, currentFocusedInput);
                }
                dropdown.remove();
                activeDropdown = null;
            });
            dropdown.appendChild(row);
        });
    }
    // Add 1-Click Masked Protected Alias Option
    const generateRow = document.createElement('div');
    generateRow.style.padding = '8px 12px';
    generateRow.style.cursor = 'pointer';
    generateRow.style.backgroundColor = '#f8fafc';
    generateRow.style.borderTop = '1px solid #e2e8f0';
    generateRow.style.display = 'flex';
    generateRow.style.alignItems = 'center';
    generateRow.style.gap = '8px';
    generateRow.innerHTML = `
    <span style="font-size: 14px;">🛡️</span>
    <div style="display: flex; flex-direction: column;">
      <span style="font-weight: 600; font-size: 12px; color: #0284c7;">Generate Masked Protected Alias</span>
      <span style="font-size: 10px; color: #64748b;">Auto-forwards to your connected inbox</span>
    </div>
  `;
    generateRow.addEventListener('mouseenter', () => generateRow.style.backgroundColor = '#f1f5f9');
    generateRow.addEventListener('mouseleave', () => generateRow.style.backgroundColor = '#f8fafc');
    generateRow.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            type: 'GENERATE_PROTECTED_ALIAS',
            url: window.location.href,
            domain: window.location.hostname
        }, (res) => {
            if (res && res.success) {
                injectCredentials(res.aliasEmail, undefined, currentFocusedInput || undefined);
                showSuccessNotification(`🛡️ Protected alias (${res.aliasEmail}) autofilled! Forwarding to ${res.forwardTo}`);
                dropdown.remove();
                activeDropdown = null;
            }
        });
    });
    dropdown.appendChild(generateRow);
    document.body.appendChild(dropdown);
    activeDropdown = dropdown;
    const closeOnClickOutside = (e) => {
        if (!dropdown.contains(e.target) && e.target !== currentFocusedInput) {
            dropdown.remove();
            activeDropdown = null;
            document.removeEventListener('mousedown', closeOnClickOutside);
        }
    };
    document.addEventListener('mousedown', closeOnClickOutside);
}
function showDropdown(input) {
    currentFocusedInput = input;
    const rect = input.getBoundingClientRect();
    chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS', url: window.location.href }, (response) => {
        if (response && response.items) {
            createDropdownUI(response.items, rect);
        }
    });
}
document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT') {
        const input = target;
        const type = input.type.toLowerCase();
        if (type === 'password' || type === 'email' || type === 'text') {
            if (!awaitingPasswordField) {
                showDropdown(input);
            }
        }
    }
});
// 6. Threat Alert Banner & Protection
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
    const reasonSummary = (analysis.reasons && analysis.reasons.length > 0)
        ? analysis.reasons[0]
        : 'Potential phishing or unverified login form';
    const domainDisplay = analysis.targetDomain || window.location.hostname;
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
      gap: 5px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    ">
      🛡️ Protect with Masked Alias
    </button>
    <button id="kloak-btn-dismiss" style="
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #9ca3af;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    ">✕</button>
  `;
    document.body.appendChild(banner);
    banner.querySelector('#kloak-btn-dismiss')?.addEventListener('click', () => {
        banner.remove();
    });
    banner.querySelector('#kloak-btn-protect')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            type: 'GENERATE_PROTECTED_ALIAS',
            url: window.location.href,
            domain: domainDisplay
        }, (res) => {
            if (res && res.success) {
                injectCredentials(res.aliasEmail);
                showSuccessNotification(`🛡️ Protected alias (${res.aliasEmail}) autofilled! Forwarding to ${res.forwardTo}`);
                banner.remove();
            }
        });
    });
}
// Check Threat on load
function checkPageThreat() {
    chrome.runtime.sendMessage({
        type: 'CHECK_THREAT',
        url: window.location.href
    }, (res) => {
        if (res && res.analysis && res.analysis.isSuspicious) {
            showThreatBanner(res.analysis, res.connectedAccount);
        }
    });
}
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkPageThreat();
}
else {
    window.addEventListener('DOMContentLoaded', checkPageThreat);
}
// 7. Listen for incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INJECT_CREDENTIALS') {
        injectCredentials(message.username, message.password);
    }
    else if (message.type === 'THREAT_DETECTED') {
        showThreatBanner(message.analysis, message.connectedAccount);
    }
});
// 7. Keep existing save-password detection and prompt
function setupFormSubmissionDetector() {
    document.addEventListener('submit', (e) => {
        const form = e.target;
        const context = analyzeFormContext(form.querySelector('input') || document.createElement('input'));
        if (context.usernameFields.length > 0 && context.passwordFields.length > 0) {
            const username = context.usernameFields[0].value;
            const password = context.passwordFields[0].value;
            if (username && password) {
                showSavePasswordPrompt(username, password);
            }
        }
    });
}
function showSavePasswordPrompt(username, password) {
    chrome.runtime.sendMessage({
        type: 'SAVE_CREDENTIAL',
        username,
        password,
        url: window.location.href
    }, (res) => {
        if (res && res.success) {
            showSuccessNotification();
        }
    });
}
function showSuccessNotification(customMsg) {
    const notif = document.createElement('div');
    notif.textContent = customMsg || 'Password saved securely!';
    notif.style.position = 'fixed';
    notif.style.bottom = '20px';
    notif.style.right = '20px';
    notif.style.backgroundColor = '#10B981';
    notif.style.color = 'white';
    notif.style.padding = '12px 20px';
    notif.style.borderRadius = '8px';
    notif.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    notif.style.fontSize = '12px';
    notif.style.fontWeight = '600';
    notif.style.zIndex = '2147483647';
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3500);
}
setupFormSubmissionDetector();
// 8. Form enhancement
function scanAndEnhanceForms() {
    // Handled cleanly via focusin dropdown
}
