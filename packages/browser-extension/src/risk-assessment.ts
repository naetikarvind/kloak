/**
 * Kloak Browser Extension — Credential Risk Assessment & Circular Circumference Gauge
 */

export interface CredentialRisk {
  score: number; // 0 - 100
  riskLevel: 'low' | 'medium' | 'high';
  label: string;
  color: string; // #10B981 (low), #F59E0B (medium), #EF4444 (high)
  entropyBits: number;
  isReused: boolean;
  reusedCount: number;
  has2FA: boolean;
  reasons: string[];
}

export function evaluatePasswordEntropy(password: string): number {
  if (!password) return 0;
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;
  if (poolSize === 0) poolSize = 1;
  return Math.round(password.length * Math.log2(poolSize));
}

export function evaluateCredentialRisk(item: any, allItems: any[] = []): CredentialRisk {
  const pwd = item.password || '';
  const reasons: string[] = [];

  if (!pwd) {
    return {
      score: 10,
      riskLevel: 'high',
      label: 'High Risk',
      color: '#EF4444',
      entropyBits: 0,
      isReused: false,
      reusedCount: 0,
      has2FA: !!item.totpSecret,
      reasons: ['No password is set for this login']
    };
  }

  const entropy = evaluatePasswordEntropy(pwd);
  let score = Math.round(Math.min(100, Math.max(10, entropy)));

  if (pwd.length < 8) {
    score = Math.min(score, 25);
    reasons.push('Password length is under 8 characters (Critical)');
  } else if (pwd.length < 12) {
    score = Math.min(score, 60);
    reasons.push('Password length is under 12 characters');
  }

  const weakPatterns = /^(password|123456|qwerty|admin|welcome|letmein|login|test)/i;
  if (weakPatterns.test(pwd)) {
    score = Math.min(score, 20);
    reasons.push('Contains common predictable dictionary words');
  }

  // Check reuse across vault
  let isReused = false;
  let reusedCount = 0;
  const currentDomain = (item.urls?.[0] || item.title || '').toLowerCase();
  for (const other of allItems) {
    if (other.id === item.id) continue;
    if (other.password && other.password === pwd) {
      const otherDomain = (other.urls?.[0] || other.title || '').toLowerCase();
      if (otherDomain !== currentDomain) {
        isReused = true;
        reusedCount++;
      }
    }
  }

  if (isReused) {
    score = Math.max(15, score - 35);
    reasons.push(`Password reused on ${reusedCount + 1} different online services`);
  }

  const has2FA = !!item.totpSecret;
  if (has2FA) {
    score = Math.min(100, score + 12);
  } else {
    reasons.push('Two-factor authentication (2FA) is not enabled');
  }

  score = Math.max(10, Math.min(100, score));

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let color = '#10B981';
  let label = 'Low Risk';

  if (score < 50) {
    riskLevel = 'high';
    color = '#EF4444';
    label = 'High Risk';
  } else if (score < 80) {
    riskLevel = 'medium';
    color = '#F59E0B';
    label = 'Medium Risk';
  }

  if (reasons.length === 0) {
    reasons.push('Strong unique password with high cryptographic entropy');
    if (has2FA) reasons.push('Hardware 2FA / TOTP protection enabled');
  }

  return {
    score,
    riskLevel,
    label,
    color,
    entropyBits: entropy,
    isReused,
    reusedCount,
    has2FA,
    reasons
  };
}

/**
 * Returns SVG markup for a circumference ring
 * @param score 0-100
 * @param color hex or rgb string
 * @param size diameter in px (e.g. 28)
 * @param stroke stroke width in px (e.g. 2.5)
 */
export function renderCircumferenceSvg(score: number, color: string, size = 28, stroke = 2.5): string {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * score) / 100;
  const center = size / 2;
  const fontSize = size >= 48 ? 13 : size >= 36 ? 10 : 8;
  const textY = size >= 48 ? center + 4.5 : size >= 36 ? center + 3.5 : center + 3;

  return `
    <svg class="kloak-circumference-gauge" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: block; flex-shrink: 0;">
      <circle
        class="kloak-gauge-bg"
        cx="${center}"
        cy="${center}"
        r="${radius}"
        stroke="rgba(255,255,255,0.12)"
        stroke-width="${stroke}"
        fill="none"
      />
      <circle
        class="kloak-gauge-bar"
        cx="${center}"
        cy="${center}"
        r="${radius}"
        stroke="${color}"
        stroke-width="${stroke}"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"
        stroke-linecap="round"
        fill="none"
        transform="rotate(-90 ${center} ${center})"
        style="transition: stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);"
      />
      <text
        x="${center}"
        y="${textY}"
        text-anchor="middle"
        font-size="${fontSize}px"
        font-weight="700"
        fill="${color}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >${score}%</text>
    </svg>
  `;
}
