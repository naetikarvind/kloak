"use strict";
/**
 * Kloak Core — Parser Types & Common Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsv = parseCsv;
exports.formatCsv = formatCsv;
/**
 * Robust CSV parser handling quoted fields, escaped quotes (""), and multiline values.
 */
function parseCsv(csvText, delimiter = ',') {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentField += '"';
                i++; // skip escaped quote
            }
            else {
                insideQuotes = !insideQuotes;
            }
        }
        else if (char === delimiter && !insideQuotes) {
            currentRow.push(currentField);
            currentField = '';
        }
        else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentField);
            currentField = '';
            if (currentRow.some(col => col.trim().length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
        }
        else {
            currentField += char;
        }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.some(col => col.trim().length > 0)) {
            rows.push(currentRow);
        }
    }
    if (rows.length === 0)
        return [];
    const headers = rows[0].map(h => h.trim().toLowerCase().replace(/^\uFEFF/, '')); // strip BOM
    const results = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const rowObj = {};
        for (let c = 0; c < headers.length; c++) {
            const header = headers[c];
            rowObj[header] = (row[c] ?? '').trim();
        }
        results.push(rowObj);
    }
    return results;
}
/**
 * Generates RFC 4180 compliant CSV string.
 */
function formatCsv(headers, rows) {
    const escapeCell = (val) => {
        if (val === undefined || val === null)
            return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    const headerLine = headers.map(escapeCell).join(',');
    const rowLines = rows.map(r => r.map(escapeCell).join(','));
    return [headerLine, ...rowLines].join('\n');
}
//# sourceMappingURL=types.js.map