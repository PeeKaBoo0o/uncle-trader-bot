import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TradingChart from '@/components/indicators/TradingChart';
import SubIndicators from '@/components/indicators/SubIndicators';
import IndicatorPanel, { IndicatorConfig } from '@/components/indicators/IndicatorPanel';
import SignalFeed from '@/components/indicators/SignalFeed';
import { useMarketData, useSignals } from '@/hooks/useMarketData';

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'XAU/USDT', 'SOL/USDT', 'BNB/USDT'];
const TIMEFRAMES = ['M15', 'H1', 'H4', 'D1'];

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { id: 'bb_squeeze', label: 'BB Squeeze', enabled: true, color: '#F59E0B', category: 'Volatility' },
  { id: 'breakout', label: 'Breakout', enabled: true, color: '#00D4FF', category: 'Trend' },
  { id: 'breakdown', label: 'Breakdown', enabled: true, color: '#EF4444', category: 'Trend' },
  { id: 'confluence', label: 'Confluence', enabled: true, color: '#7C3AED', category: 'S/R' },
  { id: 'momentum', label: 'Momentum', enabled: true, color: '#14B8A6', category: 'Momentum' },
  { id: 'vol_spike', label: 'Vol Spike', enabled: true, color: '#10B981', category: 'Volume' },
  { id: 'rsi_div', label: 'RSI Div', enabled: true, color: '#A855F7', category: 'Momentum' },
  { id: 'sup_bounce', label: 'Sup Bounce', enabled: true, color: '#F97316', category: 'S/R' },
  { id: 'ema_cross', label: 'EMA Cross', enabled: false, color: '#EC4899', category: 'Trend' },
  { id: 'macd_cross', label: 'MACD Cross', enabled: true, color: '#06B6D4', category: 'Trend' },
];

const Indicators: React.FC = () => {
  const [activePair, setActivePair] = useState('BTC/USDT');
  const [activeTimeframe, setActiveTimeframe] = useState('H4');
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [subTab, setSubTab] = useState<'rsi' | 'volume' | 'macd'>('rsi');
  const [botActive, setBotActive] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  const marketData = useMarketData(activePair, activeTimeframe);
  const { signals, loading: signalsLoading } = useSignals();

  const toggleIndicator = (id: string) => {
    setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, enabled: !ind.enabled } : ind));
  };

  const enabledIds = indicators.filter(i => i.enabled).map(i => i.id);

  // Live price
  const lastCandle = marketData.candles[marketData.candles.length - 1];
  const livePrice = lastCandle ? lastCandle.close : 0;
  const prevCandle = marketData.candles[marketData.candles.length - 2];
  const priceChange = prevCandle ? ((livePrice - prevCandle.close) / prevCandle.close * 100) : 0;

  // Log simulation
  useEffect(() => {
    if (!marketData.loading && marketData.candles.length > 0) {
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setLogs(prev => [
        `[${now}] Scanning ${activeTimeframe} candle for ${activePair}...`,
        ...prev.slice(0, 10),
      ]);
    }
  }, [marketData.loading, activePair, activeTimeframe]);

  return (
    <main className="min-h-screen bg-[#0b1120]">
      <Header />

      {/* TOP BAR */}
      <div className="pt-20 px-2 lg:px-4">
        <div className="bg-[#0d1526] border border-white/5 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          {/* Pairs */}
          <div className="flex gap-0.5">
            {PAIRS.map(p => (
              <button key={p} onClick={() => setActivePair(p)}
                className={`px-2.5 py-1.5 rounded font-mono font-bold transition-all ${
                  activePair === p
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-muted-foreground/60 hover:text-foreground'
                }`}>
                {p.split('/')[0]}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Timeframes */}
          <div className="flex gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setActiveTimeframe(tf)}
                className={`px-2 py-1.5 rounded font-mono transition-all ${
                  activeTimeframe === tf
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-muted-foreground/60 hover:text-foreground'
                }`}>
                {tf}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Live Price */}
          <div className="flex items-center gap-2">
            <span className="text-foreground font-mono font-bold text-sm">
              {marketData.loading ? '...' : `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
            {!marketData.loading && (
              <span className={`font-mono text-[10px] ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* Bot Toggle */}
          <button
            onClick={() => setBotActive(!botActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold transition-all ${
              botActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${botActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {botActive ? 'Bot: ON 🟢' : 'Bot: PAUSE ⏸'}
          </button>
        </div>
      </div>

      {/* 3-PANEL LAYOUT */}
      <div className="px-2 lg:px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_240px] gap-2 min-h-[70vh]">
          {/* LEFT - Indicators */}
          <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3">
            <IndicatorPanel indicators={indicators} onToggle={toggleIndicator} />
          </div>

          {/* CENTER - Chart */}
          <div className="bg-[#0d1526] border border-white/5 rounded-lg overflow-hidden">
            {marketData.loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-muted-foreground font-mono">Loading {activePair}...</span>
                </div>
              </div>
            ) : marketData.error ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <span className="text-red-400 text-sm">⚠️ {marketData.error}</span>
                  <p className="text-muted-foreground text-xs mt-2">Đang sử dụng dữ liệu demo</p>
                </div>
              </div>
            ) : (
              <TradingChart
                candles={marketData.candles}
                indicators={marketData.indicators}
                zones={marketData.zones}
                enabledIndicators={enabledIds}
              />
            )}

            {/* Sub-indicator tabs */}
            <div className="border-t border-white/5">
              <div className="flex gap-0.5 px-3 py-1.5 border-b border-white/5">
                {(['rsi', 'volume', 'macd'] as const).map(tab => (
                  <button key={tab} onClick={() => setSubTab(tab)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase font-bold transition-all ${
                      subTab === tab ? 'bg-white/5 text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>
              {!marketData.loading && marketData.candles.length > 0 && (
                <SubIndicators candles={marketData.candles} indicators={marketData.indicators} activeTab={subTab} />
              )}
            </div>
          </div>

          {/* RIGHT - Signal Feed */}
          <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">SIGNAL FEED</h3>
              <span className="text-[10px] font-mono text-muted-foreground/50">{signals.length}</span>
            </div>
            <SignalFeed signals={signals} loading={signalsLoading} />
          </div>
        </div>
      </div>

      {/* SYSTEM LOG */}
      <div className="px-2 lg:px-4 pb-4">
        <div className="bg-[#0d1526] border border-white/5 rounded-lg px-4 py-2 flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest shrink-0">SYSTEM LOG</span>
          <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/60">
            {logs.slice(0, 4).map((log, i) => (
              <span key={i} className={i === 0 ? 'text-cyan-400/60' : ''}>{log}</span>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
};

export default Indicators;
