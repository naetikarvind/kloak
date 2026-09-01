"use strict";
/**
 * Kloak Core — Proton Pass Parser (CSV & JSON)
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
exports.parseProtonPassCsv = parseProtonPassCsv;
const crypto = __importStar(require("node:crypto"));
const types_js_1 = require("./types.js");
function parseProtonPassCsv(csvText) {
    const rows = (0, types_js_1.parseCsv)(csvText);
    const items = [];
    const warnings = [];
    for (const row of rows) {
        try {
            const typeStr = (row['type'] || 'login').toLowerCase();
            let type = 'login';
            if (typeStr.includes('note'))
                type = 'secure_note';
            else if (typeStr.includes('card'))
                type = 'card';
            else if (typeStr.includes('alias'))
                type = 'login';
            const url = row['url'] || row['urls'] || '';
            items.push({
                id: crypto.randomUUID(),
                type,
                title: row['name'] || row['title'] || 'Untitled',
                username: row['username'] || row['email'] || undefined,
                password: row['password'] || undefined,
                urls: url ? [url] : [],
                notes: row['note'] || row['notes'] || undefined,
                totpSecret: row['totp'] || row['2fa'] || undefined,
                tags: ['Proton Pass'],
                favorite: false,
                trashed: false,
                createdAt: row['create_time'] || new Date().toISOString(),
                updatedAt: row['modify_time'] || new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`Proton Pass row error: ${e.message}`);
        }
    }
    return {
        source: 'Proton Pass (CSV)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=proton.js.map