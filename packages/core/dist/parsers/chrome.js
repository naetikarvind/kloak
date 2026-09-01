"use strict";
/**
 * Kloak Core — Chrome / Chromium / Edge / Brave / Opera Parser (CSV)
 * Format: name, url, username, password, note
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
exports.parseChromeCsv = parseChromeCsv;
const crypto = __importStar(require("node:crypto"));
const types_js_1 = require("./types.js");
function parseChromeCsv(csvText) {
    const rows = (0, types_js_1.parseCsv)(csvText);
    const items = [];
    const warnings = [];
    for (const row of rows) {
        try {
            const url = row['url'] || '';
            let title = row['name'] || '';
            if (!title && url) {
                try {
                    title = new URL(url).hostname;
                }
                catch {
                    title = url;
                }
            }
            items.push({
                id: crypto.randomUUID(),
                type: 'login',
                title: title || 'Untitled',
                username: row['username'] || undefined,
                password: row['password'] || undefined,
                urls: url ? [url] : [],
                notes: row['note'] || row['notes'] || undefined,
                tags: ['Chrome'],
                favorite: false,
                trashed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        catch (e) {
            warnings.push(`Chrome row error: ${e.message}`);
        }
    }
    return {
        source: 'Chrome / Chromium (CSV)',
        items,
        warnings,
        skippedCount: warnings.length
    };
}
//# sourceMappingURL=chrome.js.map