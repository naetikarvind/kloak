"use strict";
/**
 * Kloak Core — OAuth 2.0 & PKCE Engine
 * Secure token generation, PKCE challenge builder, and provider profiles.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAUTH_PROVIDERS = void 0;
exports.generatePkcePair = generatePkcePair;
exports.buildOAuthAuthorizationUrl = buildOAuthAuthorizationUrl;
exports.isOAuthTokenExpired = isOAuthTokenExpired;
const crypto = __importStar(require("node:crypto"));
exports.OAUTH_PROVIDERS = {
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
function generatePkcePair() {
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
function buildOAuthAuthorizationUrl(provider, options) {
    const config = exports.OAUTH_PROVIDERS[provider];
    const baseUrl = options.customAuthUrl || config.authUrl;
    if (!baseUrl)
        throw new Error(`Missing authorization URL for provider: ${provider}`);
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
function isOAuthTokenExpired(expiresAtIso, thresholdSeconds = 60) {
    if (!expiresAtIso)
        return false;
    const expiryTime = new Date(expiresAtIso).getTime();
    const now = Date.now();
    return (expiryTime - now) <= (thresholdSeconds * 1000);
}
//# sourceMappingURL=oauth.js.map