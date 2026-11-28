/**
 * Kloak Core — Cross-Application Session Monitor & Conflict Guardrail Engine
 *
 * Security invariants enforced by design:
 * 1. Never stores plaintext passwords outside the encrypted VaultPayload; never auto-submits passwords silently.
 * 2. Silent auto-login is restricted to OAuth 2.0 / OIDC token refresh grants within hardMaxLifetimeMinutes & idle limits.
 * 3. Refresh token rotation with reuse detection revokes compromised token families and fails closed to user prompt.
 */

import * as crypto from 'node:crypto';
import {
  SessionAuthMechanism,
  SessionExpiryAlert,
  SessionPolicy,
  SessionReauthMode,
  SessionSignalSource,
  TrackedSession,
  VaultItem,
  VaultSettings,
} from '../models/vault.js';
import { OAUTH_PROVIDERS } from '../crypto/oauth.js';

export type SessionEvaluationDecision =
  | 'HEALTHY'
  | 'AUTO_REFRESH'
  | 'WARN_PRE_EXPIRY'
  | 'PROMPT_EXPIRED'
  | 'REVOKE_SECURITY';

export interface SessionEvaluationResult {
  decision: SessionEvaluationDecision;
  secondsRemaining: number;
  hardCapReached: boolean;
  idleExceeded: boolean;
  canSilentRefresh: boolean;
  reason: string;
}

export interface ReportSessionEventInput {
  sessionId?: string;
  itemId?: string;
  appTitle?: string;
  url: string;
  domain?: string;
  authMechanism?: SessionAuthMechanism;
  reauthMode?: SessionReauthMode;
  status?: 'active' | 'expiring_soon' | 'expired' | 'revoked';
  source: SessionSignalSource;
  expiresAt?: string;
  ttlSeconds?: number;
  lastActivityAt?: string;
  error?: string;
}

export interface OAuthRefreshOutcome {
  ok: boolean;
  rotated: boolean;
  newExpiresAt?: string;
  reuseDetected?: boolean;
  requiresPrompt: boolean;
  reason: string;
  updatedItem?: VaultItem;
}

