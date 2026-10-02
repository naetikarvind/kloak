# Kloak — UI/UX Overhaul: Container Symmetry, Dedicated Security Sections, Full Trash Lifecycle & Advanced Squircle Favicon System

**Date:** 2 October 2026  
**Branch:** `dev`  
**Author:** Antigravity (AI Pair Programming)

---

## Overview

This update delivers four major enhancements across the Kloak macOS application:

1. **Equal Container Sizing & UI/UX Consistency**: Resolved container card size asymmetries where cards expanded unequally depending on text contents. Applied strict `.frame(maxWidth: .infinity)` across all multi-column stat rows and card containers.
2. **Sidebar Reorganization**: Separated `Settings` and `Trash` out of `Tools` into a dedicated `Manage` section, and introduced a dedicated `Security` section.
3. **Comprehensive Trash & Restore Lifecycle**: Fixed the trash system so items are properly soft-deleted to Trash, viewable in the Trash section, restorable with one click, and purgeable permanently with confirmation.
4. **Separation of Duplicate Accounts and Password Health**: Split the combined duplicates view into two dedicated tools:
   - **Duplicate Accounts**: Pure focus on detecting exact vs. conflicting credential duplicates with one-click smart merging.
   - **Password Security & Health**: Complete password auditing for reused passwords, weak/short passwords, and accounts missing 2FA with instant secure password generation.
5. **Advanced Apple Squircle Favicon System**: Replaced the boxy/rectangular favicons with true Apple continuous squircles (`size * 0.2237`, `.continuous`), full-bleed clipping, high-DPI Google S2 Favicon priority, and dynamic monogram brand avatars with rich deterministic gradients for accounts without web logos.

---

## Detailed Changes

### 1. Equal Container Sizing & UI/UX Consistency
- **Stat Cards**: In both `DuplicateManagerView` and `PasswordHealthView`, stat cards in the header `HStack(spacing: 12)` now use `.frame(maxWidth: .infinity)`, ensuring strict 1/3 equal width regardless of label or count lengths.
- **Card Styling**: Consistent glass backgrounds (`Color.white.opacity(0.04)`), rounded corners (12px), and hairline borders (`Color.white.opacity(0.08)`).
- **Line Clamping**: Added `.lineLimit(1)` on card titles and subtitles to prevent multi-line vertical layout discrepancies.

### 2. Sidebar Navigation Restructure (`SidebarView.swift`)
- **`VAULT`**: `All Items`, `Favorites`
- **`CATEGORIES`**: `Login`, `Secure Note`, `Payment Card`, `Identity`, `Email Alias`, `Authenticator`
- **`FOLDERS`**: Custom user folders + `Add Folder...`
- **`SECURITY`**:
  - `Duplicate Accounts` (`.duplicates`): Shows badge count of duplicate account groups.
  - `Password Health` (`.passwordHealth`): Shows badge count of vulnerable logins (reused + weak passwords).
- **`TOOLS`**:
  - `Password Generator` (`.generator`)
  - `Import & Export` (`.importExport`)
- **`MANAGE`**:
  - `Settings` (`.settings`)
  - `Trash` (`.trash`): Shows badge count of soft-deleted items.

### 3. Full Trash Lifecycle System
- **`VaultStore.swift`**:
  - `deleteItem(id:permanent:)`: Soft-deletes to trash if not permanent, or permanently purges if requested or already trashed.
  - `moveToTrash(id:)`: Sets `item.trashed = true` and updates timestamp.
  - `restoreItem(id:)`: Sets `item.trashed = false` and updates timestamp.
  - `emptyTrash()`: Permanently removes all items where `trashed == true`.
  - `deletePermanently(id:)`: Immediately purges a specific item.
- **`IPCServer.swift`**:
  - Added support for `permanent: Bool` in `vault.deleteItem`.
  - Added `vault.restoreItem` and `vault.emptyTrash` RPC handlers.
- **`ItemListView.swift`**:
  - When viewing `Trash`: Hides `+` (New Item) button; adds an **Empty Trash** button in the header with a confirmation dialog.
  - Empty state displays specific trash messaging: "Trash is Empty — Deleted credentials will be kept here until permanently purged."
  - Right-click row context menu displays: **Restore Credential** and **Delete Permanently**.
