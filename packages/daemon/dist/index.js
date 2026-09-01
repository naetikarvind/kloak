"use strict";
/**
 * Kloak Daemon — Main Entry Point
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@kloak/core");
const socket_server_js_1 = require("./ipc/socket-server.js");
const host_js_1 = require("./native-messaging/host.js");
async function start() {
    console.log('────────────────────────────────────────');
    console.log('🔒 Kloak Password Manager Engine & Daemon');
    console.log('────────────────────────────────────────');
    const vault = new core_1.VaultManager();
    const server = new socket_server_js_1.IpcSocketServer(vault);
    // Auto-register native messaging manifests
    host_js_1.NativeMessagingHost.installManifests();
    await server.start();
    console.log('⚡ Ready for incoming IPC & Native Messaging requests.');
    // Handle graceful termination
    const shutdown = async () => {
        console.log('\n🛑 Shutting down Kloak Daemon...');
        vault.lock();
        await server.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
start().catch(err => {
    console.error('Fatal daemon error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map