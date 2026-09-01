"use strict";
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
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const core_1 = require("@kloak/core");
const socket_server_js_1 = require("../../daemon/dist/ipc/socket-server.js");
(0, node_test_1.describe)('Kloak IPC Daemon Protocol', () => {
    const tempDir = path.join(os.tmpdir(), `kloak-ipc-test-${Date.now()}`);
    const tempVaultPath = path.join(tempDir, 'vault.kloak');
    let manager;
    let server;
    (0, node_test_1.before)(async () => {
        fs.mkdirSync(tempDir, { recursive: true });
        manager = new core_1.VaultManager(tempVaultPath);
        manager.createVault('IpcTestPassword123!');
        server = new socket_server_js_1.IpcSocketServer(manager);
    });
    (0, node_test_1.after)(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    });
    (0, node_test_1.it)('handles daemon.ping method', async () => {
        const res = await server.dispatch({
            jsonrpc: '2.0',
            id: 1,
            method: 'daemon.ping'
        });
        assert.strictEqual(res.result.pong, true);
        assert.strictEqual(res.result.version, '1.0.0');
    });
    (0, node_test_1.it)('handles vault.status method', async () => {
        const res = await server.dispatch({
            jsonrpc: '2.0',
            id: 2,
            method: 'vault.status'
        });
        assert.strictEqual(res.result.isInitialized, true);
        assert.strictEqual(res.result.isUnlocked, true);
    });
    (0, node_test_1.it)('handles vault.addItem and vault.getItems via IPC', async () => {
        const addRes = await server.dispatch({
            jsonrpc: '2.0',
            id: 3,
            method: 'vault.addItem',
            params: {
                item: {
                    type: 'login',
                    title: 'Slack',
                    username: 'worker@slack.com',
                    password: 'SlackPassword456!',
                    urls: ['https://slack.com']
                }
            }
        });
        assert.strictEqual(addRes.result.title, 'Slack');
        const getRes = await server.dispatch({
            jsonrpc: '2.0',
            id: 4,
            method: 'vault.getItems'
        });
        assert.ok(getRes.result.some((i) => i.title === 'Slack'));
    });
    (0, node_test_1.it)('handles vault.generatePassword and vault.generateTotp', async () => {
        const genRes = await server.dispatch({
            jsonrpc: '2.0',
            id: 5,
            method: 'vault.generatePassword',
            params: { options: { length: 25 } }
        });
        assert.strictEqual(genRes.result.password.length, 25);
        assert.ok(genRes.result.strength);
        const totpRes = await server.dispatch({
            jsonrpc: '2.0',
            id: 6,
            method: 'vault.generateTotp',
            params: { secret: 'JBSWY3DPEHPK3PXP' }
        });
        assert.strictEqual(totpRes.result.token.length, 6);
    });
});
