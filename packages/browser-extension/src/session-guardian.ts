/**
 * Kloak Browser Extension — Cross-Site Session Guardian & Conflict Guardrail Engine
 * Monitors website auth cookies, web-app SDK hooks, JWT `exp` claims, and login redirects.
 *
 * Security Invariants:
 * 1. Never reads/transmits raw passwords for silent replay or stores them in extension storage.
 * 2. Silent auto-login is restricted strictly to OAuth 2.0 / OIDC refresh grants within hard caps.
 * 3. Any MFA requirement, token revocation, or missing grant fails closed to interactive re-login prompt.
 */

export type SessionReauthMode = 'notify_only' | 'auto_oauth_refresh' | 'assisted_reauth';
export type SessionAuthMechanism = 'password_mfa' | 'oauth2_oidc' | 'sso_passive' | 'cookie_timer';
export type SessionStatus = 'active' | 'expiring_soon' | 'expired' | 'refreshing' | 'revoked';
export type SessionSignalSource =
  | 'cookie_expiry'
  | 'jwt_claim'
  | 'webapp_hook'
  | 'http_401'
  | 'login_redirect'
  | 'item_timer'
  | 'oauth_token';

export interface ExtensionSessionPolicy {
  enabled: boolean;
  reauthMode: SessionReauthMode;
  authMechanism: SessionAuthMechanism;
  sessionTtlMinutes: number;
  idleTimeoutMinutes: number;
  hardMaxLifetimeMinutes: number;
  notifyLeadMinutes: number;
  tokenEndpoint?: string;
  loginUrl?: string;
  lastAuthenticatedAt?: string;
  lastRefreshedAt?: string;
  reuseDetected?: boolean;
}

export interface SessionMonitorSettings {
  enabled: boolean;
  warnMinutes: number;
  defaultTtlMinutes: number;
  hardMaxLifetimeMinutes: number;
  autoOAuthRefresh: boolean;
  desktopNotifications: boolean;
}

export const DEFAULT_SESSION_MONITOR_SETTINGS: SessionMonitorSettings = {
  enabled: true,
  warnMinutes: 5,
  defaultTtlMinutes: 0,
  hardMaxLifetimeMinutes: 480,
  autoOAuthRefresh: true,
  desktopNotifications: true,
};

export interface ExtensionTrackedSession {
  id: string;
  itemId?: string;
  appTitle: string;
  url: string;
  domain: string;
  tabId?: number;
  authMechanism: SessionAuthMechanism;
  reauthMode: SessionReauthMode;
  status: SessionStatus;
  source: SessionSignalSource;
  startedAt: string;
  lastActivityAt: string;
  expiresAt?: string;
  hardDeadlineAt?: string;
  lastRefreshedAt?: string;
  refreshCount: number;
  lastError?: string;
}

export interface ExtensionSessionAlert {
  id: string;
  sessionId: string;
  itemId?: string;
  appTitle: string;
  domain: string;
  loginUrl: string;
  reauthMode: SessionReauthMode;
  severity: 'warning' | 'expired' | 'security_revoked';
  message: string;
  secondsRemaining: number;
  createdAt: string;
  dismissed: boolean;
  canOAuthRefresh: boolean;
}

export interface SessionGuardrailEvaluation {
  decision: 'HEALTHY' | 'AUTO_REFRESH' | 'WARN_PRE_EXPIRY' | 'PROMPT_EXPIRED' | 'REVOKE_SECURITY';
  secondsRemaining: number;
  hardCapReached: boolean;
  idleExceeded: boolean;
  canSilentRefresh: boolean;
  reason: string;
}

const IGNORED_COOKIE_PATTERN =
  /^(_ga|_gid|_gat|_fbp|_fbc|_hj|_clck|_clsk|amplitude|mixpanel|intercom|crisp|hubspot|ajs_|optimizely|segment)/i;

const AUTH_COOKIE_PATTERN =
  /(sess|session|sid|auth|token|jwt|access_token|id_token|refresh_token|connect\.sid|jsessionid|phpsessid|xsrf|logged_in|_gh_sess|user_session|remember|next-auth|__session|__secure-)/i;

export function isAuthSessionCookie(cookieName: string): boolean {
  if (!cookieName || IGNORED_COOKIE_PATTERN.test(cookieName)) return false;
  return AUTH_COOKIE_PATTERN.test(cookieName);
}

/**
 * Extracts only the numeric `exp` timestamp (ms) from a JWT string without exposing the raw token.
 */
