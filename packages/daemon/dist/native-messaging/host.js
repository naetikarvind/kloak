"use strict";
/**
 * Kloak Daemon — WebExtensions Native Messaging Host
 * Implements standard 32-bit length-prefixed stdin/stdout messaging for Chrome, Brave, Edge, Firefox.
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
exports.NativeMessagingHost = exports.NATIVE_HOST_NAME = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const net = __importStar(require("node:net"));
exports.NATIVE_HOST_NAME = 'app.kloak.native';
const IPC_PORT = 53152;
class NativeMessagingHost {
    run() {
        let inputBuffer = Buffer.alloc(0);
        process.stdin.on('data', async (chunk) => {
            inputBuffer = Buffer.concat([inputBuffer, chunk]);
            while (inputBuffer.length >= 4) {
                const messageLength = inputBuffer.readUInt32LE(0);
                if (inputBuffer.length < 4 + messageLength) {
                    break;
                }
                const messageBytes = inputBuffer.subarray(4, 4 + messageLength);
                inputBuffer = inputBuffer.subarray(4 + messageLength);
                try {
                    const request = JSON.parse(messageBytes.toString('utf-8'));
                    await this.forwardToSwiftDaemon(request);
                }
                catch (err) {
                    this.sendMessage({
                        jsonrpc: '2.0',
                        id: null,
                        error: { code: -32700, message: err.message }
                    });
                }
            }
        });
        process.stdin.on('end', () => {
            process.exit(0);
        });
    }
    async forwardToSwiftDaemon(request) {
        return new Promise((resolve) => {
            const client = new net.Socket();
            let responseData = '';
            client.connect(IPC_PORT, '127.0.0.1', () => {
                client.write(JSON.stringify(request) + '\n');
            });
            client.on('data', (data) => {
                responseData += data.toString();
                try {
                    // If we can parse it, it's complete
                    const parsed = JSON.parse(responseData);
                    this.sendMessage(parsed);
                    client.destroy();
                    resolve();
                }
                catch {
                    // Wait for more data
                }
            });
            client.on('error', (err) => {
                this.sendMessage({
                    jsonrpc: '2.0',
                    id: request.id,
                    error: { code: -32603, message: 'Swift IPC Daemon not running or unreachable: ' + err.message }
                });
                resolve();
            });
            client.on('timeout', () => {
                client.destroy();
                resolve();
            });
        });
    }
    sendMessage(msg) {
        const jsonStr = JSON.stringify(msg);
        const msgBuffer = Buffer.from(jsonStr, 'utf-8');
        const headerBuffer = Buffer.alloc(4);
        headerBuffer.writeUInt32LE(msgBuffer.length, 0);
        process.stdout.write(Buffer.concat([headerBuffer, msgBuffer]));
    }
    static installManifests(extensionIds = ['gikdgameggdmlfnchmeejfmhdgfbmfcl']) {
        const installedPaths = [];
        const hostScriptPath = path.resolve(__dirname, '../../dist/native-messaging/host.js');
        const nodePath = process.execPath;
        const wrapperScriptPath = path.join(os.homedir(), '.kloak', 'kloak-native-bridge.sh');
        const wrapperScript = `#!/bin/sh\nexec "${nodePath}" "${hostScriptPath}" "$@"\n`;
        fs.writeFileSync(wrapperScriptPath, wrapperScript, { mode: 0o755 });
        const chromeManifest = {
            name: exports.NATIVE_HOST_NAME,
            description: 'Kloak Password Manager Native Messaging Host',
            path: wrapperScriptPath,
            type: 'stdio',
            allowed_origins: [
                ...extensionIds.map(id => `chrome-extension://${id}/`)
            ]
        };
        const firefoxManifest = {
            name: exports.NATIVE_HOST_NAME,
            description: 'Kloak Password Manager Native Messaging Host',
            path: wrapperScriptPath,
            type: 'stdio',
            allowed_extensions: ['kloak@passwords.app', 'kloak-extension@local']
        };
        const targetDirs = [
            { dir: path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts'), manifest: chromeManifest },
            { dir: path.join(os.homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts'), manifest: chromeManifest },
            { dir: path.join(os.homedir(), 'Library/Application Support/Microsoft Edge/NativeMessagingHosts'), manifest: chromeManifest },
            { dir: path.join(os.homedir(), 'Library/Application Support/Mozilla/NativeMessagingHosts'), manifest: firefoxManifest }
        ];
        for (const target of targetDirs) {
            try {
                if (!fs.existsSync(target.dir)) {
                    fs.mkdirSync(target.dir, { recursive: true });
                }
                const manifestPath = path.join(target.dir, `${exports.NATIVE_HOST_NAME}.json`);
                fs.writeFileSync(manifestPath, JSON.stringify(target.manifest, null, 2));
                installedPaths.push(manifestPath);
            }
            catch (err) {
                console.warn(`Could not install manifest in ${target.dir}: ${err.message}`);
            }
        }
        return installedPaths;
    }
}
exports.NativeMessagingHost = NativeMessagingHost;
if (process.argv[1] && process.argv[1].endsWith('host.js')) {
    const host = new NativeMessagingHost();
    host.run();
}
//# sourceMappingURL=host.js.map