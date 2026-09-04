"use strict";
/**
 * Kloak Daemon — IPC Socket Server
 * Provides Unix Domain Socket & TCP fallback server for Raycast, CLI, and apps.
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
exports.IpcSocketServer = exports.TCP_HOST = exports.TCP_PORT = exports.SOCKET_PATH = void 0;
const net = __importStar(require("node:net"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const core_1 = require("@kloak/core");
const core_2 = require("@kloak/core");
exports.SOCKET_PATH = path.join(core_1.DEFAULT_VAULT_DIR, 'kloak.sock');
exports.TCP_PORT = 53152;
exports.TCP_HOST = '127.0.0.1';
class IpcSocketServer {
    vaultManager;
    unixServer = null;
    tcpServer = null;
    constructor(vaultManager) {
        this.vaultManager = vaultManager;
    }
    start() {
        return new Promise((resolve) => {
            // Ensure socket directory exists
            if (!fs.existsSync(core_1.DEFAULT_VAULT_DIR)) {
                fs.mkdirSync(core_1.DEFAULT_VAULT_DIR, { recursive: true, mode: 0o700 });
            }
            // Cleanup existing socket file if orphaned
            if (fs.existsSync(exports.SOCKET_PATH)) {
                try {
                    fs.unlinkSync(exports.SOCKET_PATH);
                }
                catch { }
            }
            // Start Unix Domain Socket
            this.unixServer = net.createServer((socket) => this.handleClient(socket));
            this.unixServer.listen(exports.SOCKET_PATH, () => {
                try {
                    fs.chmodSync(exports.SOCKET_PATH, 0o600);
                }
                catch { }
                console.log(`[Kloak Daemon] Unix IPC Socket listening at ${exports.SOCKET_PATH}`);
            });
            // Start Localhost TCP fallback
            this.tcpServer = net.createServer((socket) => this.handleClient(socket));
            this.tcpServer.listen(exports.TCP_PORT, exports.TCP_HOST, () => {
                console.log(`[Kloak Daemon] Localhost TCP IPC listening at ${exports.TCP_HOST}:${exports.TCP_PORT}`);
                resolve();
            });
            this.unixServer.on('error', (err) => {
                console.error('[Kloak Daemon] Unix Socket error:', err.message);
            });
            this.tcpServer.on('error', (err) => {
                console.error('[Kloak Daemon] TCP Socket error:', err.message);
            });
        });
    }
    stop() {
        return new Promise((resolve) => {
            if (this.unixServer) {
                this.unixServer.close();
                if (fs.existsSync(exports.SOCKET_PATH)) {
                    try {
                        fs.unlinkSync(exports.SOCKET_PATH);
                    }
                    catch { }
                }
            }
            if (this.tcpServer) {
                this.tcpServer.close();
            }
            resolve();
        });
    }
    handleClient(socket) {
        let buffer = '';
        socket.on('data', async (chunk) => {
            buffer += chunk.toString('utf-8');
            // Process newline-delimited JSON-RPC messages
            while (buffer.includes('\n')) {
                const lineEnd = buffer.indexOf('\n');
                const rawMessage = buffer.slice(0, lineEnd).trim();
                buffer = buffer.slice(lineEnd + 1);
                if (!rawMessage)
                    continue;
                try {
                    const request = JSON.parse(rawMessage);
                    const response = await this.dispatch(request);
                    socket.write(JSON.stringify(response) + '\n');
                }
                catch (err) {
                    const errorResponse = {
                        jsonrpc: '2.0',
                        id: null,
                        error: {
                            code: -32700,
                            message: `Parse error: ${err.message}`
                        }
                    };
                    socket.write(JSON.stringify(errorResponse) + '\n');
                }
            }
        });
        socket.on('error', () => {
            // Client disconnected abruptly
        });
    }
    async dispatch(req) {
        const id = req.id ?? null;
        try {
            const result = await this.handleMethod(req.method, req.params || {});
            return {
                jsonrpc: '2.0',
                id,
                result
            };
        }
        catch (err) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32000,
                    message: err.message || 'Internal error'
                }
            };
        }
    }
    async handleMethod(method, params) {
        switch (method) {
            case 'daemon.ping':
                return { pong: true, timestamp: Date.now(), version: '1.0.0' };
            case 'vault.status':
                return this.vaultManager.getStatus();
            case 'vault.create':
                this.vaultManager.createVault(params.masterPassword);
                return { success: true, status: this.vaultManager.getStatus() };
            case 'vault.unlock':
                this.vaultManager.unlock(params.masterPassword);
                return { success: true, status: this.vaultManager.getStatus() };
            case 'vault.lock':
                this.vaultManager.lock();
                return { success: true, status: this.vaultManager.getStatus() };
            case 'vault.getItems':
                return this.vaultManager.getItems(Boolean(params.includeTrash));
            case 'vault.getItem': {
                const item = this.vaultManager.getItem(params.id);
                if (!item)
                    throw new Error(`Item ${params.id} not found.`);
                let liveTotp = undefined;
                if (item.totpSecret) {
                    try {
                        liveTotp = (0, core_2.generateTotp)(item.totpSecret);
                    }
                    catch { }
                }
                return { item, liveTotp };
            }
            case 'vault.addItem':
                return this.vaultManager.addItem(params.item);
            case 'vault.updateItem':
                return this.vaultManager.updateItem(params.id, params.updates);
            case 'vault.deleteItem':
                this.vaultManager.deleteItem(params.id, Boolean(params.permanent));
                return { success: true };
            case 'vault.restoreItem':
                this.vaultManager.restoreItem(params.id);
                return { success: true };
            case 'vault.search':
                return this.vaultManager.search(params.query || '');
            case 'vault.matchByUrl':
                return this.vaultManager.matchByUrl(params.url || '');
            case 'vault.generateTotp':
                return (0, core_2.generateTotp)(params.secret, params.options);
            case 'vault.generatePassword': {
                const password = (0, core_2.generatePassword)(params.options);
                const strength = (0, core_2.evaluatePasswordStrength)(password);
                return { password, strength };
            }
            case 'vault.generatePassphrase': {
                const passphrase = (0, core_2.generatePassphrase)(params.options);
                const strength = (0, core_2.evaluatePasswordStrength)(passphrase);
                return { passphrase, strength };
            }
            case 'vault.import':
                return this.vaultManager.importData(params.content, params.format);
            case 'vault.export':
                return this.vaultManager.exportData(params.options);
            case 'vault.getFolders':
                return this.vaultManager.getFolders();
            case 'vault.addFolder':
                return this.vaultManager.addFolder(params.name);
            case 'vault.getSettings':
                return this.vaultManager.getSettings();
            case 'vault.updateSettings':
                return this.vaultManager.updateSettings(params.settings);
            case 'vault.changeMasterPassword':
                this.vaultManager.updateMasterPassword(params.oldPassword, params.newPassword);
                return { success: true };
            case 'shield.inspectUrl': {
                const urlStr = params.url || '';
                let isSuspicious = false;
                let riskScore = 0;
                const reasons = [];
                try {
                    const u = new URL(urlStr);
                    const host = u.hostname.toLowerCase();
                    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
                        isSuspicious = true;
                        riskScore += 45;
                        reasons.push('Raw IP address host');
                    }
                    if (['tk', 'ml', 'ga', 'cf', 'gq', 'top', 'xyz', 'click'].some(tld => host.endsWith('.' + tld))) {
                        isSuspicious = true;
                        riskScore += 35;
                        reasons.push('High-risk top-level domain');
                    }
                }
                catch { }
                return {
                    isSuspicious,
                    riskScore,
                    reasons,
                    suggestedAction: isSuspicious ? 'mask_email' : 'safe'
                };
            }
            case 'shield.generateProtectedAlias': {
                const domain = params.domain || 'untrusted-site';
                const clean = domain.replace(/^www\./, '').split('.')[0] || 'site';
                const randomHex = Math.random().toString(36).substring(2, 8);
                const aliasEmail = `protect.${clean}.${randomHex}@shield.kloak.app`;
                const forwardTo = 'naetik.arvind@gmail.com';
                const item = {
                    id: `alias-${Date.now()}`,
                    type: 'email_alias',
                    title: `Shield Alias (${domain})`,
                    username: aliasEmail,
                    urls: params.url ? [params.url] : [],
                    notes: `Kloak Threat Shield: Disposable alias for ${domain}. Emails forwarded to ${forwardTo}.`,
                    alias: {
                        aliasEmail,
                        forwardTo,
                        provider: 'Kloak Shield'
                    },
                    tags: ['Shield', 'Protected Alias']
                };
                try {
                    this.vaultManager.addItem(item);
                }
                catch { }
                return {
                    aliasEmail,
                    forwardTo,
                    provider: 'Kloak Shield',
                    success: true
                };
            }
            case 'shield.getConnectedAccount':
                return {
                    provider: 'google',
                    email: 'naetik.arvind@gmail.com',
                    shieldEnabled: true,
                    autoMaskUntrusted: true
                };
            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }
}
exports.IpcSocketServer = IpcSocketServer;
//# sourceMappingURL=socket-server.js.map