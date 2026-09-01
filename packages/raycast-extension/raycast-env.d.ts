/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Clear Clipboard After - Seconds before copied passwords are wiped from clipboard */
  "autoClearClipboardSeconds": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-vault` command */
  export type SearchVault = ExtensionPreferences & {}
  /** Preferences accessible in the `generate-password` command */
  export type GeneratePassword = ExtensionPreferences & {}
  /** Preferences accessible in the `add-entry` command */
  export type AddEntry = ExtensionPreferences & {}
  /** Preferences accessible in the `lock-vault` command */
  export type LockVault = ExtensionPreferences & {}
  /** Preferences accessible in the `import-vault` command */
  export type ImportVault = ExtensionPreferences & {}
  /** Preferences accessible in the `export-vault` command */
  export type ExportVault = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-vault` command */
  export type SearchVault = {}
  /** Arguments passed to the `generate-password` command */
  export type GeneratePassword = {}
  /** Arguments passed to the `add-entry` command */
  export type AddEntry = {}
  /** Arguments passed to the `lock-vault` command */
  export type LockVault = {}
  /** Arguments passed to the `import-vault` command */
  export type ImportVault = {}
  /** Arguments passed to the `export-vault` command */
  export type ExportVault = {}
}

