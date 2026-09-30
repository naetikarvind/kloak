import React, { useMemo } from 'react';

interface Props {
  password: string;
}

function calcEntropy(password: string): number {
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
  if (poolSize === 0) return 0;
  return Math.floor(password.length * Math.log2(poolSize));
}

interface StrengthInfo {
  label: string;
  color: string;
  score: number; // 0-4
}

function getStrength(password: string, entropy: number): StrengthInfo {
  if (password.length < 6 || entropy < 25)
    return { label: 'Weak',       color: '#ef4444', score: 1 };
  if (entropy < 50)
    return { label: 'Moderate',   color: '#f59e0b', score: 2 };
  if (entropy < 70)
    return { label: 'Strong',     color: '#3b82f6', score: 3 };
  return { label: 'Very Strong', color: '#10b981', score: 4 };
}

export default function PasswordStrength({ password }: Props) {
  const entropy  = useMemo(() => calcEntropy(password), [password]);
  const strength = useMemo(() => getStrength(password, entropy), [password, entropy]);

  if (!password) return null;

  return (
    <div style={{ width: '100%' }}>
      {/* Bar */}
      <div style={{
        height: '4px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '6px',
      }}>
        <div style={{
          height: '100%',
          width: `${(strength.score / 4) * 100}%`,
          background: strength.color,
          borderRadius: '2px',
          transition: 'width 0.3s ease, background 0.3s ease',
        }} />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: strength.color, fontWeight: 600 }}>
          {strength.label}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {entropy} bits
        </span>
      </div>
    </div>
  );
}
