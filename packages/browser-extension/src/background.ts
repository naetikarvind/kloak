import { analyzeUrl, generateMaskedAlias, ThreatAnalysis } from './threat-detector';
import { evaluateWebsiteSecurity, AIThreatEvaluation } from './ai-threat-engine';
import {
  DEFAULT_SESSION_MONITOR_SETTINGS,
  ExtensionSessionAlert,
  ExtensionTrackedSession,
  SessionMonitorSettings,
  evaluateSessionGuardrail,
  extractDomainHost,
  isAuthSessionCookie,
  tryExtractJwtExpMs,
} from './session-guardian';

const NATIVE_HOST = 'app.kloak.native';
let cachedItems: any[] = [];
let isVaultUnlocked: boolean = false;
let connectedAccount: { provider: string; email: string; customForwardingEmail?: string } = {
  provider: '',
  email: ''
};

const aiSecurityCache = new Map<string, AIThreatEvaluation>();
const sessionRegistry = new Map<string, ExtensionTrackedSession>();
const sessionAlerts = new Map<string, ExtensionSessionAlert>();
const deliveredBrowserNotificationIds = new Set<string>();
const browserNotificationTargets = new Map<string, { loginUrl: string; tabId?: number; domain: string; reauthMode: string }>();
const sessionRefreshLocks = new Set<string>();
let sessionSettings: SessionMonitorSettings = { ...DEFAULT_SESSION_MONITOR_SETTINGS };

let lastActiveTabId: number | null = null;
let lastActiveUrl: string | null = null;

// Fallback vault items (deactivated test passwords)
const FALLBACK_ITEMS: any[] = [];

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
        } else if (response.error) {
          resolve({ __error: response.error.message || 'Host error' });
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });

  if (nativeResult !== null && nativeResult !== undefined) {
    if (nativeResult.__error) {
      throw new Error(nativeResult.__error);
    }
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
      if (data && data.error) {
        return { __error: data.error.message || 'RPC Error' };
      }
    }
  } catch {}

  return null;
}

async function broadcastVaultState(isUnlocked: boolean) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'VAULT_STATE_CHANGED',
          isUnlocked,
          itemCount: cachedItems.length
        }).catch(() => {});
      }
    }
  } catch {}
}

/**
 * Refreshes vault status and items from the native host.
 */
async function refreshVaultState(): Promise<void> {
  const previousState = isVaultUnlocked;
  const status = await sendNativeRequest('vault.status');
  if (status && typeof status.isUnlocked === 'boolean') {
    isVaultUnlocked = status.isUnlocked;
  }

  if (isVaultUnlocked) {
    const itemsRes = await sendNativeRequest('vault.getItems');
    if (Array.isArray(itemsRes)) {
      cachedItems = itemsRes;
    }
    try {
      const remoteSettings = await sendNativeRequest('vault.getSettings');
      if (remoteSettings && typeof remoteSettings === 'object' && !remoteSettings.__error) {
        sessionSettings = {
          enabled: remoteSettings.sessionMonitorEnabled ?? sessionSettings.enabled,
          warnMinutes: remoteSettings.defaultSessionWarnMinutes ?? sessionSettings.warnMinutes,
          defaultTtlMinutes: remoteSettings.defaultSessionTtlMinutes ?? sessionSettings.defaultTtlMinutes,
          hardMaxLifetimeMinutes: remoteSettings.defaultHardMaxLifetimeMinutes ?? sessionSettings.hardMaxLifetimeMinutes,
          autoOAuthRefresh: remoteSettings.autoOAuthRefreshEnabled ?? sessionSettings.autoOAuthRefresh,
          desktopNotifications: remoteSettings.sessionDesktopNotificationsEnabled ?? sessionSettings.desktopNotifications,
        };
      }
    } catch {}
  } else {
    // Crucial: Wipe in-memory plaintexts immediately when locked
    cachedItems = [];
  }

  if (previousState !== isVaultUnlocked) {
    if (!isVaultUnlocked) {
      try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id) {
            chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {});
          }
        }
      } catch {}
    }
    broadcastVaultState(isVaultUnlocked);
  }
}

// Initial sync & session alarm setup
loadSessionSettingsFromStorage().then(() => refreshVaultState());

try {
  chrome.alarms?.create('kloak_session_tick', { periodInMinutes: 0.5 });
  chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === 'kloak_session_tick') {
      evaluateAllTrackedSessions();
    }
  });
} catch {}

try {
  chrome.notifications?.onClicked.addListener((notifId) => {
    const target = browserNotificationTargets.get(notifId);
    if (target) {
      focusOrOpenLoginTab(target.loginUrl, target.tabId, target.reauthMode === 'assisted_reauth');
      try { chrome.notifications.clear(notifId, () => {}); } catch {}
    }
  });
  chrome.notifications?.onButtonClicked.addListener((notifId, buttonIdx) => {
    const target = browserNotificationTargets.get(notifId);
    if (buttonIdx === 0 && target) {
      focusOrOpenLoginTab(target.loginUrl, target.tabId, target.reauthMode === 'assisted_reauth');
    }
    try { chrome.notifications.clear(notifId, () => {}); } catch {}
  });
} catch {}

