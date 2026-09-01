/**
 * Kloak Daemon — WebExtensions Native Messaging Host
 * Implements standard 32-bit length-prefixed stdin/stdout messaging for Chrome, Brave, Edge, Firefox.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';

export const NATIVE_HOST_NAME = 'app.kloak.native';
const IPC_PORT = 53152;

export class NativeMessagingHost {
  public run(): void {
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
        } catch (err: any) {
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

  private async forwardToSwiftDaemon(request: any): Promise<void> {
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
        } catch {
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

  private sendMessage(msg: any): void {
    const jsonStr = JSON.stringify(msg);
    const msgBuffer = Buffer.from(jsonStr, 'utf-8');
    const headerBuffer = Buffer.alloc(4);
    headerBuffer.writeUInt32LE(msgBuffer.length, 0);

    process.stdout.write(Buffer.concat([headerBuffer, msgBuffer]));
  }

  public static installManifests(extensionIds: string[] = ['gikdgameggdmlfnchmeejfmhdgfbmfcl']): string[] {
    const installedPaths: string[] = [];
    const hostScriptPath = path.resolve(__dirname, '../../dist/native-messaging/host.js');
    const nodePath = process.execPath;

    const wrapperScriptPath = path.join(os.homedir(), '.kloak', 'kloak-native-bridge.sh');
    const wrapperScript = `#!/bin/sh\nexec "${nodePath}" "${hostScriptPath}" "$@"\n`;
    fs.writeFileSync(wrapperScriptPath, wrapperScript, { mode: 0o755 });

    const chromeManifest = {
      name: NATIVE_HOST_NAME,
      description: 'Kloak Password Manager Native Messaging Host',
      path: wrapperScriptPath,
      type: 'stdio',
      allowed_origins: [
        ...extensionIds.map(id => `chrome-extension://${id}/`)
      ]
    };

    const firefoxManifest = {
      name: NATIVE_HOST_NAME,
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
        const manifestPath = path.join(target.dir, `${NATIVE_HOST_NAME}.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(target.manifest, null, 2));
        installedPaths.push(manifestPath);
      } catch (err: any) {
        console.warn(`Could not install manifest in ${target.dir}: ${err.message}`);
      }
    }

    return installedPaths;
  }
}

if (process.argv[1] && process.argv[1].endsWith('host.js')) {
  const host = new NativeMessagingHost();
  host.run();
}

