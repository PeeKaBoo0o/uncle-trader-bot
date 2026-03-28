import React from 'react';
import { Link } from 'react-router-dom';
import AppLogo from './AppLogo';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-cyan-brand/10 py-10 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-2">
              <AppLogo size={28} />
              <span className="font-display font-bold text-base tracking-tight text-foreground">
                UNCLETRADER
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">
                Trang Chủ
              </Link>
              <Link to="/services" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">
                Dịch Vụ
              </Link>
              <Link to="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">
                Liên Hệ
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <a href="#" className="text-muted-foreground hover:text-cyan-brand transition-colors duration-200" aria-label="Telegram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-cyan-brand transition-colors duration-200" aria-label="YouTube">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-cyan-brand transition-colors duration-200" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <span className="text-muted-foreground text-sm hidden sm:block">© 2026 UNCLETRADER</span>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-cyan-brand/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs sm:hidden">© 2026 UNCLETRADER. All rights reserved.</span>
          <span className="text-muted-foreground text-xs hidden sm:block">All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/contact" className="text-muted-foreground text-xs hover:text-foreground transition-colors">
              Chính Sách Bảo Mật
            </Link>
            <Link to="/contact" className="text-muted-foreground text-xs hover:text-foreground transition-colors">
              Điều Khoản Sử Dụng
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
