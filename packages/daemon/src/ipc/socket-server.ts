/**
 * Kloak Daemon — IPC Socket Server
 * Provides Unix Domain Socket & TCP fallback server for Raycast, CLI, and apps.
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { VaultManager, DEFAULT_VAULT_DIR } from '@kloak/core';
import { generateTotp, generatePassword, generatePassphrase, evaluatePasswordStrength } from '@kloak/core';

export const SOCKET_PATH = path.join(DEFAULT_VAULT_DIR, 'kloak.sock');
export const TCP_PORT = 53152;
export const TCP_HOST = '127.0.0.1';

export interface JsonRpcRequest {
  jsonrpc?: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class IpcSocketServer {
  private vaultManager: VaultManager;
  private unixServer: net.Server | null = null;
  private tcpServer: net.Server | null = null;

  constructor(vaultManager: VaultManager) {
    this.vaultManager = vaultManager;
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      // Ensure socket directory exists
      if (!fs.existsSync(DEFAULT_VAULT_DIR)) {
        fs.mkdirSync(DEFAULT_VAULT_DIR, { recursive: true, mode: 0o700 });
      }

      // Cleanup existing socket file if orphaned
      if (fs.existsSync(SOCKET_PATH)) {
        try {
          fs.unlinkSync(SOCKET_PATH);
        } catch {}
      }

      // Start Unix Domain Socket
      this.unixServer = net.createServer((socket) => this.handleClient(socket));
      this.unixServer.listen(SOCKET_PATH, () => {
        try {
          fs.chmodSync(SOCKET_PATH, 0o600);
        } catch {}
        console.log(`[Kloak Daemon] Unix IPC Socket listening at ${SOCKET_PATH}`);
      });

      // Start Localhost TCP fallback
      this.tcpServer = net.createServer((socket) => this.handleClient(socket));
      this.tcpServer.listen(TCP_PORT, TCP_HOST, () => {
        console.log(`[Kloak Daemon] Localhost TCP IPC listening at ${TCP_HOST}:${TCP_PORT}`);
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

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.unixServer) {
        this.unixServer.close();
        if (fs.existsSync(SOCKET_PATH)) {
          try { fs.unlinkSync(SOCKET_PATH); } catch {}
        }
      }
      if (this.tcpServer) {
        this.tcpServer.close();
      }
      resolve();
    });
  }

  private handleClient(socket: net.Socket): void {
    let buffer = '';

    socket.on('data', async (chunk) => {
      buffer += chunk.toString('utf-8');

      // Process newline-delimited JSON-RPC messages
      while (buffer.includes('\n')) {
        const lineEnd = buffer.indexOf('\n');
        const rawMessage = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        if (!rawMessage) continue;

        try {
          const request: JsonRpcRequest = JSON.parse(rawMessage);
          const response = await this.dispatch(request);
          socket.write(JSON.stringify(response) + '\n');
        } catch (err: any) {
          const errorResponse: JsonRpcResponse = {
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

  public async dispatch(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = req.id ?? null;

    try {
      const result = await this.handleMethod(req.method, req.params || {});
      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (err: any) {
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

  private async handleMethod(method: string, params: any): Promise<any> {
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
        if (!item) throw new Error(`Item ${params.id} not found.`);
        let liveTotp = undefined;
        if (item.totpSecret) {
          try {
            liveTotp = generateTotp(item.totpSecret);
          } catch {}
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
        return generateTotp(params.secret, params.options);

      case 'vault.generatePassword': {
        const password = generatePassword(params.options);
        const strength = evaluatePasswordStrength(password);
        return { password, strength };
      }

      case 'vault.generatePassphrase': {
        const passphrase = generatePassphrase(params.options);
        const strength = evaluatePasswordStrength(passphrase);
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
        const reasons: string[] = [];
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
        } catch {}
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
          this.vaultManager.addItem(item as any);
        } catch {}
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
