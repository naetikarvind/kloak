"use strict";
/**
 * Kloak Browser Extension — Service Worker (MV3)
 * Native Messaging Host connector, vault IPC sync, badge manager & phishing defense.
 */
const NATIVE_HOST = 'app.kloak.native';
let cachedItems = [];
let isVaultUnlocked = false;
// Fallback demo vault items
const FALLBACK_ITEMS = [
    {
        id: 'demo-1',
        title: 'GitHub',
        username: 'alex.dev@github.com',
        password: 'ghp_KloakSecurePassword982!',
        urls: ['https://github.com', 'https://gist.github.com'],
        totpSecret: 'JBSWY3DPEHPK3PXP'
    },
    {
        id: 'demo-2',
        title: 'Google Account',
        username: 'alex.engineer@gmail.com',
        password: 'KloakGoogleEncryptedKey#99',
        urls: ['https://accounts.google.com', 'https://google.com'],
        totpSecret: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ'
    },
    {
        id: 'demo-3',
        title: 'ProtonMail',
        username: 'security@proton.me',
        password: 'Kloak-Proton-Encrypted#42',
        urls: ['https://mail.proton.me', 'https://account.proton.me'],
        totpSecret: 'JBSWY3DPEHPK3PXP'
    }
];
let rpcIdCounter = 1;
/**
 * Sends a JSON-RPC request to the Kloak Native Messaging Host or local daemon.
 */
async function sendNativeRequest(method, params = {}) {
    const req = {
        jsonrpc: '2.0',
        id: rpcIdCounter++,
        method,
        params
    };
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendNativeMessage(NATIVE_HOST, req, (response) => {
                if (chrome.runtime.lastError || !response) {
                    // Native host not responding or disconnected
                    resolve(null);
                }
                else if (response.result !== undefined) {
                    resolve(response.result);
                }
                else {
                    resolve(null);
                }
            });
        }
        catch {
            resolve(null);
        }
    });
}
/**
 * Refreshes vault status and items from the native host.
 */
