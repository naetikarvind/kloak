import React from 'react';
import { ShieldCheck, EyeOff, Lock, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

export const PrivacySummarySection: React.FC = () => {
  const commitments = [
    {
      title: 'Zero Remote Data Transmission',
      desc: 'Neither passwords, usernames, URLs, metadata, nor analytics are ever transmitted to any remote server.',
    },
    {
      title: 'Zero Third-Party Advertising & Tracking',
      desc: 'Kloak contains zero ad SDKs, analytics beacons, or telemetry libraries. We will never sell or monetize user data.',
    },
    {
      title: '100% Local Encrypted Storage',
      desc: 'All credentials reside strictly on your local disk in ~/.kloak/vault.kloak encrypted with authenticated AES-256-GCM.',
    },
    {
      title: 'Manifest V3 Compliance',
      desc: 'The Chrome Extension operates without remotely hosted code, adhering strictly to Google Chrome Web Store Developer Policies.',
    },
  ];

  return (
    <section id="privacy" style={{ padding: '72px 0', position: 'relative' }}>
      <div className="container">
        <div
          className="glass-panel"
          style={{
            padding: '48px',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(15, 22, 38, 0.8) 100%)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '24px', marginBottom: '32px' }}>
            <div>
              <div className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.25)', marginBottom: '12px' }}>
                <ShieldCheck size={14} color="#10b981" />
                <span>Chrome Web Store User Data Privacy Compliant</span>
              </div>
              <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.8px' }}>
                Privacy Policy &amp; Security Guarantee
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '6px' }}>
                Official disclosure of user data handling in compliance with Chrome Web Store and Apple App Store policies.
              </p>
            </div>

            <a
              href="privacy.html"
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                color: '#34d399',
              }}
            >
              <FileText size={16} />
              <span>Read Full Legal Privacy Policy</span>
              <ArrowRight size={14} />
            </a>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
            }}
          >
            {commitments.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                  <CheckCircle2 size={16} />
                  <span>{c.title}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
