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
          ? 'rgba(6, 8, 15, 0.88)'
          : 'rgba(6, 8, 15, 0.45)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: scrolled
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid transparent',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '72px',
          gap: '16px',
        }}
      >
        {/* Brand */}
        <a
          href="#"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            color: 'var(--text-main)',
            flexShrink: 0,
          }}
        >
          <KloakLogo size={36} withGlow={true} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              Kloak
            </span>
            <span style={{ fontSize: '10px', color: 'var(--emerald)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Local-First Vault
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '24px',
          }}
          className="desktop-nav"
        >
          <a href="#features" className="nav-link">Features</a>
          <a href="#architecture" className="nav-link">Architecture</a>
          <a href="#generator" className="nav-link">Generator</a>
          <a href="#compare" className="nav-link">Compare</a>
          <a href="#downloads" className="nav-link">Downloads</a>
          <a href="privacy.html" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Privacy</span>
          </a>
        </nav>

        {/* Action Buttons - Identical Height & Same Baseline */}
        <div style={{ display: 'none', alignItems: 'center', gap: '8px', flexShrink: 0 }} className="desktop-actions">
          <a
            href="https://github.com/naetikarvind/kloak"
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-btn navbar-btn-ghost"
          >
            <GithubIcon size={15} />
            <span>GitHub</span>
          </a>

          <a
            href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-btn navbar-btn-chrome"
          >
            <ChromeIcon size={15} />
            <span>Chrome Store</span>
          </a>

          <a
            href="https://github.com/naetikarvind/kloak/releases/latest/download/Kloak-macOS.dmg"
            className="navbar-btn navbar-btn-primary"
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
            flexShrink: 0,
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
              className="navbar-btn navbar-btn-primary"
              style={{ width: '100%', height: '44px', fontSize: '14.5px' }}
            >
              <Download size={16} />
              <span>Download macOS (.dmg)</span>
            </a>
            <a
              href="https://chrome.google.com/webstore/detail/kloak-password-manager/hajgkgmajepndkhjhcgjenjnfojlphod"
              target="_blank"
              rel="noopener noreferrer"
              className="navbar-btn navbar-btn-chrome"
              style={{ width: '100%', height: '44px', fontSize: '14.5px' }}
            >
              <ChromeIcon size={16} />
              <span>Install Chrome Extension</span>
            </a>
          </div>
        </div>
      )}

      <style>{`
        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
          white-space: nowrap;
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

        /* Navbar Buttons - Perfectly aligned & identical height */
        .navbar-btn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          height: 38px !important;
          min-height: 38px !important;
          max-height: 38px !important;
          padding: 0 14px !important;
          border-radius: 9px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          text-decoration: none !important;
          white-space: nowrap !important;
          line-height: 1 !important;
          box-sizing: border-box !important;
          flex-shrink: 0 !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .navbar-btn-ghost {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid var(--border-subtle) !important;
          color: var(--text-main) !important;
        }
        .navbar-btn-ghost:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }
        .navbar-btn-chrome {
          background: rgba(16, 185, 129, 0.12) !important;
          border: 1px solid rgba(16, 185, 129, 0.28) !important;
          color: #34d399 !important;
        }
        .navbar-btn-chrome:hover {
          background: rgba(16, 185, 129, 0.22) !important;
          border-color: rgba(16, 185, 129, 0.45) !important;
        }
        .navbar-btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.18) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35) !important;
        }
        .navbar-btn-primary:hover {
          background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%) !important;
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5) !important;
        }

        @media (min-width: 1040px) {
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
        @media (min-width: 768px) and (max-width: 1039px) {
          .desktop-actions {
            display: flex !important;
          }
          .desktop-nav {
            display: none !important;
          }
          .mobile-toggle {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
};
