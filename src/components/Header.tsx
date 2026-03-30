import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppLogo from './AppLogo';
import { Menu, X, Send, PhoneCall, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Trang Chủ' },
  { href: '/tin-tuc', label: 'Tin Tức' },
  { href: '/phan-tich', label: 'Phân Tích' },
  { href: '/indicators', label: 'Indicators' },
  { href: '/lich-kinh-te', label: 'Lịch Kinh Tế' },
  { href: '/tu-dien', label: 'Từ Điển' },
  { href: '/services', label: 'Dịch Vụ' },
  { href: '/contact', label: 'Liên Hệ' },
];

const useLivePrice = () => {
  const [btc, setBtc] = useState({ price: 0, change: 0 });
  const [gold, setGold] = useState({ price: 0, change: 0 });

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","XAUUSDT"]');
        const data = await res.json();
        const btcData = data.find((d: any) => d.symbol === 'BTCUSDT');
        const goldData = data.find((d: any) => d.symbol === 'XAUUSDT');
        if (btcData) setBtc({ price: parseFloat(btcData.lastPrice), change: parseFloat(btcData.priceChangePercent) });
        if (goldData) setGold({ price: parseFloat(goldData.lastPrice), change: parseFloat(goldData.priceChangePercent) });
      } catch { /* silent */ }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  return { btc, gold };
};

const PriceBadge = ({ symbol, icon, price, change }: { symbol: string; icon: string; price: number; change: number }) => {
  const isPositive = change >= 0;
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-foreground/[0.03] border border-foreground/[0.06] hover:bg-foreground/[0.06] transition-colors cursor-default">
      <span className="text-sm">{icon}</span>
      <span className="text-[11px] font-bold text-foreground/80 font-mono">{symbol}</span>
      <span className="text-[11px] font-mono font-bold text-foreground">
        {price > 0 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
      </span>
      <span className={`flex items-center gap-0.5 text-[10px] font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
};

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { btc, gold } = useLivePrice();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        scrolled ? 'nav-blur shadow-2xl shadow-background/50' : 'bg-background/80 backdrop-blur-md'
      }`}
    >

      {/* ── MAIN NAV BAR ── */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 lg:h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <AppLogo size={32} className="group-hover:scale-110 transition-transform duration-300" />
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-lg tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 leading-none">
                UNCLETRADER
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/40 tracking-[0.2em] uppercase leading-none mt-0.5">
                Smart Money Analysis
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`relative px-3 py-2 rounded-lg text-[13px] font-semibold tracking-wide transition-all duration-300 ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2">
            <a
              href="https://t.me/UNCLETRADER"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold text-foreground/80 bg-foreground/[0.04] border border-foreground/[0.08] hover:bg-foreground/[0.08] hover:border-foreground/[0.12] transition-all duration-300"
            >
              <Send className="w-3.5 h-3.5" />
              Telegram
            </a>
            <Link
              to="/contact"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold text-primary-foreground bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/20"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Tư Vấn Ngay
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-all"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── MOBILE MENU ── */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-400 ease-in-out ${
          menuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4">
          <div className="glass-card rounded-xl p-3 space-y-1 border border-foreground/[0.06]">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="pt-2 mt-2 border-t border-foreground/[0.06] flex flex-col gap-2">
              <a
                href="https://t.me/UNCLETRADER"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-foreground/80 bg-foreground/[0.04] border border-foreground/[0.08]"
              >
                <Send className="w-4 h-4" />
                Tham Gia Telegram
              </a>
              <Link
                to="/contact"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-primary-foreground bg-gradient-to-r from-primary to-secondary"
              >
                <PhoneCall className="w-4 h-4" />
                Tư Vấn Ngay
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
