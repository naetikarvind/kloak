/**
 * Kloak Core — Vault Data Models
 * Local-first password manager schema.
 */

export type ItemType = 'login' | 'secure_note' | 'card' | 'identity' | 'oauth';

export interface CustomField {
  id: string;
  name: string;
  value: string;
  type: 'text' | 'hidden' | 'boolean' | 'url';
}

export interface CardDetails {
  cardholderName?: string;
  number?: string;
  brand?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  expMonth?: string;
  expYear?: string;
  cvv?: string;
}

export interface IdentityDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  passportNumber?: string;
  ssn?: string;
}

export type OAuthProviderType = 'google' | 'apple' | 'github' | 'microsoft' | 'gitlab' | 'slack' | 'custom';

export interface OAuthDetails {
  provider: OAuthProviderType;
  providerDisplayName?: string;
  accountEmail?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string; // ISO 8601
  authUrl?: string;
  tokenUrl?: string;
  codeVerifier?: string;
  codeChallenge?: string;
}

export interface PasswordHistoryEntry {
  password: string;
  changedAt: string; // ISO 8601
}

export interface VaultItem {
  id: string;
  type: ItemType;
  title: string;
  username?: string;
  password?: string;
  urls: string[];
  notes?: string;
  totpSecret?: string;
  card?: CardDetails;
  identity?: IdentityDetails;
  oauth?: OAuthDetails;
  customFields?: CustomField[];
  folderId?: string;
  tags: string[];
  favorite: boolean;
  trashed: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  passwordHistory?: PasswordHistoryEntry[];
  importSource?: string;
}

export interface VaultFolder {
  id: string;
  name: string;
  parentId?: string;
}

export interface VaultSettings {
  autoLockMinutes: number;
  clearClipboardSeconds: number;
  biometricsEnabled: boolean;
  defaultPasswordLength: number;
  defaultPasswordRules: {
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
    avoidAmbiguous: boolean;
  };
}

export interface VaultPayload {
  version: number;
  items: VaultItem[];
  folders: VaultFolder[];
  settings: VaultSettings;
  updatedAt: string;
}

export interface KdfParams {
  algorithm: 'PBKDF2-SHA256' | 'Argon2id';
  iterations: number;
  salt: string; // Hex or base64
  memoryCost?: number;
  parallelism?: number;
}

export interface EncryptedContainer {
  iv: string; // Hex (96-bit for GCM)
  ciphertext: string; // Hex or Base64
  tag: string; // Hex (128-bit GCM tag)
}

export interface HardwareKeyCredential {
  id: string; // Base64URL or Hex credential ID
  publicKey?: string; // Base64URL or Hex public key
  algorithm?: number; // COSE algorithm (e.g. -7 for ES256, -8 for Ed25519)
  transports?: string[]; // e.g. ['usb', 'nfc', 'ble', 'internal']
  prfEnabled?: boolean; // Whether CTAP 2.1 PRF (hmac-secret) is active
  name?: string; // Friendly name (e.g. "YubiKey 5C NFC", "Titan Key")
  registeredAt: string; // ISO 8601
}

export interface HardwareKeyConfig {
  enabled: boolean;
  mode: 'hardware_only' | 'password_plus_hardware';
  credentials: HardwareKeyCredential[];
  wrappedHardwareKey?: EncryptedContainer; // Wrapped Vault Key encrypted using hardware secret
  salt: string; // 32-byte hex salt for hardware PRF / challenge derivation
}

export interface VaultHeader {
  kloakVersion: string;
  formatVersion: number;
  kdf: KdfParams;
  wrappedVaultKey: EncryptedContainer;
  hardwareKey?: HardwareKeyConfig;
  createdAt: string;
}

export interface VaultFile {
  header: VaultHeader;
  encryptedPayload: EncryptedContainer;
}

export interface VaultStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  itemCount: number;
  folderCount: number;
  vaultPath: string;
  lastUnlockedAt?: string;
  autoLockMinutes: number;
  hardwareKeyEnabled?: boolean;
  hardwareKeyMode?: 'hardware_only' | 'password_plus_hardware';
  hardwareKeyCount?: number;
}
