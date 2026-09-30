/**
 * Kloak Windows App — Electron Main Process
 * Manages the application lifecycle, system tray, vault daemon, and IPC.
 *
 * Architecture:
 *   Renderer (React/Vite)
 *     ↕  contextBridge (preload.ts)
 *   Main Process (this file)
 *     ↕  JSON-RPC over TCP 127.0.0.1:53152
 *   @kloak/daemon (child_process.fork)
 */

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  dialog,
  shell,
  nativeTheme,
  type Event as ElectronEvent
} from 'electron';
import * as path from 'path';
import * as net from 'net';
import * as os from 'os';
import * as fs from 'fs';
import * as childProcess from 'child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** True when running via `electron .` or `npm run dev`, false in a packaged build. */
const IS_DEV = !app.isPackaged;

/** Directory where the encrypted vault file is stored on Windows. */
const VAULT_DIR = path.join(process.env.APPDATA ?? os.homedir(), 'Kloak');

/** Daemon TCP endpoint — matches @kloak/daemon default. */
const TCP_HOST = '127.0.0.1';
const TCP_PORT = 53152;

/** Named-pipe path — kept as a constant for future pipe-transport support. */
const PIPE_PATH = '\\\\.\\pipe\\kloak'; // eslint-disable-line @typescript-eslint/no-unused-vars

/** Resolved at runtime; falls back gracefully when the icon file is absent. */
const ICON_PATH = path.join(__dirname, '..', 'public', 'icon.ico');

// ─────────────────────────────────────────────────────────────────────────────
// Mutable state
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let daemonProcess: childProcess.ChildProcess | null = null;

/**
 * Becomes true once the daemon has signalled that it is listening.
 * Used to gate the "daemon ready" push to the renderer.
 */
let isDaemonReady = false;

// ─────────────────────────────────────────────────────────────────────────────
// Single-instance lock
// Ensures only one Kloak window is ever open at once.
// ─────────────────────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  // Another instance is already running — quit this one immediately.
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  // Focus or restore the existing window when a second launch is attempted.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Daemon management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawns the @kloak/daemon Node.js process as a child of this main process.
 *
 * In dev mode the daemon is resolved from the monorepo sibling package.
 * In production it is bundled via extraResources into process.resourcesPath.
 *
 * If the entry point cannot be found (e.g. daemon not built yet), the app
 * skips forking and sets isDaemonReady = true so that direct TCP calls to an
 * already-running daemon still work.
 */
function startDaemon(): void {
  const daemonEntry = IS_DEV
    ? path.join(__dirname, '..', '..', 'daemon', 'dist', 'index.js')
    : path.join(process.resourcesPath, 'daemon', 'dist', 'index.js');

  if (!fs.existsSync(daemonEntry)) {
    console.warn(
      '[Main] Daemon entry not found at',
      daemonEntry,
      '— skipping daemon spawn (will connect to an existing daemon via TCP)'
    );
    isDaemonReady = true;
    return;
  }

  daemonProcess = childProcess.fork(daemonEntry, [], {
    // stdio tuple: stdin=ignore, stdout=pipe, stderr=pipe, ipc channel
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, KLOAK_VAULT_DIR: VAULT_DIR }
  });

  daemonProcess.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    console.log('[Daemon]', msg);
    // The daemon logs "listening" once the TCP server is bound.
    if (msg.includes('listening')) {
      isDaemonReady = true;
      mainWindow?.webContents.send('daemon:ready');
    }
  });

  daemonProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Daemon ERR]', data.toString().trim());
  });

  daemonProcess.on('exit', (code) => {
    console.log('[Main] Daemon exited with code', code);
    isDaemonReady = false;
    daemonProcess = null;
  });
}

