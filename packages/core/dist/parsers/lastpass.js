"use strict";
/**
 * Kloak Core — LastPass Parser (CSV)
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
exports.parseLastPassCsv = parseLastPassCsv;
const crypto = __importStar(require("node:crypto"));
const types_js_1 = require("./types.js");
function parseLastPassCsv(csvText) {
    const rows = (0, types_js_1.parseCsv)(csvText);
    const items = [];
    const warnings = [];
    for (const row of rows) {
        try {
            const url = row['url'] || '';
            const isNote = url === 'http://sn' || url === 'https://sn' || !url;
            const type = isNote ? 'secure_note' : 'login';
            const urls = isNote ? [] : [url];
            const totp = row['totp'] || row['otp'] || undefined;
            items.push({
                id: crypto.randomUUID(),
                type,
                title: row['name'] || 'Untitled',
                username: row['username'] || undefined,
                password: row['password'] || undefined,
                urls,
                notes: row['extra'] || row['notes'] || undefined,
                totpSecret: totp,
                tags: row['grouping'] ? [row['grouping']] : ['LastPass'],
                favorite: row['fav'] === '1',
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`LastPass row error: ${e.message}`);
        }
    }
    return {
        source: 'LastPass (CSV)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=lastpass.js.map