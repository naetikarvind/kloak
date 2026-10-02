import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { VaultManager } from '@kloak/core';
import { IpcSocketServer } from '../../daemon/dist/ipc/socket-server.js';

describe('Kloak IPC Daemon Protocol', () => {
  const tempDir = path.join(os.tmpdir(), `kloak-ipc-test-${Date.now()}`);
  const tempVaultPath = path.join(tempDir, 'vault.kloak');
  let manager: VaultManager;
  let server: IpcSocketServer;

  before(async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    manager = new VaultManager(tempVaultPath);
    manager.createVault('IpcTestPassword123!');
    server = new IpcSocketServer(manager);
  });

  after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('handles daemon.ping method', async () => {
    const res = await server.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'daemon.ping'
    });

    assert.strictEqual(res.result.pong, true);
    assert.strictEqual(res.result.version, '1.0.0');
  });

  it('handles vault.status method', async () => {
    const res = await server.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'vault.status'
    });

    assert.strictEqual(res.result.isInitialized, true);
    assert.strictEqual(res.result.isUnlocked, true);
  });

  it('handles vault.addItem and vault.getItems via IPC', async () => {
    const addRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 3,
      method: 'vault.addItem',
      params: {
        item: {
          type: 'login',
          title: 'Slack',
          username: 'worker@slack.com',
          password: 'SlackPassword456!',
          urls: ['https://slack.com']
        }
      }
    });

    assert.strictEqual(addRes.result.title, 'Slack');

    const getRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 4,
      method: 'vault.getItems'
    });

    assert.ok(getRes.result.some((i: any) => i.title === 'Slack'));
  });

  it('handles vault.generatePassword and vault.generateTotp', async () => {
    const genRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 5,
      method: 'vault.generatePassword',
      params: { options: { length: 25 } }
    });

    assert.strictEqual(genRes.result.password.length, 25);
    assert.ok(genRes.result.strength);

    const totpRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 6,
      method: 'vault.generateTotp',
      params: { secret: 'JBSWY3DPEHPK3PXP' }
    });

    assert.strictEqual(totpRes.result.token.length, 6);
  });

  it('handles vault.lock and vault.unlock with master password', async () => {
    // 1. Lock vault
    const lockRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 7,
      method: 'vault.lock'
    });
    assert.strictEqual(lockRes.result.success, true);
    assert.strictEqual(lockRes.result.status.isUnlocked, false);

    // 2. Status reflects locked
    const statusRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 8,
      method: 'vault.status'
    });
    assert.strictEqual(statusRes.result.isUnlocked, false);

    // 3. Unlock with wrong password fails
    const failRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 9,
      method: 'vault.unlock',
      params: { masterPassword: 'WrongPassword999!' }
    });
    assert.ok(failRes.error);
    assert.match(failRes.error.message, /master password incorrect/i);

    // 4. Unlock with correct master password succeeds
    const unlockRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 10,
      method: 'vault.unlock',
      params: { masterPassword: 'IpcTestPassword123!' }
    });
    assert.strictEqual(unlockRes.result.success, true);
    assert.strictEqual(unlockRes.result.status.isUnlocked, true);

    // 5. Items are accessible again
    const itemsRes = await server.dispatch({
      jsonrpc: '2.0',
      id: 11,
      method: 'vault.getItems'
    });
    assert.ok(Array.isArray(itemsRes.result));
    assert.ok(itemsRes.result.some((i: any) => i.title === 'Slack'));
  });
});

