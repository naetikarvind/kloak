interface Window {
  kloak: {
    ping: () => Promise<any>;
    status: () => Promise<VaultStatus>;
    create: (masterPassword: string) => Promise<any>;
    unlock: (masterPassword: string) => Promise<any>;
    lock: () => Promise<any>;
    getItems: (includeTrash?: boolean) => Promise<VaultItem[]>;
    getItem: (id: string) => Promise<{ item: VaultItem; liveTotp?: any }>;
    addItem: (item: Partial<VaultItem>) => Promise<VaultItem>;
    updateItem: (id: string, updates: Partial<VaultItem>) => Promise<VaultItem>;
    deleteItem: (id: string, permanent?: boolean) => Promise<any>;
    restoreItem: (id: string) => Promise<any>;
    search: (query: string) => Promise<VaultItem[]>;
    matchByUrl: (url: string) => Promise<VaultItem[]>;
    generateTotp: (secret: string, options?: any) => Promise<{ token: string; secondsRemaining: number }>;
    generatePassword: (options?: any) => Promise<{ password: string; strength: any }>;
    generatePassphrase: (options?: any) => Promise<{ passphrase: string; strength: any }>;
    importVault: (content: string, format?: string) => Promise<{ imported: number; warnings: string[] }>;
    exportVault: (options: any) => Promise<any>;
    getFolders: () => Promise<any[]>;
    addFolder: (name: string) => Promise<any>;
    getSettings: () => Promise<any>;
    updateSettings: (settings: any) => Promise<any>;
    changeMasterPassword: (oldPassword: string, newPassword: string) => Promise<any>;
    inspectUrl: (url: string) => Promise<any>;
    openFilePicker: () => Promise<string | null>;
    saveFilePicker: (content: string, defaultName: string) => Promise<boolean>;
    minimize: () => void;
    hide: () => void;
    openExternal: (url: string) => void;
    setAutoStart: (enabled: boolean) => Promise<void>;
    getAutoStart: () => Promise<boolean>;
    getTheme: () => Promise<string>;
    setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
    onDaemonReady: (cb: () => void) => void;
    onVaultLocked: (cb: () => void) => void;
    onVaultUnlocked: (cb: () => void) => void;
    removeListener: (channel: string, cb: (...args: any[]) => void) => void;
  };
}

interface VaultStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  itemCount: number;
  folderCount: number;
  vaultPath: string;
  autoLockMinutes: number;
}

type ItemType = 'login' | 'secure_note' | 'card' | 'identity' | 'oauth' | 'email_alias' | 'authenticator';

interface VaultItem {
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
  customFields?: CustomField[];
  folderId?: string;
  tags: string[];
  favorite: boolean;
  trashed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CardDetails {
  cardholderName?: string;
  number?: string;
  brand?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
}

interface IdentityDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  passportNumber?: string;
  ssn?: string;
}

interface CustomField {
  id: string;
  name: string;
  value: string;
  type: 'text' | 'hidden' | 'boolean' | 'url';
}