- **`ItemDetailView.swift`**:
  - Displays a prominent amber warning banner when an item is in the Trash: *"This item is in the Trash. It will not be suggested for autofill until restored."* with an inline **Restore Item** button.
  - Replaces the generic delete button with **Restore Item** (emerald) and **Delete Permanently** (red, with confirmation alert).

### 4. Dedicated Password Health View (`PasswordHealthView.swift`)
- **Header Stat Cards**:
  - *Reused Passwords*: Number of password groups and affected logins (Red accent).
  - *Weak Passwords*: Short or low-complexity passwords (Amber accent).
  - *Missing 2FA*: Logins without attached TOTP authenticator (Purple accent).
- **Filter Controls**: Segmented picker for *All Issues*, *Reused*, *Weak*, and *No 2FA*, with real-time search.
- **Security Action Cards**:
  - Warning banner detailing credential stuffing risks.
  - Interactive credential cards with reveal password toggle.
  - **Generate New Password** button: creates a cryptographically strong 22-character password, saves to vault, and provides visual confirmation feedback.

### 5. Advanced Apple Squircle Favicon System (`FaviconView.swift` & `LogoService.swift`)
- **Geometry & Curvature**: Upgraded from simple corner radius to Apple continuous curvature squircle (`RoundedRectangle(cornerRadius: size * 0.2237, style: .continuous)`).
- **Aspect Ratio & Clipping**: Eliminated sharp 90-degree corners by applying continuous squircle clipping directly to the image and outer frame (`.frame(width: size, height: size)`).
- **List Row Sizing**: Increased list row favicon size to `32px` (matching Apple HIG table rows) and detail view to `48px`.
- **High-DPI Fast Resolution**: Prioritized Google S2 High-DPI Favicon proxy (`sz=256` and `sz=128`) for sub-50ms reliable icon fetching.
- **Dynamic Monogram Brand Avatars**: For logins without a web logo, computes clean 1–2 letter initials and generates a deterministic vibrant linear gradient background (from a 12-palette modern brand collection) based on domain hash.

---

## Files Modified & Created

| File | Status | Description |
|---|---|---|
| `packages/macos-app/Sources/KloakApp/UI/FaviconView.swift` | Modified | True Apple squircle, continuous curvature, dynamic monogram avatar fallbacks |
| `packages/macos-app/Sources/KloakApp/Services/LogoService.swift` | Modified | Prioritized Google S2 High-DPI Favicons (sz=256, 128) |
| `packages/macos-app/Sources/KloakApp/Services/VaultStore.swift` | Modified | Added `moveToTrash`, `restoreItem`, `emptyTrash`, `deletePermanently` |
| `packages/macos-app/Sources/KloakApp/Services/IPCServer.swift` | Modified | Added `vault.restoreItem`, `vault.emptyTrash`, permanent deletion flag |
| `packages/macos-app/Sources/KloakApp/Services/DuplicateDetectorService.swift` | Modified | Added `findWeakPasswords(in:)` and `findMissing2FA(in:)` |
| `packages/macos-app/Sources/KloakApp/Views/SidebarView.swift` | Modified | Separated `Security` and `Manage` sections, added `.passwordHealth` |
| `packages/macos-app/Sources/KloakApp/Views/DuplicateManagerView.swift` | Modified | Refactored purely for duplicate accounts with equal-width stat cards |
| `packages/macos-app/Sources/KloakApp/Views/PasswordHealthView.swift` | **Created** | Dedicated password auditing view with equal-width stat cards |
| `packages/macos-app/Sources/KloakApp/Views/ItemListView.swift` | Modified | 32px favicons, Empty Trash button & alert, restore/delete context menu |
| `packages/macos-app/Sources/KloakApp/Views/ItemDetailView.swift` | Modified | Trash warning banner, Restore Item, Delete Permanently, 48px favicon |
| `packages/macos-app/Sources/KloakApp/Views/VaultMainView.swift` | Modified | Routed `.passwordHealth`, connected full trash lifecycle actions |
| `packages/macos-app/Kloak.xcodeproj/project.pbxproj` | Modified | Registered `PasswordHealthView.swift` in Xcode target |

---

## Verification & Testing

- **Xcode Build (`./build-app.sh`)**:
  - `** BUILD SUCCEEDED **` ✅
  - AppIcon packaging and ad-hoc codesigning passed cleanly.
- **Monorepo Test Suite (`npm test`)**:
  - 35/35 tests passing across Crypto, Generators, IPC Daemon, Parsers, TOTP, and Vault Manager ✅