async function loadSessionSettingsFromStorage(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([
      'kloak_session_monitor',
      'kloak_session_warn_minutes',
      'kloak_auto_oauth_refresh',
      'kloak_session_desktop_notifications',
      'kloak_tracked_sessions',
    ]);
    if (stored.kloak_session_monitor !== undefined) sessionSettings.enabled = Boolean(stored.kloak_session_monitor);
    if (typeof stored.kloak_session_warn_minutes === 'number') sessionSettings.warnMinutes = stored.kloak_session_warn_minutes;
    if (stored.kloak_auto_oauth_refresh !== undefined) sessionSettings.autoOAuthRefresh = Boolean(stored.kloak_auto_oauth_refresh);
    if (stored.kloak_session_desktop_notifications !== undefined) {
      sessionSettings.desktopNotifications = Boolean(stored.kloak_session_desktop_notifications);
    }
    if (Array.isArray(stored.kloak_tracked_sessions)) {
      for (const s of stored.kloak_tracked_sessions) {
        if (s?.id) sessionRegistry.set(s.id, s);
      }
    }
  } catch {}
}

async function persistSessionsToStorage(): Promise<void> {
  try {
    await chrome.storage.local.set({
      kloak_tracked_sessions: Array.from(sessionRegistry.values()).slice(0, 60),
      kloak_session_alerts: Array.from(sessionAlerts.values()).filter(a => !a.dismissed).slice(0, 30),
    });
  } catch {}
}

async function focusOrOpenLoginTab(loginUrl: string, tabId?: number, armAssistedReauth: boolean = true): Promise<void> {
  const safeUrl = /^https?:\/\//i.test(loginUrl) ? loginUrl : `https://${loginUrl}`;
  try {
    if (typeof tabId === 'number') {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { active: true, url: safeUrl });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
        if (armAssistedReauth) {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id!, { type: 'ARM_ASSISTED_REAUTH' }).catch(() => {});
          }, 900);
        }
        return;
      }
    }
    const created = await chrome.tabs.create({ url: safeUrl, active: true });
    if (created.id && armAssistedReauth) {
      setTimeout(() => {
        chrome.tabs.sendMessage(created.id!, { type: 'ARM_ASSISTED_REAUTH' }).catch(() => {});
      }, 1100);
    }
  } catch {}
}

function findMatchedVaultItemForSession(urlStr: string, itemId?: string): any | undefined {
  if (itemId) {
    const exact = cachedItems.find(i => i.id === itemId);
    if (exact) return exact;
  }
  const matches = strictMatch(cachedItems, urlStr);
  return matches[0];
}

async function processSessionSignal(signal: {
  sessionId?: string;
  itemId?: string;
  appTitle?: string;
  url: string;
  domain?: string;
  tabId?: number;
  status?: 'active' | 'expiring_soon' | 'expired' | 'revoked';
  source: 'cookie_expiry' | 'jwt_claim' | 'webapp_hook' | 'http_401' | 'login_redirect' | 'item_timer' | 'oauth_token';
  authMechanism?: 'password_mfa' | 'oauth2_oidc' | 'sso_passive' | 'cookie_timer';
  expiresAt?: string;
  ttlSeconds?: number;
  lastActivityAt?: string;
  error?: string;
}): Promise<{ session: ExtensionTrackedSession; evaluation: any }> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const domain = (signal.domain || extractDomainHost(signal.url)).toLowerCase();
  const matchedItem = findMatchedVaultItemForSession(signal.url, signal.itemId);
  const sid = signal.sessionId || `${domain}:${matchedItem?.id || 'site'}`;
  const existing = sessionRegistry.get(sid);
  const policy = matchedItem?.sessionPolicy;

  let expiresAt = signal.expiresAt;
  if (!expiresAt && signal.ttlSeconds && signal.ttlSeconds > 0) {
    expiresAt = new Date(nowMs + signal.ttlSeconds * 1000).toISOString();
  } else if (!expiresAt && signal.status !== 'expired' && existing?.expiresAt) {
    expiresAt = existing.expiresAt;
  } else if (!expiresAt && signal.status !== 'expired' && matchedItem?.oauth?.expiresAt) {
    expiresAt = matchedItem.oauth.expiresAt;
  } else if (!expiresAt && signal.status !== 'expired' && policy?.sessionTtlMinutes && policy.sessionTtlMinutes > 0) {
    expiresAt = new Date(nowMs + policy.sessionTtlMinutes * 60_000).toISOString();
  }

  const startedAt =
    signal.status === 'active' && existing?.status === 'expired'
      ? nowIso
      : existing?.startedAt || nowIso;

  const hardMaxMin = policy?.hardMaxLifetimeMinutes ?? sessionSettings.hardMaxLifetimeMinutes ?? 480;
  const hardDeadlineAt =
    existing?.hardDeadlineAt && !(signal.status === 'active' && existing.status === 'expired')
      ? existing.hardDeadlineAt
      : hardMaxMin > 0
        ? new Date(Date.parse(startedAt) + hardMaxMin * 60_000).toISOString()
        : undefined;

  const session: ExtensionTrackedSession = {
    id: sid,
    itemId: matchedItem?.id || existing?.itemId,
    appTitle: signal.appTitle || matchedItem?.title || existing?.appTitle || domain,
    url: signal.url || existing?.url || matchedItem?.urls?.[0] || `https://${domain}`,
    domain,
    tabId: signal.tabId ?? existing?.tabId,
    authMechanism:
      signal.authMechanism ||
      policy?.authMechanism ||
      (matchedItem?.oauth?.refreshToken ? 'oauth2_oidc' : existing?.authMechanism || 'cookie_timer'),
    reauthMode: policy?.reauthMode || existing?.reauthMode || 'notify_only',
    status: signal.status || existing?.status || 'active',
    source: signal.source || existing?.source || 'cookie_expiry',
    startedAt,
    lastActivityAt: signal.lastActivityAt || nowIso,
    expiresAt,
    hardDeadlineAt,
    lastRefreshedAt: existing?.lastRefreshedAt,
    refreshCount: existing?.refreshCount ?? 0,
    lastError: signal.error,
  };

  const evaluation = evaluateSessionGuardrail({
    session,
    item: matchedItem,
    settings: sessionSettings,
    nowMs,
  });

  if (evaluation.decision === 'REVOKE_SECURITY') {
    session.status = 'revoked';
  } else if (evaluation.decision === 'PROMPT_EXPIRED') {
    session.status = 'expired';
  } else if (evaluation.decision === 'WARN_PRE_EXPIRY' || evaluation.decision === 'AUTO_REFRESH') {
    session.status = 'expiring_soon';
  } else if (session.status !== 'expired' && session.status !== 'revoked') {
    session.status = 'active';
  }

  sessionRegistry.set(sid, session);
  await handleSessionDecisionSideEffects(session, evaluation, matchedItem);
  await persistSessionsToStorage();

  // Sync telemetry (never secrets) with macOS desktop app / Core daemon
  sendNativeRequest('session.reportEvent', {
    sessionId: session.id,
    itemId: session.itemId,
    appTitle: session.appTitle,
    url: session.url,
    domain: session.domain,
    authMechanism: session.authMechanism,
    reauthMode: session.reauthMode,
    status: session.status,
    source: session.source,
    expiresAt: session.expiresAt,
    lastActivityAt: session.lastActivityAt,
    error: session.lastError,
  }).catch(() => {});

  return { session, evaluation };
}

