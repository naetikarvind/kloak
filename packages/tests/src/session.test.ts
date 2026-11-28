import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  VaultManager,
  VaultItem,
  SessionCoordinator,
  evaluateSessionPolicy,
} from '@kloak/core';
import { IpcSocketServer } from '../../daemon/dist/ipc/socket-server.js';

describe('Session Expiration Notification & Auto-Login Guardrails', () => {
  const tempDir = path.join(os.tmpdir(), `kloak-session-test-${Date.now()}`);
  const tempVaultPath = path.join(tempDir, 'vault.kloak');
  let manager: VaultManager;
  let server: IpcSocketServer;

  before(() => {
    fs.mkdirSync(tempDir, { recursive: true });
    manager = new VaultManager(tempVaultPath);
    manager.createVault('SessionTestPass123!');
    server = new IpcSocketServer(manager);
  });

  after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('triggers pre-expiry warning and expired prompt for password-based website without unattended replay', () => {
    const coordinator = new SessionCoordinator();
    const item: VaultItem = {
      id: 'item-pw-1',
      type: 'login',
      title: 'Banking Portal',
      username: 'alice',
      password: 'VerySecretPassword!',
      urls: ['https://bank.example.com/login'],
      tags: [],
      favorite: false,
      trashed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionPolicy: {
        enabled: true,
        reauthMode: 'auto_oauth_refresh', // Even if misconfigured to auto, no OAuth grant -> MUST fail closed
        authMechanism: 'password_mfa',
        sessionTtlMinutes: 30,
        idleTimeoutMinutes: 15,
        hardMaxLifetimeMinutes: 240,
        notifyLeadMinutes: 5,
      },
    };

    const warnExpiresAt = new Date(Date.now() + 120_000).toISOString(); // 2 mins left (< 5m warn lead)
    const warnRes = coordinator.reportEvent(
      {
        url: 'https://bank.example.com/dashboard',
        source: 'cookie_expiry',
        status: 'active',
        expiresAt: warnExpiresAt,
      },
      item,
      manager.getSettings()
    );

    assert.strictEqual(warnRes.evaluation.decision, 'WARN_PRE_EXPIRY');
    assert.strictEqual(warnRes.evaluation.canSilentRefresh, false);
    assert.ok(warnRes.alert);
    assert.strictEqual(warnRes.alert?.severity, 'warning');

    // Now expire the session -> must prompt interactively, never auto-replay raw password
    const expiredRes = coordinator.reportEvent(
      {
        url: 'https://bank.example.com/login',
        source: 'login_redirect',
        status: 'expired',
      },
      item,
      manager.getSettings()
    );

    assert.strictEqual(expiredRes.evaluation.decision, 'PROMPT_EXPIRED');
    assert.strictEqual(expiredRes.evaluation.canSilentRefresh, false);
    assert.strictEqual(expiredRes.session.status, 'expired');
    assert.strictEqual(expiredRes.alert?.severity, 'expired');
  });

  it('enforces hardMaxLifetimeMinutes even when OAuth refresh grant is valid', () => {
    const startedMs = Date.now() - 9 * 60 * 60 * 1000; // 9 hours ago
    const item: VaultItem = {
      id: 'item-oauth-cap',
      type: 'login',
      title: 'Workspace App',
      username: 'alice@corp.com',
      urls: ['https://app.corp.com'],
      oauth: {
        provider: 'google',
        refreshToken: 'refresh-tok-123',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      },
      sessionPolicy: {
        enabled: true,
        reauthMode: 'auto_oauth_refresh',
        authMechanism: 'oauth2_oidc',
        sessionTtlMinutes: 60,
        idleTimeoutMinutes: 30,
        hardMaxLifetimeMinutes: 480, // 8h hard cap
        notifyLeadMinutes: 5,
      },
      tags: [],
      favorite: false,
      trashed: false,
      createdAt: new Date(startedMs).toISOString(),
      updatedAt: new Date(startedMs).toISOString(),
    };

    const evalRes = evaluateSessionPolicy({
      session: {
        id: 'app.corp.com:item-oauth-cap',
        itemId: item.id,
        appTitle: 'Workspace App',
        url: 'https://app.corp.com',
        domain: 'app.corp.com',
        authMechanism: 'oauth2_oidc',
        reauthMode: 'auto_oauth_refresh',
        status: 'expiring_soon',
        source: 'oauth_token',
        startedAt: new Date(startedMs).toISOString(),
        lastActivityAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        refreshCount: 3,
      },
      item,
      settings: manager.getSettings(),
    });

    assert.strictEqual(evalRes.hardCapReached, true);
    assert.strictEqual(evalRes.canSilentRefresh, false);
    assert.strictEqual(evalRes.decision, 'PROMPT_EXPIRED');
  });

  it('performs OAuth refresh token rotation and revokes compromised family on reuse (invalid_grant)', async () => {
    const coordinator = new SessionCoordinator();
    let persistedItem: VaultItem = {
      id: 'item-oauth-rot',
      type: 'login',
      title: 'Cloud Studio',
      username: 'dev@studio.io',
      urls: ['https://studio.io'],
      oauth: {
        provider: 'custom',
        clientId: 'client-123',
        accessToken: 'old-access',
        refreshToken: 'refresh-v1',
        tokenUrl: 'https://studio.io/oauth/token',
        expiresAt: new Date(Date.now() + 20_000).toISOString(),
      },
      sessionPolicy: {
        enabled: true,
        reauthMode: 'auto_oauth_refresh',
        authMechanism: 'oauth2_oidc',
        sessionTtlMinutes: 60,
        idleTimeoutMinutes: 30,
        hardMaxLifetimeMinutes: 480,
        notifyLeadMinutes: 5,
      },
      tags: [],
      favorite: false,
      trashed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    coordinator.reportEvent(
      {
        url: 'https://studio.io/app',
        source: 'oauth_token',
        expiresAt: persistedItem.oauth?.expiresAt,
      },
      persistedItem,
      manager.getSettings()
    );

    const mockOkFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-access-v2',
        refresh_token: 'refresh-v2',
        expires_in: 3600,
      }),
    })) as unknown as typeof fetch;

    const okOutcome = await coordinator.refreshOAuthSession({
      sessionId: 'studio.io:item-oauth-rot',
      item: persistedItem,
      settings: manager.getSettings(),
      persistItem: (u) => { persistedItem = u; },
      fetchFn: mockOkFetch,
    });

    assert.strictEqual(okOutcome.ok, true);
    assert.strictEqual(okOutcome.rotated, true);
    assert.strictEqual(okOutcome.requiresPrompt, false);
    assert.strictEqual(persistedItem.oauth?.refreshToken, 'refresh-v2');
    assert.strictEqual(persistedItem.oauth?.accessToken, 'new-access-v2');

    // Simulate invalid_grant / refresh token reuse attack -> must wipe tokens & revoke
    const mockRevokeFetch = (async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Refresh token reuse detected',
      }),
    })) as unknown as typeof fetch;

    const failOutcome = await coordinator.refreshOAuthSession({
      sessionId: 'studio.io:item-oauth-rot',
      item: persistedItem,
      settings: manager.getSettings(),
      persistItem: (u) => { persistedItem = u; },
      fetchFn: mockRevokeFetch,
    });

    assert.strictEqual(failOutcome.ok, false);
    assert.strictEqual(failOutcome.reuseDetected, true);
    assert.strictEqual(failOutcome.requiresPrompt, true);
    assert.strictEqual(persistedItem.oauth?.refreshToken, undefined);
    assert.strictEqual(persistedItem.sessionPolicy?.reuseDetected, true);
  });

  it('handles cross-app session.* IPC RPC flow end-to-end', async () => {
    const added = await server.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'vault.addItem',
      params: {
        item: {
          type: 'login',
          title: 'Internal Wiki',
          username: 'eng@wiki.local',
          password: 'WikiPassword999!',
          urls: ['https://wiki.local'],
          sessionPolicy: {
            enabled: true,
            reauthMode: 'assisted_reauth',
            authMechanism: 'cookie_timer',
            sessionTtlMinutes: 15,
            idleTimeoutMinutes: 15,
            hardMaxLifetimeMinutes: 240,
            notifyLeadMinutes: 5,
          },
        },
      },
    });

    const itemId = added.result.id;
    const reportRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'session.reportEvent',
      params: {
        itemId,
        url: 'https://wiki.local/docs',
        domain: 'wiki.local',
        source: 'webapp_hook',
        status: 'expiring_soon',
        ttlSeconds: 90,
      },
    });

    assert.strictEqual(reportRes.result.evaluation.decision, 'WARN_PRE_EXPIRY');
    assert.ok(reportRes.result.alert);

    const statusRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 3,
      method: 'session.getStatus',
    });

    assert.ok(statusRes.result.sessions.some((s: any) => s.domain === 'wiki.local'));
    assert.ok(statusRes.result.alerts.some((a: any) => a.domain === 'wiki.local'));

    const alertId = statusRes.result.alerts.find((a: any) => a.domain === 'wiki.local').id;
    await server.dispatch({
      jsonrpc: '2.0',
      id: 4,
      method: 'session.dismissAlert',
      params: { alertId },
    });

    const afterDismiss = await server.dispatch({
      jsonrpc: '2.0',
      id: 5,
      method: 'session.getStatus',
    });
    assert.ok(!afterDismiss.result.alerts.some((a: any) => a.id === alertId));
  });
});
