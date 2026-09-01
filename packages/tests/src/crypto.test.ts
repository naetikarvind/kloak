import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';
import {
  deriveKeyWrappingKey,
  encryptAesGcm,
  decryptAesGcm,
  initializeVault,
  unlockVault,
  changeMasterPassword,
  zeroizeBuffer,
  DEFAULT_SETTINGS
} from '@kloak/core';

describe('Kloak Crypto Engine', () => {
  const masterPassword = 'MySecretSuperPassword123!';
  const saltHex = crypto.randomBytes(32).toString('hex');

  it('derives a 256-bit Key Wrapping Key (KWK) using PBKDF2', () => {
    const kwk = deriveKeyWrappingKey(masterPassword, saltHex, 10000);
    assert.strictEqual(kwk.length, 32);
  });

  it('performs AES-256-GCM authenticated encryption and decryption', () => {
    const key = crypto.randomBytes(32);
    const plaintext = 'Super confidential secret data for vault item';

    const container = encryptAesGcm(key, plaintext);
    assert.ok(container.iv);
    assert.ok(container.ciphertext);
    assert.ok(container.tag);

    const decryptedBuf = decryptAesGcm(key, container);
    assert.strictEqual(decryptedBuf.toString('utf-8'), plaintext);
  });

  it('throws on tampered ciphertext or tag (GCM authentication integrity)', () => {
    const key = crypto.randomBytes(32);
    const container = encryptAesGcm(key, 'Real data');

    // Tamper ciphertext
    const tampered = {
      ...container,
      ciphertext: '00' + container.ciphertext.slice(2)
    };

    assert.throws(() => {
      decryptAesGcm(key, tampered);
    }, /Decryption failed/);
  });

  it('initializes a full two-key vault and unlocks with master password', () => {
    const payload = {
      version: 1,
      items: [
        {
          id: 'test-1',
          type: 'login' as const,
          title: 'GitHub',
          username: 'user@github.com',
          password: 'Password999!',
          urls: ['https://github.com'],
          tags: ['Dev'],
          favorite: true,
          trashed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      folders: [{ id: 'f1', name: 'Work' }],
      settings: DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString()
    };

    const { vaultFile } = initializeVault(masterPassword, payload);
    assert.strictEqual(vaultFile.header.formatVersion, 1);
    assert.ok(vaultFile.header.wrappedVaultKey);

    const { payload: unlockedPayload } = unlockVault(vaultFile, masterPassword);
    assert.strictEqual(unlockedPayload.items.length, 1);
    assert.strictEqual(unlockedPayload.items[0].title, 'GitHub');
  });

  it('fails unlock when master password is incorrect', () => {
    const { vaultFile } = initializeVault(masterPassword, {
      version: 1,
      items: [],
      folders: [],
      settings: DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString()
    });

    assert.throws(() => {
      unlockVault(vaultFile, 'WrongPassword456!');
    }, /Master password incorrect/);
  });

  it('re-wraps vault key when master password changes without modifying payload', () => {
    const payload = {
      version: 1,
      items: [{
        id: '1',
        type: 'login' as const,
        title: 'Bank',
        password: 'OriginalBankPassword',
        urls: [],
        tags: [],
        favorite: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      folders: [],
      settings: DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString()
    };

    const { vaultFile } = initializeVault(masterPassword, payload);

    const newPass = 'NewMasterPass789!#';
    const updatedVaultFile = changeMasterPassword(vaultFile, masterPassword, newPass);

    // Old password should now fail
    assert.throws(() => {
      unlockVault(updatedVaultFile, masterPassword);
    });

    // New password should unlock successfully
    const { payload: newUnlocked } = unlockVault(updatedVaultFile, newPass);
    assert.strictEqual(newUnlocked.items[0].password, 'OriginalBankPassword');
  });

  it('zeroizes memory buffers effectively', () => {
    const secretBuf = Buffer.from('SensitiveSecretString123');
    zeroizeBuffer(secretBuf);
    assert.ok(secretBuf.every(b => b === 0));
  });
});
