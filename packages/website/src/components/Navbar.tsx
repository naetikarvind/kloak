import React, { useState, useEffect } from 'react';
import { KloakLogo } from './KloakLogo';
import { Download, ShieldCheck, Menu, X, ExternalLink } from 'lucide-react';
import { GithubIcon, ChromeIcon } from './Icons';

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        transition: 'all 0.25s ease',
        background: scrolled
          ? 'rgba(6, 8, 15, 0.85)'
          : 'rgba(6, 8, 15, 0.4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: scrolled
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid transparent',
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
        {/* Brand */}
        <a
          href="#"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            color: 'var(--text-main)',
          }}
        >
          <KloakLogo size={36} withGlow={true} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Kloak
            </span>
            <span style={{ fontSize: '10px', color: 'var(--emerald)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '-3px' }}>
              Local-First Vault
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '28px',
          }}
          className="desktop-nav"
        >
          <a href="#features" className="nav-link">Features</a>
          <a href="#architecture" className="nav-link">Architecture</a>
          <a href="#generator" className="nav-link">Generator</a>
          <a href="#compare" className="nav-link">Compare</a>
          <a href="#downloads" className="nav-link">Downloads</a>
          <a href="privacy.html" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Privacy</span>
          </a>
        </nav>

        {/* Action Buttons */}
        <div style={{ display: 'none', alignItems: 'center', gap: '12px' }} className="desktop-actions">
          <a
            href="https://github.com/naetikarvind/kloak"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-github"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <GithubIcon size={16} />
            <span>GitHub</span>
          </a>

          <a
            href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34d399',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <ChromeIcon size={15} />
            <span>Chrome Store</span>
          </a>

          <a
            href="https://github.com/naetikarvind/kloak/releases/latest/download/Kloak-macOS.dmg"
            className="btn-primary"
            style={{
              padding: '9px 18px',
              fontSize: '13.5px',
              borderRadius: '10px',
            }}
          >
            <Download size={15} />
            <span>Download .dmg</span>
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'flex',
            background: 'none',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            padding: '6px',
          }}
          className="mobile-toggle"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            background: 'rgba(12, 16, 29, 0.98)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <a
            href="#features"
            className="mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </a>
          <a
            href="#architecture"
            className="mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Architecture
          </a>
          <a
            href="#generator"
            className="mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Generator
          </a>
          <a
            href="#compare"
            className="mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Compare
          </a>
          <a
            href="#downloads"
            className="mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Downloads
          </a>
          <a
            href="privacy.html"
            className="mobile-link"
            style={{ color: 'var(--emerald)' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            Privacy Policy
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <a
              href="https://github.com/naetikarvind/kloak/releases/latest/download/Kloak-macOS.dmg"
              className="btn-primary"
              style={{ width: '100%' }}
            >
              <Download size={16} />
              Download macOS (.dmg)
            </a>
            <a
              href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-chrome"
              style={{ width: '100%' }}
            >
              <ChromeIcon size={16} />
              Install Chrome Extension
            </a>
          </div>
        </div>
      )}

      <style>{`
        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14.5px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: var(--text-main);
        }
        .mobile-link {
          color: var(--text-main);
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          padding: 8px 0;
        }
        @media (min-width: 900px) {
          .desktop-nav {
            display: flex !important;
          }
          .desktop-actions {
            display: flex !important;
          }
          .mobile-toggle {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};
