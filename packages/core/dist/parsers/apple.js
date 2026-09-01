"use strict";
/**
 * Kloak Core — Apple Passwords / Safari Parser (CSV)
 * Parses macOS / iOS Passwords CSV export: Title, URL, Username, Password, Notes, OTPAuth
 */
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
exports.parseApplePasswordsCsv = parseApplePasswordsCsv;
const crypto = __importStar(require("node:crypto"));
const types_js_1 = require("./types.js");
const totp_js_1 = require("../crypto/totp.js");
function parseApplePasswordsCsv(csvText) {
    const rows = (0, types_js_1.parseCsv)(csvText);
    const items = [];
    const warnings = [];
    for (const row of rows) {
        try {
            const title = row['title'] || row['name'] || 'Untitled';
            const url = row['url'] || '';
            const username = row['username'] || undefined;
            const password = row['password'] || undefined;
            const notes = row['notes'] || undefined;
            const otpAuth = row['otpauth'] || row['otp'] || row['verification code'];
            let totpSecret;
            if (otpAuth) {
                if (otpAuth.startsWith('otpauth://')) {
                    try {
                        const parsed = (0, totp_js_1.parseOtpAuthUri)(otpAuth);
                        totpSecret = parsed.secret;
                    }
                    catch {
                        totpSecret = otpAuth;
                    }
                }
                else {
                    totpSecret = otpAuth;
                }
            }
            items.push({
                id: crypto.randomUUID(),
                type: 'login',
                title,
                username,
                password,
                urls: url ? [url] : [],
                notes,
                totpSecret,
                tags: ['Apple Passwords'],
                favorite: false,
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`Apple Passwords row error: ${e.message}`);
        }
    }
    return {
        source: 'Apple Passwords (CSV)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=apple.js.map