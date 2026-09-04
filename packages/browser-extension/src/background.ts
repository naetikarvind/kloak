import { analyzeUrl, generateMaskedAlias, ThreatAnalysis } from './threat-detector';

const NATIVE_HOST = 'app.kloak.native';
let cachedItems: any[] = [];
let isVaultUnlocked: boolean = false;
let connectedAccount: { provider: string; email: string; customForwardingEmail?: string } = {
  provider: 'google',
  email: 'naetik.arvind@gmail.com'
};

let lastActiveTabId: number | null = null;
let lastActiveUrl: string | null = null;

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
 * eTLD+1 extraction
 */
function getRegistrableDomain(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    const parts = host.split('.');
    if (parts.length < 2) return host;
    
    const secondToLast = parts[parts.length - 2];
    const knownShort = ['co', 'com', 'net', 'org', 'edu', 'gov', 'ac', 'ne', 'or'];
    
    if (knownShort.includes(secondToLast) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

/**
 * Strict domain matching and scoring
 */
function strictMatch(items: any[], pageUrlStr: string): any[] {
  const pageDomain = getRegistrableDomain(pageUrlStr);
  if (!pageDomain) return [];
  
  let pageHost = '';
  try {
    pageHost = new URL(pageUrlStr).hostname.toLowerCase();
    if (pageHost.startsWith('www.')) pageHost = pageHost.slice(4);
  } catch {}

  const matches = items.filter(item => {
    if (!item.urls || !Array.isArray(item.urls)) return false;
    return item.urls.some((u: string) => {
      const itemDomain = getRegistrableDomain(u);
      if (!itemDomain) return false;
      return itemDomain === pageDomain;
    });
  });

  const scoredMatches = matches.map(item => {
    let score = 0;
    
    let exactMatch = false;
    for (const u of item.urls) {
      try {
        let itemHost = new URL(u).hostname.toLowerCase();
        if (itemHost.startsWith('www.')) itemHost = itemHost.slice(4);
        if (itemHost === pageHost) {
          exactMatch = true;
          break;
        }
      } catch {}
    }

    if (exactMatch) {
      score += 100;
    } else {
      score += 80; // eTLD+1 match
    }

    if (item.favorite) score += 20;
    if (item.lastUsed) score += 10;

    return { item, score };
  });

  scoredMatches.sort((a, b) => b.score - a.score);
  return scoredMatches.map(sm => sm.item);
}

async function notifyMacOSApp(url: string) {
  try {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, {
      method: 'extension.activeUrlChanged',
      params: { url }
    });
  } catch {}
}

/**
 * Sends a JSON-RPC request to the Kloak Native Messaging Host or local daemon HTTP endpoint.
 */
async function sendNativeRequest(method: string, params: any = {}): Promise<any> {
  const req = {
    jsonrpc: '2.0',
    id: rpcIdCounter++,
    method,
    params
  };

  // 1. Try Native Messaging Host
  const nativeResult = await new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, req, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve(null);
        } else if (response.result !== undefined) {
          resolve(response.result);
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });

  if (nativeResult !== null && nativeResult !== undefined) {
    return nativeResult;
  }

  // 2. Direct HTTP Fallback to local Kloak macOS App daemon (127.0.0.1:53152)
  try {
    const res = await fetch('http://127.0.0.1:53152/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.result !== undefined) {
        return data.result;
      }
    }
  } catch {}

  return null;
}

/**
 * Refreshes vault status and items from the native host.
 */
async function refreshVaultState(): Promise<void> {
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
  if (changeInfo.status !== 'complete' || !tab.url) return;
  await updateBadgeForTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab?.url) {
    await updateBadgeForTab(tab.id!, tab.url);
  }
});

