import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface IndicatorConfig {
  id: string;
  label: string;
  shortLabel: string;
  enabled: boolean;
  color: string;
  category: string;
}

interface Signal {
  id: string;
  time: string;
  pair: string;
  type: 'BUY' | 'SELL' | 'NEUTRAL';
  indicator: string;
  price: string;
  strength: number;
}

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'XAU/USDT', 'SOL/USDT', 'BNB/USDT'];
const TIMEFRAMES = ['M15', 'H1', 'H4', 'D1'];

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { id: 'bb_squeeze', label: 'BB Squeeze', shortLabel: 'BB SQ', enabled: false, color: '#F59E0B', category: 'Volatility' },
  { id: 'breakout', label: 'Breakout', shortLabel: 'BRKOUT', enabled: true, color: '#00D4FF', category: 'Trend' },
  { id: 'vol_spike', label: 'Volume Spike', shortLabel: 'VOL SP', enabled: true, color: '#10B981', category: 'Volume' },
  { id: 'rsi_div', label: 'RSI Divergence', shortLabel: 'RSI DIV', enabled: false, color: '#A855F7', category: 'Momentum' },
  { id: 'macd_cross', label: 'MACD Cross', shortLabel: 'MACD X', enabled: true, color: '#F97316', category: 'Trend' },
  { id: 'ema_cross', label: 'EMA Cross', shortLabel: 'EMA X', enabled: false, color: '#EC4899', category: 'Trend' },
  { id: 'sr_zone', label: 'S/R Zone Touch', shortLabel: 'S/R', enabled: true, color: '#EF4444', category: 'S/R' },
  { id: 'momentum', label: 'Momentum Shift', shortLabel: 'MOM', enabled: true, color: '#14B8A6', category: 'Momentum' },
];

