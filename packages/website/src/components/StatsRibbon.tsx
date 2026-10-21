import React from 'react';
import { ServerOff, ShieldCheck, Zap, Code2 } from 'lucide-react';

export const StatsRibbon: React.FC = () => {
  const stats = [
    {
      icon: ServerOff,
      value: '0',
      unit: 'Cloud Servers',
      description: 'Zero servers holding your master keys or vault payloads. 100% stored on your disk.',
      accent: '#ef4444',
    },
    {
      icon: ShieldCheck,
      value: '256',
      unit: 'Bit AES-GCM',
      description: 'Authenticated symmetric cipher with Argon2id memory-hard KDF resistance.',
      accent: '#3b82f6',
    },
    {
      icon: Zap,
      value: '< 8ms',
      unit: 'Local IPC Latency',
      description: 'Zero HTTP requests. Direct Unix domain socket & Named Pipe communication.',
      accent: '#10b981',
    },
    {
      icon: Code2,
      value: '100%',
      unit: 'Open Source',
      description: 'Fully auditable codebase licensed under MIT. No hidden proprietary telemetry.',
      accent: '#8b5cf6',
    },
  ];

  return (
    <section style={{ padding: '36px 0 72px 0' }}>
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
          }}
        >
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="glass-panel"
                style={{
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: `${s.accent}15`,
                    border: `1px solid ${s.accent}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={22} color={s.accent} />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 800,
                      letterSpacing: '-1px',
                      color: '#ffffff',
                      lineHeight: 1.1,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: s.accent,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      marginTop: '2px',
                    }}
                  >
                    {s.unit}
                  </div>
                </div>

                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