/** Gracefully terminates the daemon child process. */
function stopDaemon(): void {
  if (daemonProcess) {
    daemonProcess.kill('SIGTERM');
    daemonProcess = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC TCP bridge
// All IPC handlers in this file delegate here — the main process never holds
// vault state itself; it is just a secure relay between renderer and daemon.
// ─────────────────────────────────────────────────────────────────────────────

/** Monotonically increasing JSON-RPC request ID. */
let rpcIdCounter = 1;

/**
 * Sends a JSON-RPC 2.0 request to the daemon over TCP and returns the result.
 *
 * @param method - The RPC method name (e.g. "vault.unlock")
 * @param params - Method parameters object
 * @returns Resolves with `result` from the daemon response
 * @throws  Rejects with an Error if the daemon returns an error object,
 *          the connection fails, or the 8-second timeout is exceeded.
 */
async function callDaemon<T = unknown>(method: string, params: unknown = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = '';

    const request =
      JSON.stringify({ jsonrpc: '2.0', id: rpcIdCounter++, method, params }) + '\n';

    socket.connect(TCP_PORT, TCP_HOST, () => {
      socket.write(request);
    });

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      // JSON-RPC responses are newline-delimited.
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex !== -1) {
        const raw = buffer.slice(0, newlineIndex);
        socket.destroy();
        try {
          const response = JSON.parse(raw) as { result?: T; error?: { message: string } };
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result as T);
          }
        } catch (parseError) {
          reject(parseError);
        }
      }
    });

    socket.on('error', (err) => {
      reject(err);
    });

    // Abort if the daemon doesn't respond within 8 seconds.
    socket.setTimeout(8_000, () => {
      socket.destroy();
      reject(new Error('Daemon timeout: no response within 8 s'));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers
// Each handler is registered once in registerIpcHandlers(), called during
// app 'ready'. Handlers use ipcMain.handle() (invoke/handle pattern) for
// request-response, and ipcMain.on() for fire-and-forget messages.
// ─────────────────────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // ── Daemon health ──────────────────────────────────────────────────────────
  ipcMain.handle('daemon:ping', () => callDaemon('daemon.ping'));

  // ── Vault lifecycle ────────────────────────────────────────────────────────
  ipcMain.handle('vault:status', () => callDaemon('vault.status'));

  ipcMain.handle('vault:create', (_e, masterPassword: string) =>
    callDaemon('vault.create', { masterPassword })
  );

  ipcMain.handle('vault:unlock', (_e, masterPassword: string) =>
    callDaemon('vault.unlock', { masterPassword })
  );

  ipcMain.handle('vault:lock', () => callDaemon('vault.lock'));

  // ── CRUD ──────────────────────────────────────────────────────────────────
  ipcMain.handle('vault:getItems', (_e, includeTrash = false) =>
    callDaemon('vault.getItems', { includeTrash })
  );

  ipcMain.handle('vault:getItem', (_e, id: string) =>
    callDaemon('vault.getItem', { id })
  );

  ipcMain.handle('vault:addItem', (_e, item: unknown) =>
    callDaemon('vault.addItem', { item })
  );

  ipcMain.handle('vault:updateItem', (_e, id: string, updates: unknown) =>
    callDaemon('vault.updateItem', { id, updates })
  );

  ipcMain.handle('vault:deleteItem', (_e, id: string, permanent = false) =>
    callDaemon('vault.deleteItem', { id, permanent })
  );

  ipcMain.handle('vault:restoreItem', (_e, id: string) =>
    callDaemon('vault.restoreItem', { id })
  );

  // ── Search & URL matching ─────────────────────────────────────────────────
  ipcMain.handle('vault:search', (_e, query: string) =>
    callDaemon('vault.search', { query })
  );

  ipcMain.handle('vault:matchByUrl', (_e, url: string) =>
    callDaemon('vault.matchByUrl', { url })
  );

  // ── Crypto tools ──────────────────────────────────────────────────────────
  ipcMain.handle('vault:generateTotp', (_e, secret: string, options?: unknown) =>
    callDaemon('vault.generateTotp', { secret, options })
  );

  ipcMain.handle('vault:generatePassword', (_e, options?: unknown) =>
    callDaemon('vault.generatePassword', { options })
  );

  ipcMain.handle('vault:generatePassphrase', (_e, options?: unknown) =>
    callDaemon('vault.generatePassphrase', { options })
  );

  // ── Import / Export ───────────────────────────────────────────────────────
  ipcMain.handle('vault:import', (_e, content: string, format?: string) =>
    callDaemon('vault.import', { content, format })
  );

  ipcMain.handle('vault:export', (_e, options: unknown) =>
    callDaemon('vault.export', { options })
  );

  // ── Folders & Settings ────────────────────────────────────────────────────
  ipcMain.handle('vault:getFolders', () => callDaemon('vault.getFolders'));

  ipcMain.handle('vault:addFolder', (_e, name: string) =>
    callDaemon('vault.addFolder', { name })
  );

  ipcMain.handle('vault:getSettings', () => callDaemon('vault.getSettings'));

  ipcMain.handle('vault:updateSettings', (_e, settings: unknown) =>
    callDaemon('vault.updateSettings', { settings })
  );

  ipcMain.handle(
    'vault:changeMasterPassword',
    (_e, oldPassword: string, newPassword: string) =>
      callDaemon('vault.changeMasterPassword', { oldPassword, newPassword })
  );

  // ── Shield (breach / phishing detection) ─────────────────────────────────
  ipcMain.handle('shield:inspectUrl', (_e, url: string) =>
    callDaemon('shield.inspectUrl', { url })
  );

  // ── File picker helpers ───────────────────────────────────────────────────

  /**
   * Opens the native file-open dialog and returns the selected file's
   * contents as a UTF-8 string, or null if the user cancelled.
   */
  ipcMain.handle('app:openFilePicker', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Passwords',
      filters: [
        { name: 'All Supported Formats', extensions: ['json', 'csv', 'xml', '1pux', '1pif'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'CSV', extensions: ['csv'] },
        { name: 'XML', extensions: ['xml'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return fs.readFileSync(result.filePaths[0], 'utf-8');
  });

  /**
   * Opens the native save dialog and writes content to the chosen path.
   * Returns true on success, false if the user cancelled.
   */
  ipcMain.handle('app:saveFilePicker', async (_e, content: string, defaultName: string) => {
    if (!mainWindow) return false;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Vault',
      defaultPath: defaultName,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });

    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  });

  // ── Window controls (fire-and-forget) ─────────────────────────────────────
  ipcMain.on('app:minimize', () => mainWindow?.minimize());
  ipcMain.on('app:hide', () => mainWindow?.hide());
  ipcMain.on('app:openExternal', (_e, url: string) => shell.openExternal(url));

  // ── Auto-start at Windows login ───────────────────────────────────────────
  ipcMain.handle('app:setAutoStart', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
  });

  ipcMain.handle('app:getAutoStart', () => app.getLoginItemSettings().openAtLogin);

  // ── Theme ──────────────────────────────────────────────────────────────────
  ipcMain.handle('app:getTheme', () =>
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  );

  ipcMain.handle('app:setTheme', (_e, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme;
  });

  // ── Vault state notifications from renderer → main ─────────────────────────
  // Renderer sends these after a successful unlock/lock so the tray can update.
  ipcMain.on('vault:unlocked', () => updateTrayMenu(true));
  ipcMain.on('vault:locked-notify', () => updateTrayMenu(false));
}

// ─────────────────────────────────────────────────────────────────────────────
// BrowserWindow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates (or re-creates) the main application window.
 *
 * Key decisions:
 * - `frame: false`   — Custom frameless title bar rendered in React.
 * - `show: false`    — Window is hidden until 'ready-to-show' to avoid flash.
 * - `close` handler  — Intercepts close and hides instead, keeping tray alive.
 * - `nodeIntegration: false` + `contextIsolation: true` — Electron security baseline.
 */
function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1020,
    height: 700,
    minWidth: 760,
    minHeight: 520,
    frame: false,
    transparent: false,
    backgroundColor: '#0f172a', // Slate-900 — matches the dark theme base
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // Required: renderer cannot access Node APIs
      nodeIntegration: false,   // Required: no direct Node in renderer
      sandbox: false            // false needed so preload can use ipcRenderer
    },
    show: false
  });

  // ── Load the React UI ───────────────────────────────────────────────────
  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, renderer is bundled to dist/renderer/ by Vite.
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Show only when fully painted — prevents white-flash on startup.
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // ── Minimize to tray on close ───────────────────────────────────────────
  mainWindow.on('close', (e: ElectronEvent) => {
    // Prevent the OS from destroying the window; hide it to tray instead.
    e.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ─────────────────────────────────────────────────────────────────────────────
// System tray
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises the system tray icon and context menu.
 * Double-clicking the tray icon toggles the main window.
 */
function createTray(): void {
  try {
    tray = new Tray(fs.existsSync(ICON_PATH) ? ICON_PATH : nativeImage.createEmpty());
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }

  tray.setToolTip('Kloak Password Manager');
  updateTrayMenu(false);
  tray.on('double-click', toggleWindow);
}

/**
 * Rebuilds the tray context menu to reflect current vault lock state.
 *
 * @param isUnlocked - Pass true after a successful vault.unlock call.
 */
function updateTrayMenu(isUnlocked: boolean): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Kloak',
      click: () => toggleWindow()
    },
    { type: 'separator' },
    {
      label: isUnlocked ? '🔓 Vault Unlocked' : '🔒 Vault Locked',
      enabled: false // Status label — not clickable
    },
    {
      label: 'Lock Vault',
      enabled: isUnlocked,
      click: async () => {
        try {
          await callDaemon('vault.lock');
          // Push lock event down to renderer so it can show the lock screen.
          mainWindow?.webContents.send('vault:locked');
          updateTrayMenu(false);
        } catch (err) {
          console.error('[Main] Failed to lock vault from tray:', err);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Kloak',
      click: () => {
        // Remove the intercepting close handler so the window actually closes.
        mainWindow?.removeAllListeners('close');
        stopDaemon();
        app.quit();
      }
    }
  ]);

  tray?.setContextMenu(menu);
}

/**
 * Toggles main window visibility — used by tray double-click and "Open Kloak".
 */
function toggleWindow(): void {
  if (!mainWindow) {
    createMainWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────

app.on('ready', () => {
  // Ensure the vault storage directory exists before the daemon starts.
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  // IPC handlers must be registered before any window is created so that
  // renderer-initiated calls during load don't miss their handlers.
  registerIpcHandlers();

  // Spawn the @kloak/daemon child process.
  startDaemon();

  // Create the tray icon and the main window.
  createTray();
  createMainWindow();
});

app.on('window-all-closed', () => {
  // On Windows, closing all windows would normally quit the app if quit was called.
  // By leaving this empty, we keep Kloak running in the system tray.
});

app.on('before-quit', () => {
  // Ensure the daemon is always cleaned up on any quit path.
  stopDaemon();
});

app.on('activate', () => {
  // macOS: re-create window when dock icon is clicked and no windows are open.
  if (!mainWindow) createMainWindow();
});
