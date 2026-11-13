import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  initializeVault,
  unlockVault,
  unlockVaultWithHardwareKey,
  unlockVaultWithPasswordAndHardwareKey,
  registerHardwareKeyToVault,
  removeHardwareKeyFromVault,
  deriveHardwareKeyWrappingKey,
  deriveDualFactorKeyWrappingKey,
  wrapVaultKeyWithHardwareSecret,
  unwrapVaultKeyWithHardwareSecret,
  generateHardwareKeySalt,
  generateHardwareKeyChallenge,
  VaultManager,
  HardwareKeyCredential
} from '@kloak/core';

describe('Kloak Hardware Security Key (FIDO2 / YubiKey) Compatibility', () => {
  const masterPassword = 'MasterPassword2026!#';
  const mockHardwareSecretHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const saltHex = generateHardwareKeySalt();

  const mockCredential: HardwareKeyCredential = {
    id: 'fido2-cred-yubikey-5c-nfc-001',
    publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
    algorithm: -7, // ES256
    transports: ['usb', 'nfc'],
    prfEnabled: true,
    name: 'YubiKey 5C NFC (Primary)',
    registeredAt: new Date().toISOString()
  };

  it('derives a 256-bit Key Wrapping Key from hardware secret using HKDF', () => {
    const kwk = deriveHardwareKeyWrappingKey(mockHardwareSecretHex, saltHex);
    assert.strictEqual(kwk.length, 32);

    // Deterministic with same salt
    const kwk2 = deriveHardwareKeyWrappingKey(mockHardwareSecretHex, saltHex);
    assert.strictEqual(kwk.toString('hex'), kwk2.toString('hex'));

    // Different salt yields different key
    const differentSalt = generateHardwareKeySalt();
    const kwk3 = deriveHardwareKeyWrappingKey(mockHardwareSecretHex, differentSalt);
    assert.notStrictEqual(kwk.toString('hex'), kwk3.toString('hex'));
  });

  it('derives dual-factor Key Wrapping Key requiring BOTH password and hardware key', () => {
    const dualKwk = deriveDualFactorKeyWrappingKey(masterPassword, mockHardwareSecretHex, saltHex, 10000);
    assert.strictEqual(dualKwk.length, 32);

    // Wrong password generates different key
    const wrongPasswordKwk = deriveDualFactorKeyWrappingKey('WrongPassword123', mockHardwareSecretHex, saltHex, 10000);
    assert.notStrictEqual(dualKwk.toString('hex'), wrongPasswordKwk.toString('hex'));

    // Wrong hardware secret generates different key
    const wrongSecretKwk = deriveDualFactorKeyWrappingKey(masterPassword, 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', saltHex, 10000);
    assert.notStrictEqual(dualKwk.toString('hex'), wrongSecretKwk.toString('hex'));
  });

  it('wraps and unwraps Vault Key using hardware key secret', () => {
    const vaultKey = crypto.randomBytes(32);
    const wrapped = wrapVaultKeyWithHardwareSecret(vaultKey, mockHardwareSecretHex, saltHex);
    assert.ok(wrapped.iv);
    assert.ok(wrapped.ciphertext);
    assert.ok(wrapped.tag);

    const unwrapped = unwrapVaultKeyWithHardwareSecret(wrapped, mockHardwareSecretHex, saltHex);
    assert.strictEqual(unwrapped.toString('hex'), vaultKey.toString('hex'));

    // Failing with wrong secret
    assert.throws(() => {
      unwrapVaultKeyWithHardwareSecret(wrapped, '0000000000000000000000000000000000000000000000000000000000000000', saltHex);
    }, /Hardware key verification failed/);
  });

  it('registers hardware key to vault and unlocks vault directly with hardware key (Hardware-Only Mode)', () => {
    const initialPayload = {
      version: 1,
      items: [
        {
          id: 'test-item-1',
          type: 'login' as const,
          title: 'Secure Server',
          username: 'admin',
          password: 'ServerPassword99!',
          urls: ['https://server.local'],
          tags: ['infra'],
          favorite: true,
          trashed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      folders: [],
      settings: {
        autoLockMinutes: 15,
        clearClipboardSeconds: 30,
        biometricsEnabled: false,
        defaultPasswordLength: 20,
        defaultPasswordRules: { uppercase: true, lowercase: true, numbers: true, symbols: true, avoidAmbiguous: false }
      },
      updatedAt: new Date().toISOString()
    };

    const { vaultFile, vaultKey } = initializeVault(masterPassword, initialPayload);

    // Register hardware key
    const updatedVaultFile = registerHardwareKeyToVault(
      vaultFile,
      vaultKey,
      mockCredential,
      mockHardwareSecretHex,
      'hardware_only'
    );

    assert.ok(updatedVaultFile.header.hardwareKey);
    assert.strictEqual(updatedVaultFile.header.hardwareKey?.enabled, true);
    assert.strictEqual(updatedVaultFile.header.hardwareKey?.mode, 'hardware_only');
    assert.strictEqual(updatedVaultFile.header.hardwareKey?.credentials.length, 1);
    assert.strictEqual(updatedVaultFile.header.hardwareKey?.credentials[0].name, 'YubiKey 5C NFC (Primary)');

    // Unlock using hardware key without entering master password!
    const unlocked = unlockVaultWithHardwareKey(updatedVaultFile, mockHardwareSecretHex);
    assert.strictEqual(unlocked.payload.items.length, 1);
    assert.strictEqual(unlocked.payload.items[0].title, 'Secure Server');
    assert.strictEqual(unlocked.vaultKey.toString('hex'), vaultKey.toString('hex'));

    // Master password still works as backup
    const unlockedViaPassword = unlockVault(updatedVaultFile, masterPassword);
    assert.strictEqual(unlockedViaPassword.payload.items[0].title, 'Secure Server');
  });

  it('supports Dual-Factor Mode (Master Password + Hardware Key required together)', () => {
    const initialPayload = {
      version: 1,
      items: [],
      folders: [],
      settings: {
        autoLockMinutes: 15,
        clearClipboardSeconds: 30,
        biometricsEnabled: false,
        defaultPasswordLength: 20,
        defaultPasswordRules: { uppercase: true, lowercase: true, numbers: true, symbols: true, avoidAmbiguous: false }
      },
      updatedAt: new Date().toISOString()
    };

    const { vaultFile, vaultKey } = initializeVault(masterPassword, initialPayload);

    // Register in dual factor mode
    const dualVaultFile = registerHardwareKeyToVault(
      vaultFile,
      vaultKey,
      mockCredential,
      mockHardwareSecretHex,
      'password_plus_hardware',
      masterPassword
    );

    assert.strictEqual(dualVaultFile.header.hardwareKey?.mode, 'password_plus_hardware');

    // Trying hardware only should reject
    assert.throws(() => {
      unlockVaultWithHardwareKey(dualVaultFile, mockHardwareSecretHex);
    }, /requires both Master Password and Hardware Key/);

    // Unlocking with both password and hardware key succeeds
    const unlocked = unlockVaultWithPasswordAndHardwareKey(dualVaultFile, masterPassword, mockHardwareSecretHex);
    assert.ok(unlocked.payload);
    assert.strictEqual(unlocked.vaultKey.toString('hex'), vaultKey.toString('hex'));

    // Wrong password with correct hardware key fails
    assert.throws(() => {
      unlockVaultWithPasswordAndHardwareKey(dualVaultFile, 'WrongPassword!', mockHardwareSecretHex);
    }, /Hardware key verification failed/);

    // Correct password with wrong hardware key fails
    assert.throws(() => {
      unlockVaultWithPasswordAndHardwareKey(dualVaultFile, masterPassword, '0000000000000000000000000000000000000000000000000000000000000000');
    }, /Hardware key verification failed/);
  });

  it('removes hardware key configuration cleanly', () => {
    const { vaultFile, vaultKey } = initializeVault(masterPassword, {
      version: 1, items: [], folders: [], settings: { autoLockMinutes: 15, clearClipboardSeconds: 30, biometricsEnabled: false, defaultPasswordLength: 20, defaultPasswordRules: { uppercase: true, lowercase: true, numbers: true, symbols: true, avoidAmbiguous: false } }, updatedAt: new Date().toISOString()
    });

    const withHw = registerHardwareKeyToVault(vaultFile, vaultKey, mockCredential, mockHardwareSecretHex);
    assert.ok(withHw.header.hardwareKey);

    const removed = removeHardwareKeyFromVault(withHw);
    assert.strictEqual(removed.header.hardwareKey, undefined);

    // Unlocking with hardware key fails once removed
    assert.throws(() => {
      unlockVaultWithHardwareKey(removed, mockHardwareSecretHex);
    }, /Hardware key is not registered/);
  });

  it('VaultManager provides full lifecycle for hardware key registration, unlocking, and removal', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kloak-hw-test-'));
    const vaultPath = path.join(tmpDir, 'vault.kloak');

    try {
      const vm = new VaultManager(vaultPath);
      vm.createVault(masterPassword);

      assert.strictEqual(vm.getStatus().hardwareKeyEnabled, false);

      // Register hardware key
      vm.registerHardwareKey(mockCredential, mockHardwareSecretHex, 'hardware_only');

      const status = vm.getStatus();
      assert.strictEqual(status.hardwareKeyEnabled, true);
      assert.strictEqual(status.hardwareKeyMode, 'hardware_only');
      assert.strictEqual(status.hardwareKeyCount, 1);

      const hwConfig = vm.getHardwareKeyConfig();
      assert.strictEqual(hwConfig?.credentials[0].id, mockCredential.id);

      // Lock vault
      vm.lock();
      assert.strictEqual(vm.isUnlocked(), false);

      // Unlock with hardware key!
      vm.unlockWithHardwareKey(mockHardwareSecretHex);
      assert.strictEqual(vm.isUnlocked(), true);

      // Lock again
      vm.lock();

      // Wrong key throws error
      assert.throws(() => {
        vm.unlockWithHardwareKey('9999999999999999999999999999999999999999999999999999999999999999');
      }, /Hardware key verification failed/);

      // Unlock with master password still works
      vm.unlock(masterPassword);
      assert.strictEqual(vm.isUnlocked(), true);

      // Remove hardware key
      vm.removeHardwareKey();
      assert.strictEqual(vm.getStatus().hardwareKeyEnabled, false);
      assert.strictEqual(vm.getHardwareKeyConfig(), undefined);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates deterministic WebAuthn challenge from salt', () => {
    const ch1 = generateHardwareKeyChallenge(saltHex, 'kloak.app');
    const ch2 = generateHardwareKeyChallenge(saltHex, 'kloak.app');
    assert.strictEqual(ch1, ch2);
    assert.strictEqual(ch1.length, 64); // 32 bytes in hex
  });
});
