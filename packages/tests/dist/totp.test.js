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
(0, node_test_1.describe)('Kloak RFC 6238 TOTP Engine', () => {
    const standardSecret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 secret
    (0, node_test_1.it)('correctly encodes and decodes Base32 strings', () => {
        const raw = Buffer.from('Hello World 123!');
        const encoded = (0, core_1.encodeBase32)(raw);
        const decoded = (0, core_1.decodeBase32)(encoded);
        assert.strictEqual(decoded.toString('utf-8'), 'Hello World 123!');
    });
    (0, node_test_1.it)('generates valid 6-digit TOTP tokens with seconds countdown', () => {
        const res = (0, core_1.generateTotp)(standardSecret);
        assert.strictEqual(res.token.length, 6);
        assert.ok(/^\d{6}$/.test(res.token));
        assert.ok(res.secondsRemaining >= 1 && res.secondsRemaining <= 30);
    });
    (0, node_test_1.it)('generates consistent token for deterministic timestamp', () => {
        const timeA = 1600000000000; // Fixed timestamp
        const resA = (0, core_1.generateTotp)(standardSecret, { timestamp: timeA });
        const resB = (0, core_1.generateTotp)(standardSecret, { timestamp: timeA });
        assert.strictEqual(resA.token, resB.token);
    });
    (0, node_test_1.it)('verifies TOTP token within tolerance window', () => {
        const current = (0, core_1.generateTotp)(standardSecret);
        assert.strictEqual((0, core_1.verifyTotp)(current.token, standardSecret), true);
        assert.strictEqual((0, core_1.verifyTotp)('000000', standardSecret), false);
    });
    (0, node_test_1.it)('generates and parses otpauth:// URIs', () => {
        const uri = (0, core_1.generateOtpAuthUri)('user@example.com', 'KloakSecurity', standardSecret);
        assert.ok(uri.startsWith('otpauth://totp/'));
        const parsed = (0, core_1.parseOtpAuthUri)(uri);
        assert.strictEqual(parsed.secret, standardSecret);
        assert.strictEqual(parsed.issuer, 'KloakSecurity');
        assert.strictEqual(parsed.digits, 6);
        assert.strictEqual(parsed.period, 30);
    });
    (0, node_test_1.it)('generates cryptographically random Base32 setup secrets', () => {
        const secret1 = (0, core_1.generateTotpSecret)(20);
        const secret2 = (0, core_1.generateTotpSecret)(20);
        assert.notStrictEqual(secret1, secret2);
        assert.ok(secret1.length >= 32);
    });
});