async function handleSessionDecisionSideEffects(
  session: ExtensionTrackedSession,
  evaluation: ReturnType<typeof evaluateSessionGuardrail>,
  matchedItem?: any
): Promise<void> {
  if (!sessionSettings.enabled) return;

  if (evaluation.decision === 'AUTO_REFRESH' && matchedItem && !sessionRefreshLocks.has(session.id)) {
    sessionRefreshLocks.add(session.id);
    try {
      const refreshRes = await sendNativeRequest('session.refresh', {
        sessionId: session.id,
        itemId: matchedItem.id,
        domain: session.domain,
      });
      if (refreshRes && refreshRes.ok && refreshRes.newExpiresAt) {
        session.status = 'active';
        session.expiresAt = refreshRes.newExpiresAt;
        session.lastRefreshedAt = new Date().toISOString();
        session.refreshCount += 1;
        session.lastError = undefined;
        sessionRegistry.set(session.id, session);
        for (const sev of ['warning', 'expired', 'security_revoked']) {
          sessionAlerts.delete(`${session.id}:${sev}`);
        }
        await refreshVaultState();
        await broadcastToDomainTabs(session.domain, {
          type: 'SESSION_RENEWED',
          session,
          rotated: Boolean(refreshRes.rotated),
        });
        return;
      }
      // Fail closed cleanly if refresh declined/requires interactive auth
      session.status = refreshRes?.reuseDetected ? 'revoked' : 'expired';
      session.lastError = refreshRes?.reason;
      sessionRegistry.set(session.id, session);
    } catch {
      session.status = 'expired';
    } finally {
      sessionRefreshLocks.delete(session.id);
    }
  }

  if (
    evaluation.decision === 'WARN_PRE_EXPIRY' ||
    evaluation.decision === 'PROMPT_EXPIRED' ||
    evaluation.decision === 'REVOKE_SECURITY' ||
    session.status === 'expired' ||
    session.status === 'revoked'
  ) {
    const severity: ExtensionSessionAlert['severity'] =
      session.status === 'revoked' || evaluation.decision === 'REVOKE_SECURITY'
        ? 'security_revoked'
        : session.status === 'expired' || evaluation.decision === 'PROMPT_EXPIRED'
          ? 'expired'
          : 'warning';

    const alertKey = `${session.id}:${severity}`;
    const existingAlert = sessionAlerts.get(alertKey);
    const loginUrl = matchedItem?.sessionPolicy?.loginUrl || matchedItem?.urls?.[0] || session.url;
    const msg =
      severity === 'security_revoked'
        ? `${session.appTitle} refresh token was revoked or reused. Sign in interactively.`
        : severity === 'expired'
          ? `${session.appTitle} session expired. Sign back in to continue.`
          : `${session.appTitle} session expires in ${Math.max(1, Math.ceil(evaluation.secondsRemaining / 60))}m.`;

    const alert: ExtensionSessionAlert = {
      id: alertKey,
      sessionId: session.id,
      itemId: session.itemId,
      appTitle: session.appTitle,
      domain: session.domain,
      loginUrl,
      reauthMode: session.reauthMode,
      severity,
      message: msg,
      secondsRemaining: Math.max(0, evaluation.secondsRemaining),
      createdAt: existingAlert?.createdAt || new Date().toISOString(),
      dismissed: existingAlert?.dismissed ?? false,
      canOAuthRefresh: evaluation.canSilentRefresh,
    };
    sessionAlerts.set(alertKey, alert);

    if (!alert.dismissed) {
      await broadcastToDomainTabs(session.domain, {
        type: 'SESSION_STATUS_ALERT',
        session,
        alert,
      });

      if (sessionSettings.desktopNotifications && !deliveredBrowserNotificationIds.has(alertKey)) {
        deliveredBrowserNotificationIds.add(alertKey);
        const notifId = `kloak-session-${alertKey}`;
        browserNotificationTargets.set(notifId, {
          loginUrl,
          tabId: session.tabId,
          domain: session.domain,
          reauthMode: session.reauthMode,
        });
        try {
          chrome.notifications?.create(notifId, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
            title:
              severity === 'warning'
                ? `${session.appTitle} Session Expiring Soon`
                : severity === 'security_revoked'
                  ? `${session.appTitle} Security Re-Auth Required`
                  : `${session.appTitle} Session Expired`,
            message: msg,
            buttons: [{ title: 'Sign Back In' }, { title: 'Dismiss' }],
            priority: severity === 'warning' ? 1 : 2,
          });
        } catch {}
      }
    }
  } else if (session.status === 'active') {
    for (const sev of ['warning', 'expired', 'security_revoked']) {
      sessionAlerts.delete(`${session.id}:${sev}`);
      deliveredBrowserNotificationIds.delete(`${session.id}:${sev}`);
    }
  }
}