function generateCandles(base: number, count: number) {
  const candles = [];
  let price = base;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * base * 0.012;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * base * 0.005;
    const low = Math.min(open, close) - Math.random() * base * 0.005;
    const volume = 1000 + Math.random() * 9000;
    candles.push({ time: now - i * 14400000, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

function generateSignals(indicators: IndicatorConfig[]): Signal[] {
  const enabled = indicators.filter(i => i.enabled);
  const signals: Signal[] = [];
  const pairs = ['BTC/USDT', 'ETH/USDT', 'XAU/USDT'];
  const types: ('BUY' | 'SELL' | 'NEUTRAL')[] = ['BUY', 'SELL', 'BUY', 'SELL', 'NEUTRAL'];
  const prices = ['67,840', '3,520', '2,310', '68,120', '3,480', '2,295', '67,950', '3,555'];
  for (let i = 0; i < 8; i++) {
    const ind = enabled[i % enabled.length];
    if (!ind) continue;
    const h = Math.floor(Math.random() * 12);
    const m = Math.floor(Math.random() * 60);
    signals.push({
      id: `sig-${i}`,
      time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
      pair: pairs[i % pairs.length],
      type: types[i % types.length],
      indicator: ind.label,
      price: prices[i % prices.length],
      strength: 60 + Math.floor(Math.random() * 35),
    });
  }
  return signals.sort((a, b) => b.time.localeCompare(a.time));
}

const TYPE_STYLES = {
  BUY: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', label: '🟢 MUA' },
  SELL: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', label: '🔴 BÁN' },
  NEUTRAL: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', label: '🟡 TRUNG LẬP' },
};

const Indicators: React.FC = () => {
  const [activePair, setActivePair] = useState('BTC/USDT');
  const [activeTimeframe, setActiveTimeframe] = useState('H4');
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [signals, setSignals] = useState<Signal[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 800, height: 350 });

  useEffect(() => {
    setSignals(generateSignals(indicators));
  }, [indicators]);

  useEffect(() => {
    const els = document.querySelectorAll('.page-reveal');
    els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), 200 + i * 150));
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (chartRef.current) setChartSize({ width: chartRef.current.offsetWidth, height: 350 });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const toggleIndicator = (id: string) => {
    setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, enabled: !ind.enabled } : ind));
  };

  const basePrices: Record<string, number> = { 'BTC/USDT': 67500, 'ETH/USDT': 3500, 'XAU/USDT': 2300, 'SOL/USDT': 170, 'BNB/USDT': 600 };
  const candles = generateCandles(basePrices[activePair] || 67500, 50);

  // Simple SVG chart
  const prices = candles.flatMap(c => [c.high, c.low]);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;
  const pad = { top: 20, bottom: 20, left: 60, right: 10 };
  const chartW = chartSize.width - pad.left - pad.right;
  const chartH = chartSize.height - pad.top - pad.bottom;
  const toY = (p: number) => pad.top + ((maxP - p) / range) * chartH;
  const candleW = Math.max(2, (chartW / candles.length) * 0.6);
  const spacing = chartW / candles.length;

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />

      <section className="relative pt-32 pb-10 overflow-hidden line-grid">
        <div className="absolute top-0 right-1/4 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <div className="reveal-hidden page-reveal inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono-custom text-xs text-cyan-400 tracking-wider">INDICATORS DASHBOARD</span>
          </div>
          <h1 className="reveal-hidden page-reveal font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight mb-6">
            <span className="text-gradient-cyan italic">Indicators</span> Trading
          </h1>
          <p className="reveal-hidden page-reveal text-muted-foreground text-lg max-w-2xl mx-auto">
            Tùy chỉnh bộ indicators, theo dõi tín hiệu giao dịch real-time và phân tích kỹ thuật đa khung thời gian.
          </p>
        </div>
      </section>

      <section className="py-8 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Indicator Panel */}
            <div className="glass-card rounded-2xl p-5 cyber-border">
              <h3 className="text-sm font-bold text-foreground mb-4">📊 Bộ Indicators</h3>
              <div className="space-y-2">
                {indicators.map(ind => (
                  <button key={ind.id} onClick={() => toggleIndicator(ind.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                      ind.enabled ? 'bg-white/5 border-white/15 text-foreground' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ind.enabled ? ind.color : '#4B5563' }} />
                      <span>{ind.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/40">{ind.category}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chart + Signals */}
            <div className="lg:col-span-3 space-y-6">
              {/* Chart */}
              <div className="glass-card rounded-2xl overflow-hidden cyber-border">
                <div className="px-5 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
                  <div className="flex gap-1">
                    {PAIRS.map(p => (
                      <button key={p} onClick={() => setActivePair(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activePair === p ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30' : 'text-muted-foreground hover:text-foreground'}`}>
                        {p.split('/')[0]}
                      </button>
                    ))}
                  </div>
                  <div className="h-4 w-px bg-white/10" />
                  <div className="flex gap-1">
                    {TIMEFRAMES.map(tf => (
                      <button key={tf} onClick={() => setActiveTimeframe(tf)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTimeframe === tf ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-muted-foreground hover:text-foreground'}`}>
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <div ref={chartRef} className="bg-[#0a0f1e] p-4" style={{ minHeight: 350 }}>
                  <svg width={chartSize.width} height={chartSize.height} className="w-full h-full">
                    {[0, 0.25, 0.5, 0.75, 1].map(t => {
                      const y = pad.top + t * chartH;
                      const price = maxP - t * range;
                      return (
                        <g key={t}>
                          <line x1={pad.left} y1={y} x2={chartSize.width - pad.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                          <text x={pad.left - 4} y={y + 4} fill="rgba(136,146,176,0.8)" fontSize="9" textAnchor="end">{price.toFixed(0)}</text>
                        </g>
                      );
                    })}
                    {candles.map((c, i) => {
                      const x = pad.left + i * spacing + spacing / 2;
                      const isUp = c.close >= c.open;
                      const color = isUp ? '#10B981' : '#EF4444';
                      const bodyTop = toY(Math.max(c.open, c.close));
                      const bodyBot = toY(Math.min(c.open, c.close));
                      const bodyH = Math.max(1, bodyBot - bodyTop);
                      return (
                        <g key={i}>
                          <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth="1" />
                          <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} opacity="0.9" />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Signals */}
              <div className="glass-card rounded-2xl overflow-hidden cyber-border">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">🎯 Tín Hiệu Giao Dịch</span>
                  <span className="text-xs text-muted-foreground font-mono-custom">{signals.length} signals</span>
                </div>
                <div className="divide-y divide-white/5">
                  {signals.map(signal => {
                    const style = TYPE_STYLES[signal.type];
                    return (
                      <div key={signal.id} className={`px-5 py-3 ${style.bg} border-l-2 ${style.border} hover:bg-white/5 transition-colors flex items-center justify-between`}>
                        <div className="flex items-center gap-4">
                          <span className="font-mono-custom text-xs text-muted-foreground w-12">{signal.time}</span>
                          <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
                          <span className="text-xs font-bold text-foreground/70 px-1.5 py-0.5 rounded bg-white/5">{signal.pair}</span>
                          <span className="text-xs text-muted-foreground">{signal.indicator}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono-custom text-sm text-foreground font-bold">${signal.price}</span>
                          <div className="w-16">
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${signal.strength > 80 ? 'bg-emerald-400' : signal.strength > 60 ? 'bg-cyan-400' : 'bg-yellow-400'}`} style={{ width: `${signal.strength}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground/60">{signal.strength}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Indicators;
