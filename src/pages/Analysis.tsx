import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface BotSignal {
  id: number;
  time: string;
  message: string;
  type: 'buy' | 'sell' | 'alert' | 'breakout' | 'support_touch' | 'volume_anomaly';
  symbol: string;
  badge: string;
}

const SIGNAL_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  buy: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'MUA' },
  sell: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-400', label: 'BÁN' },
  alert: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'CẢNH BÁO' },
  breakout: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300', dot: 'bg-violet-400', label: 'BREAKOUT' },
  support_touch: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', text: 'text-cyan-300', dot: 'bg-cyan-400', label: 'HỖ TRỢ' },
  volume_anomaly: { bg: 'bg-orange-500/10', border: 'border-orange-500/25', text: 'text-orange-300', dot: 'bg-orange-400', label: 'VOLUME' },
};

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'XAU/USDT', 'SOL/USDT'];
const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

const INITIAL_SIGNALS: BotSignal[] = [
  { id: 1, time: '06:42', message: 'BTC breakout khỏi vùng kháng cự 68,000 — momentum tăng mạnh', type: 'breakout', symbol: 'BTC', badge: 'BREAKOUT' },
  { id: 2, time: '06:15', message: 'XAU/USD chạm vùng hỗ trợ 2,290 — theo dõi phản ứng giá', type: 'support_touch', symbol: 'GOLD', badge: 'HỖ TRỢ' },
  { id: 3, time: '05:58', message: 'Volume BTC tăng 340% so với trung bình — dấu hiệu bất thường', type: 'volume_anomaly', symbol: 'BTC', badge: 'VOLUME' },
  { id: 4, time: '05:30', message: 'BTC phá vỡ vùng tích lũy 67.5k–68k với volume lớn', type: 'breakout', symbol: 'BTC', badge: 'BREAKOUT' },
  { id: 5, time: '04:45', message: 'ETH tăng 5.2% — breakout trên EMA 200', type: 'buy', symbol: 'ETH', badge: 'MUA' },
  { id: 6, time: '04:12', message: 'Vàng rebound từ hỗ trợ 2,290 — nến đảo chiều tăng H4', type: 'support_touch', symbol: 'GOLD', badge: 'HỖ TRỢ' },
  { id: 7, time: '03:55', message: 'Volume XAU/USD tăng đột biến 280% — theo dõi breakout', type: 'volume_anomaly', symbol: 'GOLD', badge: 'VOLUME' },
  { id: 8, time: '03:20', message: 'Lực bán xuất hiện tại kháng cự 2,340 XAU/USD', type: 'sell', symbol: 'GOLD', badge: 'BÁN' },
];

// Generate mock candle data
function generateCandles(count: number): { time: number; open: number; high: number; low: number; close: number }[] {
  const candles = [];
  let price = 67500;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * 500;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    candles.push({ time: now - i * 3600000, open, high, low, close });
    price = close;
  }
  return candles;
}

function CandleChart({ width, height }: { width: number; height: number }) {
  const candles = generateCandles(40);
  const prices = candles.flatMap(c => [c.high, c.low]);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;
  const pad = { top: 20, bottom: 20, left: 60, right: 10 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const toY = (p: number) => pad.top + ((maxP - p) / range) * chartH;
  const candleW = Math.max(2, (chartW / candles.length) * 0.6);
  const spacing = chartW / candles.length;

  return (
    <svg width={width} height={height} className="w-full h-full">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + t * chartH;
        const price = maxP - t * range;
        return (
          <g key={t}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={pad.left - 4} y={y + 4} fill="rgba(136,146,176,0.8)" fontSize="9" textAnchor="end">{price.toFixed(0)}</text>
          </g>
        );
      })}
      {/* Support/Resistance zones */}
      <line x1={pad.left} y1={toY(maxP - range * 0.15)} x2={width - pad.right} y2={toY(maxP - range * 0.15)} stroke="rgba(239,68,68,0.4)" strokeWidth="1" strokeDasharray="4,3" />
      <line x1={pad.left} y1={toY(minP + range * 0.15)} x2={width - pad.right} y2={toY(minP + range * 0.15)} stroke="rgba(16,185,129,0.4)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={width - pad.right - 2} y={toY(maxP - range * 0.15) - 3} fill="#EF4444" fontSize="8" textAnchor="end">R1</text>
      <text x={width - pad.right - 2} y={toY(minP + range * 0.15) - 3} fill="#10B981" fontSize="8" textAnchor="end">S1</text>
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
  );
}

