/**
 * Kloak Core — Vault Data Models
 * Zero-knowledge, local-first password manager schema.
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
    expiresAt?: string;
    authUrl?: string;
    tokenUrl?: string;
    codeVerifier?: string;
    codeChallenge?: string;
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
    createdAt: string;
    updatedAt: string;
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
    salt: string;
    memoryCost?: number;
    parallelism?: number;
}
export interface EncryptedContainer {
    iv: string;
    ciphertext: string;
    tag: string;
}
export interface VaultHeader {
    kloakVersion: string;
    formatVersion: number;
    kdf: KdfParams;
    wrappedVaultKey: EncryptedContainer;
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
}
//# sourceMappingURL=vault.d.ts.map