async function broadcastToDomainTabs(domain: string, payload: any): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      const tabDomain = extractDomainHost(tab.url);
      if (tabDomain === domain || tabDomain.endsWith('.' + domain) || domain.endsWith('.' + tabDomain)) {
        chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
      }
    }
  } catch {}
}

async function inspectTabCookiesAndSession(tabId: number, urlStr: string): Promise<void> {
  if (!sessionSettings.enabled) return;
  try {
    const parsed = new URL(urlStr);
    if (!parsed.protocol.startsWith('http')) return;
    const cookies = await chrome.cookies?.getAll({ url: urlStr }).catch(() => []);
    if (!Array.isArray(cookies) || cookies.length === 0) return;

    const nowSec = Date.now() / 1000;
    const authCookies = cookies.filter(c => isAuthSessionCookie(c.name) && typeof c.expirationDate === 'number' && c.expirationDate > nowSec);
    if (authCookies.length === 0) return;

    let earliestMs = Math.min(...authCookies.map(c => (c.expirationDate! * 1000)));
    let signalSource: 'cookie_expiry' | 'jwt_claim' = 'cookie_expiry';
    for (const c of authCookies) {
      const jwtExp = tryExtractJwtExpMs(c.value || '');
      if (jwtExp && jwtExp > Date.now() && jwtExp < earliestMs) {
        earliestMs = jwtExp;
        signalSource = 'jwt_claim';
      }
    }

    await processSessionSignal({
      url: urlStr,
      domain: extractDomainHost(urlStr),
      tabId,
      status: 'active',
      source: signalSource,
      expiresAt: new Date(earliestMs).toISOString(),
    });
  } catch {}
}

async function evaluateAllTrackedSessions(): Promise<void> {
  if (!sessionSettings.enabled) return;
  const nowMs = Date.now();
  for (const session of Array.from(sessionRegistry.values())) {
    const matchedItem = findMatchedVaultItemForSession(session.url, session.itemId);
    const evalRes = evaluateSessionGuardrail({ session, item: matchedItem, settings: sessionSettings, nowMs });
    if (evalRes.decision === 'REVOKE_SECURITY') session.status = 'revoked';
    else if (evalRes.decision === 'PROMPT_EXPIRED') session.status = 'expired';
    else if (evalRes.decision === 'WARN_PRE_EXPIRY' || evalRes.decision === 'AUTO_REFRESH') session.status = 'expiring_soon';
    sessionRegistry.set(session.id, session);
    await handleSessionDecisionSideEffects(session, evalRes, matchedItem);
  }
  await persistSessionsToStorage();
  if (lastActiveTabId && lastActiveUrl) {
    await updateBadgeForTab(lastActiveTabId, lastActiveUrl);
  }
}

// Active bi-directional sync loop: polls every 2.5s to catch external lock/unlock from macOS app
setInterval(async () => {
  await refreshVaultState();
}, 2500);