async function updateBadgeForTab(tabId: number, urlStr: string) {
  try {
    const url = new URL(urlStr);
    if (!url.protocol.startsWith('http')) {
      await chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    // 1. Check Threat Shield
    const threat = analyzeUrl(urlStr);
    if (threat.isSuspicious) {
      await chrome.action.setBadgeText({ tabId, text: '⚠️' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#E53935' });
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'THREAT_DETECTED',
          analysis: threat,
          connectedAccount
        });
      } catch {}
      return;
    }

    let matches: any[] = [];
    const nativeMatches = await sendNativeRequest('vault.matchByUrl', { url: urlStr });
    if (Array.isArray(nativeMatches) && nativeMatches.length > 0) {
      matches = strictMatch(nativeMatches, urlStr);
    } 
    if (matches.length === 0) {
      // 2. Query in-memory cached/fallback items
      const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
      matches = strictMatch(pool, urlStr);
    }

    if (matches.length > 0) {
      await chrome.action.setBadgeText({ tabId, text: String(matches.length) });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b82f6' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch {
    await chrome.action.setBadgeText({ tabId, text: '' });
  }
}

// Handle messages from content script, popup, and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'CHECK_THREAT': {
        const url = message.url || (sender.tab?.url ?? '');
        const analysis = analyzeUrl(url);
        sendResponse({ success: true, analysis, connectedAccount });
        break;
      }

      case 'GENERATE_PROTECTED_ALIAS': {
        const urlStr = message.url || (sender.tab?.url ?? '');
        let targetDomain = message.domain || '';
        try {
          if (!targetDomain && urlStr) {
            targetDomain = new URL(urlStr).hostname.replace(/^www\./, '');
          }
        } catch {}
        targetDomain = targetDomain || 'untrusted-site';

        const aliasEmail = generateMaskedAlias(targetDomain);
        const forwardTo = connectedAccount.customForwardingEmail || connectedAccount.email || 'naetik.arvind@gmail.com';
        const provider = (connectedAccount.provider || 'google').toUpperCase();

        const newItem = {
          id: `alias-${Date.now()}`,
          type: 'email_alias',
          title: `Shield Alias (${targetDomain})`,
          username: aliasEmail,
          urls: urlStr ? [urlStr] : [],
          notes: `Kloak Threat Shield: Auto-generated disposable alias for ${targetDomain}. Emails automatically forward to ${forwardTo}.`,
          alias: {
            aliasEmail,
            forwardTo,
            provider: `Kloak Shield (${provider})`
          },
          tags: ['Shield', 'Protected Alias']
        };

        // Persist to native vault or local cache
        try {
          await sendNativeRequest('shield.generateProtectedAlias', { url: urlStr, domain: targetDomain });
        } catch {
          await sendNativeRequest('vault.addItem', { item: newItem });
        }

        const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
        pool.push(newItem);

        sendResponse({
          success: true,
          aliasEmail,
          forwardTo,
          provider: `Kloak Shield (${provider})`
        });
        break;
      }

      case 'GET_CONNECTED_ACCOUNT': {
        try {
          const res = await sendNativeRequest('shield.getConnectedAccount', {});
          if (res && res.email) {
            connectedAccount = {
              provider: res.provider || 'google',
              email: res.email,
              customForwardingEmail: res.customForwardingEmail
            };
          }
        } catch {}
        sendResponse({ success: true, connectedAccount });
        break;
      }

      case 'PUSH_ACTIVE_URL': {
        if (message.tabId) {
          lastActiveTabId = message.tabId;
        }
        if (message.url) {
          lastActiveUrl = message.url;
          notifyMacOSApp(message.url);
          if (sender.tab?.id) {
            updateBadgeForTab(sender.tab.id, message.url);
          }
        }
        sendResponse({ success: true });
        break;
      }

      case 'AUTOFILL_FROM_MACOS': {
        if (lastActiveTabId !== null) {
          try {
            await chrome.tabs.sendMessage(lastActiveTabId, {
              type: 'INJECT_CREDENTIALS',
              username: message.username,
              password: message.password
            });
          } catch {}
        }
        sendResponse({ success: true });
        break;
      }

      case 'GET_MATCHED_LOGINS': {
        const urlStr = message.url || sender.tab?.url || '';
        try {
          await refreshVaultState();
          if (!isVaultUnlocked) {
            sendResponse({ success: true, isUnlocked: false, items: [] });
            return;
          }

          let matches: any[] = [];
          const nativeMatches = await sendNativeRequest('vault.matchByUrl', { url: urlStr });
          if (Array.isArray(nativeMatches) && nativeMatches.length > 0) {
            matches = strictMatch(nativeMatches, urlStr);
          }
          
          if (matches.length === 0) {
            const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
            matches = strictMatch(pool, urlStr);
          }

          sendResponse({ success: true, isUnlocked: true, items: matches });
        } catch {
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
        if (Array.isArray(nativeSearch) && (nativeSearch.length > 0 || q !== '')) {
          sendResponse({ success: true, isUnlocked: true, items: nativeSearch });
          return;
        }

        const nativeItems = await sendNativeRequest('vault.getItems');
        if (Array.isArray(nativeItems) && nativeItems.length > 0) {
          cachedItems = nativeItems;
          const filtered = q
            ? nativeItems.filter(item =>
                (item.title || '').toLowerCase().includes(q) ||
                (item.username || '').toLowerCase().includes(q) ||
                (item.urls || []).some((u: string) => u.toLowerCase().includes(q))
              )
            : nativeItems;
          sendResponse({ success: true, isUnlocked: true, items: filtered });
          return;
        }

        // 2. Fallback search
        const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
        const results = pool.filter(item =>
          item.title.toLowerCase().includes(q) ||
          (item.username && item.username.toLowerCase().includes(q)) ||
          item.urls.some((u: string) => u.toLowerCase().includes(q))
        );
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
        await sendNativeRequest('vault.updateItem', { item });
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
        await sendNativeRequest('vault.addItem', { item });
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

          await refreshVaultState();
          const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;

          const matched = strictMatch(pool, urlStr);

          if (matched.length === 0) {
            sendResponse({ action: 'save_new', domain, username, password });
          } else {
            const userMatch = matched.find(m => (m.username || '').toLowerCase() === (username || '').toLowerCase());
            if (userMatch) {
              if (userMatch.password !== password) {
                sendResponse({ action: 'update_password', item: userMatch, domain, username, password });
              } else {
                sendResponse({ action: 'none' });
              }
            } else {
              sendResponse({ action: 'save_new', domain, username, password });
            }
          }
        } catch {
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
