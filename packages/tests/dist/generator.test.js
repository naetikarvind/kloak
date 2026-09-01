"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert"));
const core_1 = require("@kloak/core");
(0, node_test_1.describe)('Kloak Password & Passphrase Generator', () => {
    (0, node_test_1.it)('generates random password with exact requested length', () => {
        const pwd = (0, core_1.generatePassword)({ length: 32 });
        assert.strictEqual(pwd.length, 32);
    });
    (0, node_test_1.it)('guarantees character categories when toggled on', () => {
        const pwd = (0, core_1.generatePassword)({
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
    (0, node_test_1.it)('excludes ambiguous characters when avoidAmbiguous is set', () => {
        for (let i = 0; i < 20; i++) {
            const pwd = (0, core_1.generatePassword)({ length: 30, avoidAmbiguous: true });
            assert.ok(!/[0O1lI|\[\]{}()/'"`~,;:.<>]/.test(pwd), `Ambiguous character detected in ${pwd}`);
        }
    });
    (0, node_test_1.it)('generates multi-word EFF passphrases', () => {
        const phrase = (0, core_1.generatePassphrase)({ wordsCount: 5, separator: '-' });
        const parts = phrase.split('-');
        assert.strictEqual(parts.length, 5);
        assert.ok(parts[0].length > 0);
    });
    (0, node_test_1.it)('evaluates password strength and entropy correctly', () => {
        const weak = (0, core_1.evaluatePasswordStrength)('123456');
        assert.strictEqual(weak.score, 0);
        const strong = (0, core_1.evaluatePasswordStrength)('T7$x9L#qP2@vW8!mZ1&kR4%y');
        assert.strictEqual(strong.score, 4);
        assert.ok(strong.entropyBits > 100);
    });
});
