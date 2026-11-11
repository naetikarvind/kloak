import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  VaultItem,
  VaultManager,
  normalizeDomain,
  normalizeUsername,
  accountKey,
  calculatePasswordSimilarity,
  calculateItemRisk,
  smartMergeItems,
  autoMergeVaultItems
} from '@kloak/core';

function mockItem(partial: Partial<VaultItem>): VaultItem {
  return {
    id: partial.id || 'id-' + Math.random().toString(36).substring(2),
    type: partial.type || 'login',
    title: partial.title || 'Title',
    username: partial.username,
    password: partial.password,
    urls: partial.urls || [],
    notes: partial.notes,
    tags: partial.tags || [],
    favorite: partial.favorite ?? false,
    trashed: partial.trashed ?? false,
    totpSecret: partial.totpSecret,
    passwordHistory: partial.passwordHistory,
    importSource: partial.importSource,
    createdAt: partial.createdAt || new Date().toISOString(),
    updatedAt: partial.updatedAt || new Date().toISOString()
  };
}

describe('Kloak Smart Deduplication & Auto-Merging Engine', () => {
  test('normalizes domain names, brand aliases, and multi-part TLDs', () => {
    assert.strictEqual(normalizeDomain('https://accounts.google.com/signin/v2'), 'google.com');
    assert.strictEqual(normalizeDomain('https://passwords.google.com'), 'google.com');
    assert.strictEqual(normalizeDomain('login.live.com'), 'microsoft.com');
    assert.strictEqual(normalizeDomain('https://sync.opera.com/web'), 'opera.com');
    assert.strictEqual(normalizeDomain('https://appleid.apple.com/auth'), 'apple.com');
    assert.strictEqual(normalizeDomain('https://www.amazon.co.uk/ap/signin'), 'amazon.co.uk');
    assert.strictEqual(normalizeDomain('http://login.github.com:8080'), 'github.com');
  });

  test('normalizes usernames and generates canonical account keys', () => {
    assert.strictEqual(normalizeUsername('  User.Name@Gmail.com '), 'user.name@gmail.com');
    const item: Partial<VaultItem> = {
      urls: ['https://accounts.google.com/ServiceLogin'],
      username: 'Alice@example.com'
    };
    assert.strictEqual(accountKey(item), 'google.com::alice@example.com');
  });

  test('computes string similarity with Levenshtein distance', () => {
    assert.strictEqual(calculatePasswordSimilarity('Password123!', 'Password123!'), 1.0);
    assert.ok(calculatePasswordSimilarity('Password123!', 'Password123?') > 0.85);
    assert.ok(calculatePasswordSimilarity('abc', 'xyz') < 0.2);
  });

  test('evaluates item risk level, circumference score, and reuse detection', () => {
    const weakItem = mockItem({
      id: 'item-1',
      title: 'Weak Service',
      username: 'user1',
      password: 'password',
      urls: ['https://example.com']
    });
    const weakRisk = calculateItemRisk(weakItem);
    assert.strictEqual(weakRisk.riskLevel, 'high');
    assert.strictEqual(weakRisk.color, '#EF4444');
    assert.ok(weakRisk.score < 50);

    const strongItem = mockItem({
      id: 'item-2',
      title: 'Secure Service',
      username: 'user2',
      password: 'kX9#mQ2$vL8!zR5@wP1&',
      urls: ['https://secure.org'],
      totpSecret: 'JBSWY3DPEHPK3PXP'
    });
    const strongRisk = calculateItemRisk(strongItem);
    assert.strictEqual(strongRisk.riskLevel, 'low');
    assert.strictEqual(strongRisk.color, '#10B981');
    assert.ok(strongRisk.score >= 80);
    assert.strictEqual(strongRisk.has2FA, true);

    // Reuse detection
    const reusedItem = mockItem({
      id: 'item-3',
      title: 'Other Service',
      username: 'user2',
      password: 'kX9#mQ2$vL8!zR5@wP1&',
      urls: ['https://different-service.com']
    });
    const riskWithReused = calculateItemRisk(reusedItem, [strongItem, reusedItem]);
    assert.strictEqual(riskWithReused.isReused, true);
    assert.strictEqual(riskWithReused.reusedCount, 1);
  });

  test('smartly merges duplicate items, preserves notes/tags, and retains password history', () => {
    const existing = mockItem({
      id: 'item-google-1',
      title: 'Google',
      username: 'johndoe@gmail.com',
      password: 'OldPassword123!',
      urls: ['https://accounts.google.com'],
      notes: 'Initial note',
      tags: ['Email'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    });

    const incomingFromOpera = mockItem({
      id: 'opera-import-1',
      title: 'Google Account',
      username: 'johndoe@gmail.com',
      password: 'NewStrongerPassword2026!#$',
      urls: ['https://mail.google.com'],
      notes: 'Note from Opera',
      tags: ['Work'],
      totpSecret: 'JBSWY3DPEHPK3PXP',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      importSource: 'Opera'
    });

    const { merged, wasUpdated } = smartMergeItems(existing, incomingFromOpera);
    assert.strictEqual(wasUpdated, true);
    assert.strictEqual(merged.password, 'NewStrongerPassword2026!#$');
    assert.strictEqual(merged.passwordHistory?.length, 1);
    assert.strictEqual(merged.passwordHistory?.[0].password, 'OldPassword123!');
    assert.strictEqual(merged.totpSecret, 'JBSWY3DPEHPK3PXP');
    assert.ok(merged.urls.includes('https://accounts.google.com'));
    assert.ok(merged.urls.includes('https://mail.google.com'));
    assert.ok(merged.tags?.includes('Email'));
    assert.ok(merged.tags?.includes('Work'));
    assert.ok(merged.notes?.includes('Initial note'));
    assert.ok(merged.notes?.includes('Note from Opera'));
  });

  test('autoMergeVaultItems deduplicates accounts across Google, Microsoft, and Opera imports', () => {
    const existing: VaultItem[] = [
      mockItem({
        id: '1',
        title: 'Google',
        username: 'alice@gmail.com',
        password: 'PassOne123!',
        urls: ['https://accounts.google.com']
      }),
      mockItem({
        id: '2',
        title: 'GitHub',
        username: 'alice',
        password: 'GithubPass123!',
        urls: ['https://github.com']
      })
    ];

    const incoming: VaultItem[] = [
      // Duplicate of Google with updated URL and password
      mockItem({
        id: 'incoming-1',
        title: 'Google Mail',
        username: 'alice@gmail.com',
        password: 'PassOne123!Updated',
        urls: ['https://mail.google.com'],
        updatedAt: '2026-05-01T00:00:00.000Z'
      }),
      // Duplicate of GitHub with exact same credentials
      mockItem({
        id: 'incoming-2',
        title: 'GitHub.com',
        username: 'alice',
        password: 'GithubPass123!',
        urls: ['https://github.com/login']
      }),
      // Brand new account from Microsoft
      mockItem({
        id: 'incoming-3',
        title: 'Microsoft Live',
        username: 'alice@outlook.com',
        password: 'LivePassword999!',
        urls: ['https://login.live.com']
      })
    ];

    const { mergedItems, report } = autoMergeVaultItems(existing, incoming);
    assert.strictEqual(mergedItems.length, 3); // Google, GitHub, Microsoft
    assert.strictEqual(report.exactDuplicatesMerged, 1); // GitHub
    assert.strictEqual(report.updatedPasswordsMerged, 1); // Google
    assert.strictEqual(report.newItemsAdded, 1); // Microsoft

    const google = mergedItems.find(i => i.username === 'alice@gmail.com');
    assert.ok(google);
    assert.strictEqual(google.password, 'PassOne123!Updated');
    assert.strictEqual(google.passwordHistory?.[0].password, 'PassOne123!');
  });

  test('VaultManager integrates auto-merge into importData and provides security audit', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kloak-merge-test-'));
    const vaultPath = path.join(tempDir, 'vault.kloak');
    const vm = new VaultManager(vaultPath);

    vm.createVault('MasterPass123!');

    // Add initial item
    vm.addItem({
      type: 'login',
      title: 'Google',
      username: 'user@gmail.com',
      password: 'OldPassword123!',
      urls: ['https://google.com'],
      tags: [],
      favorite: false,
      trashed: false
    });

    // Import Chrome/Google CSV with same account but new password
    const googleCsv = `name,url,username,password,note\nGoogle,https://accounts.google.com,user@gmail.com,BrandNewPassword456!,Imported note\n`;
    const importRes = vm.importData(googleCsv, 'google-csv');

    assert.ok(importRes.mergeReport);
    assert.strictEqual(importRes.mergeReport.updatedPasswordsMerged, 1);

    const items = vm.getItems();
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].password, 'BrandNewPassword456!');
    assert.strictEqual(items[0].passwordHistory?.[0].password, 'OldPassword123!');

    // Run security audit
    const audit = vm.getSecurityAudit();
    assert.strictEqual(audit.riskSummary.length, 1);
    assert.ok(audit.overallScore > 0);

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