export function tryExtractJwtExpMs(rawValue: string): number | null {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim().replace(/^Bearer\s+/i, '');
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const jsonStr = atob(padded);
    const payload = JSON.parse(jsonStr);
    if (typeof payload.exp === 'number' && payload.exp > 1_000_000_000) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractDomainHost(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return urlStr.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

export function evaluateSessionGuardrail(params: {
  session: ExtensionTrackedSession;
  item?: any;
  settings: SessionMonitorSettings;
  nowMs?: number;
  refreshBufferSec?: number;
}): SessionGuardrailEvaluation {
  const { session, item, settings, nowMs = Date.now(), refreshBufferSec = 90 } = params;
  const policy: ExtensionSessionPolicy | undefined = item?.sessionPolicy;

  if (policy?.reuseDetected || session.status === 'revoked') {
    return {
      decision: 'REVOKE_SECURITY',
      secondsRemaining: 0,
      hardCapReached: true,
      idleExceeded: false,
      canSilentRefresh: false,
      reason: 'Refresh token reuse or revocation detected; interactive login required.',
    };
  }

  const startedMs = Date.parse(session.startedAt) || nowMs;
  const lastActiveMs = Date.parse(session.lastActivityAt) || startedMs;

  const hardMaxMin = policy?.hardMaxLifetimeMinutes ?? settings.hardMaxLifetimeMinutes ?? 480;
  const idleMaxMin = policy?.idleTimeoutMinutes ?? 0;
  const warnMin = policy?.notifyLeadMinutes ?? settings.warnMinutes ?? 5;

  const hardDeadlineMs = session.hardDeadlineAt
    ? Date.parse(session.hardDeadlineAt)
    : hardMaxMin > 0
      ? startedMs + hardMaxMin * 60_000
      : Number.POSITIVE_INFINITY;

  const idleDeadlineMs = idleMaxMin > 0 ? lastActiveMs + idleMaxMin * 60_000 : Number.POSITIVE_INFINITY;

  const hardCapReached = Number.isFinite(hardDeadlineMs) && nowMs >= hardDeadlineMs;
  const idleExceeded = Number.isFinite(idleDeadlineMs) && nowMs >= idleDeadlineMs;

  let expiresAtMs = session.expiresAt ? Date.parse(session.expiresAt) : NaN;
  if (Number.isNaN(expiresAtMs) && policy?.sessionTtlMinutes && policy.sessionTtlMinutes > 0) {
    const baseMs = Date.parse(session.lastRefreshedAt || session.startedAt) || startedMs;
    expiresAtMs = baseMs + policy.sessionTtlMinutes * 60_000;
  }

  const secondsRemaining = Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.round((expiresAtMs - nowMs) / 1000))
    : Number.POSITIVE_INFINITY;

  const isExplicitlyExpired =
    session.status === 'expired' ||
    session.source === 'http_401' ||
    session.source === 'login_redirect' ||
    (Number.isFinite(expiresAtMs) && nowMs >= expiresAtMs);

  const effectiveMode: SessionReauthMode = policy?.reauthMode ?? session.reauthMode ?? 'notify_only';
  const hasOAuthRefresh = Boolean(item?.oauth?.refreshToken);

  // Guardrail: never silently replay passwords; only OAuth refresh grants qualify within hard & idle limits
  const canSilentRefresh =
    settings.autoOAuthRefresh &&
    effectiveMode === 'auto_oauth_refresh' &&
    !hardCapReached &&
    !idleExceeded &&
    hasOAuthRefresh;

  if (hardCapReached) {
    return {
      decision: 'PROMPT_EXPIRED',
      secondsRemaining: 0,
      hardCapReached: true,
      idleExceeded,
      canSilentRefresh: false,
      reason: 'Max session lifetime reached; enforcing interactive sign-in.',
    };
  }

  if (canSilentRefresh && (isExplicitlyExpired || (Number.isFinite(secondsRemaining) && secondsRemaining <= refreshBufferSec))) {
    return {
      decision: 'AUTO_REFRESH',
      secondsRemaining: Number.isFinite(secondsRemaining) ? secondsRemaining : 0,
      hardCapReached: false,
      idleExceeded: false,
      canSilentRefresh: true,
      reason: 'Eligible for silent OAuth refresh token rotation.',
    };
  }

  if (isExplicitlyExpired) {
    return {
      decision: 'PROMPT_EXPIRED',
      secondsRemaining: 0,
      hardCapReached: false,
      idleExceeded,
      canSilentRefresh,
      reason: 'Session expired; interactive re-authentication required.',
    };
  }

  if (Number.isFinite(secondsRemaining) && secondsRemaining <= Math.max(60, warnMin * 60)) {
    return {
      decision: 'WARN_PRE_EXPIRY',
      secondsRemaining,
      hardCapReached: false,
      idleExceeded,
      canSilentRefresh,
      reason: `Session expires in ${Math.max(1, Math.ceil(secondsRemaining / 60))}m.`,
    };
  }

  return {
    decision: 'HEALTHY',
    secondsRemaining: Number.isFinite(secondsRemaining) ? secondsRemaining : -1,
    hardCapReached: false,
    idleExceeded,
    canSilentRefresh,
    reason: 'Session is active.',
  };
}
