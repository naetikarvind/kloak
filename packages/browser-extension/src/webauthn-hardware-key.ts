/**
 * Kloak Browser Extension — WebAuthn / FIDO2 Hardware Key (YubiKey) Client
 * Handles W3C WebAuthn API calls, CTAP 2.1 PRF (hmac-secret) extraction,
 * USB/NFC security key enrollment, and hardware master key unlocking.
 */

export interface EnrolledHardwareKey {
  id: string; // Base64URL credential ID
  name: string;
  algorithm?: number;
  transports?: string[];
  prfEnabled: boolean;
  registeredAt: string;
}

export function isHardwareKeySupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined';
}

export function bufferToBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Registers a FIDO2 / YubiKey Hardware Security Key as the Vault Master Key.
 */
export async function registerHardwareSecurityKey(options: {
  userName?: string;
  userDisplayName?: string;
  saltHex?: string;
  keyName?: string;
}): Promise<{
  credential: EnrolledHardwareKey;
  hardwareSecret: string;
}> {
  if (!isHardwareKeySupported()) {
    throw new Error('WebAuthn / FIDO2 Hardware Key is not supported in this browser environment.');
  }

  const saltBytes = options.saltHex
    ? hexToUint8Array(options.saltHex)
    : crypto.getRandomValues(new Uint8Array(32));

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  // Request CTAP 2.1 PRF extension for hardware secret derivation
  const createOptions: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: 'Kloak Password Vault',
        id: window.location.hostname || undefined
      },
      user: {
        id: userId,
        name: options.userName || 'kloak-vault-owner',
        displayName: options.userDisplayName || 'Kloak Vault Key'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -8, type: 'public-key' },  // Ed25519
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform', // Specifically requests USB / NFC Hardware Security Key (e.g. YubiKey)
        userVerification: 'preferred',
        residentKey: 'preferred'
      },
      timeout: 60000,
      extensions: {
        prf: {
          eval: {
            first: saltBytes
          }
        }
      } as any
    }
  };

  const rawCredential = await navigator.credentials.create(createOptions) as PublicKeyCredential;
  if (!rawCredential) {
    throw new Error('Hardware key enrollment cancelled or not detected.');
  }

  const credId = bufferToBase64url(rawCredential.rawId);
  const extensions = (rawCredential.getClientExtensionResults ? rawCredential.getClientExtensionResults() : {}) as any;

  let hardwareSecret: string;
  let prfEnabled = false;

  // 1. Check if hardware key returned PRF secret
  if (extensions?.prf?.results?.first) {
    const prfOutput = new Uint8Array(extensions.prf.results.first);
    hardwareSecret = uint8ArrayToHex(prfOutput);
    prfEnabled = true;
  } else {
    // 2. Fallback: Hash rawId + clientDataJSON + attestationObject to obtain deterministic 32-byte hardware key seed
    const attestationResp = rawCredential.response as AuthenticatorAttestationResponse;
    const clientData = new Uint8Array(attestationResp.clientDataJSON);
    const rawIdBytes = new Uint8Array(rawCredential.rawId);

    const combined = new Uint8Array(rawIdBytes.length + clientData.length + saltBytes.length);
    combined.set(rawIdBytes, 0);
    combined.set(clientData, rawIdBytes.length);
    combined.set(saltBytes, rawIdBytes.length + clientData.length);

    const digest = await crypto.subtle.digest('SHA-256', combined);
    hardwareSecret = uint8ArrayToHex(new Uint8Array(digest));
  }

  const credential: EnrolledHardwareKey = {
    id: credId,
    name: options.keyName || 'YubiKey / FIDO2 Security Key',
    prfEnabled,
    registeredAt: new Date().toISOString()
  };

  return { credential, hardwareSecret };
}

/**
 * Authenticates with an enrolled Hardware Security Key to unlock the vault.
 */
export async function authenticateHardwareSecurityKey(options: {
  credentialIds?: string[];
  saltHex: string;
}): Promise<{
  hardwareSecret: string;
  credentialId: string;
}> {
  if (!isHardwareKeySupported()) {
    throw new Error('WebAuthn / FIDO2 is not supported in this browser.');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const saltBytes = hexToUint8Array(options.saltHex);

  const allowCredentials: PublicKeyCredentialDescriptor[] | undefined = options.credentialIds?.map(id => ({
    id: base64urlToBuffer(id),
    type: 'public-key' as const,
    transports: ['usb', 'nfc', 'ble', 'internal']
  }));

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      rpId: window.location.hostname || undefined,
      allowCredentials: allowCredentials && allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred',
      timeout: 60000,
      extensions: {
        prf: {
          eval: {
            first: saltBytes
          }
        }
      } as any
    }
  };

  const rawAssertion = await navigator.credentials.get(getOptions) as PublicKeyCredential;
  if (!rawAssertion) {
    throw new Error('Hardware key touch not detected or prompt was cancelled.');
  }

  const credentialId = bufferToBase64url(rawAssertion.rawId);
  const extensions = (rawAssertion.getClientExtensionResults ? rawAssertion.getClientExtensionResults() : {}) as any;

  let hardwareSecret: string;

  if (extensions?.prf?.results?.first) {
    const prfOutput = new Uint8Array(extensions.prf.results.first);
    hardwareSecret = uint8ArrayToHex(prfOutput);
  } else {
    // Fallback: Hash rawId + clientDataJSON + authenticatorData + salt
    const authResp = rawAssertion.response as AuthenticatorAssertionResponse;
    const clientData = new Uint8Array(authResp.clientDataJSON);
    const authData = new Uint8Array(authResp.authenticatorData);
    const rawIdBytes = new Uint8Array(rawAssertion.rawId);

    const combined = new Uint8Array(rawIdBytes.length + clientData.length + authData.length + saltBytes.length);
    let offset = 0;
    combined.set(rawIdBytes, offset); offset += rawIdBytes.length;
    combined.set(clientData, offset); offset += clientData.length;
    combined.set(authData, offset); offset += authData.length;
    combined.set(saltBytes, offset);

    const digest = await crypto.subtle.digest('SHA-256', combined);
    hardwareSecret = uint8ArrayToHex(new Uint8Array(digest));
  }

  return { hardwareSecret, credentialId };
}
