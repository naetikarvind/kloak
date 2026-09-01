/**
 * Kloak Core — OAuth 2.0 & PKCE Engine
 * Secure token generation, PKCE challenge builder, and provider profiles.
 */

import * as crypto from 'node:crypto';
import { OAuthDetails, OAuthProviderType } from '../models/vault.js';

export interface PkceChallengePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface OAuthProviderConfig {
  name: string;
  authUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
  supportsPkce: boolean;
}

export const OAUTH_PROVIDERS: Record<OAuthProviderType, OAuthProviderConfig> = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    defaultScopes: ['openid', 'email', 'profile'],
    supportsPkce: true
  },
  apple: {
    name: 'Apple',
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    defaultScopes: ['name', 'email'],
    supportsPkce: true
  },
  github: {
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    defaultScopes: ['read:user', 'user:email'],
    supportsPkce: false
  },
  microsoft: {
    name: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    defaultScopes: ['openid', 'email', 'profile', 'offline_access'],
    supportsPkce: true
  },
  gitlab: {
    name: 'GitLab',
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    defaultScopes: ['read_user', 'openid', 'profile', 'email'],
    supportsPkce: true
  },
  slack: {
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    defaultScopes: ['identity.basic', 'identity.email'],
    supportsPkce: false
  },
  custom: {
    name: 'Custom OAuth 2.0',
    authUrl: '',
    tokenUrl: '',
    defaultScopes: [],
    supportsPkce: true
  }
};

/**
 * Generates an RFC 7636 compliant PKCE code_verifier and SHA-256 code_challenge.
 */
export function generatePkcePair(): PkceChallengePair {
  // 32 cryptographically secure random bytes = 43 URL-safe base64 characters
  const rawBytes = crypto.randomBytes(32);
  const codeVerifier = rawBytes
    .toString('base64url')
    .replace(/[^a-zA-Z0-9-._~]/g, '');

  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hash.toString('base64url');

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

/**
 * Constructs an OAuth 2.0 authorization URL.
 */
export function buildOAuthAuthorizationUrl(
  provider: OAuthProviderType,
  options: {
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    state?: string;
    codeChallenge?: string;
    customAuthUrl?: string;
  }
): string {
  const config = OAUTH_PROVIDERS[provider];
  const baseUrl = options.customAuthUrl || config.authUrl;
  if (!baseUrl) throw new Error(`Missing authorization URL for provider: ${provider}`);

  const url = new URL(baseUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);

  const scopes = options.scopes || config.defaultScopes;
  if (scopes.length > 0) {
    url.searchParams.set('scope', scopes.join(' '));
  }

  if (options.state) {
    url.searchParams.set('state', options.state);
  }

  if (options.codeChallenge && config.supportsPkce) {
    url.searchParams.set('code_challenge', options.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

/**
 * Validates whether an OAuth token is expired or about to expire.
 */
export function isOAuthTokenExpired(expiresAtIso?: string, thresholdSeconds: number = 60): boolean {
  if (!expiresAtIso) return false;
  const expiryTime = new Date(expiresAtIso).getTime();
  const now = Date.now();
  return (expiryTime - now) <= (thresholdSeconds * 1000);
}
