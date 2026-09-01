/**
 * Kloak Core — OAuth 2.0 & PKCE Engine
 * Secure token generation, PKCE challenge builder, and provider profiles.
 */
import { OAuthProviderType } from '../models/vault.js';
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
export declare const OAUTH_PROVIDERS: Record<OAuthProviderType, OAuthProviderConfig>;
/**
 * Generates an RFC 7636 compliant PKCE code_verifier and SHA-256 code_challenge.
 */
export declare function generatePkcePair(): PkceChallengePair;
/**
 * Constructs an OAuth 2.0 authorization URL.
 */
export declare function buildOAuthAuthorizationUrl(provider: OAuthProviderType, options: {
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    state?: string;
    codeChallenge?: string;
    customAuthUrl?: string;
}): string;
/**
 * Validates whether an OAuth token is expired or about to expire.
 */
export declare function isOAuthTokenExpired(expiresAtIso?: string, thresholdSeconds?: number): boolean;
//# sourceMappingURL=oauth.d.ts.map