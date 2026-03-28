import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

interface CryptoTicker {
  symbol: string;
  shortName: string;
  binanceSymbol: string;
  price: string;
  change: string;
  up: boolean;
  loading: boolean;
}

const initialTickers: CryptoTicker[] = [
  { symbol: 'BTC/USDT', shortName: 'BTC', binanceSymbol: 'BTCUSDT', price: '...', change: '...', up: true, loading: true },
  { symbol: 'ETH/USDT', shortName: 'ETH', binanceSymbol: 'ETHUSDT', price: '...', change: '...', up: true, loading: true },
  { symbol: 'SOL/USDT', shortName: 'SOL', binanceSymbol: 'SOLUSDT', price: '...', change: '...', up: true, loading: true },
  { symbol: 'BNB/USDT', shortName: 'BNB', binanceSymbol: 'BNBUSDT', price: '...', change: '...', up: true, loading: true },
];

const HeroSection: React.FC = () => {
  const [activeTickerIdx, setActiveTickerIdx] = useState(0);
  const [tickers, setTickers] = useState<CryptoTicker[]>(initialTickers);
  const heroRef = useRef<HTMLDivElement>(null);
  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const symbols = initialTickers.map((t) => t.binanceSymbol);
      const results = await Promise.allSettled(
        symbols.map((sym) =>
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { cache: 'no-store' }).then((r) => r.json())
        )
      );
      setTickers((prev) =>
        prev.map((ticker, idx) => {
          const result = results[idx];
          if (result.status === 'fulfilled' && result.value?.lastPrice) {
            const data = result.value;
            const price = parseFloat(data.lastPrice);
            const changePercent = parseFloat(data.priceChangePercent);
            const formattedPrice = price >= 1000
              ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
              : price >= 1
              ? price.toLocaleString('en-US', { maximumFractionDigits: 2 })
              : price.toFixed(4);
            return { ...ticker, price: formattedPrice, change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`, up: changePercent >= 0, loading: false };
          }
          return { ...ticker, loading: false };
        })
      );
    } catch {
      setTickers((prev) => prev.map((t) => ({ ...t, loading: false })));
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTickerIdx((prev) => (prev + 1) % initialTickers.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      if (blob1Ref.current) blob1Ref.current.style.transform = `translate(${x * 30}px, ${y * 20}px) scale(1.02)`;
      if (blob2Ref.current) blob2Ref.current.style.transform = `translate(${-x * 25}px, ${-y * 15}px) scale(0.98)`;
    };
    const hero = heroRef.current;
    hero?.addEventListener('mousemove', handleMouseMove);
    return () => hero?.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden hero-bg-layer line-grid">
      <div ref={blob1Ref} className="animate-blob-1 absolute top-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', filter: 'blur(80px)', transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      <div ref={blob2Ref} className="animate-blob-2 absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)', filter: 'blur(60px)', transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      <div className="animate-blob-3 absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', filter: 'blur(50px)' }} />

      {/* Chart SVG */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none opacity-20">
        <svg viewBox="0 0 1440 200" fill="none" className="w-full h-full">
          <path d="M0 180 L80 160 L160 170 L240 140 L320 150 L400 120 L480 130 L560 90 L640 100 L720 70 L800 80 L880 50 L960 60 L1040 30 L1120 40 L1200 20 L1280 30 L1360 10 L1440 0" stroke="url(#chartGrad)" strokeWidth="2" fill="none" />
          <path d="M0 180 L80 160 L160 170 L240 140 L320 150 L400 120 L480 130 L560 90 L640 100 L720 70 L800 80 L880 50 L960 60 L1040 30 L1120 40 L1200 20 L1280 30 L1360 10 L1440 0 L1440 200 L0 200 Z" fill="url(#chartFill)" />
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="1440" y2="0">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#00D4FF" />
            </linearGradient>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-8 animate-fade-up">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-mono-custom text-xs text-green-400 tracking-wider">LIVE SIGNALS ĐANG HOẠT ĐỘNG</span>
            </div>

            <h1 className="font-display font-bold leading-[0.95] tracking-tight mb-6 animate-hero-text">
              <span className="block text-5xl sm:text-6xl lg:text-7xl text-foreground">Giao Dịch</span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl text-gradient-cyan mt-2 italic">Có Chiến Lược.</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mb-10 animate-fade-up" style={{ animationDelay: '200ms' }}>
              Tín hiệu giao dịch crypto chính xác, giáo dục thực chiến và cộng đồng trader chuyên nghiệp. Tham gia ngay cùng hơn 2,400 trader tại Việt Nam.
            </p>

            <div className="flex flex-wrap gap-4 mb-12 animate-fade-up" style={{ animationDelay: '400ms' }}>
              <Link to="/services" className="btn-primary px-8 py-4 rounded-xl text-base font-semibold inline-flex items-center gap-2">
                Bắt Đầu Ngay
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link to="/services" className="btn-outline px-8 py-4 rounded-xl text-base font-semibold">
                Xem Dịch Vụ
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 animate-fade-up" style={{ animationDelay: '600ms' }}>
              {[
                { value: '78%', label: 'Win Rate' },
                { value: '2,400+', label: 'Thành Viên' },
                { value: '400+', label: 'Signals' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-display font-bold text-2xl text-gradient-cyan">{stat.value}</div>
                  <div className="font-mono-custom text-xs text-muted-foreground tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Ticker card */}
          <div className="hidden lg:block animate-fade-up" style={{ animationDelay: '500ms' }}>
            <div className="glass-card rounded-2xl p-6 cyber-border">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono-custom text-xs text-green-400">LIVE MARKET</span>
              </div>
              <div className="space-y-3">
                {tickers.map((ticker, idx) => (
                  <div
                    key={ticker.symbol}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all duration-500 ${
                      idx === activeTickerIdx ? 'glass-card border border-cyan-brand/20' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-cyber flex items-center justify-center text-xs font-bold text-navy">
                        {ticker.shortName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{ticker.symbol}</div>
                        <div className="text-xs text-muted-foreground">{ticker.shortName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono-custom text-foreground">
                        {ticker.loading ? '...' : `$${ticker.price}`}
                      </div>
                      <div className={`text-xs font-mono-custom px-2 py-0.5 rounded-full ${ticker.up ? 'ticker-up' : 'ticker-down'}`}>
                        {ticker.loading ? '...' : ticker.change}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