// Listen for tab updates to calculate matched logins for the badge & inspect session cookies
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  await refreshVaultState();
  await inspectTabCookiesAndSession(tabId, tab.url);
  await updateBadgeForTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await refreshVaultState();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab?.url) {
    await inspectTabCookiesAndSession(tab.id!, tab.url);
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
        let aiEval = aiSecurityCache.get(urlStr);
        if (!aiEval) {
          aiEval = await evaluateWebsiteSecurity(urlStr);
          aiSecurityCache.set(urlStr, aiEval);
        }
        await chrome.tabs.sendMessage(tabId, {
          type: 'THREAT_DETECTED',
          analysis: threat,
          aiEvaluation: aiEval,
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
      // 2. Query in-memory cached items
      matches = strictMatch(cachedItems, urlStr);
    }

    if (matches.length > 0) {
      const domain = extractDomainHost(urlStr);
      const tabSession = Array.from(sessionRegistry.values()).find(s => s.domain === domain);
      if (tabSession && (tabSession.status === 'expired' || tabSession.status === 'revoked')) {
        await chrome.action.setBadgeText({ tabId, text: 'EXP' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#EF4444' });
      } else if (tabSession && tabSession.status === 'expiring_soon') {
        await chrome.action.setBadgeText({ tabId, text: '⏱' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#F59E0B' });
      } else {
        await chrome.action.setBadgeText({ tabId, text: String(matches.length) });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b82f6' });
      }
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
        let aiEvaluation = aiSecurityCache.get(url);
        if (!aiEvaluation && (analysis.isSuspicious || message.includeAi)) {
          aiEvaluation = await evaluateWebsiteSecurity(url);
          aiSecurityCache.set(url, aiEvaluation);
        }
        sendResponse({ success: true, analysis, aiEvaluation, connectedAccount });
        break;
      }

      case 'AI_INSPECT_WEBSITE': {
        const url = message.url || (sender.tab?.url ?? '');
        let evaluation = aiSecurityCache.get(url);
        if (!evaluation) {
          evaluation = await evaluateWebsiteSecurity(url);
          aiSecurityCache.set(url, evaluation);
        }
        sendResponse({ success: true, evaluation, connectedAccount });
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
        const forwardTo = connectedAccount.customForwardingEmail || connectedAccount.email || 'shield@kloak.app';
        const provider = (connectedAccount.provider || 'Kloak').toUpperCase();

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

        cachedItems.push(newItem);

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

      case 'GET_CREDENTIALS':
      case 'GET_MATCHED_LOGINS': {
        const urlStr = message.url || sender.tab?.url || '';
        try {
          await refreshVaultState();

          let matches: any[] = [];
          if (isVaultUnlocked) {
            const nativeMatches = await sendNativeRequest('vault.matchByUrl', { url: urlStr });
            if (Array.isArray(nativeMatches) && nativeMatches.length > 0) {
              matches = strictMatch(nativeMatches, urlStr);
            }
          }
          
          if (matches.length === 0) {
            matches = strictMatch(cachedItems, urlStr);
          }

          sendResponse({ success: true, isUnlocked: isVaultUnlocked, items: matches });
        } catch {
          sendResponse({ success: true, isUnlocked: isVaultUnlocked, items: [] });
        }
        break;
      }

      case 'GENERATE_PASSWORD': {
        const length = message.length || 20;
        const useSymbols = message.symbols !== false;
        const useDigits = message.digits !== false;
        const useUpper = message.uppercase !== false;
        const useLower = message.lowercase !== false;

        let charset = '';
        if (useLower) charset += 'abcdefghijkmnopqrstuvwxyz';
        if (useUpper) charset += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        if (useDigits) charset += '23456789';
        if (useSymbols) charset += '!@#$%^&*()-_=+[]{}|;:,.<>?';
        if (!charset) charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';

        const randomBytes = new Uint8Array(length);
        crypto.getRandomValues(randomBytes);
        let password = '';
        for (let i = 0; i < length; i++) {
          password += charset[randomBytes[i] % charset.length];
        }
        sendResponse({ success: true, password });
        break;
      }

      case 'GET_TOTP': {
        const secret = message.secret;
        if (!secret) {
          sendResponse({ success: false, error: 'No secret provided' });
          break;
        }
        try {
          const res = await sendNativeRequest('vault.generateTotp', { secret });
          if (res && res.token) {
            sendResponse({ success: true, token: res.token, secondsRemaining: res.secondsRemaining });
          } else {
            sendResponse({ success: false, error: 'Could not generate TOTP' });
          }
        } catch {
          sendResponse({ success: false, error: 'TOTP generation failed' });
        }
        break;
      }

      case 'SEARCH_VAULT': {
        const q = (message.query || '').trim().toLowerCase();
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

        const terms = q ? q.split(/\s+/).filter(Boolean) : [];
        const matchesQuery = (item: any) => {
          if (terms.length === 0) return true;
          const title = (item.title || '').toLowerCase();
          const username = (item.username || '').toLowerCase();
          const urls = (item.urls || []).map((u: string) => u.toLowerCase());
          return terms.every(t => title.includes(t) || username.includes(t) || urls.some(u => u.includes(t)));
        };

        const nativeItems = await sendNativeRequest('vault.getItems');
        if (Array.isArray(nativeItems) && nativeItems.length > 0) {
          cachedItems = nativeItems;
          const filtered = nativeItems.filter(matchesQuery);
          sendResponse({ success: true, isUnlocked: true, items: filtered });
          return;
        }

        // 2. Fallback search
        const results = cachedItems.filter(matchesQuery);
        sendResponse({ success: true, isUnlocked: true, items: results });
        break;
      }

      case 'GET_STATUS': {
        await refreshVaultState();
        let biometricsAvailable = false;
        try {
          const pingRes = await sendNativeRequest('daemon.ping');
          biometricsAvailable = !!pingRes?.biometricsAvailable;
        } catch {}
        sendResponse({
          success: true,
          isUnlocked: isVaultUnlocked,
          itemCount: cachedItems.length,
          biometricsAvailable
        });
        break;
      }

      case 'UNLOCK_WITH_TOUCH_ID':
      case 'UNLOCK_VAULT_WITH_TOUCH_ID': {
        try {
          const res = await sendNativeRequest('vault.unlockWithBiometrics');
          if (res && (res.success || res.isUnlocked || res.status?.isUnlocked)) {
            isVaultUnlocked = true;
            const itemsRes = await sendNativeRequest('vault.getItems');
            if (Array.isArray(itemsRes)) {
              cachedItems = itemsRes;
            }
            if (lastActiveTabId && lastActiveUrl) {
              updateBadgeForTab(lastActiveTabId, lastActiveUrl);
            }
            broadcastVaultState(true);
            sendResponse({ success: true, isUnlocked: true, items: cachedItems });
          } else {
            const errorMsg = res?.error || res?.__error || 'Touch ID authentication failed or was cancelled.';
            sendResponse({ success: false, error: errorMsg });
          }
        } catch (err: any) {
          sendResponse({ success: false, error: err.message || 'Touch ID authentication failed' });
        }
        break;
      }

      case 'UNLOCK_VAULT': {
        const masterPassword = message.password || message.masterPassword || '';
        if (!masterPassword) {
          sendResponse({ success: false, error: 'Master password is required' });
          break;
        }
        try {
          const res = await sendNativeRequest('vault.unlock', { masterPassword });
          if (res && (res.success || res.isUnlocked || res.status?.isUnlocked)) {
            isVaultUnlocked = true;
            const itemsRes = await sendNativeRequest('vault.getItems');
            if (Array.isArray(itemsRes)) {
              cachedItems = itemsRes;
            }
            if (lastActiveTabId && lastActiveUrl) {
              updateBadgeForTab(lastActiveTabId, lastActiveUrl);
            }
            broadcastVaultState(true);
            sendResponse({ success: true, isUnlocked: true, items: cachedItems });
          } else {
            sendResponse({ success: false, error: 'Incorrect master password. Please try again.' });
          }
        } catch (err: any) {
          sendResponse({ success: false, error: err.message || 'Unlock failed' });
        }
        break;
      }

      case 'UNLOCK_VAULT_WITH_HARDWARE_KEY': {
        const hardwareSecret = message.hardwareSecret || '';
        if (!hardwareSecret) {
          sendResponse({ success: false, error: 'Hardware key secret is required' });
          break;
        }
        try {
          const res = await sendNativeRequest('vault.unlockWithHardwareKey', { hardwareSecret });
          if (res && (res.success || res.isUnlocked || res.status?.isUnlocked)) {
            isVaultUnlocked = true;
            const itemsRes = await sendNativeRequest('vault.getItems');
            if (Array.isArray(itemsRes)) {
              cachedItems = itemsRes;
            }
            if (lastActiveTabId && lastActiveUrl) {
              updateBadgeForTab(lastActiveTabId, lastActiveUrl);
            }
            broadcastVaultState(true);
            sendResponse({ success: true, isUnlocked: true, items: cachedItems });
          } else {
            sendResponse({ success: false, error: 'Hardware key verification failed. Please try again.' });
          }
        } catch (err: any) {
          // If daemon isn't running or native failed, check local storage credential
          const stored = await chrome.storage.local.get(['kloak_hardware_key', 'kloak_cached_vault']);
          if (stored.kloak_hardware_key) {
            isVaultUnlocked = true;
            sendResponse({ success: true, isUnlocked: true, items: cachedItems });
          } else {
            sendResponse({ success: false, error: err.message || 'Hardware key unlock failed' });
          }
        }
        break;
      }

      case 'GET_HARDWARE_KEY_CONFIG': {
        try {
          const res = await sendNativeRequest('vault.getHardwareKeyConfig');
          const stored = await chrome.storage.local.get(['kloak_hardware_key']);
          const hwConfig = res?.hardwareKey || stored.kloak_hardware_key || null;
          sendResponse({ success: true, hardwareKey: hwConfig });
        } catch (err) {
          const stored = await chrome.storage.local.get(['kloak_hardware_key']);
          sendResponse({ success: true, hardwareKey: stored.kloak_hardware_key || null });
        }
        break;
      }

      case 'REGISTER_HARDWARE_KEY': {
        const { credential, hardwareSecret, mode, masterPassword } = message;
        try {
          await sendNativeRequest('vault.registerHardwareKey', {
            credential,
            hardwareSecret,
            mode,
            masterPassword
          });
          await chrome.storage.local.set({
            kloak_hardware_key: {
              enabled: true,
              mode: mode || 'hardware_only',
              credentials: [credential],
              salt: credential.salt || ''
            }
          });
          sendResponse({ success: true });
        } catch (err: any) {
          await chrome.storage.local.set({
            kloak_hardware_key: {
              enabled: true,
              mode: mode || 'hardware_only',
              credentials: [credential],
              salt: credential.salt || ''
            }
          });
          sendResponse({ success: true, warning: err.message });
        }
        break;
      }

      case 'REMOVE_HARDWARE_KEY': {
        try {
          await sendNativeRequest('vault.removeHardwareKey');
        } catch {}
        await chrome.storage.local.remove(['kloak_hardware_key']);
        sendResponse({ success: true });
        break;
      }

      case 'LOCK_VAULT': {
        try {
          await sendNativeRequest('vault.lock');
        } catch {}

        try {
          await fetch('http://127.0.0.1:53152/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'vault.lock' })
          });
        } catch {}

        isVaultUnlocked = false;
        cachedItems = [];
        try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id) {
              chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {});
            }
          }
        } catch {}
        broadcastVaultState(false);
        sendResponse({ success: true, isUnlocked: false });
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
        if (!item || !item.id) {
          sendResponse({ success: false, error: 'Invalid item data' });
          break;
        }

        const normalizedItem = {
          ...item,
          id: item.id,
          type: item.type || 'login',
          title: item.title || 'Untitled',
          username: item.username || '',
          password: item.password || '',
          urls: Array.isArray(item.urls) ? item.urls : [],
          notes: item.notes || '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          favorite: Boolean(item.favorite),
          trashed: Boolean(item.trashed),
          usedRecoveryCodes: Array.isArray(item.usedRecoveryCodes) ? item.usedRecoveryCodes : [],
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...(item.totpSecret ? { totpSecret: item.totpSecret } : {}),
          ...(item.oauth ? { oauth: item.oauth } : {}),
          ...(item.sessionPolicy ? { sessionPolicy: item.sessionPolicy } : {}),
          ...(Array.isArray(item.passwordHistory) && item.passwordHistory.length > 0 ? { passwordHistory: item.passwordHistory } : {})
        };

        try {
          // 1. Try vault.saveItem (universally supported across macOS app and daemon)
          let res = await sendNativeRequest('vault.saveItem', { item: normalizedItem });

          // 2. If saveItem failed or returned error, try vault.updateItem
          if (!res || res.__error) {
            res = await sendNativeRequest('vault.updateItem', {
              id: normalizedItem.id,
              updates: normalizedItem,
              item: normalizedItem
            });
          }

          // 3. Fallback: Try vault.addItem
          if (!res || res.__error) {
            res = await sendNativeRequest('vault.addItem', { item: normalizedItem });
          }

          const index = cachedItems.findIndex(i => i.id === normalizedItem.id);
          if (index !== -1) {
            cachedItems[index] = { ...cachedItems[index], ...normalizedItem };
          } else {
            cachedItems.push(normalizedItem);
          }

          sendResponse({ success: true, item: normalizedItem });
        } catch (err: any) {
          console.warn('[Kloak] Failed to update item in native host, updating local cache:', err);
          const index = cachedItems.findIndex(i => i.id === normalizedItem.id);
          if (index !== -1) {
            cachedItems[index] = { ...cachedItems[index], ...normalizedItem };
          }
          sendResponse({ success: true, warning: err.message, item: normalizedItem });
        }
        break;
      }

      case 'ADD_ITEM': {
        const { item } = message;
        if (!item) {
          sendResponse({ success: false, error: 'Invalid item' });
          break;
        }
        const normalizedItem = {
          id: item.id || `item-${Date.now()}`,
          type: item.type || 'login',
          title: item.title || 'Untitled',
          username: item.username || '',
          password: item.password || '',
          urls: Array.isArray(item.urls) ? item.urls : [],
          notes: item.notes || '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          favorite: Boolean(item.favorite),
          trashed: Boolean(item.trashed),
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...(item.totpSecret ? { totpSecret: item.totpSecret } : {}),
          ...(item.oauth ? { oauth: item.oauth } : {}),
          ...(item.sessionPolicy ? { sessionPolicy: item.sessionPolicy } : {}),
          ...(Array.isArray(item.passwordHistory) && item.passwordHistory.length > 0 ? { passwordHistory: item.passwordHistory } : {})
        };

        try {
          let res = await sendNativeRequest('vault.saveItem', { item: normalizedItem });
          if (!res || res.__error) {
            res = await sendNativeRequest('vault.addItem', { item: normalizedItem });
          }
          cachedItems.push(normalizedItem);
          sendResponse({ success: true, item: normalizedItem });
        } catch (err: any) {
          console.warn('[Kloak] Failed to add item to native host, caching locally:', err);
          cachedItems.push(normalizedItem);
          sendResponse({ success: true, item: normalizedItem });
        }
        break;
      }

      case 'IMPORT_PASSWORDS': {
        try {
          const res = await sendNativeRequest('vault.import', {
            content: message.content,
            format: message.format || 'auto',
            options: {
              autoMerge: true,
              ...(message.options || {}),
              ...(message.filename ? { filename: message.filename } : {})
            }
          });
          await refreshVaultState();
          sendResponse({ success: true, result: res });
        } catch (err: any) {
          sendResponse({ success: false, error: err.message || 'Import failed' });
        }
        break;
      }

      case 'AUTO_MERGE_VAULT': {
        try {
          const res = await sendNativeRequest('vault.autoMerge', {});
          await refreshVaultState();
          sendResponse({ success: true, report: res });
        } catch (err: any) {
          sendResponse({ success: false, error: err.message || 'Auto-merge failed' });
        }
        break;
      }

      case 'GET_SECURITY_AUDIT': {
        try {
          const res = await sendNativeRequest('vault.getSecurityAudit', {});
          sendResponse({ success: true, audit: res });
        } catch (err: any) {
          sendResponse({ success: false, error: err.message || 'Security audit failed' });
        }
        break;
      }

      case 'SEND_RPC': {
        try {
          const res = await sendNativeRequest(message.method, message.params);
          sendResponse({ success: true, result: res });
        } catch (err: any) {
          sendResponse({ success: false, error: err.message });
        }
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
          const matched = strictMatch(cachedItems, urlStr);

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

      case 'OPEN_EXTENSION_GENERATOR': {
        const tabId = sender.tab?.id || lastActiveTabId;
        if (tabId) {
          lastActiveTabId = tabId;
        }
        await chrome.storage.local.set({ defaultTab: 'generator', pendingAutofillTabId: tabId });

        let opened = false;
        try {
          if (chrome.action && typeof (chrome.action as any).openPopup === 'function') {
            await (chrome.action as any).openPopup();
            opened = true;
          }
        } catch {}

        if (!opened) {
          try {
            const popupUrl = chrome.runtime.getURL('popup/popup.html?tab=generator');
            if (chrome.windows && chrome.windows.create) {
              await chrome.windows.create({
                url: popupUrl,
                type: 'popup',
                width: 640,
                height: 520,
                focused: true
              });
              opened = true;
            }
          } catch {}
        }

        if (!opened) {
          try {
            const popupUrl = chrome.runtime.getURL('popup/popup.html?tab=generator');
            await chrome.tabs.create({ url: popupUrl });
          } catch {}
        }

        sendResponse({ success: true });
        break;
      }

      case 'FETCH_IMAGE_DATA_URL': {
        try {
          const res = await fetch(message.url);
          if (!res.ok) {
            sendResponse({ success: false, status: res.status });
            break;
          }
          const blob = await res.blob();
          if (blob.size < 50) {
            sendResponse({ success: false, reason: 'too_small' });
            break;
          }
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          const mime = blob.type || 'image/png';
          sendResponse({
            success: true,
            dataUrl: `data:${mime};base64,${base64}`,
            size: blob.size
          });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'fetch_failed' });
        }
        break;
      }

      case 'REPORT_WEBAPP_SESSION': {
        const targetUrl = message.url || sender.tab?.url || '';
        if (!targetUrl || !targetUrl.startsWith('http')) {
          sendResponse({ success: false });
          break;
        }
        const result = await processSessionSignal({
          sessionId: message.sessionId,
          itemId: message.itemId,
          appTitle: message.appTitle,
          url: targetUrl,
          domain: message.domain,
          tabId: sender.tab?.id,
          status: message.status,
          source: message.source || 'webapp_hook',
          authMechanism: message.authMechanism,
          expiresAt: message.expiresAt,
          ttlSeconds: message.ttlSeconds,
          lastActivityAt: message.lastActivityAt,
          error: message.error,
        });
        if (sender.tab?.id) {
          updateBadgeForTab(sender.tab.id, targetUrl).catch(() => {});
        }
        sendResponse({ success: true, ...result });
        break;
      }

      case 'SESSION_HEARTBEAT': {
        const targetUrl = message.url || sender.tab?.url || '';
        const domain = extractDomainHost(targetUrl);
        for (const s of sessionRegistry.values()) {
          if (s.domain === domain) {
            s.lastActivityAt = new Date().toISOString();
            sessionRegistry.set(s.id, s);
            sendNativeRequest('session.heartbeat', { sessionId: s.id }).catch(() => {});
          }
        }
        sendResponse({ success: true });
        break;
      }

      case 'GET_SESSION_WATCH_STATUS': {
        let nativeStatus: any = null;
        try {
          nativeStatus = await sendNativeRequest('session.getStatus');
        } catch {}
        if (nativeStatus && Array.isArray(nativeStatus.sessions)) {
          for (const ns of nativeStatus.sessions) {
            if (ns?.id && !sessionRegistry.has(ns.id)) {
              sessionRegistry.set(ns.id, ns);
            }
          }
        }
        sendResponse({
          success: true,
          settings: sessionSettings,
          sessions: Array.from(sessionRegistry.values()),
          alerts: Array.from(sessionAlerts.values()).filter(a => !a.dismissed),
        });
        break;
      }

      case 'REFRESH_SESSION_OAUTH': {
        try {
          const res = await sendNativeRequest('session.refresh', {
            sessionId: message.sessionId,
            itemId: message.itemId,
            domain: message.domain,
          });
          if (res?.ok && message.sessionId && sessionRegistry.has(message.sessionId)) {
            const s = sessionRegistry.get(message.sessionId)!;
            s.status = 'active';
            s.expiresAt = res.newExpiresAt;
            s.lastRefreshedAt = new Date().toISOString();
            s.refreshCount += 1;
            sessionRegistry.set(s.id, s);
            for (const sev of ['warning', 'expired', 'security_revoked']) {
              sessionAlerts.delete(`${s.id}:${sev}`);
            }
            await persistSessionsToStorage();
            await broadcastToDomainTabs(s.domain, { type: 'SESSION_RENEWED', session: s, rotated: Boolean(res.rotated) });
          }
          sendResponse({ success: Boolean(res?.ok), result: res });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'Refresh failed' });
        }
        break;
      }

      case 'DISMISS_SESSION_ALERT': {
        const alertId = message.alertId || '';
        const existing = sessionAlerts.get(alertId);
        if (existing) {
          existing.dismissed = true;
          sessionAlerts.set(alertId, existing);
          await persistSessionsToStorage();
        }
        sendNativeRequest('session.dismissAlert', { alertId }).catch(() => {});
        sendResponse({ success: true });
        break;
      }

      case 'OPEN_LOGIN_AND_REAUTH': {
        await focusOrOpenLoginTab(message.loginUrl || '', message.tabId || lastActiveTabId || undefined, true);
        sendResponse({ success: true });
        break;
      }

      case 'UPDATE_SESSION_SETTINGS': {
        sessionSettings = { ...sessionSettings, ...(message.settings || {}) };
        await chrome.storage.local.set({
          kloak_session_monitor: sessionSettings.enabled,
          kloak_session_warn_minutes: sessionSettings.warnMinutes,
          kloak_auto_oauth_refresh: sessionSettings.autoOAuthRefresh,
          kloak_session_desktop_notifications: sessionSettings.desktopNotifications,
        });
        sendNativeRequest('vault.updateSettings', {
          settings: {
            sessionMonitorEnabled: sessionSettings.enabled,
            defaultSessionWarnMinutes: sessionSettings.warnMinutes,
            defaultHardMaxLifetimeMinutes: sessionSettings.hardMaxLifetimeMinutes,
            autoOAuthRefreshEnabled: sessionSettings.autoOAuthRefresh,
            sessionDesktopNotificationsEnabled: sessionSettings.desktopNotifications,
          },
        }).catch(() => {});
        sendResponse({ success: true, settings: sessionSettings });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();

  return true; // Keep message channel open for async response
});
