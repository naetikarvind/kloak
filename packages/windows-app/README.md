# Kloak Password Manager — Windows App

Electron-based Windows desktop application for the Kloak local-first password manager.

## Architecture

```
packages/windows-app/
├── electron/           ← Main process (Tray, IPC, Daemon management)
│   ├── main.ts         ← App lifecycle, tray, window, IPC handlers
│   └── preload.ts      ← contextBridge API exposed to renderer
├── src/                ← React renderer (UI)
│   ├── main.tsx        ← React entry point
│   ├── App.tsx         ← App shell + routing (setup/unlock/vault)
│   ├── types/          ← TypeScript global declarations
│   ├── views/          ← Full-page views
│   │   ├── SetupView.tsx         ← First-run vault creation
│   │   ├── UnlockView.tsx        ← Master password unlock screen
│   │   ├── VaultMainView.tsx     ← Authenticated main vault shell
│   │   ├── ItemListView.tsx      ← Credential list
│   │   ├── ItemDetailPanel.tsx   ← Credential detail + edit
│   │   ├── GeneratorView.tsx     ← Password/passphrase generator
│   │   └── SettingsView.tsx      ← App settings
│   ├── components/     ← Reusable components
│   │   ├── TitleBar.tsx          ← Frameless custom title bar
│   │   ├── PasswordStrength.tsx  ← Strength indicator bar
│   │   └── TOTPCode.tsx          ← Live TOTP countdown display
│   └── styles/
│       └── global.css
├── public/
│   ├── index.html
│   └── icon.ico        ← App icon (place your icon here)
├── package.json
├── tsconfig.json           ← Renderer TS config
├── tsconfig.electron.json  ← Main process TS config
└── vite.config.ts          ← Vite config for renderer
```

## IPC Architecture

```
Renderer (React)
    │  window.kloak.*
    ▼
Preload (contextBridge)
    │  ipcRenderer.invoke()
    ▼
Main Process (Electron)
    │  ipcMain.handle()
    │  callDaemon() → TCP 127.0.0.1:53152
    ▼
Node.js Daemon (@kloak/daemon)
    │  VaultManager (@kloak/core)
    ▼
vault.kloak (on disk, %APPDATA%\Kloak\)
```

## Prerequisites

- Node.js 18+
- npm 9+
- On Windows: Build Tools for Visual Studio (for native modules)

## Development

```bash
# From monorepo root — build core and daemon first
npm run build --workspace=packages/core
npm run build --workspace=packages/daemon

# Install windows-app dependencies
cd packages/windows-app
npm install

# Start in dev mode (Vite + Electron hot-reload)
npm run dev
```

## Building a Distributable

```bash
# From packages/windows-app/
npm run dist
# Output: release/ directory with NSIS installer
```

## Windows-Specific Notes

| Feature | Implementation |
|---|---|
| Vault path | `%APPDATA%\Kloak\vault.kloak` |
| IPC socket | Named Pipe `\\.\pipe\kloak` |
| Native messaging | `%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\` + Registry |
| Biometrics | Windows Hello (stub — coming soon) |
| Auto-start | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` via Electron `setLoginItemSettings` |
| Tray | System notification area via Electron `Tray` API |

## Vault Compatibility

The vault file format (`vault.kloak`) is **identical** across macOS and Windows. You can copy `~/.kloak/vault.kloak` from macOS to `%APPDATA%\Kloak\vault.kloak` on Windows and open it with the same master password.

## Browser Extension Integration

The daemon registers the native messaging host manifests for Chrome, Edge, Brave, and Firefox automatically on first run. The browser extension works identically on Windows — no changes needed.

```bash
# Register native messaging hosts (run once after install)
node dist/daemon/dist/index.js --install-native-host
```
