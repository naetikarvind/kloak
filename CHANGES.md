# Kloak — Vault Login / Unlock from Browser Extension

**Date:** 2 October 2026  
**Branch:** `dev`  
**Author:** Antigravity (AI Pair Programming)

---

## Overview

This change adds the ability to **unlock / login to the Kloak vault directly from the Chrome browser extension** — both the popup and the side panel — without requiring the user to switch to the macOS or Windows desktop application.

Prior to this work, the popup displayed a static placeholder when the vault was locked. Users had to open the native macOS app to enter their master password, then return to the browser. Now the unlock flow is fully self-contained within the extension.

---

## Feature: Vault Unlock & Lock from the Extension

### User Flow

1. User clicks the Kloak extension icon (popup) or opens the side panel.
2. If the vault is locked, a polished **Unlock Vault** card is displayed immediately:
   - Kloak shield icon badge
   - Master password input (auto-focused)
   - Show / hide password toggle
   - Inline error message on invalid credentials
   - "Unlock Vault" submit button with spinner feedback (supports `Enter` key)
3. On success, credentials load instantly and smart domain suggestions render.
4. A **Lock** button in the header allows re-locking the vault at any time from the extension.

### Dual IPC Connection Pipeline

To maximise reliability across all browser / OS configurations, the unlock flow uses two fallback paths in order:

| Priority | Method | Description |
|---|---|---|
| 1 | **Direct HTTP RPC** | `POST http://127.0.0.1:53152/rpc` — instant, no setup required, works in all Chromium-based browsers |
| 2 | **Native Messaging** | Chrome Native Messaging Host `app.kloak.native` via background service worker — used when the daemon's HTTP listener is unavailable |

This mirrors the same dual-path design used throughout the rest of the extension for `vault.getItems`, `vault.matchByUrl`, etc.

---

## Files Changed

### `packages/browser-extension/popup/popup.html`

- Added `#unlock-view` full-screen overlay modal:
  - Kloak shield badge with purple glow
  - `<form id="unlock-form">` with password `<input>`, show/hide eye toggle, error banner, and spinner submit button
- Added `#btn-lock` icon button in `.header-right` to lock the vault from the header

### `packages/browser-extension/src/popup.ts`

- Added `unlockVaultDirect(password: string)` — sends `vault.unlock` JSON-RPC via `fetch()` to `127.0.0.1:53152/rpc`
- Added `lockVaultDirect()` — sends `vault.lock` JSON-RPC via `fetch()`
- Added `showUnlockView(statusMessage?)` — displays unlock modal, clears prior input, auto-focuses password field
- Added `hideUnlockView()` — hides the unlock overlay
- Added `setupUnlockView()` — wires form submission with dual IPC fallback, loading states, error handling
- Added `setupLockBtn()` — wires the header lock button, clears cached items, re-shows unlock view
- Updated `loadLogins()` to detect locked state from direct HTTP status and show the unlock view automatically

### `packages/browser-extension/src/background.ts`

- Added `case 'UNLOCK_VAULT'` message handler:
  - Calls `sendNativeRequest('vault.unlock', { masterPassword })` via native messaging host
  - On success: sets `isVaultUnlocked = true`, fetches fresh `cachedItems`, refreshes active tab badge count
  - On failure: returns structured error for the popup to display
- Added `case 'LOCK_VAULT'` message handler:
  - Calls `sendNativeRequest('vault.lock')`
  - Wipes `cachedItems = []`, sets `isVaultUnlocked = false`, clears tab badge

### `packages/browser-extension/sidepanel/sidepanel.html`

Fully redesigned from a minimal 75-line stub into a complete Kloak-styled side panel:

- **Header** with Kloak shield SVG icon and a **Lock** button
- **Unlock view** (`#side-unlock-view`): identical unlock card to the popup — password input, show/hide toggle, error banner, spinner submit
- **Unlocked view** (`#side-unlocked-view`): search bar + scrollable credential card list
- **Credential cards** featuring:
  - Google Favicon Service site icons
  - Item title and username
  - **Fill** button — injects credentials into the active tab's focused fields
  - **Copy User** / **Copy Pass** quick-action buttons

### `packages/browser-extension/src/sidepanel.ts`

Fully rewritten (39 lines → 280+ lines):

- `checkDirectStatus()` — probes `vault.getItems` over direct HTTP to detect locked/unlocked state
- `unlockVaultDirect(password)` — direct HTTP `vault.unlock` call with structured error return
- `lockVaultDirect()` — direct HTTP `vault.lock` call
- `showLocked()` / `showUnlocked(items)` — view state management
- `renderItems(items)` — renders credential cards with favicon, Fill, Copy User, Copy Pass actions
- `loadVault()` — dual IPC load with direct HTTP → background fallback
- Unlock form submission with dual IPC fallback, spinner state, error display
- Search filtering on cached item list

### `packages/daemon/src/ipc/socket-server.ts`

- Added HTTP `POST /rpc` request parsing inside `handleClient()`:
  - Parses `Content-Length` and waits for complete HTTP body before dispatching
  - Returns full JSON-RPC response wrapped in HTTP 200 with CORS headers
  - Returns HTTP 400 on parse errors
- Added `OPTIONS` CORS preflight handler (required for `fetch()` from extension content scripts)
- `vault.unlock` dispatch case was already present in `handleMethod()`

### `packages/macos-app/Sources/KloakApp/Services/IPCServer.swift`

- Added `case "vault.unlock":` to the `IPCServer` JSON-RPC dispatcher:
  ```swift
  case "vault.unlock":
      guard let password = params["masterPassword"] as? String else {
          reply(["error": "masterPassword required"])
          return
      }
      Task { @MainActor in
          let success = await VaultStore.shared.unlock(password: password)
          if success {
              reply(["success": true, "status": ["isUnlocked": true]])
          } else {
              reply(["error": "Incorrect master password"])
          }
      }
  ```

### `packages/tests/src/ipc.test.ts`

Added a new 5-step test case **"handles vault.lock and vault.unlock with master password"**:

1. Locks the vault via `vault.lock` — asserts `success: true` and `isUnlocked: false`
2. Checks `vault.status` — asserts `isUnlocked: false`
3. Attempts `vault.unlock` with wrong password — asserts error response with message matching `/master password incorrect/i`
4. Unlocks with correct master password — asserts `success: true` and `isUnlocked: true`
5. Calls `vault.getItems` — asserts items array contains previously added item

---

## Test Results

```
▶ Kloak Crypto Engine                       7/7  ✔
▶ Kloak Password & Passphrase Generator     5/5  ✔
▶ Kloak IPC Daemon Protocol                 5/5  ✔  (was 4/4 before this change)
▶ Kloak Import & Export Parsers             8/8  ✔
▶ Kloak RFC 6238 TOTP Engine               6/6  ✔
▶ Kloak Vault Manager & Session Controller  4/4  ✔

ℹ tests     35   (was 34)
ℹ pass      35
ℹ fail       0
ℹ duration  ~700ms
```

macOS Swift app: `swift build` → `Build complete! (0.63 sec)` ✅

---

## Architecture Notes

- **Zero cloud dependency maintained** — all IPC is purely local: loopback TCP `127.0.0.1:53152` and native messaging host `app.kloak.native`. No credentials ever leave the device.
- **Chrome Manifest V3 compliant** — no inline scripts, all event listeners added via `addEventListener`, async/await throughout, proper message passing between contexts.
- The side panel and popup share the same dual IPC architecture but are fully independent entry points, each managing their own UI state.
