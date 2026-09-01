"use strict";
/**
 * Kloak Core — Generic CSV Auto-Detector & Custom Column Mapper
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
exports.autoDetectColumnMapping = autoDetectColumnMapping;
exports.parseGenericCsv = parseGenericCsv;
const crypto = __importStar(require("node:crypto"));
const types_js_1 = require("./types.js");
/**
 * Heuristically identifies columns in a generic CSV file.
 */
function autoDetectColumnMapping(sampleRow) {
    const keys = Object.keys(sampleRow);
    const findKey = (...patterns) => {
        return keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
    };
    return {
        titleColumn: findKey('title', 'name', 'account', 'service', 'site', 'label'),
        usernameColumn: findKey('username', 'user', 'email', 'login', 'id'),
        passwordColumn: findKey('password', 'pass', 'secret', 'key'),
        urlColumn: findKey('url', 'uri', 'link', 'website', 'domain', 'address', 'host'),
        notesColumn: findKey('notes', 'note', 'comment', 'extra', 'description'),
        totpColumn: findKey('totp', 'otp', '2fa', 'authenticator', 'code'),
        tagsColumn: findKey('tag', 'folder', 'group', 'category')
    };
}
function parseGenericCsv(csvText, customMapping) {
    const rows = (0, types_js_1.parseCsv)(csvText);
    const items = [];
    const warnings = [];
    if (rows.length === 0) {
        return { source: 'Generic CSV', items: [], warnings: ['CSV file is empty.'], skippedCount: 0 };
    }
    const mapping = customMapping || autoDetectColumnMapping(rows[0]);
    for (const row of rows) {
        try {
            const title = (mapping.titleColumn ? row[mapping.titleColumn] : undefined) || 'Untitled';
            const username = mapping.usernameColumn ? row[mapping.usernameColumn] : undefined;
            const password = mapping.passwordColumn ? row[mapping.passwordColumn] : undefined;
            const url = mapping.urlColumn ? row[mapping.urlColumn] : undefined;
            const notes = mapping.notesColumn ? row[mapping.notesColumn] : undefined;
            const totp = mapping.totpColumn ? row[mapping.totpColumn] : undefined;
            const tag = mapping.tagsColumn ? row[mapping.tagsColumn] : undefined;
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
                tags: tag ? [tag] : ['Imported'],
                favorite: false,
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`CSV parsing error: ${e.message}`);
        }
    }
    return {
        source: 'Generic CSV',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=generic-csv.js.map