import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useIndicatorPermissions } from '@/hooks/useIndicatorPermissions';
import Footer from '@/components/Footer';
import TradingChart from '@/components/indicators/TradingChart';

import IndicatorPanel, { IndicatorConfig } from '@/components/indicators/IndicatorPanel';
import SignalFeed from '@/components/indicators/SignalFeed';
import { useMarketData, useSignals } from '@/hooks/useMarketData';
import { useSmcAnalysis } from '@/hooks/useSmcAnalysis';
import { useAlphaNet } from '@/hooks/useAlphaNet';
import AlphaNetDashboard from '@/components/indicators/AlphaNetDashboard';
import { useMatrixIndicator } from '@/hooks/useMatrixIndicator';
import { useEngineIndicator } from '@/hooks/useEngineIndicator';
import { useTpSlIndicator } from '@/hooks/useTpSlIndicator';
import { useBuySellSignal } from '@/hooks/useBuySellSignal';
import { useOscillatorMatrix } from '@/hooks/useOscillatorMatrix';
import { useProEma } from '@/hooks/useProEma';
import { useSupportResistance } from '@/hooks/useSupportResistance';
import { useWyckoff } from '@/hooks/useWyckoff';
import { computeDualTrendlines } from '@/lib/computeTrendline';
import { useAlphaLH, defaultAlphaLHConfig, type AlphaLHConfig } from '@/hooks/useAlphaLH';
import AlphaLHConfigPanel from '@/components/indicators/AlphaLHConfig';
import { useAlphaMP, defaultAlphaMPConfig, type AlphaMPConfig } from '@/hooks/useAlphaMP';
import AlphaMPConfigPanel from '@/components/indicators/AlphaMPConfig';

const PAIRS = [
  { symbol: 'BTC/USDT', label: 'BTC', color: '#F7931A' },
  { symbol: 'ETH/USDT', label: 'ETH', color: '#627EEA' },
  { symbol: 'XAU/USDT', label: 'XAU', color: '#FFD700' },
  { symbol: 'SOL/USDT', label: 'SOL', color: '#9945FF' },
  { symbol: 'XRP/USDT', label: 'XRP', color: '#23292F' },
  { symbol: 'BNB/USDT', label: 'BNB', color: '#F3BA2F' },
  { symbol: 'DOGE/USDT', label: 'DOGE', color: '#C2A633' },
  { symbol: 'WLD/USDT', label: 'WLD', color: '#1DB4D5' },
  { symbol: 'HYPE/USDT', label: 'HYPE', color: '#A855F7' },
  { symbol: 'PEPE/USDT', label: 'PEPE', color: '#4CAF50' },
];

const TIMEFRAMES = ['M15', 'H1', 'H4', 'D1'];

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  
  { id: 'alphanet', label: 'AlphaNet AI', enabled: false, color: '#7C3AED', category: 'AI' },
  { id: 'matrix', label: 'Matrix NWE', enabled: false, color: '#00BCD4', category: 'Envelope' },
  { id: 'engine', label: 'MS Engine', enabled: false, color: '#FF9800', category: 'Structure' },
  { id: 'tp_sl', label: 'TP/SL Zones', enabled: false, color: '#E91E63', category: 'Risk' },
  { id: 'buy_sell', label: 'Buy/Sell Signal', enabled: false, color: '#4CAF50', category: 'Signal' },
  { id: 'oscillator', label: 'Oscillator Matrix', enabled: false, color: '#FF5722', category: 'Oscillator' },
  { id: 'pro_ema', label: 'Pro EMA', enabled: false, color: '#FFA726', category: 'Trend' },
  { id: 'support_resistance', label: 'Pro S/R', enabled: false, color: '#00E676', category: 'S/R' },
  { id: 'wyckoff', label: 'Wyckoff', enabled: false, color: '#B388FF', category: 'Structure' },
  { id: 'alpha_lh', label: 'Alpha LH', enabled: false, color: '#F59E0B', category: 'Liquidity' },
  { id: 'alpha_mp', label: 'Alpha MP', enabled: false, color: '#06B6D4', category: 'Envelope' },
];

