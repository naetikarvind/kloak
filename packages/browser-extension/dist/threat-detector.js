/**
 * Kloak Threat Detection & Masked Alias Engine
 * Detects phishing, typosquatting, high-risk TLDs, and generates custom disposable forwarding aliases.
 */
const HIGH_PROFILE_DOMAINS = [
    'google.com', 'accounts.google.com', 'apple.com', 'icloud.com',
    'microsoft.com', 'live.com', 'outlook.com', 'login.microsoftonline.com',
    'amazon.com', 'paypal.com', 'github.com', 'netflix.com',
    'spotify.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'proton.me', 'protonmail.com', 'chase.com', 'bankofamerica.com',
    'wellsfargo.com', 'citi.com', 'coinbase.com', 'binance.com',
    'dropbox.com', 'slack.com', 'notion.so', 'figma.com',
    'openai.com', 'chatgpt.com', 'anthropic.com', 'discord.com'
];
const HIGH_RISK_TLDS = new Set([
    'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'buzz', 'xyz', 'click',
    'rest', 'cam', 'sbs', 'cfd', 'fit', 'icu', 'work', 'loan', 'men',
    'stream', 'trade', 'bid', 'racing', 'date', 'faith', 'review', 'zip', 'mov'
]);
const PHISHING_KEYWORDS = [
    'login-', 'signin-', 'secure-', 'verify-', 'account-update',
    'auth-', 'wallet-connect', 'web3-', 'security-alert', 'confirm-identity',
    'support-', 'billing-update', 'recover-password', 'session-expired'
];
function levenshtein(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const d = [];
    for (let i = 0; i <= m; i++)
        d[i] = [i];
    for (let j = 0; j <= n; j++)
        d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }
    return d[m][n];
}
export function generateMaskedAlias(domain) {
    const clean = domain.replace(/^www\./, '').split('.')[0] || 'site';
    const safeSlug = clean.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'site';
    const randomHex = Math.random().toString(36).substring(2, 8);
    return `protect.${safeSlug}.${randomHex}@shield.kloak.app`;
}
export function analyzeUrl(urlString) {
    let url;
    try {
        url = new URL(urlString);
    }
    catch {
        return {
            isSuspicious: false,
            riskScore: 0,
            targetDomain: '',
            reasons: [],
            suggestedAction: 'safe',
            suggestedAliasEmail: ''
        };
    }
    const host = url.hostname.toLowerCase();
    const cleanHost = host.replace(/^www\./, '');
    let riskScore = 0;
    const reasons = [];
    let targetedLegitDomain = cleanHost;
    // 1. IP Address check
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    if (isIP) {
        riskScore += 45;
        reasons.push('Raw IP address used instead of verified domain');
    }
    // 2. High-Risk TLD check
    const parts = host.split('.');
    const tld = parts[parts.length - 1];
    if (HIGH_RISK_TLDS.has(tld)) {
        riskScore += 35;
        reasons.push(`High-risk top-level domain (.${tld}) frequently used in phishing campaigns`);
    }
    // 3. Phishing Keywords
    const fullPath = (host + url.pathname).toLowerCase();
    for (const kw of PHISHING_KEYWORDS) {
        if (fullPath.includes(kw)) {
            riskScore += 25;
            reasons.push(`Suspicious credential harvesting keyword detected: '${kw}'`);
            break;
        }
    }
    // 4. Typosquatting / Impersonation Check
    for (const target of HIGH_PROFILE_DOMAINS) {
        const targetClean = target.replace(/^www\./, '');
        if (cleanHost === targetClean) {
            // Legit official site
            return {
                isSuspicious: false,
                riskScore: 0,
                targetDomain: targetClean,
                reasons: [],
                suggestedAction: 'safe',
                suggestedAliasEmail: ''
            };
        }
        // Subdomain / Prefix spoofing (e.g. google.com.phish.xyz or google-login.com)
        if (cleanHost.includes(targetClean) && cleanHost !== targetClean) {
            riskScore += 50;
            targetedLegitDomain = targetClean;
            reasons.push(`Potential brand impersonation of ${targetClean}`);
            break;
        }
        // Levenshtein edit distance
        const dist = levenshtein(cleanHost, targetClean);
        if (dist > 0 && dist <= 2 && Math.abs(cleanHost.length - targetClean.length) <= 2) {
            riskScore += 65;
            targetedLegitDomain = targetClean;
            reasons.push(`Typosquatting detected: deceptive lookalike of official domain '${targetClean}'`);
            break;
        }
    }
    // 5. Insecure HTTP login form
    if (url.protocol === 'http:' && (fullPath.includes('login') || fullPath.includes('auth') || fullPath.includes('signin'))) {
        riskScore += 40;
        reasons.push('Insecure unencrypted HTTP connection submitting credentials');
    }
    const isSuspicious = riskScore >= 40;
    const suggestedAction = isSuspicious ? 'mask_email' : (riskScore > 20 ? 'warn' : 'safe');
    const alias = isSuspicious ? generateMaskedAlias(cleanHost) : '';
    return {
        isSuspicious,
        riskScore: Math.min(100, riskScore),
        targetDomain: targetedLegitDomain,
        reasons,
        suggestedAction,
        suggestedAliasEmail: alias
    };
}
