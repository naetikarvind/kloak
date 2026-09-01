"use strict";
/**
 * Kloak Core — 1Password Parser (.1pux JSON & .1pif)
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
exports.parseOnePassword1Pux = parseOnePassword1Pux;
exports.parseOnePassword1Pif = parseOnePassword1Pif;
const crypto = __importStar(require("node:crypto"));
function parseOnePassword1Pux(jsonText) {
    const data = JSON.parse(jsonText);
    const items = [];
    const warnings = [];
    const rawItems = data.items || (data.accounts ? data.accounts.flatMap((a) => a.vaults?.flatMap((v) => v.items || []) || []) : []);
    for (const raw of rawItems) {
        try {
            const id = raw.uuid || crypto.randomUUID();
            const title = raw.title || raw.overview?.title || 'Untitled';
            const notes = raw.notes || raw.details?.notesPlain || undefined;
            const favorite = Boolean(raw.favIndex && raw.favIndex > 0);
            const createdAt = raw.createdAt ? new Date(raw.createdAt * 1000).toISOString() : new Date().toISOString();
            const updatedAt = raw.updatedAt ? new Date(raw.updatedAt * 1000).toISOString() : new Date().toISOString();
            let type = 'login';
            let username;
            let password;
            let totpSecret;
            const urls = [];
            if (raw.overview?.url)
                urls.push(raw.overview.url);
            if (Array.isArray(raw.overview?.urls)) {
                for (const u of raw.overview.urls) {
                    if (u.u && !urls.includes(u.u))
                        urls.push(u.u);
                }
            }
            // Fields in details
            if (raw.details?.fields) {
                for (const f of raw.details.fields) {
                    if (f.designation === 'username' || f.name === 'username')
                        username = f.value;
                    else if (f.designation === 'password' || f.name === 'password')
                        password = f.value;
                    else if (f.type === 'OTP' || f.name?.toLowerCase().includes('one-time'))
                        totpSecret = f.value;
                }
            }
            if (raw.category === 'SECURE_NOTE' || raw.typeName === 'secure.Note') {
                type = 'secure_note';
            }
            else if (raw.category === 'CREDIT_CARD' || raw.typeName === 'wallet.financial.CreditCard') {
                type = 'card';
            }
            else if (raw.category === 'IDENTITY' || raw.typeName === 'identity') {
                type = 'identity';
            }
            items.push({
                id,
                type,
                title,
                username,
                password,
                urls,
                notes,
                totpSecret,
                tags: ['1Password'],
                favorite,
                trashed: false,
                createdAt,
                updatedAt
            });
        }
        catch (e) {
            warnings.push(`1Password item error: ${e.message}`);
        }
    }
    return {
        source: '1Password (1PUX)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
function parseOnePassword1Pif(pifText) {
    const lines = pifText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('***'));
    const items = [];
    const warnings = [];
    for (const line of lines) {
        try {
            const raw = JSON.parse(line);
            const id = raw.uuid || crypto.randomUUID();
            const title = raw.title || raw.overview?.title || 'Untitled';
            const notes = raw.notesPlain || raw.secureContents?.notesPlain || undefined;
            const urls = raw.location ? [raw.location] : [];
            let type = 'login';
            let username;
            let password;
            let totpSecret;
            const sec = raw.secureContents || {};
            username = sec.username || sec.fields?.find((f) => f.name === 'username')?.value;
            password = sec.password || sec.fields?.find((f) => f.name === 'password')?.value;
            if (raw.typeName === 'secure.Note')
                type = 'secure_note';
            else if (raw.typeName?.includes('CreditCard'))
                type = 'card';
            items.push({
                id,
                type,
                title,
                username,
                password,
                urls,
                notes,
                totpSecret,
                tags: ['1Password'],
                favorite: Boolean(raw.openContents?.faveIndex),
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`1PIF line error: ${e.message}`);
        }
    }
    return {
        source: '1Password (1PIF)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=onepassword.js.map