const Indicators: React.FC = () => {
  const { user } = useAuth();
  const { hasAccess, loading: permLoading } = useIndicatorPermissions();
  const [activePair, setActivePair] = useState('BTC/USDT');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('H4');
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  
  const [botActive, setBotActive] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  const marketData = useMarketData(activePair, activeTimeframe);
  const { fetchOlderCandles } = marketData;
  const { signals, loading: signalsLoading } = useSignals();
  const liqHunterEnabled = indicators.find(i => i.id === 'liq_hunter')?.enabled ?? false;
  const smcResult = useSmcAnalysis(marketData.candles, activePair, activeTimeframe, liqHunterEnabled && !marketData.loading);
  const alphaNetEnabled = indicators.find(i => i.id === 'alphanet')?.enabled ?? false;
  const alphaNet = useAlphaNet(marketData.candles, alphaNetEnabled && !marketData.loading && marketData.candles.length >= 30);
  const matrixEnabled = indicators.find(i => i.id === 'matrix')?.enabled ?? false;
  const matrixData = useMatrixIndicator(marketData.candles, matrixEnabled && !marketData.loading);
  const engineEnabled = indicators.find(i => i.id === 'engine')?.enabled ?? false;
  const engineData = useEngineIndicator(marketData.candles, engineEnabled && !marketData.loading);
  const tpSlEnabled = indicators.find(i => i.id === 'tp_sl')?.enabled ?? false;
  const tpSlData = useTpSlIndicator(marketData.candles, tpSlEnabled && !marketData.loading);
  const buySellEnabled = indicators.find(i => i.id === 'buy_sell')?.enabled ?? false;
  const buySellData = useBuySellSignal(marketData.candles, buySellEnabled && !marketData.loading);
  const oscillatorEnabled = indicators.find(i => i.id === 'oscillator')?.enabled ?? false;
  const oscillatorData = useOscillatorMatrix(marketData.candles, oscillatorEnabled && !marketData.loading);
  const proEmaEnabled = indicators.find(i => i.id === 'pro_ema')?.enabled ?? false;
  const proEmaData = useProEma(marketData.candles, proEmaEnabled && !marketData.loading);
  const srEnabled = indicators.find(i => i.id === 'support_resistance')?.enabled ?? false;
  const srData = useSupportResistance(marketData.candles, srEnabled && !marketData.loading);
  const wyckoffEnabled = indicators.find(i => i.id === 'wyckoff')?.enabled ?? false;
  const wyckoffData = useWyckoff(marketData.candles, wyckoffEnabled && !marketData.loading);
  const alphaLHEnabled = indicators.find(i => i.id === 'alpha_lh')?.enabled ?? false;
  const [alphaLHConfig, setAlphaLHConfig] = useState(defaultAlphaLHConfig);
  const alphaLHData = useAlphaLH(marketData.candles, alphaLHEnabled && !marketData.loading, alphaLHConfig);
  const alphaMPEnabled = indicators.find(i => i.id === 'alpha_mp')?.enabled ?? false;
  const [alphaMPConfig, setAlphaMPConfig] = useState(defaultAlphaMPConfig);
  const alphaMPData = useAlphaMP(marketData.candles, alphaMPEnabled && !marketData.loading, alphaMPConfig);

  const trendlines = useMemo(() => {
    if (!engineEnabled || marketData.loading || marketData.candles.length < 30) return { support: null, resistance: null };
    return computeDualTrendlines(marketData.candles);
  }, [marketData.candles, marketData.loading, engineEnabled]);

  const toggleIndicator = (id: string) => {
    setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, enabled: !ind.enabled } : ind));
  };

  const enabledIds = indicators.filter(i => i.enabled).map(i => i.id);
  const activePairInfo = PAIRS.find(p => p.symbol === activePair) || PAIRS[0];

  const lastCandle = marketData.candles[marketData.candles.length - 1];
  const livePrice = lastCandle ? lastCandle.close : 0;
  const prevCandle = marketData.candles[marketData.candles.length - 2];
  const priceChange = prevCandle ? ((livePrice - prevCandle.close) / prevCandle.close * 100) : 0;

  useEffect(() => {
    if (!marketData.loading && marketData.candles.length > 0) {
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setLogs(prev => [
        `[${now}] Đang quét nến ${activeTimeframe} cho ${activePair}...`,
        ...prev.slice(0, 10),
      ]);
    }
  }, [marketData.loading, activePair, activeTimeframe]);

  // Filter indicators by permission (if logged in, check permissions; if guest, show all)
  const accessibleIndicators = indicators.map(ind => ({
    ...ind,
    enabled: ind.enabled && (user ? hasAccess(ind.id) : true),
    locked: user ? !hasAccess(ind.id) : false,
  }));

  return (
    <main className="min-h-screen bg-[#0b0e11]">
      <Header />

      {/* ═══ BINANCE-STYLE TOP BAR ═══ */}
      <div className="pt-24 px-1.5 lg:px-3">
        <div className="bg-[#161a1e] border-b border-[#2b3139] px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Symbol + Price block */}
          <div className="flex items-center gap-3 pr-4 border-r border-[#2b3139]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${activePairInfo.color}20` }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activePairInfo.color }} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#eaecef] font-mono leading-tight">{activePair}</span>
                <span className="text-[9px] text-[#848e9c] font-mono">Perpetual</span>
              </div>
            </div>
            <div className="flex flex-col items-end ml-2">
              <span className={`text-lg font-bold font-mono leading-tight ${priceChange >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {marketData.loading ? '...' : `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
              {!marketData.loading && (
                <span className={`text-[11px] font-mono font-bold ${priceChange >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          {/* Market stats */}
          <div className="flex items-center gap-4 px-3 border-r border-[#2b3139]">
            <div className="flex flex-col">
              <span className="text-[9px] text-[#848e9c] font-mono">24h High</span>
              <span className="text-[11px] text-[#eaecef] font-mono font-medium">
                {lastCandle ? `$${lastCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-[#848e9c] font-mono">24h Low</span>
              <span className="text-[11px] text-[#eaecef] font-mono font-medium">
                {lastCandle ? `$${lastCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-[#848e9c] font-mono">24h Vol</span>
              <span className="text-[11px] text-[#eaecef] font-mono font-medium">
                {lastCandle ? `${(lastCandle.volume / 1e6).toFixed(2)}M` : '—'}
              </span>
            </div>
          </div>

          {/* Coin pair selector */}
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 flex-wrap">
              {PAIRS.map(p => (
                <button key={p.symbol} onClick={() => setActivePair(p.symbol)}
                  className={`px-2.5 py-1.5 rounded font-mono font-bold transition-all text-[11px] ${
                    activePair === p.symbol
                      ? 'text-[#fcd535] bg-[#fcd535]/10'
                      : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-[#2b3139]" />

          {/* Timeframe */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setActiveTimeframe(tf)}
                className={`px-2.5 py-1.5 rounded font-mono font-bold text-[11px] transition-all ${
                  activeTimeframe === tf
                    ? 'bg-[#fcd535]/10 text-[#fcd535]'
                    : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'
                }`}>
                {tf}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ═══ 3-PANEL LAYOUT ═══ */}
      <div className="px-1.5 lg:px-3 py-1">
        <div className={`grid grid-cols-1 ${sidebarOpen ? 'lg:grid-cols-[180px_1fr_300px]' : 'lg:grid-cols-[1fr_300px]'} gap-px min-h-[75vh] bg-[#2b3139] rounded overflow-hidden transition-all duration-300`}>

          {/* ── Collapsed sidebar handle ── */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed left-1 top-1/2 -translate-y-1/2 z-30 bg-[#1e2329] border border-[#2b3139] rounded-r-lg px-1 py-4 hover:bg-[#2b3139] transition-colors group"
              title="Mở chỉ báo"
            >
              <svg className="w-3.5 h-3.5 text-[#848e9c] group-hover:text-[#fcd535] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* ── LEFT: Indicator Checklist ── */}
          {sidebarOpen && (
          <div className="bg-[#161a1e] p-3 relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-[#848e9c] tracking-widest uppercase font-mono">CHỈ BÁO</h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-[#5e6673]">{enabledIds.length}/{indicators.length}</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-0.5 rounded hover:bg-[#2b3139] transition-colors group"
                  title="Thu gọn"
                >
                  <svg className="w-3.5 h-3.5 text-[#5e6673] group-hover:text-[#fcd535] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-[9px] text-[#5e6673] mb-3 font-mono">Bật/Tắt để hiển thị lên đồ thị</p>
            <IndicatorPanel indicators={indicators} onToggle={toggleIndicator} />
            
            {/* AlphaNet AI Dashboard */}
            {alphaNetEnabled && (
              <div className="mt-3">
                <AlphaNetDashboard data={alphaNet.data} loading={alphaNet.loading} error={alphaNet.error} />
              </div>
            )}

            {/* TP/SL Backtesting Dashboard */}
            {tpSlEnabled && tpSlData && (
              <div className="mt-3 border border-[#2b3139] rounded-lg overflow-hidden">
                <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  BACKTESTING
                </div>
                <div className="bg-[#161a1e] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Total Entries</span>
                    <span className="text-[#eaecef] font-bold">{tpSlData.stats.totalEntries}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">TP / SL Hit</span>
                    <span className="text-[#eaecef] font-bold">
                      <span className="text-emerald-400">{tpSlData.stats.tpCount}</span>
                      {' / '}
                      <span className="text-red-400">{tpSlData.stats.slCount}</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Winrate</span>
                    <span className={`font-bold ${tpSlData.stats.winrate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tpSlData.stats.winrate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Buy/Sell Signal Dashboard */}
            {buySellEnabled && buySellData && (
              <div className="mt-3 border border-[#2b3139] rounded-lg overflow-hidden">
                <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  BUY/SELL SIGNAL
                </div>
                <div className="bg-[#161a1e] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Trend</span>
                    <span className={`font-bold ${buySellData.currentTrend === 'BULLISH' ? 'text-emerald-400' : buySellData.currentTrend === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {buySellData.currentTrend}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Zone</span>
                    <span className={`font-bold ${
                      buySellData.currentZone === 'green' ? 'text-emerald-400' :
                      buySellData.currentZone === 'red' ? 'text-red-400' :
                      buySellData.currentZone === 'blue' ? 'text-blue-400' :
                      buySellData.currentZone === 'orange' ? 'text-orange-400' :
                      buySellData.currentZone === 'yellow' ? 'text-yellow-400' :
                      'text-cyan-400'
                    }`}>
                      {buySellData.currentZone.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Last Signal</span>
                    <span className={`font-bold ${buySellData.currentSignal === 'BUY' ? 'text-emerald-400' : buySellData.currentSignal === 'SELL' ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {buySellData.currentSignal || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Total Signals</span>
                    <span className="text-[#eaecef] font-bold">{buySellData.signals.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Oscillator Matrix Dashboard */}
            {oscillatorEnabled && oscillatorData && (
              <div className="mt-3 border border-[#2b3139] rounded-lg overflow-hidden">
                <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  OSCILLATOR MATRIX
                </div>
                <div className="bg-[#161a1e] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Hyper Wave</span>
                    <span className={`font-bold ${oscillatorData.lastSig > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {oscillatorData.lastSig.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Signal</span>
                    <span className={`font-bold ${oscillatorData.lastSgD > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {oscillatorData.lastSgD.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Money Flow</span>
                    <span className={`font-bold ${oscillatorData.lastMfi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {oscillatorData.lastMfi.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Confluence</span>
                    <span className={`font-bold ${
                      oscillatorData.confluence.bullish ? 'text-emerald-400' :
                      oscillatorData.confluence.bearish ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {oscillatorData.confluence.bullish ? 'BULLISH' :
                       oscillatorData.confluence.bearish ? 'BEARISH' : 'NEUTRAL'}
                      {' '}({oscillatorData.confluence.score > 0 ? '+' : ''}{oscillatorData.confluence.score})
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Reversals</span>
                    <span className="text-[#eaecef] font-bold">{oscillatorData.reversals.length}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Signals</span>
                    <span className="text-[#eaecef] font-bold">{oscillatorData.buySellSignals.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pro EMA Dashboard */}
            {proEmaEnabled && proEmaData && (
              <div className="mt-3 border border-[#2b3139] rounded-lg overflow-hidden">
                <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  PRO EMA
                </div>
                <div className="bg-[#161a1e] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-orange-400/60">EMA 20</span>
                    <span className="text-orange-400 font-bold">{proEmaData.lastEma20.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-yellow-400/60">EMA 50</span>
                    <span className="text-yellow-400 font-bold">{proEmaData.lastEma50.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-teal-400/60">EMA 100</span>
                    <span className="text-teal-400 font-bold">{proEmaData.lastEma100.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-purple-400/60">EMA 200</span>
                    <span className="text-purple-400 font-bold">{proEmaData.lastEma200.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Ribbon</span>
                    <span className={`font-bold ${proEmaData.ribbon === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {proEmaData.ribbon === 'bullish' ? '🟢 BULLISH' : '🔴 BEARISH'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Crosses</span>
                    <span className="text-[#eaecef] font-bold">{proEmaData.crosses.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pro Support/Resistance Dashboard */}
            {srEnabled && srData && (
              <div className="mt-3 border border-[#2b3139] rounded-lg overflow-hidden">
                <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  PRO S/R
                </div>
                <div className="bg-[#161a1e] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Stoch K</span>
                    <span className={`font-bold ${srData.lastK < 30 ? 'text-emerald-400' : srData.lastK > 70 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {srData.lastK.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Stoch D</span>
                    <span className={`font-bold ${srData.lastD < 30 ? 'text-emerald-400' : srData.lastD > 70 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {srData.lastD.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">S/R Zones</span>
                    <span className="text-[#eaecef] font-bold">{srData.channels.length}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Signals</span>
                    <span className="text-[#eaecef] font-bold">{srData.signals.length}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Broken</span>
                    <span className="text-[#eaecef] font-bold">{srData.broken.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Wyckoff Dashboard */}
            {wyckoffEnabled && wyckoffData && (
              <div className="mt-3 border border-[#2b3139] rounded-lg overflow-hidden">
                <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  WYCKOFF
                </div>
                <div className="bg-[#161a1e] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Phase</span>
                    <span className={`font-bold ${
                      wyckoffData.currentPhase === 'accumulation' ? 'text-emerald-400' :
                      wyckoffData.currentPhase === 'distribution' ? 'text-red-400' :
                      wyckoffData.currentPhase === 'bullish' ? 'text-lime-400' :
                      wyckoffData.currentPhase === 'bearish' ? 'text-purple-400' :
                      'text-muted-foreground'
                    }`}>
                      {wyckoffData.currentPhase.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Boxes</span>
                    <span className="text-[#eaecef] font-bold">{wyckoffData.boxes.length}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Events</span>
                    <span className="text-[#eaecef] font-bold">{wyckoffData.events.length}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#5e6673]">Signals</span>
                    <span className="text-[#eaecef] font-bold">{wyckoffData.signals.length}</span>
                  </div>
                  {wyckoffData.events.length > 0 && (
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-[#5e6673]">Last Event</span>
                      <span className={`font-bold ${wyckoffData.events[wyckoffData.events.length - 1].type === 'accumulation' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {wyckoffData.events[wyckoffData.events.length - 1].label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alpha LH Dashboard + Config */}
            {alphaLHEnabled && (
              <div className="mt-3">
                <AlphaLHConfigPanel config={alphaLHConfig} onChange={setAlphaLHConfig} />
                {alphaLHData && (
                  <div className="mt-2 border border-[#2b3139] rounded-lg overflow-hidden">
                    <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                      ALPHA LH STATS
                    </div>
                    <div className="bg-[#161a1e] p-2 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[#5e6673]">Total Entries</span>
                        <span className="text-[#eaecef] font-bold">{alphaLHData.stats.totalEntries}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[#5e6673]">TP1 / TP2 / TP3</span>
                        <span className="text-emerald-400 font-bold">{alphaLHData.stats.tp1Count} / {alphaLHData.stats.tp2Count} / {alphaLHData.stats.tp3Count}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[#5e6673]">Losses</span>
                        <span className="text-red-400 font-bold">{alphaLHData.stats.losses}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[#5e6673]">Winrate</span>
                        <span className={`font-bold ${alphaLHData.stats.winrate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {alphaLHData.stats.winrate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
          <div className="bg-[#0b0e11] overflow-hidden flex flex-col">

            {/* Main chart */}
            <div className="flex-1">
              {marketData.loading ? (
                <div className="flex items-center justify-center h-[560px] bg-[#0b0e11]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#fcd535] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-[#848e9c] font-mono">Loading {activePair}...</span>
                  </div>
                </div>
              ) : marketData.error ? (
                <div className="flex items-center justify-center h-[560px] bg-[#0b0e11]">
                  <div className="text-center">
                    <span className="text-[#f6465d] text-sm font-mono">⚠️ {marketData.error}</span>
                    <p className="text-[#848e9c] text-xs mt-2 font-mono">Đang sử dụng dữ liệu demo</p>
                  </div>
                </div>
              ) : (
                <TradingChart
                  key={`${activePair}-${activeTimeframe}-${enabledIds.join('.')}`}
                  candles={marketData.candles}
                  indicators={marketData.indicators}
                  zones={marketData.zones}
                  trendline={trendlines.support}
                  trendlineResistance={trendlines.resistance}
                  enabledIndicators={enabledIds}
                  height={750}
                  smcAnalysis={smcResult.analysis}
                  alphaNetData={alphaNet.data}
                  matrixData={matrixData}
                  engineData={engineData}
                  tpSlData={tpSlData}
                  buySellData={buySellData}
                  oscillatorData={oscillatorData}
                  proEmaData={proEmaData}
                  srData={srData}
                  wyckoffData={wyckoffData}
                  alphaLHData={alphaLHData}
                  alphaMPData={alphaMPData}
                  onLoadMore={fetchOlderCandles}
                />
              )}
            </div>

          </div>

          {/* ── RIGHT: Signal Feed ── */}
          <div className="bg-[#161a1e] p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-[#848e9c] tracking-widest uppercase font-mono">TÍN HIỆU GẦN ĐÂY</h3>
              <span className="text-[10px] font-mono text-[#5e6673]">{signals.length}</span>
            </div>
            <p className="text-[9px] text-[#5e6673] mb-3 font-mono">Click để xem lại vị trí</p>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SignalFeed signals={signals} loading={signalsLoading} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SYSTEM LOG ═══ */}
      <div className="px-1.5 lg:px-3 pb-3">
        <div className="bg-[#161a1e] border-t border-[#2b3139] px-4 py-2 flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] font-bold text-[#5e6673] tracking-widest shrink-0 font-mono">SYSTEM LOG</span>
          <div className="w-px h-3 bg-[#2b3139]" />
          <div className="flex gap-4 text-[10px] font-mono text-[#848e9c]">
            {logs.slice(0, 4).map((log, i) => (
              <span key={i} className={i === 0 ? 'text-[#fcd535]' : ''}>{log}</span>
            ))}
            {logs.length === 0 && <span>Chờ dữ liệu...</span>}
          </div>
        </div>

        {/* AI SMC Action Points */}
        {smcResult.analysis && smcResult.analysis.action_points.length > 0 && (
          <div className="mt-1 bg-[#161a1e] border border-[#2b3139] rounded px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold text-[#848e9c] tracking-widest font-mono">🤖 AI PHÂN TÍCH SMC</span>
              {smcResult.analysis.trade_signal.has_signal && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  smcResult.analysis.trade_signal.type === 'Long'
                    ? 'text-[#0ecb81] bg-[#0ecb81]/10'
                    : 'text-[#f6465d] bg-[#f6465d]/10'
                }`}>
                  {smcResult.analysis.trade_signal.type === 'Long' ? '▲ LONG' : '▼ SHORT'}
                </span>
              )}
              {smcResult.loading && (
                <span className="text-[10px] text-[#fcd535] font-mono animate-pulse">Đang phân tích...</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {smcResult.analysis.action_points.map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono text-[#848e9c]">
                  <span className="text-[#fcd535] shrink-0">{i + 1}.</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
            {smcResult.analysis.trade_signal.has_signal && smcResult.analysis.trade_signal.entry_price && (
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[#2b3139] text-[10px] font-mono">
                <span className="text-[#848e9c]">Entry: <span className="text-[#eaecef]">${smcResult.analysis.trade_signal.entry_price?.toLocaleString()}</span></span>
                <span className="text-[#0ecb81]">TP1: ${smcResult.analysis.trade_signal.TP1?.toLocaleString()}</span>
                <span className="text-[#0ecb81]">TP2: ${smcResult.analysis.trade_signal.TP2?.toLocaleString()}</span>
                <span className="text-[#0ecb81]">TP3: ${smcResult.analysis.trade_signal.TP3?.toLocaleString()}</span>
                <span className="text-[#f6465d]">SL: ${smcResult.analysis.trade_signal.SL?.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {smcResult.error && (
          <div className="mt-1 bg-[#f6465d]/5 border border-[#f6465d]/20 rounded px-4 py-2 text-[10px] font-mono text-[#f6465d]">
            ⚠️ AI Error: {smcResult.error}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
};

export default Indicators;
