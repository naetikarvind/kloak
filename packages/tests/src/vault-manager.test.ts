import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { VaultManager } from '@kloak/core';

describe('Kloak Vault Manager & Session Controller', () => {
  const tempDir = path.join(os.tmpdir(), `kloak-test-${Date.now()}`);
  const tempVaultPath = path.join(tempDir, 'vault.kloak');
  const masterPassword = 'MasterPasswordVaultTest123!';

  before(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates and persists a new vault on disk', () => {
    const manager = new VaultManager(tempVaultPath);
    assert.strictEqual(manager.isInitialized(), false);

    manager.createVault(masterPassword);
    assert.strictEqual(manager.isInitialized(), true);
    assert.strictEqual(manager.isUnlocked(), true);
    assert.strictEqual(fs.existsSync(tempVaultPath), true);
  });

  it('locks vault, wipes keys from memory, and unlocks again', () => {
    const manager = new VaultManager(tempVaultPath);
    assert.strictEqual(manager.isInitialized(), true);
    assert.strictEqual(manager.isUnlocked(), false);

    manager.unlock(masterPassword);
    assert.strictEqual(manager.isUnlocked(), true);

    manager.lock();
    assert.strictEqual(manager.isUnlocked(), false);

    manager.unlock(masterPassword);
    assert.strictEqual(manager.isUnlocked(), true);
  });

  it('performs CRUD operations on vault items', () => {
    const manager = new VaultManager(tempVaultPath);
    manager.unlock(masterPassword);

    // Add
    const item = manager.addItem({
      type: 'login',
      title: 'Discord',
      username: 'gamer#1234',
      password: 'DiscordSecret99!',
      urls: ['https://discord.com/login'],
      tags: ['Gaming'],
      favorite: true,
      trashed: false
    });

    assert.ok(item.id);
    assert.strictEqual(manager.getItems().length, 1);

    // Get
    const fetched = manager.getItem(item.id);
    assert.strictEqual(fetched?.title, 'Discord');

    // Update
    const updated = manager.updateItem(item.id, { username: 'pro_gamer#9999' });
    assert.strictEqual(updated.username, 'pro_gamer#9999');

    // Soft delete to Trash
    manager.deleteItem(item.id, false);
    assert.strictEqual(manager.getItems().length, 0);
    assert.strictEqual(manager.getItems(true).length, 1);

    // Restore
    manager.restoreItem(item.id);
    assert.strictEqual(manager.getItems().length, 1);

    // Permanent delete
    manager.deleteItem(item.id, true);
    assert.strictEqual(manager.getItems(true).length, 0);
  });

  it('performs phishing-resistant domain matching', () => {
    const manager = new VaultManager(tempVaultPath);
    manager.unlock(masterPassword);

    manager.addItem({
      type: 'login',
      title: 'GitHub Work',
      username: 'work@github.com',
      password: 'SecretWorkPassword',
      urls: ['https://github.com/login', 'https://gist.github.com'],
      tags: [],
      favorite: false,
      trashed: false
    });

    // Valid matches
    const match1 = manager.matchByUrl('https://github.com/session');
    assert.strictEqual(match1.length, 1);

    const match2 = manager.matchByUrl('https://gist.github.com/new');
    assert.strictEqual(match2.length, 1);

    // Phishing lookalike URL should NOT match!
    const phishMatch = manager.matchByUrl('https://github.com.evil-phishing-site.net/login');
    assert.strictEqual(phishMatch.length, 0);
  });
});
