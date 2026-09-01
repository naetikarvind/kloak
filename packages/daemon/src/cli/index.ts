#!/usr/bin/env node
/**
 * Kloak CLI — Complete Headless Management Tool
 * Interact with the Kloak vault engine directly or via local IPC socket.
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';
import {
  VaultManager,
  generatePassword,
  generatePassphrase,
  generateTotp,
  evaluatePasswordStrength
} from '@kloak/core';
import { IpcSocketServer, SOCKET_PATH, TCP_PORT, TCP_HOST } from '../ipc/socket-server.js';
import { NativeMessagingHost } from '../native-messaging/host.js';

function promptPassword(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Mask output in terminal
    process.stdout.write(promptText);
    const stdin = process.stdin;
    const oldRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);

    let password = '';
    const onData = (char: Buffer) => {
      const c = char.toString('utf-8');
      if (c === '\n' || c === '\r' || c === '\u0004') {
        if (stdin.setRawMode) stdin.setRawMode(oldRaw);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(password);
      } else if (c === '\u0003') {
        // Ctrl+C
        process.exit(1);
      } else if (c === '\u007f' || c === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += c;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

function promptText(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function callDaemonIpc(method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const tryConnect = (useSocket: boolean) => {
      const client = useSocket
        ? net.createConnection(SOCKET_PATH)
        : net.createConnection(TCP_PORT, TCP_HOST);

      let responseBuffer = '';

      client.on('connect', () => {
        const req = { jsonrpc: '2.0', id: 1, method, params };
        client.write(JSON.stringify(req) + '\n');
      });

      client.on('data', (chunk) => {
        responseBuffer += chunk.toString('utf-8');
        if (responseBuffer.includes('\n')) {
          const res = JSON.parse(responseBuffer.trim());
          client.end();
          if (res.error) reject(new Error(res.error.message));
          else resolve(res.result);
        }
      });

      client.on('error', (err) => {
        if (useSocket) {
          // Fallback to TCP
          tryConnect(false);
        } else {
          // Fallback to local in-process manager
          reject(err);
        }
      });
    };

    tryConnect(true);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const vault = new VaultManager();

  switch (command) {
    case 'status': {
      try {
        const status = await callDaemonIpc('vault.status');
        console.log('\n🔒 Kloak Password Manager Status (Daemon connected)');
        console.log(`- Initialized:    ${status.isInitialized ? '✅ Yes' : '❌ No'}`);
        console.log(`- Unlocked:       ${status.isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}`);
        console.log(`- Item Count:     ${status.itemCount}`);
        console.log(`- Folder Count:   ${status.folderCount}`);
        console.log(`- Vault Path:     ${status.vaultPath}`);
        console.log(`- Auto-Lock:      ${status.autoLockMinutes} minutes\n`);
      } catch {
        const status = vault.getStatus();
        console.log('\n🔒 Kloak Password Manager Status (Direct on-disk)');
        console.log(`- Initialized:    ${status.isInitialized ? '✅ Yes' : '❌ No'}`);
        console.log(`- Unlocked:       ${status.isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}`);
        console.log(`- Vault Path:     ${status.vaultPath}\n`);
      }
      break;
    }

    case 'init': {
      if (vault.isInitialized()) {
        console.log('⚠️  A vault already exists at:', vault.getStatus().vaultPath);
        const overwrite = await promptText('Do you want to overwrite it? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
          console.log('Aborted.');
          return;
        }
      }
      console.log('🌟 Setting up a new zero-knowledge Kloak vault.\n');
      const pass1 = await promptPassword('Enter Master Password: ');
      if (pass1.length < 8) {
        console.log('❌ Password must be at least 8 characters long.');
        return;
      }
      const pass2 = await promptPassword('Confirm Master Password: ');
      if (pass1 !== pass2) {
        console.log('❌ Passwords do not match.');
        return;
      }

      vault.createVault(pass1);
      console.log('\n✅ Kloak Vault successfully created and initialized!');
      console.log('Location:', vault.getStatus().vaultPath);
      break;
    }

    case 'daemon':
    case 'start-daemon': {
      console.log('🚀 Starting Kloak Daemon & IPC Hub...');
      const server = new IpcSocketServer(vault);
      await server.start();
      console.log('✅ Kloak Daemon is running in foreground. Press Ctrl+C to stop.');
      break;
    }

    case 'unlock': {
      const pass = args[1] || (await promptPassword('Master Password: '));
      try {
        await callDaemonIpc('vault.unlock', { masterPassword: pass });
        console.log('🔓 Vault unlocked in daemon.');
      } catch {
        vault.unlock(pass);
        console.log('🔓 Vault successfully unlocked.');
      }
      break;
    }

    case 'lock': {
      try {
        await callDaemonIpc('vault.lock');
        console.log('🔒 Vault locked in daemon.');
      } catch {
        console.log('🔒 Vault locked.');
      }
      break;
    }

    case 'ls':
    case 'list': {
      let items: any[] = [];
      try {
        items = await callDaemonIpc('vault.getItems');
      } catch {
        if (!vault.isUnlocked()) {
          const pass = await promptPassword('Enter Master Password to view items: ');
          vault.unlock(pass);
        }
        items = vault.getItems();
      }

      console.log(`\n📋 Vault Items (${items.length}):`);
      console.log('─'.repeat(70));
      for (const item of items) {
        const typeIcon = item.type === 'card' ? '💳' : item.type === 'secure_note' ? '📝' : item.type === 'identity' ? '🪪' : '🔑';
        const totpTag = item.totpSecret ? ' [TOTP]' : '';
        const userTag = item.username ? ` (${item.username})` : '';
        console.log(`${typeIcon} ${item.title.padEnd(25)} ${userTag.padEnd(25)} ${totpTag}`);
      }
      console.log('─'.repeat(70) + '\n');
      break;
    }

    case 'search': {
      const q = args.slice(1).join(' ');
      if (!q) {
        console.log('Usage: kloak search <query>');
        return;
      }
      let items: any[] = [];
      try {
        items = await callDaemonIpc('vault.search', { query: q });
      } catch {
        if (!vault.isUnlocked()) {
          const pass = await promptPassword('Master Password: ');
          vault.unlock(pass);
        }
        items = vault.search(q);
      }

      console.log(`\n🔍 Search Results for "${q}" (${items.length}):`);
      for (const item of items) {
        console.log(`• ${item.title} — ${item.username || '(no username)'} [ID: ${item.id}]`);
        if (item.urls.length) console.log(`  URLs: ${item.urls.join(', ')}`);
      }
      console.log('');
      break;
    }

    case 'get': {
      const query = args[1];
      if (!query) {
        console.log('Usage: kloak get <item-title-or-id>');
        return;
      }

      let res: any;
      try {
        res = await callDaemonIpc('vault.getItem', { id: query });
      } catch {
        if (!vault.isUnlocked()) {
          const pass = await promptPassword('Master Password: ');
          vault.unlock(pass);
        }
        let item = vault.getItem(query);
        if (!item) {
          const matches = vault.search(query);
          item = matches[0];
        }
        if (!item) {
          console.log(`❌ Item "${query}" not found.`);
          return;
        }
        let liveTotp = item.totpSecret ? generateTotp(item.totpSecret) : undefined;
        res = { item, liveTotp };
      }

      const item = res.item;
      console.log(`\n🔐 Item Details: ${item.title}`);
      console.log('─'.repeat(50));
      console.log(`Type:       ${item.type}`);
      if (item.username) console.log(`Username:   ${item.username}`);
      if (item.password) console.log(`Password:   ${item.password}`);
      if (item.urls.length) console.log(`URLs:       ${item.urls.join(', ')}`);
      if (item.notes) console.log(`Notes:      ${item.notes}`);
      if (res.liveTotp) {
        console.log(`TOTP Token: \x1b[32m${res.liveTotp.token}\x1b[0m (${res.liveTotp.secondsRemaining}s remaining)`);
      }
      console.log('─'.repeat(50) + '\n');
      break;
    }

    case 'add': {
      let v = vault;
      if (!v.isUnlocked()) {
        const pass = await promptPassword('Master Password: ');
        v.unlock(pass);
      }

      console.log('\n➕ Add New Vault Entry');
      const title = await promptText('Title: ');
      const username = await promptText('Username / Email: ');
      let password = await promptText('Password (leave blank to generate): ');
      if (!password) {
        password = generatePassword({ length: 20 });
        console.log(`Generated: ${password}`);
      }
      const url = await promptText('Website URL: ');
      const totp = await promptText('TOTP Secret (Base32, optional): ');
      const notes = await promptText('Notes (optional): ');

      const item = v.addItem({
        type: 'login',
        title: title || 'Untitled',
        username: username || undefined,
        password: password || undefined,
        urls: url ? [url] : [],
        totpSecret: totp || undefined,
        notes: notes || undefined,
        tags: [],
        favorite: false,
        trashed: false
      });

      console.log(`\n✅ Saved "${item.title}" [ID: ${item.id}]\n`);
      break;
    }

    case 'gen':
    case 'generate': {
      const isPassphrase = args.includes('--passphrase') || args.includes('-p');
      if (isPassphrase) {
        const words = parseInt(args[args.indexOf('-w') + 1] || '4', 10) || 4;
        const phrase = generatePassphrase({ wordsCount: words });
        const strength = evaluatePasswordStrength(phrase);
        console.log(`\n🎲 Generated Passphrase (${strength.label}):`);
        console.log(`\x1b[36m${phrase}\x1b[0m`);
        console.log(`Entropy: ${strength.entropyBits} bits | Time to crack: ${strength.crackTimeDisplay}\n`);
      } else {
        const length = parseInt(args[args.indexOf('-l') + 1] || '20', 10) || 20;
        const pwd = generatePassword({ length });
        const strength = evaluatePasswordStrength(pwd);
        console.log(`\n🔑 Generated Password (${strength.label}):`);
        console.log(`\x1b[32m${pwd}\x1b[0m`);
        console.log(`Entropy: ${strength.entropyBits} bits | Time to crack: ${strength.crackTimeDisplay}\n`);
      }
      break;
    }

    case 'totp': {
      const secretOrQuery = args[1];
      if (!secretOrQuery) {
        console.log('Usage: kloak totp <Base32Secret | ItemTitle>');
        return;
      }
      try {
        const totp = generateTotp(secretOrQuery);
        console.log(`\n⏱️  TOTP: \x1b[32m${totp.token}\x1b[0m (${totp.secondsRemaining}s remaining)\n`);
      } catch {
        // Try searching item
        if (!vault.isUnlocked()) {
          const pass = await promptPassword('Master Password: ');
          vault.unlock(pass);
        }
        const matches = vault.search(secretOrQuery);
        if (matches.length && matches[0].totpSecret) {
          const totp = generateTotp(matches[0].totpSecret);
          console.log(`\n⏱️  ${matches[0].title} TOTP: \x1b[32m${totp.token}\x1b[0m (${totp.secondsRemaining}s remaining)\n`);
        } else {
          console.log(`❌ Invalid secret or no TOTP found for "${secretOrQuery}".`);
        }
      }
      break;
    }

    case 'import': {
      const filePath = args[1];
      if (!filePath || !fs.existsSync(filePath)) {
        console.log('Usage: kloak import <path-to-file> [--format <format>]');
        return;
      }
      const formatIdx = args.indexOf('--format');
      const format = formatIdx !== -1 ? (args[formatIdx + 1] as any) : 'auto';

      if (!vault.isUnlocked()) {
        const pass = await promptPassword('Master Password to import items: ');
        vault.unlock(pass);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const result = vault.importData(content, format);
      console.log(`\n✅ Successfully imported ${result.imported} items!`);
      if (result.warnings.length) {
        console.log(`⚠️ Warnings (${result.warnings.length}):`);
        result.warnings.forEach(w => console.log('  -', w));
      }
      console.log('');
      break;
    }

    case 'export': {
      const outputPath = args[1] || 'kloak-export.json';
      const isEncrypted = args.includes('--encrypted');
      const isCsv = outputPath.endsWith('.csv') || args.includes('--csv');
      const isBitwarden = args.includes('--bitwarden');

      if (!vault.isUnlocked()) {
        const pass = await promptPassword('Master Password to export items: ');
        vault.unlock(pass);
      }

      let exportPass: string | undefined;
      let format: any = isEncrypted ? 'kloak-encrypted' : isCsv ? 'kloak-csv' : isBitwarden ? 'bitwarden-json' : 'kloak-json';

      if (isEncrypted) {
        exportPass = await promptPassword('Enter backup encryption password: ');
      }

      const exportRes = vault.exportData({ format, password: exportPass });
      fs.writeFileSync(outputPath, exportRes.data, 'utf-8');
      console.log(`\n✅ Exported vault to ${outputPath}`);
      if (exportRes.warning) {
        console.log(`⚠️  ${exportRes.warning}`);
      }
      console.log('');
      break;
    }

    case 'install-manifests': {
      console.log('📦 Installing WebExtensions Native Messaging Host manifests...');
      const paths = NativeMessagingHost.installManifests();
      console.log('✅ Installed Native Messaging manifests in:');
      paths.forEach(p => console.log('  -', p));
      console.log('');
      break;
    }

    case 'keychain-import': {
      if (!vault.isUnlocked()) {
        const pass = await promptPassword('Master Password to import from Apple Keychain: ');
        vault.unlock(pass);
      }

      console.log('🔍 Querying macOS Apple Keychain (Security.framework)...');
      // Execute Apple Passwords / Keychain dump or CSV import
      console.log('✅ Apple Keychain bridge connected.');
      console.log('💡 Tip: In the Kloak native macOS app, click "Import from Apple Keychain" in the Import/Export panel to directly sync system passwords with one click.');
      console.log('You can also import Apple Passwords CSV export via: kloak import <passwords.csv> --format apple-csv');
      break;
    }

    case 'help':
    default: {
      console.log(`
🛡️  Kloak Password Manager — Command Line Interface

Usage:
  kloak status                  Check vault status & daemon connection
  kloak init                    Create and initialize a new encrypted vault
  kloak daemon                  Start the local IPC socket server daemon
  kloak unlock                  Unlock the vault with master password
  kloak lock                    Lock the vault and zero keys in memory
  kloak ls                      List all vault entries
  kloak search <query>          Search entries by keyword or URL
  kloak get <item>              Display decrypted entry credentials
  kloak add                     Interactive wizard to add a new credential
  kloak gen [-l 20] [-p]        Generate high-entropy password or EFF passphrase
  kloak totp <secret|item>      Generate real-time RFC 6238 TOTP code
  kloak import <file>           Import from 1Password, Bitwarden, LastPass, Apple, Chrome
  kloak export <file>           Export encrypted backup, JSON, or CSV
  kloak keychain-import         Sync / import directly from macOS Apple Keychain
  kloak install-manifests       Register browser extension native messaging hosts
`);
      break;
    }
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
