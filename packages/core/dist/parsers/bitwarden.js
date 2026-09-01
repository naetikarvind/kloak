"use strict";
/**
 * Kloak Core — Bitwarden Parser (JSON & CSV)
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
exports.parseBitwardenJson = parseBitwardenJson;
exports.parseBitwardenCsv = parseBitwardenCsv;
const crypto = __importStar(require("node:crypto"));
const types_js_1 = require("./types.js");
function parseBitwardenJson(jsonText) {
    const data = JSON.parse(jsonText);
    const items = [];
    const warnings = [];
    const rawItems = Array.isArray(data) ? data : data.items || [];
    for (const raw of rawItems) {
        try {
            const id = raw.id || crypto.randomUUID();
            const title = raw.name || 'Untitled';
            const notes = raw.notes || undefined;
            const favorite = Boolean(raw.favorite);
            const createdAt = raw.creationDate || new Date().toISOString();
            const updatedAt = raw.revisionDate || new Date().toISOString();
            let type = 'login';
            let username = '';
            let password = '';
            let urls = [];
            let totpSecret;
            let card;
            let identity;
            if (raw.type === 1 || raw.login) {
                // Login
                type = 'login';
                const login = raw.login || {};
                username = login.username || '';
                password = login.password || '';
                totpSecret = login.totp || undefined;
                if (Array.isArray(login.uris)) {
                    urls = login.uris.map((u) => (typeof u === 'string' ? u : u.uri)).filter(Boolean);
                }
            }
            else if (raw.type === 2 || raw.secureNote) {
                // Secure Note
                type = 'secure_note';
            }
            else if (raw.type === 3 || raw.card) {
                // Card
                type = 'card';
                const c = raw.card || {};
                card = {
                    cardholderName: c.cardholderName,
                    number: c.number,
                    brand: c.brand?.toLowerCase(),
                    expMonth: c.expMonth,
                    expYear: c.expYear,
                    cvv: c.code
                };
            }
            else if (raw.type === 4 || raw.identity) {
                // Identity
                type = 'identity';
                const iden = raw.identity || {};
                identity = {
                    firstName: iden.firstName,
                    lastName: iden.lastName,
                    email: iden.email,
                    phone: iden.phone,
                    address1: iden.address1,
                    address2: iden.address2,
                    city: iden.city,
                    state: iden.state,
                    zip: iden.postalCode,
                    country: iden.country,
                    passportNumber: iden.passportNumber,
                    ssn: iden.ssn
                };
            }
            const customFields = Array.isArray(raw.fields)
                ? raw.fields.map((f) => ({
                    id: crypto.randomUUID(),
                    name: f.name || 'Field',
                    value: f.value || '',
                    type: f.type === 1 ? 'hidden' : f.type === 2 ? 'boolean' : 'text'
                }))
                : undefined;
            items.push({
                id,
                type,
                title,
                username: username || undefined,
                password: password || undefined,
                urls,
                notes,
                totpSecret,
                card,
                identity,
                customFields,
                tags: raw.folderId ? ['Bitwarden'] : [],
                favorite,
                trashed: Boolean(raw.deletedDate),
                createdAt,
                updatedAt
            });
        }
        catch (e) {
            warnings.push(`Failed to parse item "${raw?.name}": ${e.message}`);
        }
    }
    return {
        source: 'Bitwarden (JSON)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
function parseBitwardenCsv(csvText) {
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
            else if (typeStr.includes('identity'))
                type = 'identity';
            const urls = [row['login_uri'], row['uri'], row['url']].filter(Boolean);
            items.push({
                id: crypto.randomUUID(),
                type,
                title: row['name'] || row['title'] || 'Untitled',
                username: row['login_username'] || row['username'] || undefined,
                password: row['login_password'] || row['password'] || undefined,
                urls,
                notes: row['notes'] || undefined,
                totpSecret: row['login_totp'] || row['totp'] || undefined,
                tags: row['folder'] ? [row['folder']] : [],
                favorite: row['favorite'] === '1' || row['favorite'] === 'true',
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`CSV Row error: ${e.message}`);
        }
    }
    return {
        source: 'Bitwarden (CSV)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=bitwarden.js.map