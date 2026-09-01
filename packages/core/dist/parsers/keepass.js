"use strict";
/**
 * Kloak Core — KeePass / KeePassXC Parser (XML & CSV)
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
exports.parseKeePassXml = parseKeePassXml;
exports.parseKeePassCsv = parseKeePassCsv;
const crypto = __importStar(require("node:crypto"));
const types_js_1 = require("./types.js");
function parseKeePassXml(xmlText) {
    const items = [];
    const warnings = [];
    // Match <Entry>...</Entry> blocks
    const entryRegex = /<Entry>([\s\S]*?)<\/Entry>/g;
    let entryMatch;
    while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
        try {
            const entryContent = entryMatch[1];
            const stringRegex = /<String>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Value(?:[^>]*)>([^<]*)<\/Value>[\s\S]*?<\/String>/g;
            let title = '';
            let username = '';
            let password = '';
            let url = '';
            let notes = '';
            let totp = '';
            let strMatch;
            while ((strMatch = stringRegex.exec(entryContent)) !== null) {
                const key = strMatch[1].trim().toLowerCase();
                const value = strMatch[2].trim();
                if (key === 'title')
                    title = value;
                else if (key === 'username' || key === 'user name')
                    username = value;
                else if (key === 'password')
                    password = value;
                else if (key === 'url')
                    url = value;
                else if (key === 'notes')
                    notes = value;
                else if (key.includes('otp') || key.includes('totp') || key === 'timeotp-secret')
                    totp = value;
            }
            if (!title && !username && !password && !url)
                continue;
            items.push({
                id: crypto.randomUUID(),
                type: 'login',
                title: title || 'Untitled',
                username: username || undefined,
                password: password || undefined,
                urls: url ? [url] : [],
                notes: notes || undefined,
                totpSecret: totp || undefined,
                tags: ['KeePass'],
                favorite: false,
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`KeePass XML error: ${e.message}`);
        }
    }
    return {
        source: 'KeePass (XML)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
function parseKeePassCsv(csvText) {
    const rows = (0, types_js_1.parseCsv)(csvText);
    const items = [];
    const warnings = [];
    for (const row of rows) {
        try {
            const url = row['url'] || '';
            items.push({
                id: crypto.randomUUID(),
                type: 'login',
                title: row['title'] || row['group'] || 'Untitled',
                username: row['user name'] || row['username'] || undefined,
                password: row['password'] || undefined,
                urls: url ? [url] : [],
                notes: row['comments'] || row['notes'] || undefined,
                tags: row['group'] ? [row['group']] : ['KeePass'],
                favorite: false,
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`KeePass CSV error: ${e.message}`);
        }
    }
    return {
        source: 'KeePass (CSV)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=keepass.js.map