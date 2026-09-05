"use strict";
(() => {
  // src/threat-detector.ts
  var HIGH_PROFILE_DOMAINS = [
    "google.com",
    "accounts.google.com",
    "apple.com",
    "icloud.com",
    "microsoft.com",
    "live.com",
    "outlook.com",
    "login.microsoftonline.com",
    "amazon.com",
    "paypal.com",
    "github.com",
    "netflix.com",
    "spotify.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "proton.me",
    "protonmail.com",
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "citi.com",
    "coinbase.com",
    "binance.com",
    "dropbox.com",
    "slack.com",
    "notion.so",
    "figma.com",
    "openai.com",
    "chatgpt.com",
    "anthropic.com",
    "discord.com"
  ];
  var HIGH_RISK_TLDS = /* @__PURE__ */ new Set([
    "tk",
    "ml",
    "ga",
    "cf",
    "gq",
    "top",
    "buzz",
    "xyz",
    "click",
    "rest",
    "cam",
    "sbs",
    "cfd",
    "fit",
    "icu",
    "work",
    "loan",
    "men",
    "stream",
    "trade",
    "bid",
    "racing",
    "date",
    "faith",
    "review",
    "zip",
    "mov"
  ]);
  var PHISHING_KEYWORDS = [
    "login-",
    "signin-",
    "secure-",
    "verify-",
    "account-update",
    "auth-",
    "wallet-connect",
    "web3-",
    "security-alert",
    "confirm-identity",
    "support-",
    "billing-update",
    "recover-password",
    "session-expired"
  ];
  function levenshtein(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const d = [];
    for (let i = 0; i <= m; i++) d[i] = [i];
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
      }
    }
    return d[m][n];
  }
  function generateMaskedAlias(domain) {
    const clean = domain.replace(/^www\./, "").split(".")[0] || "site";
    const safeSlug = clean.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "site";
    const randomHex = Math.random().toString(36).substring(2, 8);
    return `protect.${safeSlug}.${randomHex}@shield.kloak.app`;
  }
  function analyzeUrl(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return {
        isSuspicious: false,
        riskScore: 0,
        targetDomain: "",
        reasons: [],
        suggestedAction: "safe",
        suggestedAliasEmail: ""
      };
    }
    const host = url.hostname.toLowerCase();
    const cleanHost = host.replace(/^www\./, "");
    let riskScore = 0;
    const reasons = [];
    let targetedLegitDomain = cleanHost;
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    if (isIP) {
      riskScore += 45;
      reasons.push("Raw IP address used instead of verified domain");
    }
    const parts = host.split(".");
    const tld = parts[parts.length - 1];
    if (HIGH_RISK_TLDS.has(tld)) {
      riskScore += 35;
      reasons.push(`High-risk top-level domain (.${tld}) frequently used in phishing campaigns`);
    }
    const fullPath = (host + url.pathname).toLowerCase();
    for (const kw of PHISHING_KEYWORDS) {
      if (fullPath.includes(kw)) {
        riskScore += 25;
        reasons.push(`Suspicious credential harvesting keyword detected: '${kw}'`);
        break;
      }
    }
    for (const target of HIGH_PROFILE_DOMAINS) {
      const targetClean = target.replace(/^www\./, "");
      if (cleanHost === targetClean) {
        return {
          isSuspicious: false,
          riskScore: 0,
          targetDomain: targetClean,
          reasons: [],
          suggestedAction: "safe",
          suggestedAliasEmail: ""
        };
      }
      if (cleanHost.includes(targetClean) && cleanHost !== targetClean) {
        riskScore += 50;
        targetedLegitDomain = targetClean;
        reasons.push(`Potential brand impersonation of ${targetClean}`);
        break;
      }
      const dist = levenshtein(cleanHost, targetClean);
      if (dist > 0 && dist <= 2 && Math.abs(cleanHost.length - targetClean.length) <= 2) {
        riskScore += 65;
        targetedLegitDomain = targetClean;
        reasons.push(`Typosquatting detected: deceptive lookalike of official domain '${targetClean}'`);
        break;
      }
    }
    if (url.protocol === "http:" && (fullPath.includes("login") || fullPath.includes("auth") || fullPath.includes("signin"))) {
      riskScore += 40;
      reasons.push("Insecure unencrypted HTTP connection submitting credentials");
    }
    const isSuspicious = riskScore >= 40;
    const suggestedAction = isSuspicious ? "mask_email" : riskScore > 20 ? "warn" : "safe";
    const alias = isSuspicious ? generateMaskedAlias(cleanHost) : "";
    return {
      isSuspicious,
      riskScore: Math.min(100, riskScore),
      targetDomain: targetedLegitDomain,
      reasons,
      suggestedAction,
      suggestedAliasEmail: alias
    };
  }

  // src/background.ts
  var NATIVE_HOST = "app.kloak.native";
  var cachedItems = [];
  var isVaultUnlocked = false;
  var connectedAccount = {
    provider: "google",
    email: "naetik.arvind@gmail.com"
  };
  var lastActiveTabId = null;
  var lastActiveUrl = null;
  var FALLBACK_ITEMS = [
    {
      id: "demo-1",
      title: "GitHub",
      username: "alex.dev@github.com",
      password: "ghp_KloakSecurePassword982!",
      urls: ["https://github.com", "https://gist.github.com"],
      totpSecret: "JBSWY3DPEHPK3PXP"
    },
    {
      id: "demo-2",
      title: "Google Account",
      username: "alex.engineer@gmail.com",
      password: "KloakGoogleEncryptedKey#99",
      urls: ["https://accounts.google.com", "https://google.com"],
      totpSecret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"
    },
    {
      id: "demo-3",
      title: "ProtonMail",
      username: "security@proton.me",
      password: "Kloak-Proton-Encrypted#42",
      urls: ["https://mail.proton.me", "https://account.proton.me"],
      totpSecret: "JBSWY3DPEHPK3PXP"
    }
  ];
  var rpcIdCounter = 1;
  function getRegistrableDomain(urlStr) {
    try {
      const url = new URL(urlStr);
      let host = url.hostname.toLowerCase();
      if (host.startsWith("www.")) {
        host = host.slice(4);
      }
      const parts = host.split(".");
      if (parts.length < 2) return host;
      const secondToLast = parts[parts.length - 2];
      const knownShort = ["co", "com", "net", "org", "edu", "gov", "ac", "ne", "or"];
      if (knownShort.includes(secondToLast) && parts.length >= 3) {
        return parts.slice(-3).join(".");
      }
      return parts.slice(-2).join(".");
    } catch {
      return null;
    }
  }
  function strictMatch(items, pageUrlStr) {
    const pageDomain = getRegistrableDomain(pageUrlStr);
    if (!pageDomain) return [];
    let pageHost = "";
    try {
      pageHost = new URL(pageUrlStr).hostname.toLowerCase();
      if (pageHost.startsWith("www.")) pageHost = pageHost.slice(4);
    } catch {
    }
    const matches = items.filter((item) => {
      if (!item.urls || !Array.isArray(item.urls)) return false;
      return item.urls.some((u) => {
        const itemDomain = getRegistrableDomain(u);
        if (!itemDomain) return false;
        return itemDomain === pageDomain;
      });
    });
    const scoredMatches = matches.map((item) => {
      let score = 0;
      let exactMatch = false;
      for (const u of item.urls) {
        try {
          let itemHost = new URL(u).hostname.toLowerCase();
          if (itemHost.startsWith("www.")) itemHost = itemHost.slice(4);
          if (itemHost === pageHost) {
            exactMatch = true;
            break;
          }
        } catch {
        }
      }
      if (exactMatch) {
        score += 100;
      } else {
        score += 80;
      }
      if (item.favorite) score += 20;
      if (item.lastUsed) score += 10;
      return { item, score };
    });
    scoredMatches.sort((a, b) => b.score - a.score);
    return scoredMatches.map((sm) => sm.item);
  }
  async function notifyMacOSApp(url) {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, {
        method: "extension.activeUrlChanged",
        params: { url }
      });
    } catch {
    }
  }
  async function sendNativeRequest(method, params = {}) {
    const req = {
      jsonrpc: "2.0",
      id: rpcIdCounter++,
      method,
      params
    };
    const nativeResult = await new Promise((resolve) => {
      try {
        chrome.runtime.sendNativeMessage(NATIVE_HOST, req, (response) => {
          if (chrome.runtime.lastError || !response) {
            resolve(null);
          } else if (response.result !== void 0) {
            resolve(response.result);
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
    if (nativeResult !== null && nativeResult !== void 0) {
      return nativeResult;
    }
    try {
      const res = await fetch("http://127.0.0.1:53152/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result !== void 0) {
          return data.result;
        }
      }
    } catch {
    }
    return null;
  }
  async function refreshVaultState() {
    const status = await sendNativeRequest("vault.status");
    if (status && typeof status.isUnlocked === "boolean") {
      isVaultUnlocked = status.isUnlocked;
    }
    if (isVaultUnlocked) {
      const itemsRes = await sendNativeRequest("vault.getItems");
      if (Array.isArray(itemsRes)) {
        cachedItems = itemsRes;
      }
    }
  }
  refreshVaultState();
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab.url) return;
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
      if (!url.protocol.startsWith("http")) {
        await chrome.action.setBadgeText({ tabId, text: "" });
        return;
      }
      const threat = analyzeUrl(urlStr);
      if (threat.isSuspicious) {
        await chrome.action.setBadgeText({ tabId, text: "\u26A0\uFE0F" });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#E53935" });
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: "THREAT_DETECTED",
            analysis: threat,
            connectedAccount
          });
        } catch {
        }
        return;
      }
      let matches = [];
      const nativeMatches = await sendNativeRequest("vault.matchByUrl", { url: urlStr });
      if (Array.isArray(nativeMatches) && nativeMatches.length > 0) {
        matches = strictMatch(nativeMatches, urlStr);
      }
      if (matches.length === 0) {
        const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
        matches = strictMatch(pool, urlStr);
      }
      if (matches.length > 0) {
        await chrome.action.setBadgeText({ tabId, text: String(matches.length) });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#3b82f6" });
      } else {
        await chrome.action.setBadgeText({ tabId, text: "" });
      }
    } catch {
      await chrome.action.setBadgeText({ tabId, text: "" });
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      switch (message.type) {
        case "CHECK_THREAT": {
          const url = message.url || (sender.tab?.url ?? "");
          const analysis = analyzeUrl(url);
          sendResponse({ success: true, analysis, connectedAccount });
          break;
        }
        case "GENERATE_PROTECTED_ALIAS": {
          const urlStr = message.url || (sender.tab?.url ?? "");
          let targetDomain = message.domain || "";
          try {
            if (!targetDomain && urlStr) {
              targetDomain = new URL(urlStr).hostname.replace(/^www\./, "");
            }
          } catch {
          }
          targetDomain = targetDomain || "untrusted-site";
          const aliasEmail = generateMaskedAlias(targetDomain);
          const forwardTo = connectedAccount.customForwardingEmail || connectedAccount.email || "naetik.arvind@gmail.com";
          const provider = (connectedAccount.provider || "google").toUpperCase();
          const newItem = {
            id: `alias-${Date.now()}`,
            type: "email_alias",
            title: `Shield Alias (${targetDomain})`,
            username: aliasEmail,
            urls: urlStr ? [urlStr] : [],
            notes: `Kloak Threat Shield: Auto-generated disposable alias for ${targetDomain}. Emails automatically forward to ${forwardTo}.`,
            alias: {
              aliasEmail,
              forwardTo,
              provider: `Kloak Shield (${provider})`
            },
            tags: ["Shield", "Protected Alias"]
          };
          try {
            await sendNativeRequest("shield.generateProtectedAlias", { url: urlStr, domain: targetDomain });
          } catch {
            await sendNativeRequest("vault.addItem", { item: newItem });
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
        case "GET_CONNECTED_ACCOUNT": {
          try {
            const res = await sendNativeRequest("shield.getConnectedAccount", {});
            if (res && res.email) {
              connectedAccount = {
                provider: res.provider || "google",
                email: res.email,
                customForwardingEmail: res.customForwardingEmail
              };
            }
          } catch {
          }
          sendResponse({ success: true, connectedAccount });
          break;
        }
        case "PUSH_ACTIVE_URL": {
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
        case "AUTOFILL_FROM_MACOS": {
          if (lastActiveTabId !== null) {
            try {
              await chrome.tabs.sendMessage(lastActiveTabId, {
                type: "INJECT_CREDENTIALS",
                username: message.username,
                password: message.password
              });
            } catch {
            }
          }
          sendResponse({ success: true });
          break;
        }
        case "GET_CREDENTIALS":
        case "GET_MATCHED_LOGINS": {
          const urlStr = message.url || sender.tab?.url || "";
          try {
            await refreshVaultState();
            let matches = [];
            if (isVaultUnlocked) {
              const nativeMatches = await sendNativeRequest("vault.matchByUrl", { url: urlStr });
              if (Array.isArray(nativeMatches) && nativeMatches.length > 0) {
                matches = strictMatch(nativeMatches, urlStr);
              }
            }
            if (matches.length === 0) {
              const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
              matches = strictMatch(pool, urlStr);
            }
            sendResponse({ success: true, isUnlocked: isVaultUnlocked, items: matches });
          } catch {
            sendResponse({ success: true, isUnlocked: isVaultUnlocked, items: [] });
          }
          break;
        }
        case "GENERATE_PASSWORD": {
          const length = message.length || 20;
          const useSymbols = message.symbols !== false;
          const useDigits = message.digits !== false;
          const useUpper = message.uppercase !== false;
          const useLower = message.lowercase !== false;
          let charset = "";
          if (useLower) charset += "abcdefghijkmnopqrstuvwxyz";
          if (useUpper) charset += "ABCDEFGHJKLMNPQRSTUVWXYZ";
          if (useDigits) charset += "23456789";
          if (useSymbols) charset += "!@#$%^&*()-_=+[]{}|;:,.<>?";
          if (!charset) charset = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
          const randomBytes = new Uint8Array(length);
          crypto.getRandomValues(randomBytes);
          let password = "";
          for (let i = 0; i < length; i++) {
            password += charset[randomBytes[i] % charset.length];
          }
          sendResponse({ success: true, password });
          break;
        }
        case "GET_TOTP": {
          const secret = message.secret;
          if (!secret) {
            sendResponse({ success: false, error: "No secret provided" });
            break;
          }
          try {
            const res = await sendNativeRequest("vault.generateTotp", { secret });
            if (res && res.token) {
              sendResponse({ success: true, token: res.token, secondsRemaining: res.secondsRemaining });
            } else {
              sendResponse({ success: false, error: "Could not generate TOTP" });
            }
          } catch {
            sendResponse({ success: false, error: "TOTP generation failed" });
          }
          break;
        }
        case "SEARCH_VAULT": {
          const q = (message.query || "").toLowerCase();
          await refreshVaultState();
          if (!isVaultUnlocked) {
            sendResponse({ success: true, isUnlocked: false, items: [] });
            return;
          }
          const nativeSearch = await sendNativeRequest("vault.search", { query: q });
          if (Array.isArray(nativeSearch) && (nativeSearch.length > 0 || q !== "")) {
            sendResponse({ success: true, isUnlocked: true, items: nativeSearch });
            return;
          }
          const nativeItems = await sendNativeRequest("vault.getItems");
          if (Array.isArray(nativeItems) && nativeItems.length > 0) {
            cachedItems = nativeItems;
            const filtered = q ? nativeItems.filter(
              (item) => (item.title || "").toLowerCase().includes(q) || (item.username || "").toLowerCase().includes(q) || (item.urls || []).some((u) => u.toLowerCase().includes(q))
            ) : nativeItems;
            sendResponse({ success: true, isUnlocked: true, items: filtered });
            return;
          }
          const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
          const results = pool.filter(
            (item) => item.title.toLowerCase().includes(q) || item.username && item.username.toLowerCase().includes(q) || item.urls.some((u) => u.toLowerCase().includes(q))
          );
          sendResponse({ success: true, isUnlocked: true, items: results });
          break;
        }
        case "GET_STATUS": {
          await refreshVaultState();
          sendResponse({
            success: true,
            isUnlocked: isVaultUnlocked,
            itemCount: cachedItems.length > 0 ? cachedItems.length : FALLBACK_ITEMS.length
          });
          break;
        }
        case "AUTOFILL_CREDENTIALS": {
          if (sender.tab?.id) {
            await chrome.tabs.sendMessage(sender.tab.id, {
              type: "INJECT_CREDENTIALS",
              username: message.username,
              password: message.password
            });
          }
          sendResponse({ success: true });
          break;
        }
        case "UPDATE_ITEM": {
          const { item } = message;
          await sendNativeRequest("vault.updateItem", { item });
          const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
          const index = pool.findIndex((i) => i.id === item.id);
          if (index !== -1) {
            pool[index] = { ...pool[index], ...item };
          }
          sendResponse({ success: true });
          break;
        }
        case "ADD_ITEM": {
          const { item } = message;
          item.id = `new-${Date.now()}`;
          await sendNativeRequest("vault.addItem", { item });
          const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
          pool.push(item);
          sendResponse({ success: true, item });
          break;
        }
        case "CHECK_OR_PROMPT_SAVE": {
          const { url: urlStr, username, password } = message;
          if (!urlStr || !password) {
            sendResponse({ action: "none" });
            break;
          }
          try {
            const url = new URL(urlStr);
            const domain = url.hostname.toLowerCase().replace("www.", "");
            await refreshVaultState();
            const pool = cachedItems.length > 0 ? cachedItems : FALLBACK_ITEMS;
            const matched = strictMatch(pool, urlStr);
            if (matched.length === 0) {
              sendResponse({ action: "save_new", domain, username, password });
            } else {
              const userMatch = matched.find((m) => (m.username || "").toLowerCase() === (username || "").toLowerCase());
              if (userMatch) {
                if (userMatch.password !== password) {
                  sendResponse({ action: "update_password", item: userMatch, domain, username, password });
                } else {
                  sendResponse({ action: "none" });
                }
              } else {
                sendResponse({ action: "save_new", domain, username, password });
              }
            }
          } catch {
            sendResponse({ action: "none" });
          }
          break;
        }
        case "OPEN_SIDE_PANEL": {
          if (sender.tab?.windowId) {
            await chrome.sidePanel.open({ windowId: sender.tab.windowId });
          }
          sendResponse({ success: true });
          break;
        }
        default:
          sendResponse({ error: "Unknown message type" });
      }
    })();
    return true;
  });
})();