async function refreshVaultState() {
    const status = await sendNativeRequest('vault.status');
    if (status && typeof status.isUnlocked === 'boolean') {
        isVaultUnlocked = status.isUnlocked;
    }
    if (isVaultUnlocked) {
        const itemsRes = await sendNativeRequest('vault.getItems');
        if (Array.isArray(itemsRes)) {
            cachedItems = itemsRes;
        }
    }
}
// Initial sync
refreshVaultState();
// Listen for tab updates to calculate matched logins for the badge
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url)
        return;
    await updateBadgeForTab(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url) {
        await updateBadgeForTab(tab.id, tab.url);
    }
});
async function updateBadgeForTab(tabId, urlStr) {
    try {
        const url = new URL(urlStr);
        if (!url.protocol.startsWith('http')) {
            await chrome.action.setBadgeText({ tabId, text: '' });
            return;
        }
        const domain = url.hostname.toLowerCase().replace('www.', '');
        // 1. Try native host query
        let matches = [];
        const nativeMatches = await sendNativeRequest('vault.matchByUrl', { url: urlStr });
        if (Array.isArray(nativeMatches) && nativeMatches.length > 0) {
            matches = nativeMatches;
        }
        else {
            // 2. Query in-memory cached/fallback items
            const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
            matches = pool.filter(item => item.urls.some((u) => {
                try {
                    return new URL(u).hostname.toLowerCase().replace('www.', '') === domain;
                }
                catch {
                    return u.toLowerCase().includes(domain);
                }
            }) || item.title.toLowerCase().includes(domain.split('.')[0]));
        }
        if (matches.length > 0) {
            await chrome.action.setBadgeText({ tabId, text: String(matches.length) });
            await chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b82f6' });
        }
        else {
            await chrome.action.setBadgeText({ tabId, text: '' });
        }
    }
    catch {
        await chrome.action.setBadgeText({ tabId, text: '' });
    }
}
// Handle messages from content script, popup, and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        switch (message.type) {
            case 'GET_MATCHED_LOGINS': {
                const urlStr = message.url || sender.tab?.url || '';
                try {
                    await refreshVaultState();
                    if (!isVaultUnlocked) {
                        sendResponse({ success: true, isUnlocked: false, items: [] });
                        return;
                    }
                    // 1. Try live native matching
                    const nativeMatches = await sendNativeRequest('vault.matchByUrl', { url: urlStr });
                    if (Array.isArray(nativeMatches) && nativeMatches.length > 0) {
                        sendResponse({ success: true, isUnlocked: true, items: nativeMatches });
                        return;
                    }
                    // 2. Fallback matching
                    const url = new URL(urlStr);
                    const domain = url.hostname.toLowerCase().replace('www.', '');
                    const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
                    const matches = pool.filter(item => item.urls.some((u) => {
                        try {
                            return new URL(u).hostname.toLowerCase().replace('www.', '') === domain;
                        }
                        catch {
                            return u.toLowerCase().includes(domain);
                        }
                    }) || item.title.toLowerCase().includes(domain.split('.')[0]));
                    sendResponse({ success: true, isUnlocked: true, items: matches });
                }
                catch {
                    sendResponse({ success: true, isUnlocked: isVaultUnlocked, items: [] });
                }
                break;
            }
            case 'SEARCH_VAULT': {
                const q = (message.query || '').toLowerCase();
                await refreshVaultState();
                if (!isVaultUnlocked) {
                    sendResponse({ success: true, isUnlocked: false, items: [] });
                    return;
                }
                // 1. Try native search
                const nativeSearch = await sendNativeRequest('vault.search', { query: q });
                if (Array.isArray(nativeSearch)) {
                    sendResponse({ success: true, isUnlocked: true, items: nativeSearch });
                    return;
                }
                // 2. Fallback search
                const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
                const results = pool.filter(item => item.title.toLowerCase().includes(q) ||
                    (item.username && item.username.toLowerCase().includes(q)) ||
                    item.urls.some((u) => u.toLowerCase().includes(q)));
                sendResponse({ success: true, isUnlocked: true, items: results });
                break;
            }
            case 'GET_STATUS': {
                await refreshVaultState();
                sendResponse({
                    success: true,
                    isUnlocked: isVaultUnlocked,
                    itemCount: cachedItems.length > 0 ? cachedItems.length : FALLBACK_ITEMS.length
                });
                break;
            }
            case 'AUTOFILL_CREDENTIALS': {
                if (sender.tab?.id) {
                    await chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'INJECT_CREDENTIALS',
                        username: message.username,
                        password: message.password
                    });
                }
                sendResponse({ success: true });
                break;
            }
            case 'UPDATE_ITEM': {
                const { item } = message;
                // 1. Send native request
                await sendNativeRequest('vault.updateItem', { item });
                // 2. Fallback in-memory update
                const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
                const index = pool.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    pool[index] = { ...pool[index], ...item };
                }
                sendResponse({ success: true });
                break;
            }
            case 'ADD_ITEM': {
                const { item } = message;
                item.id = `new-${Date.now()}`;
                // 1. Send native request
                await sendNativeRequest('vault.addItem', { item });
                // 2. Fallback in-memory update
                const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
                pool.push(item);
                sendResponse({ success: true, item });
                break;
            }
            case 'CHECK_OR_PROMPT_SAVE': {
                const { url: urlStr, username, password } = message;
                if (!urlStr || !password) {
                    sendResponse({ action: 'none' });
                    break;
                }
                try {
                    const url = new URL(urlStr);
                    const domain = url.hostname.toLowerCase().replace('www.', '');
                    const domainPrefix = domain.split('.')[0];
                    await refreshVaultState();
                    const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
                    const matched = pool.filter(item => (item.title || '').toLowerCase().includes(domainPrefix) ||
                        (item.urls || []).some((u) => {
                            try {
                                return new URL(u).hostname.toLowerCase().replace('www.', '') === domain;
                            }
                            catch {
                                return u.toLowerCase().includes(domain);
                            }
                        }));
                    if (matched.length === 0) {
                        sendResponse({ action: 'save_new', domain, username, password });
                    }
                    else {
                        const userMatch = matched.find(m => (m.username || '').toLowerCase() === (username || '').toLowerCase());
                        if (userMatch) {
                            if (userMatch.password !== password) {
                                sendResponse({ action: 'update_password', item: userMatch, domain, username, password });
                            }
                            else {
                                sendResponse({ action: 'none' });
                            }
                        }
                        else {
                            sendResponse({ action: 'save_new', domain, username, password });
                        }
                    }
                }
                catch {
                    sendResponse({ action: 'none' });
                }
                break;
            }
            case 'OPEN_SIDE_PANEL': {
                if (sender.tab?.windowId) {
                    await chrome.sidePanel.open({ windowId: sender.tab.windowId });
                }
                sendResponse({ success: true });
                break;
            }
            default:
                sendResponse({ error: 'Unknown message type' });
        }
    })();
    return true; // Keep message channel open for async response
});
