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
// 6. Listen for INJECT_CREDENTIALS
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INJECT_CREDENTIALS') {
        injectCredentials(message.username, message.password);
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
function showSuccessNotification() {
    const notif = document.createElement('div');
    notif.textContent = 'Password saved securely!';
    notif.style.position = 'fixed';
    notif.style.bottom = '20px';
    notif.style.right = '20px';
    notif.style.backgroundColor = '#4CAF50';
    notif.style.color = 'white';
    notif.style.padding = '12px 24px';
    notif.style.borderRadius = '4px';
    notif.style.zIndex = '2147483647';
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}
setupFormSubmissionDetector();
// 8. MutationObserver for dynamic forms
function addKloakBadge(input) {
    if (input.dataset.kloakBadge)
        return;
    input.dataset.kloakBadge = 'true';
    input.style.backgroundImage = 'url("chrome-extension://__MSG_@@extension_id__/icon.png")'; // placeholder
    input.style.backgroundRepeat = 'no-repeat';
    input.style.backgroundPosition = 'right 8px center';
    input.style.backgroundSize = '16px';
}
function scanAndEnhanceForms() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach((input) => {
        addKloakBadge(input);
    });
}
const formObserver = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mut of mutations) {
        if (mut.addedNodes.length > 0) {
            shouldScan = true;
            break;
        }
    }
    if (shouldScan) {
        scanAndEnhanceForms();
    }
});
formObserver.observe(document.body, { childList: true, subtree: true });
scanAndEnhanceForms();