export function extractDomainFromUrl(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return urlStr.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

export function resolveOAuthTokenEndpoint(item?: VaultItem, policy?: SessionPolicy): string | null {
  if (policy?.tokenEndpoint && policy.tokenEndpoint.trim()) {
    return policy.tokenEndpoint.trim();
  }
  if (item?.oauth?.tokenUrl && item.oauth.tokenUrl.trim()) {
    return item.oauth.tokenUrl.trim();
  }
  if (item?.oauth?.provider && item.oauth.provider in OAUTH_PROVIDERS) {
    const endpoint = OAUTH_PROVIDERS[item.oauth.provider].tokenUrl;
    return endpoint || null;
  }
  return null;
}

/**
 * Evaluates a tracked session against security guardrails and its app/item policy.
 * Conflicts between silent auto-login and security limits always resolve in favor of security.
 */
export function evaluateSessionPolicy(params: {
  session: TrackedSession;
  item?: VaultItem;
  settings?: Partial<VaultSettings>;
  nowMs?: number;
  refreshBufferSec?: number;
}): SessionEvaluationResult {
  const { session, item, settings, nowMs = Date.now(), refreshBufferSec = 90 } = params;
  const policy = item?.sessionPolicy;

  if (policy?.reuseDetected || session.status === 'revoked') {
    return {
      decision: 'REVOKE_SECURITY',
      secondsRemaining: 0,
      hardCapReached: true,
      idleExceeded: false,
      canSilentRefresh: false,
      reason: 'Refresh token reuse or revocation detected; interactive re-login required.',
    };
  }

  const startedMs = Date.parse(session.startedAt) || nowMs;
  const lastActiveMs = Date.parse(session.lastActivityAt) || startedMs;

  const hardMaxMin = policy?.hardMaxLifetimeMinutes ?? settings?.defaultHardMaxLifetimeMinutes ?? 480;
  const idleMaxMin = policy?.idleTimeoutMinutes ?? 0;
  const warnMin = policy?.notifyLeadMinutes ?? settings?.defaultSessionWarnMinutes ?? 5;

  const hardDeadlineMs = session.hardDeadlineAt
    ? Date.parse(session.hardDeadlineAt)
    : hardMaxMin > 0
      ? startedMs + hardMaxMin * 60_000
      : Number.POSITIVE_INFINITY;

  const idleDeadlineMs = idleMaxMin > 0 ? lastActiveMs + idleMaxMin * 60_000 : Number.POSITIVE_INFINITY;

  const hardCapReached = Number.isFinite(hardDeadlineMs) && nowMs >= hardDeadlineMs;
  const idleExceeded = Number.isFinite(idleDeadlineMs) && nowMs >= idleDeadlineMs;

  let expiresAtMs = session.expiresAt ? Date.parse(session.expiresAt) : NaN;
  if (Number.isNaN(expiresAtMs) && policy && policy.sessionTtlMinutes > 0) {
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

  const globalAutoRefreshAllowed = settings?.autoOAuthRefreshEnabled !== false;
  const effectiveMode: SessionReauthMode = policy?.reauthMode ?? session.reauthMode ?? 'notify_only';
  const hasOAuthGrant = Boolean(item?.oauth?.refreshToken && resolveOAuthTokenEndpoint(item, policy));

  // Conflict Resolution Guardrail:
  // Unattended auto-login ONLY allowed for OAuth/OIDC tokens within hardMax + idle bounds.
  const canSilentRefresh =
    globalAutoRefreshAllowed &&
    effectiveMode === 'auto_oauth_refresh' &&
    !hardCapReached &&
    !idleExceeded &&
    hasOAuthGrant;

  if (hardCapReached) {
    return {
      decision: 'PROMPT_EXPIRED',
      secondsRemaining: 0,
      hardCapReached: true,
      idleExceeded,
      canSilentRefresh: false,
      reason: 'Maximum allowed session lifetime reached; enforcing interactive authentication.',
    };
  }

  if (canSilentRefresh && (isExplicitlyExpired || secondsRemaining <= refreshBufferSec)) {
    return {
      decision: 'AUTO_REFRESH',
      secondsRemaining: Number.isFinite(secondsRemaining) ? secondsRemaining : 0,
      hardCapReached: false,
      idleExceeded: false,
      canSilentRefresh: true,
      reason: 'OAuth/OIDC refresh token eligible for silent rotation within compliance window.',
    };
  }

  if (isExplicitlyExpired) {
    return {
      decision: 'PROMPT_EXPIRED',
      secondsRemaining: 0,
      hardCapReached: false,
      idleExceeded,
      canSilentRefresh,
      reason:
        effectiveMode === 'auto_oauth_refresh' && !hasOAuthGrant
          ? 'Session expired without an OAuth refresh grant; falling back safely to user login prompt.'
          : 'Session has expired; interactive sign-in required.',
    };
  }

  if (Number.isFinite(secondsRemaining) && secondsRemaining <= warnMin * 60) {
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

/**
 * Coordinates cross-application session tracking, deduplicated alerts, and single-flight OAuth rotation.
 */
export class SessionCoordinator {
  private sessions = new Map<string, TrackedSession>();
  private alerts = new Map<string, SessionExpiryAlert>();
  private refreshLocks = new Set<string>();

  public reportEvent(
    input: ReportSessionEventInput,
    item?: VaultItem,
    settings?: Partial<VaultSettings>
  ): { session: TrackedSession; evaluation: SessionEvaluationResult; alert?: SessionExpiryAlert } {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const domain = (input.domain || extractDomainFromUrl(input.url)).toLowerCase();
    const sessionId = input.sessionId || `${domain}:${item?.id || 'site'}`;
    const existing = this.sessions.get(sessionId);

    const policy = item?.sessionPolicy;
    const hardMaxMin = policy?.hardMaxLifetimeMinutes ?? settings?.defaultHardMaxLifetimeMinutes ?? 480;
    const ttlMin = policy?.sessionTtlMinutes ?? settings?.defaultSessionTtlMinutes ?? 0;

    let expiresAt = input.expiresAt;
    if (!expiresAt && input.ttlSeconds && input.ttlSeconds > 0) {
      expiresAt = new Date(nowMs + input.ttlSeconds * 1000).toISOString();
    } else if (!expiresAt && existing?.expiresAt && input.status !== 'expired') {
      expiresAt = existing.expiresAt;
    } else if (!expiresAt && item?.oauth?.expiresAt && input.status !== 'expired') {
      expiresAt = item.oauth.expiresAt;
    } else if (!expiresAt && ttlMin > 0 && input.status !== 'expired') {
      expiresAt = new Date(nowMs + ttlMin * 60_000).toISOString();
    }

    const startedAt =
      input.status === 'active' && existing?.status === 'expired'
        ? nowIso
        : existing?.startedAt || nowIso;

    const hardDeadlineAt =
      existing?.hardDeadlineAt && !(input.status === 'active' && existing.status === 'expired')
        ? existing.hardDeadlineAt
        : hardMaxMin > 0
          ? new Date(Date.parse(startedAt) + hardMaxMin * 60_000).toISOString()
          : undefined;

    const inferredMechanism: SessionAuthMechanism =
      input.authMechanism ||
      policy?.authMechanism ||
      (item?.oauth?.refreshToken ? 'oauth2_oidc' : 'cookie_timer');

    const session: TrackedSession = {
      id: sessionId,
      itemId: input.itemId || item?.id || existing?.itemId,
      appTitle: input.appTitle || item?.title || existing?.appTitle || domain || 'Web App',
      url: input.url || existing?.url || `https://${domain}`,
      domain,
      authMechanism: inferredMechanism,
      reauthMode: input.reauthMode || policy?.reauthMode || existing?.reauthMode || 'notify_only',
      status: input.status || existing?.status || 'active',
      source: input.source || existing?.source || 'cookie_expiry',
      startedAt,
      lastActivityAt: input.lastActivityAt || nowIso,
      expiresAt,
      hardDeadlineAt,
      lastRefreshedAt: existing?.lastRefreshedAt,
      refreshCount: existing?.refreshCount ?? 0,
      lastError: input.error,
    };

    const evaluation = evaluateSessionPolicy({ session, item, settings, nowMs });

    if (evaluation.decision === 'REVOKE_SECURITY') {
      session.status = 'revoked';
    } else if (evaluation.decision === 'PROMPT_EXPIRED') {
      session.status = 'expired';
    } else if (evaluation.decision === 'WARN_PRE_EXPIRY') {
      session.status = 'expiring_soon';
    } else if (session.status !== 'expired' && session.status !== 'revoked') {
      session.status = 'active';
    }

    this.sessions.set(sessionId, session);

    let generatedAlert: SessionExpiryAlert | undefined;
    if (
      evaluation.decision === 'WARN_PRE_EXPIRY' ||
      evaluation.decision === 'PROMPT_EXPIRED' ||
      evaluation.decision === 'REVOKE_SECURITY'
    ) {
      const severity: SessionExpiryAlert['severity'] =
        evaluation.decision === 'REVOKE_SECURITY'
          ? 'security_revoked'
          : evaluation.decision === 'PROMPT_EXPIRED'
            ? 'expired'
            : 'warning';
      const alertKey = `${session.id}:${severity}`;
      const prior = this.alerts.get(alertKey);
      if (!prior || prior.dismissed === false) {
        generatedAlert = {
          id: alertKey,
          sessionId: session.id,
          itemId: session.itemId,
          appTitle: session.appTitle,
          domain: session.domain,
          loginUrl: policy?.loginUrl || item?.urls?.[0] || session.url,
          severity,
          message:
            severity === 'security_revoked'
              ? `${session.appTitle} refresh token was revoked or reused. Interactive sign-in required.`
              : severity === 'expired'
                ? `${session.appTitle} session has expired. Sign in again to continue.`
                : `${session.appTitle} session expires in ${Math.max(1, Math.ceil(evaluation.secondsRemaining / 60))}m.`,
          secondsRemaining: Math.max(0, evaluation.secondsRemaining),
          createdAt: prior?.createdAt || nowIso,
          dismissed: prior?.dismissed ?? false,
        };
        this.alerts.set(alertKey, generatedAlert);
      }
    } else if (session.status === 'active') {
      // Clear stale expired/warning alerts when session becomes healthy again
      for (const sev of ['warning', 'expired'] as const) {
        this.alerts.delete(`${session.id}:${sev}`);
      }
    }

    return { session, evaluation, alert: generatedAlert };
  }

  public recordHeartbeat(sessionId: string): TrackedSession | null {
    const existing = this.sessions.get(sessionId);
    if (!existing) return null;
    existing.lastActivityAt = new Date().toISOString();
    this.sessions.set(sessionId, existing);
    return existing;
  }

  public dismissAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    alert.dismissed = true;
    this.alerts.set(alertId, alert);
    return true;
  }

  public getStatus(): { sessions: TrackedSession[]; alerts: SessionExpiryAlert[] } {
    return {
      sessions: Array.from(this.sessions.values()).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
      alerts: Array.from(this.alerts.values()).filter(a => !a.dismissed),
    };
  }

  /**
   * Executes single-flight OAuth 2.0 Refresh Token Rotation with Reuse Detection.
   */
  public async refreshOAuthSession(params: {
    sessionId: string;
    item: VaultItem;
    settings?: Partial<VaultSettings>;
    persistItem: (updated: VaultItem) => void;
    fetchFn?: typeof fetch;
  }): Promise<OAuthRefreshOutcome> {
    const { sessionId, item, settings, persistItem, fetchFn = fetch } = params;
    if (this.refreshLocks.has(sessionId)) {
      return {
        ok: false,
        rotated: false,
        requiresPrompt: false,
        reason: 'Refresh already in progress for this session.',
      };
    }

    const session = this.sessions.get(sessionId) || {
      id: sessionId,
      itemId: item.id,
      appTitle: item.title,
      url: item.urls[0] || '',
      domain: extractDomainFromUrl(item.urls[0] || item.title),
      authMechanism: 'oauth2_oidc' as const,
      reauthMode: item.sessionPolicy?.reauthMode || 'auto_oauth_refresh',
      status: 'expiring_soon' as const,
      source: 'oauth_token' as const,
      startedAt: item.sessionPolicy?.lastAuthenticatedAt || item.createdAt,
      lastActivityAt: new Date().toISOString(),
      expiresAt: item.oauth?.expiresAt,
      refreshCount: 0,
    };

    const evaluation = evaluateSessionPolicy({ session, item, settings });
    if (!evaluation.canSilentRefresh) {
      return {
        ok: false,
        rotated: false,
        requiresPrompt: true,
        reason: evaluation.reason,
      };
    }

    const tokenUrl = resolveOAuthTokenEndpoint(item, item.sessionPolicy);
    const refreshToken = item.oauth?.refreshToken;
    if (!tokenUrl || !refreshToken) {
      return {
        ok: false,
        rotated: false,
        requiresPrompt: true,
        reason: 'Missing OAuth tokenUrl or refreshToken.',
      };
    }

    this.refreshLocks.add(sessionId);
    session.status = 'refreshing';
    this.sessions.set(sessionId, session);

    try {
      const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      if (item.oauth?.clientId) {
        form.set('client_id', item.oauth.clientId);
      }

      const response = await fetchFn(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: form.toString(),
      });

      const body = (await response.json().catch(() => ({}))) as Record<string, any>;

      if (!response.ok || !body.access_token) {
        const errCode = String(body.error || '').toLowerCase();
        const isReuseOrRevoked = errCode === 'invalid_grant' || response.status === 400 || response.status === 401;

        if (isReuseOrRevoked) {
          // RFC 9700 Reuse Detection / Token Revocation: wipe compromised grants and fail closed
          const revokedItem: VaultItem = {
            ...item,
            oauth: item.oauth
              ? { ...item.oauth, accessToken: undefined, refreshToken: undefined }
              : undefined,
            sessionPolicy: {
              ...(item.sessionPolicy || {
                enabled: true,
                reauthMode: 'notify_only',
                authMechanism: 'oauth2_oidc',
                sessionTtlMinutes: 60,
                idleTimeoutMinutes: 30,
                hardMaxLifetimeMinutes: 480,
                notifyLeadMinutes: 5,
              }),
              tokenFamilyId: item.sessionPolicy?.tokenFamilyId || crypto.randomUUID(),
              reuseDetected: true,
            },
            updatedAt: new Date().toISOString(),
          };
          persistItem(revokedItem);
          session.status = 'revoked';
          session.lastError = body.error_description || body.error || `HTTP ${response.status}`;
          this.sessions.set(sessionId, session);

          return {
            ok: false,
            rotated: false,
            reuseDetected: true,
            requiresPrompt: true,
            reason: 'OAuth refresh token rejected/revoked; token family cleared. Interactive login required.',
            updatedItem: revokedItem,
          };
        }

        session.status = 'expired';
        session.lastError = body.error_description || `HTTP ${response.status}`;
        this.sessions.set(sessionId, session);
        return {
          ok: false,
          rotated: false,
          requiresPrompt: true,
          reason: `OAuth refresh failed (${session.lastError}).`,
        };
      }

      const nowIso = new Date().toISOString();
      const expiresIn = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 3600;
      const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const rotated = Boolean(body.refresh_token && body.refresh_token !== refreshToken);

      const updatedItem: VaultItem = {
        ...item,
        oauth: {
          ...(item.oauth || { provider: 'custom' }),
          accessToken: body.access_token,
          refreshToken: body.refresh_token || refreshToken,
          expiresAt: newExpiresAt,
        },
        sessionPolicy: {
          ...(item.sessionPolicy || {
            enabled: true,
            reauthMode: 'auto_oauth_refresh',
            authMechanism: 'oauth2_oidc',
            sessionTtlMinutes: Math.round(expiresIn / 60),
            idleTimeoutMinutes: 30,
            hardMaxLifetimeMinutes: 480,
            notifyLeadMinutes: 5,
          }),
          lastRefreshedAt: nowIso,
          tokenFamilyId: item.sessionPolicy?.tokenFamilyId || crypto.randomUUID(),
          reuseDetected: false,
        },
        updatedAt: nowIso,
      };

      persistItem(updatedItem);

      session.status = 'active';
      session.expiresAt = newExpiresAt;
      session.lastRefreshedAt = nowIso;
      session.refreshCount += 1;
      session.lastError = undefined;
      this.sessions.set(sessionId, session);

      for (const sev of ['warning', 'expired', 'security_revoked'] as const) {
        this.alerts.delete(`${sessionId}:${sev}`);
      }

      return {
        ok: true,
        rotated,
        newExpiresAt,
        requiresPrompt: false,
        reason: rotated ? 'OAuth token refreshed and rotated.' : 'OAuth access token refreshed.',
        updatedItem,
      };
    } catch (err: any) {
      session.status = 'expired';
      session.lastError = err?.message || 'Network error';
      this.sessions.set(sessionId, session);
      return {
        ok: false,
        rotated: false,
        requiresPrompt: true,
        reason: `Network error during token refresh: ${session.lastError}`,
      };
    } finally {
      this.refreshLocks.delete(sessionId);
    }
  }
}