const Analysis: React.FC = () => {
  const [activeSymbol, setActiveSymbol] = useState('BTC/USDT');
  const [activeTimeframe, setActiveTimeframe] = useState('H1');
  const [signals] = useState<BotSignal[]>(INITIAL_SIGNALS);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const els = document.querySelectorAll('.page-reveal');
    els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), 200 + i * 150));
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (chartRef.current) {
        setChartSize({ width: chartRef.current.offsetWidth, height: 400 });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-10 overflow-hidden line-grid">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <div className="reveal-hidden page-reveal inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="font-mono-custom text-xs text-violet-400 tracking-wider">AI-POWERED ANALYSIS</span>
          </div>
          <h1 className="reveal-hidden page-reveal font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight mb-6">
            Phân Tích <span className="text-gradient-cyan italic">Thị Trường</span>
          </h1>
          <p className="reveal-hidden page-reveal text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
            Biểu đồ real-time với AI phân tích xu hướng, vùng hỗ trợ/kháng cự và tín hiệu giao dịch tự động.
          </p>
        </div>
      </section>

      {/* Chart Section */}
      <section className="py-8 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="lg:col-span-2">
              <div className="glass-card rounded-2xl overflow-hidden cyber-border">
                {/* Chart Toolbar */}
                <div className="px-5 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
                  <div className="flex gap-1">
                    {SYMBOLS.map(s => (
                      <button key={s} onClick={() => setActiveSymbol(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSymbol === s ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30' : 'text-muted-foreground hover:text-foreground'}`}>
                        {s}
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

                {/* Chart Area */}
                <div ref={chartRef} className="bg-[#0a0f1e] p-4" style={{ minHeight: 400 }}>
                  <CandleChart width={chartSize.width} height={chartSize.height} />
                </div>

                {/* AI Analysis Panel */}
                <div className="px-5 py-4 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider">🤖 AI Phân Tích — {activeSymbol} {activeTimeframe}</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground/60 text-xs mb-1 font-mono-custom">XU HƯỚNG</div>
                      <div className="text-emerald-400 font-semibold">📈 Tăng (Bullish)</div>
                      <p className="text-muted-foreground text-xs mt-1">Giá đang giao dịch trên EMA 200, momentum tích cực</p>
                    </div>
                    <div>
                      <div className="text-muted-foreground/60 text-xs mb-1 font-mono-custom">VÙNG QUAN TRỌNG</div>
                      <div className="text-foreground font-semibold">S: $66,800 | R: $69,200</div>
                      <p className="text-muted-foreground text-xs mt-1">Vùng hỗ trợ mạnh tại $66.8K, kháng cự tiếp theo $69.2K</p>
                    </div>
                    <div>
                      <div className="text-muted-foreground/60 text-xs mb-1 font-mono-custom">HÀNH ĐỘNG</div>
                      <div className="text-cyan-400 font-semibold">🎯 Long tại pullback $67K</div>
                      <p className="text-muted-foreground text-xs mt-1">SL: $66.2K | TP1: $69K | TP2: $71K</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signal Feed */}
            <div className="glass-card rounded-2xl overflow-hidden cyber-border flex flex-col">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-bold text-foreground">BOT SIGNAL Live</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono-custom">{signals.length} tín hiệu</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[520px] divide-y divide-white/5">
                {signals.map((signal) => {
                  const style = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.alert;
                  return (
                    <div key={signal.id} className={`px-4 py-3 ${style.bg} border-l-2 ${style.border} hover:bg-white/5 transition-colors`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          <span className={`text-xs font-bold ${style.text} uppercase tracking-wider`}>{style.label}</span>
                          <span className="text-xs font-bold text-foreground/70 px-1.5 py-0.5 rounded bg-white/5">{signal.symbol}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono-custom">{signal.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{signal.message}</p>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-white/5">
                <a href="https://t.me/botsignal" target="_blank" rel="noopener noreferrer"
                  className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold text-center block">
                  🚀 Tham Gia BOT SIGNAL Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Analysis;
