/**
 * Kloak Daemon — WebExtensions Native Messaging Host
 * Implements standard 32-bit length-prefixed stdin/stdout messaging for Chrome, Brave, Edge, Firefox.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';
import * as childProcess from 'node:child_process';
import { VaultManager, getDefaultVaultDir } from '@kloak/core';
import { IpcSocketServer } from '../ipc/socket-server';

export const NATIVE_HOST_NAME = 'app.kloak.native';
const IPC_PORT = 53152;

export class NativeMessagingHost {
  private fallbackVault: VaultManager | null = null;
  private fallbackServer: IpcSocketServer | null = null;

  private getFallbackServer(): IpcSocketServer {
    if (!this.fallbackServer) {
      this.fallbackVault = new VaultManager();
      this.fallbackServer = new IpcSocketServer(this.fallbackVault);
    }
    return this.fallbackServer;
  }

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
          await this.handleMessage(request);
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

  private async handleMessage(request: any): Promise<void> {
    // 1. Try to forward to running desktop app or daemon on 127.0.0.1:53152
    const forwarded = await this.tryForwardToDaemon(request);
    if (forwarded) return;

    // 2. Desktop app is NOT running!
    // Handle the request directly using VaultManager and IpcSocketServer
    try {
      const server = this.getFallbackServer();
      const response = await server.dispatch(request);
      this.sendMessage(response);

      // In the background, auto-spawn the standalone daemon so port 53152
      // is up for subsequent HTTP requests, Raycast, and CLI
      this.spawnBackgroundDaemon();
    } catch (err: any) {
      this.sendMessage({
        jsonrpc: '2.0',
        id: request.id ?? null,
        error: { code: -32000, message: err.message || 'Vault operation failed' }
      });
    }
  }

  private async tryForwardToDaemon(request: any): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      let responseData = '';
      let isResolved = false;

      client.setTimeout(250);

      client.connect(IPC_PORT, '127.0.0.1', () => {
        client.write(JSON.stringify(request) + '\n');
      });

      client.on('data', (data) => {
        responseData += data.toString();
        try {
          const parsed = JSON.parse(responseData);
          this.sendMessage(parsed);
          client.destroy();
          if (!isResolved) {
            isResolved = true;
            resolve(true);
          }
        } catch {
          // Wait for full JSON payload
        }
      });

      client.on('error', () => {
        client.destroy();
        if (!isResolved) {
          isResolved = true;
          resolve(false);
        }
      });

      client.on('timeout', () => {
        client.destroy();
        if (!isResolved) {
          isResolved = true;
          resolve(false);
        }
      });
    });
  }

  private spawnBackgroundDaemon(): void {
    try {
      const daemonScript = path.resolve(__dirname, '../index.js');
      if (fs.existsSync(daemonScript)) {
        const child = childProcess.spawn(process.execPath, [daemonScript], {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, KLOAK_VAULT_DIR: getDefaultVaultDir() }
        });
        child.unref();
      }
    } catch {}
  }

  private sendMessage(msg: any): void {
    const jsonStr = JSON.stringify(msg);
    const msgBuffer = Buffer.from(jsonStr, 'utf-8');
    const headerBuffer = Buffer.alloc(4);
    headerBuffer.writeUInt32LE(msgBuffer.length, 0);

    process.stdout.write(Buffer.concat([headerBuffer, msgBuffer]));
  }

  public static installManifests(extensionIds: string[] = ['gikdgameggdmlfnchmeejfmhdgfbmfcl', 'hajgkgmajepndkhjhcgjenjnfojlphod']): string[] {
    const installedPaths: string[] = [];
    const hostScriptPath = path.resolve(__dirname, '../../dist/native-messaging/host.js');
    const nodePath = process.execPath;

    const vaultDir = getDefaultVaultDir();
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
    }

    // Generate a platform-appropriate wrapper script (.cmd on Windows, .sh elsewhere)
    const isWindows = process.platform === 'win32';
    const wrapperScriptExt = isWindows ? '.cmd' : '.sh';
    const wrapperScriptPath = path.join(vaultDir, `kloak-native-bridge${wrapperScriptExt}`);
    const wrapperScript = isWindows
      ? `@echo off\r\n"${nodePath}" "${hostScriptPath}" %*\r\n`
      : `#!/bin/sh\nexport PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"\nNODE_BIN="$(which node 2>/dev/null || echo "${nodePath}")"\nexec "$NODE_BIN" "${hostScriptPath}" "$@"\n`;
    const wrapperMode = isWindows ? undefined : 0o755;
    fs.writeFileSync(wrapperScriptPath, wrapperScript, isWindows ? { encoding: 'utf-8' } : { mode: wrapperMode! });
    if (!isWindows) {
      try { fs.chmodSync(wrapperScriptPath, 0o755); } catch {}
    }

    const allExtensionIds = Array.from(new Set([
      'gikdgameggdmlfnchmeejfmhdgfbmfcl', // Unpacked / dev extension ID
      'hajgkgmajepndkhjhcgjenjnfojlphod', // Official Chrome Web Store ID
      ...extensionIds
    ]));

    const chromeManifest = {
      name: NATIVE_HOST_NAME,
      description: 'Kloak Password Manager Native Messaging Host',
      path: wrapperScriptPath,
      type: 'stdio',
      allowed_origins: [
        ...allExtensionIds.map(id => `chrome-extension://${id}/`)
      ]
    };

    const firefoxManifest = {
      name: NATIVE_HOST_NAME,
      description: 'Kloak Password Manager Native Messaging Host',
      path: wrapperScriptPath,
      type: 'stdio',
      allowed_extensions: ['kloak@passwords.app', 'kloak-extension@local']
    };

    // --- Windows: AppData NativeMessagingHosts directories + Registry entries ---
    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

      const windowsTargetDirs = [
        {
          dir: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts'),
          manifest: chromeManifest,
          browser: 'chrome'
        },
        {
          dir: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'NativeMessagingHosts'),
          manifest: chromeManifest,
          browser: 'brave'
        },
        {
          dir: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'NativeMessagingHosts'),
          manifest: chromeManifest,
          browser: 'edge'
        },
        {
          dir: path.join(appData, 'Opera Software', 'Opera Stable', 'NativeMessagingHosts'),
          manifest: chromeManifest,
          browser: 'opera'
        },
        {
          dir: path.join(appData, 'Opera Software', 'Opera GX Stable', 'NativeMessagingHosts'),
          manifest: chromeManifest,
          browser: 'opera-gx'
        },
        {
          dir: path.join(appData, 'Mozilla', 'NativeMessagingHosts'),
          manifest: firefoxManifest,
          browser: 'firefox'
        }
      ];

      for (const target of windowsTargetDirs) {
        try {
          if (!fs.existsSync(target.dir)) fs.mkdirSync(target.dir, { recursive: true });
          const manifestPath = path.join(target.dir, `${NATIVE_HOST_NAME}.json`);
          fs.writeFileSync(manifestPath, JSON.stringify(target.manifest, null, 2));
          installedPaths.push(manifestPath);

          // Register in Windows Registry for Chromium browsers
          if (target.browser !== 'firefox') {
            const regBase = target.browser === 'edge'
              ? 'Microsoft\\Edge'
              : target.browser === 'brave'
                ? 'BraveSoftware\\Brave-Browser'
                : 'Google\\Chrome';
            const regKey = `HKCU\\Software\\${regBase}\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
            try {
              childProcess.execSync(`reg add "${regKey}" /ve /d "${manifestPath}" /f`, { stdio: 'ignore' });
            } catch {}
          }
        } catch (err: any) {
          console.warn(`Windows: Could not install manifest in ${target.dir}: ${err.message}`);
        }
      }
      return installedPaths;
    }

    // --- macOS / Linux: Library or XDG paths ---
    const targetDirs = [
      { dir: path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts'), manifest: chromeManifest },
      { dir: path.join(os.homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts'), manifest: chromeManifest },
      { dir: path.join(os.homedir(), 'Library/Application Support/Microsoft Edge/NativeMessagingHosts'), manifest: chromeManifest },
      { dir: path.join(os.homedir(), 'Library/Application Support/com.operasoftware.Opera/NativeMessagingHosts'), manifest: chromeManifest },
      { dir: path.join(os.homedir(), 'Library/Application Support/com.operasoftware.OperaGX/NativeMessagingHosts'), manifest: chromeManifest },
      { dir: path.join(os.homedir(), 'Library/Application Support/Arc/User Data/NativeMessagingHosts'), manifest: chromeManifest },
      { dir: path.join(os.homedir(), 'Library/Application Support/Chromium/NativeMessagingHosts'), manifest: chromeManifest },
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

