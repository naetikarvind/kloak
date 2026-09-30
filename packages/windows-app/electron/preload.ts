/**
 * Kloak Windows App — Preload Script
 *
 * This script runs in a special isolated context that has access to both the
 * DOM *and* Electron's ipcRenderer, but nothing it exposes via contextBridge
 * can access Node.js APIs directly — the renderer is fully sandboxed.
 *
 * Every method maps 1-to-1 with an ipcMain.handle() in main.ts.
 */

import { contextBridge, ipcRenderer } from 'electron';

// ─────────────────────────────────────────────────────────────────────────────
// Allowed IPC event channels for push notifications (main → renderer).
// Maintaining an explicit allow-list prevents renderer code from subscribing
// to arbitrary channels.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_EVENTS = ['daemon:ready', 'vault:locked', 'vault:unlocked'] as const;
type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

function isAllowedEvent(channel: string): channel is AllowedEvent {
  return (ALLOWED_EVENTS as readonly string[]).includes(channel);
}

// ─────────────────────────────────────────────────────────────────────────────
// The kloak API surface exposed to window.kloak in the renderer
// ─────────────────────────────────────────────────────────────────────────────

const kloak = {
  // ── Daemon ───────────────────────────────────────────────────────────────
  /** Ping the daemon to verify connectivity. */
  ping: () => ipcRenderer.invoke('daemon:ping'),

  // ── Vault lifecycle ───────────────────────────────────────────────────────
  /** Returns the current vault status (locked / unlocked / uninitialised). */
  status: () => ipcRenderer.invoke('vault:status'),

  /** Creates a new vault protected with the given master password. */
  create: (masterPassword: string) => ipcRenderer.invoke('vault:create', masterPassword),

  /** Unlocks the vault with the given master password. */
  unlock: (masterPassword: string) => ipcRenderer.invoke('vault:unlock', masterPassword),

  /** Locks the vault and clears the in-memory key. */
  lock: () => ipcRenderer.invoke('vault:lock'),

  // ── CRUD ──────────────────────────────────────────────────────────────────
  /** Lists all vault items. Pass true to include soft-deleted items. */
  getItems: (includeTrash?: boolean) =>
    ipcRenderer.invoke('vault:getItems', includeTrash),

  /** Retrieves a single vault item by ID. */
  getItem: (id: string) => ipcRenderer.invoke('vault:getItem', id),

  /** Adds a new item to the vault. */
  addItem: (item: unknown) => ipcRenderer.invoke('vault:addItem', item),

  /** Applies partial updates to an existing vault item. */
  updateItem: (id: string, updates: unknown) =>
    ipcRenderer.invoke('vault:updateItem', id, updates),

  /**
   * Deletes a vault item.
   * @param permanent - If false (default), moves to trash; if true, wipes it.
   */
  deleteItem: (id: string, permanent?: boolean) =>
    ipcRenderer.invoke('vault:deleteItem', id, permanent),

  /** Restores a soft-deleted item from the trash. */
  restoreItem: (id: string) => ipcRenderer.invoke('vault:restoreItem', id),

  // ── Search & URL matching ─────────────────────────────────────────────────
  /** Full-text search across all vault items. */
  search: (query: string) => ipcRenderer.invoke('vault:search', query),

  /** Returns items whose URL field matches the given URL (for autofill). */
  matchByUrl: (url: string) => ipcRenderer.invoke('vault:matchByUrl', url),

  // ── Crypto tools ──────────────────────────────────────────────────────────
  /** Generates a TOTP code for the given Base32 secret. */
  generateTotp: (secret: string, options?: unknown) =>
    ipcRenderer.invoke('vault:generateTotp', secret, options),

  /** Generates a random password using the given policy options. */
  generatePassword: (options?: unknown) =>
    ipcRenderer.invoke('vault:generatePassword', options),

  /** Generates a random passphrase (wordlist-based). */
  generatePassphrase: (options?: unknown) =>
    ipcRenderer.invoke('vault:generatePassphrase', options),

  // ── Import / Export ───────────────────────────────────────────────────────
  /**
   * Imports passwords from a string payload.
   * @param content - Raw file content (JSON, CSV, XML, 1PUX, etc.)
   * @param format  - Hint for the parser; auto-detected when omitted.
   */
  importVault: (content: string, format?: string) =>
    ipcRenderer.invoke('vault:import', content, format),

  /** Exports the vault in the format specified by options. */
  exportVault: (options: unknown) => ipcRenderer.invoke('vault:export', options),

  // ── Folders & Settings ────────────────────────────────────────────────────
  /** Returns all vault folders. */
  getFolders: () => ipcRenderer.invoke('vault:getFolders'),

  /** Creates a new folder with the given name. */
  addFolder: (name: string) => ipcRenderer.invoke('vault:addFolder', name),

  /** Returns the persisted vault settings object. */
  getSettings: () => ipcRenderer.invoke('vault:getSettings'),

  /** Merges the provided settings into the vault settings. */
  updateSettings: (settings: unknown) =>
    ipcRenderer.invoke('vault:updateSettings', settings),

  /** Changes the vault master password after verifying the old one. */
  changeMasterPassword: (oldPassword: string, newPassword: string) =>
    ipcRenderer.invoke('vault:changeMasterPassword', oldPassword, newPassword),

  // ── Shield ────────────────────────────────────────────────────────────────
  /** Checks a URL against breach / phishing databases via the daemon. */
  inspectUrl: (url: string) => ipcRenderer.invoke('shield:inspectUrl', url),

  // ── App utilities ─────────────────────────────────────────────────────────
  /**
   * Opens the native file-open dialog and returns the selected file's
   * contents as a string, or null if the user cancelled.
   */
  openFilePicker: () => ipcRenderer.invoke('app:openFilePicker'),

  /**
   * Opens the native save dialog and writes content to the chosen path.
   * @returns true on success, false if cancelled.
   */
  saveFilePicker: (content: string, defaultName: string) =>
    ipcRenderer.invoke('app:saveFilePicker', content, defaultName),

  /** Minimises the main window. */
  minimize: () => ipcRenderer.send('app:minimize'),

  /** Hides the main window to the system tray. */
  hide: () => ipcRenderer.send('app:hide'),

  /** Opens a URL in the system default browser. */
  openExternal: (url: string) => ipcRenderer.send('app:openExternal', url),

  /** Enables or disables Windows auto-start at login via the registry. */
  setAutoStart: (enabled: boolean) =>
    ipcRenderer.invoke('app:setAutoStart', enabled),

  /** Returns whether Kloak is configured to start at login. */
  getAutoStart: () => ipcRenderer.invoke('app:getAutoStart'),

  /** Returns the current effective theme ('light' | 'dark'). */
  getTheme: () => ipcRenderer.invoke('app:getTheme'),

  /**
   * Sets the app colour theme.
   * 'system' follows the OS preference.
   */
  setTheme: (theme: 'light' | 'dark' | 'system') =>
    ipcRenderer.invoke('app:setTheme', theme),

  // ── Push-event subscriptions (main → renderer) ────────────────────────────

  /**
   * Registers a callback for the specified IPC push event.
   * Only channels in the ALLOWED_EVENTS allow-list are accepted.
   *
   * @returns A cleanup function that removes the listener.
   */
  on: (channel: AllowedEvent, cb: (...args: unknown[]) => void): (() => void) => {
    if (!isAllowedEvent(channel)) {
      console.warn('[Preload] Attempted to subscribe to disallowed channel:', channel);
      return () => {};
    }
    // ipcRenderer wraps the callback with the event object; we drop it here
    // so the renderer receives only the payload arguments.
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args);
    ipcRenderer.on(channel, wrapped);
    // Return a cleanup function so React components can unsubscribe on unmount.
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  // ── Convenience named subscriptions (kept for ergonomics) ─────────────────

  /** Fires once the daemon has signalled it is listening. */
  onDaemonReady: (cb: () => void) => {
    const wrapped = () => cb();
    ipcRenderer.on('daemon:ready', wrapped);
    return () => ipcRenderer.removeListener('daemon:ready', wrapped);
  },

  /** Fires when the vault is locked (from tray or timeout). */
  onVaultLocked: (cb: () => void) => {
    const wrapped = () => cb();
    ipcRenderer.on('vault:locked', wrapped);
    return () => ipcRenderer.removeListener('vault:locked', wrapped);
  },

  /** Fires when the vault is unlocked (pushed from main if needed). */
  onVaultUnlocked: (cb: () => void) => {
    const wrapped = () => cb();
    ipcRenderer.on('vault:unlocked', wrapped);
    return () => ipcRenderer.removeListener('vault:unlocked', wrapped);
  }
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Expose to renderer as window.kloak
// ─────────────────────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('kloak', kloak);

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript ambient declaration
// Import this type in renderer code: import type { KloakAPI } from '../electron/preload'
// ─────────────────────────────────────────────────────────────────────────────
export type KloakAPI = typeof kloak;
