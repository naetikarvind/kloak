"use strict";
/**
 * Kloak Core — Unified Import Dispatcher
 * Automatically detects or dispatches file formats to specialized parsers.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTextNote = parseTextNote;
exports.importFromContent = importFromContent;
const understander_js_1 = require("./understander.js");
const bitwarden_js_1 = require("./bitwarden.js");
const onepassword_js_1 = require("./onepassword.js");
const lastpass_js_1 = require("./lastpass.js");
const apple_js_1 = require("./apple.js");
const chrome_js_1 = require("./chrome.js");
const keepass_js_1 = require("./keepass.js");
const proton_js_1 = require("./proton.js");
const dashlane_js_1 = require("./dashlane.js");
const generic_csv_js_1 = require("./generic-csv.js");
/**
 * Parses plain text / markdown files into a Secure Note (or Recovery Code) VaultItem.
 */
function parseTextNote(content, filename) {
    const trimmed = content.trim();
    if (!trimmed) {
        return {
            source: 'Secure Note (Plain Text)',
            items: [],
            warnings: ['Empty text content'],
            skippedCount: 0
        };
    }
    // Derive title from filename or first non-empty line
    let title = 'Imported Note';
    if (filename) {
        const cleanName = filename.replace(/\.[^/.]+$/, '').trim();
        if (cleanName)
            title = cleanName;
    }
    else {
        const firstLine = trimmed.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0);
        if (firstLine) {
            title = firstLine.slice(0, 80).replace(/^#+\s*/, '');
        }
    }
    // Discover URLs & username hints inside the text note
    const urlMatches = trimmed.match(/https?:\/\/[^\s)\]>'"]+/gi) ?? [];
    const urls = [];
    for (const u of urlMatches) {
        if (!urls.includes(u))
            urls.push(u);
    }
    let discoveredUsername;
    const noteLines = trimmed.split(/\r?\n/).map(l => l.trim());
    for (const line of noteLines.slice(0, 10)) {
        const lowerLine = line.toLowerCase();
        for (const prefix of ['username:', 'user:', 'account:', 'email:', 'login:', '# username:', '# account:', '# email:']) {
            const idx = lowerLine.indexOf(prefix);
            if (idx !== -1) {
                const val = line.slice(idx + prefix.length).trim();
                if (val) {
                    discoveredUsername = val;
                    break;
                }
            }
        }
        if (discoveredUsername)
            break;
    }
    const now = new Date().toISOString();
    const tags = ['Secure Note', 'Imported'];
    const item = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'secure_note',
        title,
        username: discoveredUsername,
        urls,
        notes: trimmed,
        tags,
        favorite: false,
        trashed: false,
        createdAt: now,
        updatedAt: now,
        importSource: 'Text File'
    };
    if ((0, understander_js_1.isRecoveryCodeItem)(item)) {
        if (!item.tags.includes('Recovery Codes'))
            item.tags.push('Recovery Codes');
        if (!item.tags.includes('2FA'))
            item.tags.push('2FA');
    }
    return {
        source: 'Secure Note (Plain Text)',
        items: [item],
        warnings: [],
        skippedCount: 0
    };
}
function importFromContent(content, format = 'auto', customMapping, filename) {
    const trimmed = content.trim();
    if (format === 'auto') {
        // 0. Explicit check for text file extensions
        if (filename && /\.(txt|text|md|markdown|note)$/i.test(filename)) {
            return parseTextNote(trimmed, filename);
        }
        // 1. Check for JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.items && (parsed.encrypted !== undefined || parsed.folders !== undefined)) {
                    return (0, bitwarden_js_1.parseBitwardenJson)(trimmed);
                }
                if (parsed.accounts || (parsed.items && parsed.items[0]?.overview)) {
                    return (0, onepassword_js_1.parseOnePassword1Pux)(trimmed);
                }
                if (parsed.version && parsed.items) {
                    // Kloak json
                    return {
                        source: 'Kloak JSON',
                        items: parsed.items,
                        warnings: [],
                        skippedCount: 0
                    };
                }
            }
            catch {
                // Continue fallback
            }
        }
        // 2. Check for 1PIF
        if (trimmed.includes('{"typeName":') || trimmed.startsWith('***')) {
            return (0, onepassword_js_1.parseOnePassword1Pif)(trimmed);
        }
        // 3. Check for XML (KeePass)
        if (trimmed.startsWith('<?xml') || trimmed.includes('<KeePassFile>')) {
            return (0, keepass_js_1.parseKeePassXml)(trimmed);
        }
        // 4. CSV Auto-detection based on header row
        const firstLine = trimmed.split(/\r?\n/)[0].toLowerCase();
        if (firstLine.includes('login_uri') || firstLine.includes('login_username')) {
            return (0, bitwarden_js_1.parseBitwardenCsv)(trimmed);
        }
        if (firstLine.includes('otpauth') || (firstLine.includes('title') && firstLine.includes('url') && firstLine.includes('username') && firstLine.includes('password'))) {
            return (0, apple_js_1.parseApplePasswordsCsv)(trimmed);
        }
        if (firstLine.includes('fav') && (firstLine.includes('grouping') || firstLine.includes('extra'))) {
            return (0, lastpass_js_1.parseLastPassCsv)(trimmed);
        }
        if (firstLine.includes('group') && firstLine.includes('user name') && firstLine.includes('comments')) {
            return (0, keepass_js_1.parseKeePassCsv)(trimmed);
        }
        if (firstLine.includes('create_time') || firstLine.includes('modify_time')) {
            return (0, proton_js_1.parseProtonPassCsv)(trimmed);
        }
        if (firstLine.includes('domain') && firstLine.includes('otpsecret')) {
            return (0, dashlane_js_1.parseDashlaneCsv)(trimmed);
        }
        if (firstLine.includes('name') && firstLine.includes('url') && firstLine.includes('username') && firstLine.includes('password')) {
            return (0, chrome_js_1.parseChromeCsv)(trimmed);
        }
        // Fallback to generic CSV (or text note if not structured data)
        const genericRes = (0, generic_csv_js_1.parseGenericCsv)(trimmed, customMapping);
        if (genericRes.items.length === 0 && trimmed.length > 0) {
            return parseTextNote(trimmed, filename);
        }
        return genericRes;
    }
    // Explicit format specified
    switch (format) {
        case 'text-note':
        case 'plain-text': return parseTextNote(trimmed, filename);
        case 'google-csv':
        case 'microsoft-csv':
        case 'opera-csv':
        case 'edge-csv':
        case 'chrome-csv': return (0, chrome_js_1.parseChromeCsv)(trimmed);
        case 'bitwarden-json': return (0, bitwarden_js_1.parseBitwardenJson)(trimmed);
        case 'bitwarden-csv': return (0, bitwarden_js_1.parseBitwardenCsv)(trimmed);
        case '1password-1pux': return (0, onepassword_js_1.parseOnePassword1Pux)(trimmed);
        case '1password-1pif': return (0, onepassword_js_1.parseOnePassword1Pif)(trimmed);
        case 'lastpass-csv': return (0, lastpass_js_1.parseLastPassCsv)(trimmed);
        case 'apple-csv': return (0, apple_js_1.parseApplePasswordsCsv)(trimmed);
        case 'keepass-xml': return (0, keepass_js_1.parseKeePassXml)(trimmed);
        case 'keepass-csv': return (0, keepass_js_1.parseKeePassCsv)(trimmed);
        case 'proton-csv': return (0, proton_js_1.parseProtonPassCsv)(trimmed);
        case 'dashlane-csv': return (0, dashlane_js_1.parseDashlaneCsv)(trimmed);
        case 'firefox-csv':
        case 'generic-csv': return (0, generic_csv_js_1.parseGenericCsv)(trimmed, customMapping);
        default: return (0, generic_csv_js_1.parseGenericCsv)(trimmed, customMapping);
    }
}
__exportStar(require("./types.js"), exports);
__exportStar(require("./export.js"), exports);
__exportStar(require("./merger.js"), exports);
__exportStar(require("./understander.js"), exports);
__exportStar(require("./bitwarden.js"), exports);
__exportStar(require("./onepassword.js"), exports);
__exportStar(require("./apple.js"), exports);
__exportStar(require("./chrome.js"), exports);
__exportStar(require("./lastpass.js"), exports);
__exportStar(require("./keepass.js"), exports);
__exportStar(require("./proton.js"), exports);
__exportStar(require("./dashlane.js"), exports);
__exportStar(require("./generic-csv.js"), exports);
//# sourceMappingURL=index.js.map