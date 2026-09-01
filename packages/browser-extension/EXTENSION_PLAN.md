# Kloak Chrome Extension — Architecture & Roadmap Plan

> **Zero-Knowledge • Local-First Password Management**  
> *Proton Pass Aesthetic + iCloud Passwords Interaction Model*

---

## 1. Executive Summary & Design Vision

The **Kloak Browser Extension** is a Manifest V3 extension engineered to pair seamlessly with the native macOS companion app. It connects to an on-disk encrypted vault (`~/.kloak/vault.kloak` with PBKDF2-SHA256 600k iterations + AES-256-GCM) via a low-latency native messaging host proxy.

### Core Design Philosophy:
* **The Look of Proton Pass**: Authentic deep violet/charcoal palette (`#16151D`), elevated card surfaces (`#211F2D`), signature purple accent (`#6D4AFF`), distinct category colors, and customized SVGs.
* **The Feel of iCloud Passwords**: Frictionless in-page suggestion dropdowns on input focus, automatic form detection, one-click fill, and quick contextual actions.
* **Zero Cloud Dependency**: Purely local IPC communication via `127.0.0.1:53152` native messaging proxy.

---

## 2. Visual Evolution & User Reference History

Below are the visual reference snapshots provided during the development iterations:

````carousel
![Original Proton Pass Reference UI](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787675375824.png)
<!-- slide -->
![Button Removal Request (Turn #1408)](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787676143800.png)
<!-- slide -->
![Password Overflow Bug (Turn #1446)](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787677655889.png)
<!-- slide -->
![Sidebar Favicons & Dense Layout Request (Turn #1474)](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787978931938.png)
<!-- slide -->
![Horizontal Scrollbar Removal Request (Turn #1655)](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787983513534.png)
<!-- slide -->
![Smart Suggestion Context Banner Reference (Turns #1669 / #1920)](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1788079415246.png)
````

---

## 3. Technical Architecture & Communication Flow

```
┌────────────────────────────────────────────────────────┐
│                   Chrome Web Browser                   │
│                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │   In-Page Content    │    │    Toolbar Popup     │  │
│  │  Script (content.ts) │    │  (620×460 Split-UI)  │  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
│             │                           │              │
│             └───────────┬───────────────┘              │
│                         ▼                              │
│       ┌───────────────────────────────────┐            │
│       │ Service Worker (background.ts)    │            │
│       └─────────────────┬─────────────────┘            │
└─────────────────────────┼──────────────────────────────┘
                          │ Chrome Native Messaging
                          │ (JSON-RPC Protocol)
                          ▼
┌────────────────────────────────────────────────────────┐
│   Kloak Native Messaging Host Proxy (host.ts)         │
│   Deterministic Extension ID: gikdgameggdmlfnch...     │
└─────────────────────────┬──────────────────────────────┘
                          │ TCP Socket on 127.0.0.1:53152
                          ▼
┌────────────────────────────────────────────────────────┐
│   macOS Companion Daemon / App (KloakApp.swift)        │
│   Encrypted Vault Store (`~/.kloak/vault.kloak`)       │
│   LAContext Pure Touch ID Authentication               │
└────────────────────────────────────────────────────────┘
```

---

## 4. Requirements & Visual Implementation Traceability

### Reference 1: Original Proton Pass Target Interface
![Proton Pass Reference](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787675375824.png)
- **Goal**: Copy Proton Pass split-screen design, color accents, and card hierarchy.
- **Implemented**: Dark background (`#16151D`), sidebar list (`#191823`), search header with (+) action button, modular detail view cards.

### Reference 2: Button Cleanup & Sizing Reductions
![Button Cleanup](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787676143800.png)
- **Goal**: Eliminate clutter (hamburger button, diamond icon, and "Upgrade" pill) and make the popup more compact.
- **Implemented**: Streamlined header down to 48px height with just search and (+), adjusted dimensions to **620 × 460px**.

### Reference 3: Fixing Password Text Container Overflow
![Password Overflow](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787677655889.png)
- **Goal**: Prevent long passwords or security badges from pushing copy/reveal buttons outside the card boundary.
- **Implemented**: Mask text with `overflow: hidden; text-overflow: ellipsis; max-width: 230px`, flexible CSS grid row layout.

### Reference 4: Sidebar Favicons & Dense Item Cards
![Sidebar Favicons](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787978931938.png)
- **Goal**: Add high-res domain logos to items and increase density to display more password data.
- **Implemented**: Google Favicon API integration with fallback letter avatars; reduced row height to fit more items.

### Reference 5: Horizontal Scrollbar Removal
![Horizontal Scrollbar Fix](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1787983513534.png)
- **Goal**: Remove the accidental horizontal scrollbar at the bottom of the sidebar.
- **Implemented**: Added `overflow-x: hidden;` and `::-webkit-scrollbar { height: 0px; }`.

### Reference 6: Contextual Suggestions Container
![Smart Suggestion Context Banner](/Users/naetikarvind/.gemini/antigravity/brain/89eddcbc-1c05-432a-a086-5d8cc4a1f352/.user_uploaded/media_1788079415246.png)
- **Goal**: Add a top card container in the popup (`✨ SUGGESTED FOR [SITE / APP]`) showing direct 1-click `🔑 Copy Pass` / `🔑 Fill` action buttons for the current active webpage or app context.

---

## 5. Current State: Feature Matrix

### 🟢 Completed & Verified Features:
1. **Popup Window (620 × 460px)**:
   - Header with global search bar and Proton-purple `(+)` action button.
   - Sidebar (225px) with `All`, `Recent` filters, favicon avatars, and selection indicators.
   - Detail pane with modular cards for Username, Email, Password (with reveal), TOTP authenticator, multi-URLs, Notes, and Timestamps.
2. **Proton Pass Category Palette**:
   - 🔑 **Login**: `#6D4AFF` (Electric Violet)
   - 🛡️ **Alias**: `#00D2B4` (Proton Mint / Teal)
   - 💳 **Credit Card**: `#FF884D` (Amber Coral)
   - 📝 **Encrypted Note**: `#4D96FF` (Sky Blue)
   - 🪪 **Identity**: `#E066FF` (Rose Magenta)
3. **Credentials Creation Suite (`showAddForm`)**:
   - **Live Favicon Preview**: Updates automatically as title/domain is typed.
   - **One-Click Alias Generator**: Inlines `name.xxxx@kloak.link` privacy addresses.
   - **Interactive Password Generator**: 8–64 character slider, character toggles (`A-Z`, `a-z`, `0-9`, `!@#$%`), instant regenerate & apply.
   - **Real-Time Strength Meter**: 4-segment dynamic color bar (Weak, Fair, Good, Strong).
   - **Live 2FA (TOTP) Test Preview**: Displays computed 6-digit code and countdown ring in real time before saving.
   - **Multi-URL Rows**: Dynamic `+ Add another website` row management.
4. **In-Page Autofill Suggestion Popup (`content.ts`)**:
   - Auto-triggers on `focusin` for username & password fields (200ms debounce).
   - Anchored directly under the active field with `position: fixed` and `getBoundingClientRect()`.
   - Dismisses cleanly on `Escape`, outside click, or scroll.
   - One-click autofill for both username and password.
   - Inline shield badge trigger inside password inputs.

---

## 6. Next Phase Roadmap: Upcoming Features

### Phase 1: Smart Context Suggestions Banner ("Suggested for Active Site")
* **Goal**: Show a top card in the extension popup matching the current active tab's domain, identical to the macOS menu bar helper.
* **UI Specs**:
  - Header: `✨ SUGGESTED FOR [DOMAIN / APP]` in uppercase bold text.
  - Suggestion Item Card: Favicon + Domain Title + Username.
  - Action: Prominent `🔑 Fill` / `🔑 Copy Pass` blue pill button for 1-click credential copying/filling without searching.
* **Behavior**:
  - If on `github.com/login`, the top of the popup automatically surfaces GitHub credentials.
  - If no direct URL match, falls back to recent or alphabetical vault items.

### Phase 2: Automatic Form Detection & "Save to Kloak" Notification Banner
* **Goal**: Detect when a user submits a new or updated password on any webpage and offer to save/update it.
* **Implementation Details**:
  1. `content.ts` listens for `submit` events or enter-key form submissions.
  2. Extracts submitted username and password values.
  3. Checks if the item already exists in the vault:
     - **If new**: Displays floating toast/banner: *"Save this login to Kloak?"* with **[Save]** and **[Dismiss]**.
     - **If updated password**: Displays toast: *"Update password for [username] in Kloak?"* with **[Update]**.
  4. Dispatches `ADD_ITEM` or `UPDATE_ITEM` back to background worker.

### Phase 3: Passkey & WebAuthn Bridge
* **Goal**: Register and authenticate passkeys through the native macOS Touch ID / Secure Enclave layer via extension WebAuthn proxying.

### Phase 4: Biometric Quick-Unlock Integration
* **Goal**: Allow extension to trigger Touch ID prompt on the companion app when the vault is locked without switching windows.

---

## 7. File & Component Directory

```
packages/browser-extension/
├── manifest.json              # Manifest V3 configuration & permissions
├── popup/
│   └── popup.html             # Split-pane UI layout & CSS styling
├── src/
│   ├── popup.ts               # UI controller, forms, TOTP engine & search
│   ├── background.ts          # Native messaging bridge & message router
│   └── content.ts             # In-page focus suggestion popup & autofill
├── dist/                      # Compiled standalone JavaScript bundles
└── EXTENSION_PLAN.md          # Master architecture and roadmap plan
```

---

## 8. Verification & Testing Checklist

- [x] Sizing: 620×460px with no horizontal scrollbars.
- [x] Category icons & colors aligned with Proton Pass design system.
- [x] Interactive password generator with live strength meter.
- [x] Live TOTP preview badge in creation and detail modes.
- [x] In-page auto-focus suggestions working across login pages.
- [ ] Smart contextual suggestion banner for active tab at top of popup.
- [ ] In-page "Save/Update password" prompt on form submission.
