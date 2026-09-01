import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  generatePassword,
  generatePassphrase,
  evaluatePasswordStrength
} from '@kloak/core';

describe('Kloak Password & Passphrase Generator', () => {
  it('generates random password with exact requested length', () => {
    const pwd = generatePassword({ length: 32 });
    assert.strictEqual(pwd.length, 32);
  });

  it('guarantees character categories when toggled on', () => {
    const pwd = generatePassword({
      length: 24,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true
    });

    assert.ok(/[A-Z]/.test(pwd), 'Should contain uppercase');
    assert.ok(/[a-z]/.test(pwd), 'Should contain lowercase');
    assert.ok(/[0-9]/.test(pwd), 'Should contain numbers');
    assert.ok(/[^a-zA-Z0-9]/.test(pwd), 'Should contain symbols');
  });

  it('excludes ambiguous characters when avoidAmbiguous is set', () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generatePassword({ length: 30, avoidAmbiguous: true });
      assert.ok(!/[0O1lI|\[\]{}()/'"`~,;:.<>]/.test(pwd), `Ambiguous character detected in ${pwd}`);
    }
  });

  it('generates multi-word EFF passphrases', () => {
    const phrase = generatePassphrase({ wordsCount: 5, separator: '-' });
    const parts = phrase.split('-');
    assert.strictEqual(parts.length, 5);
    assert.ok(parts[0].length > 0);
  });

  it('evaluates password strength and entropy correctly', () => {
    const weak = evaluatePasswordStrength('123456');
    assert.strictEqual(weak.score, 0);

    const strong = evaluatePasswordStrength('T7$x9L#qP2@vW8!mZ1&kR4%y');
    assert.strictEqual(strong.score, 4);
    assert.ok(strong.entropyBits > 100);
  });
});
