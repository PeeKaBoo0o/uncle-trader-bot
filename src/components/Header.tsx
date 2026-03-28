import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppLogo from './AppLogo';

const navLinks = [
  { href: '/', label: 'Trang Chủ' },
  { href: '/services', label: 'Dịch Vụ' },
  { href: '/contact', label: 'Liên Hệ' },
];

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        scrolled ? 'nav-blur shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <AppLogo size={36} className="group-hover:scale-110 transition-transform duration-300" />
            <span className="font-display font-bold text-xl tracking-tight text-foreground group-hover:text-cyan-brand transition-colors duration-300">
              UNCLETRADER
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium tracking-wide transition-all duration-300 relative group ${
                  location.pathname === link.href ? 'text-cyan-brand' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-cyan-brand transition-all duration-300 ${
                    location.pathname === link.href ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/contact"
              className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Tư Vấn Ngay
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen ? (
                <>
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </>
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </div>

        <div id="mobile-menu-panel" className={menuOpen ? 'open' : ''}>
          <div className="glass-card rounded-xl mb-4 p-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                  location.pathname === link.href
                    ? 'text-cyan-brand bg-cyan-brand/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/contact"
              onClick={() => setMenuOpen(false)}
              className="btn-primary mt-2 px-4 py-3 rounded-lg text-sm font-semibold text-center"
            >
              Tư Vấn Ngay
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
