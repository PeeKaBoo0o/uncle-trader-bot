import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TradingChart from '@/components/indicators/TradingChart';
import SubIndicators from '@/components/indicators/SubIndicators';
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
  { id: 'liq_hunter', label: 'Liquidity Hunter', enabled: true, color: '#FF6B6B', category: 'Liquidity' },
  { id: 'alphanet', label: 'AlphaNet AI', enabled: true, color: '#7C3AED', category: 'AI' },
  { id: 'matrix', label: 'Matrix NWE', enabled: true, color: '#00BCD4', category: 'Envelope' },
  { id: 'engine', label: 'MS Engine', enabled: true, color: '#FF9800', category: 'Structure' },
  { id: 'tp_sl', label: 'TP/SL Zones', enabled: true, color: '#E91E63', category: 'Risk' },
  { id: 'buy_sell', label: 'Buy/Sell Signal', enabled: false, color: '#4CAF50', category: 'Signal' },
  { id: 'oscillator', label: 'Oscillator Matrix', enabled: false, color: '#FF5722', category: 'Oscillator' },
  { id: 'pro_ema', label: 'Pro EMA', enabled: false, color: '#FFA726', category: 'Trend' },
  { id: 'support_resistance', label: 'Pro S/R', enabled: false, color: '#00E676', category: 'S/R' },
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

  return (
    <main className="min-h-screen bg-[#0b1120]">
      <Header />

      {/* ═══ TOP BAR: Logo | Pair | Timeframe | Bot Status ═══ */}
      <div className="pt-20 px-2 lg:px-4">
        <div className="bg-[#0d1526] border border-white/5 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          {/* Coin pair selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50 font-mono tracking-widest">PAIR</span>
            <div className="flex gap-0.5 flex-wrap">
              {PAIRS.map(p => (
                <button key={p.symbol} onClick={() => setActivePair(p.symbol)}
                  className={`px-2 py-1.5 rounded font-mono font-bold transition-all text-[11px] ${
                    activePair === p.symbol
                      ? 'text-foreground border border-white/20'
                      : 'text-muted-foreground/50 hover:text-foreground hover:bg-white/5'
                  }`}
                  style={activePair === p.symbol ? { backgroundColor: `${p.color}15`, borderColor: `${p.color}40` } : {}}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Timeframe */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50 font-mono tracking-widest">TF</span>
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
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Live price */}
          <div className="flex items-center gap-2">
            <span className="text-foreground font-mono font-bold text-sm">
              {marketData.loading ? '...' : `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
            {!marketData.loading && (
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${priceChange >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* Bot status */}
          <button
            onClick={() => setBotActive(!botActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all ${
              botActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${botActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {botActive ? 'ĐANG CHẠY' : 'TẠM DỪNG'}
          </button>
        </div>
      </div>

      {/* ═══ 3-PANEL LAYOUT ═══ */}
      <div className="px-2 lg:px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_220px] gap-2 min-h-[70vh]">

          {/* ── LEFT: Indicator Checklist ── */}
          <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">CHỈ BÁO</h3>
              <span className="text-[9px] font-mono text-muted-foreground/40">{enabledIds.length}/{indicators.length}</span>
            </div>
            <p className="text-[9px] text-muted-foreground/40 mb-3 font-mono">Bật/Tắt để hiển thị lên đồ thị</p>
            <IndicatorPanel indicators={indicators} onToggle={toggleIndicator} />
            
            {/* AlphaNet AI Dashboard */}
            {alphaNetEnabled && (
              <div className="mt-3">
                <AlphaNetDashboard data={alphaNet.data} loading={alphaNet.loading} error={alphaNet.error} />
              </div>
            )}

            {/* TP/SL Backtesting Dashboard */}
            {tpSlEnabled && tpSlData && (
              <div className="mt-3 border border-white/5 rounded-lg overflow-hidden">
                <div className="bg-[#1B1F2B] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  BACKTESTING
                </div>
                <div className="bg-[#0d1526] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Total Entries</span>
                    <span className="text-foreground font-bold">{tpSlData.stats.totalEntries}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">TP / SL Hit</span>
                    <span className="text-foreground font-bold">
                      <span className="text-emerald-400">{tpSlData.stats.tpCount}</span>
                      {' / '}
                      <span className="text-red-400">{tpSlData.stats.slCount}</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Winrate</span>
                    <span className={`font-bold ${tpSlData.stats.winrate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tpSlData.stats.winrate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Buy/Sell Signal Dashboard */}
            {buySellEnabled && buySellData && (
              <div className="mt-3 border border-white/5 rounded-lg overflow-hidden">
                <div className="bg-[#1B1F2B] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  BUY/SELL SIGNAL
                </div>
                <div className="bg-[#0d1526] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Trend</span>
                    <span className={`font-bold ${buySellData.currentTrend === 'BULLISH' ? 'text-emerald-400' : buySellData.currentTrend === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {buySellData.currentTrend}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Zone</span>
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
                    <span className="text-muted-foreground/60">Last Signal</span>
                    <span className={`font-bold ${buySellData.currentSignal === 'BUY' ? 'text-emerald-400' : buySellData.currentSignal === 'SELL' ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {buySellData.currentSignal || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Total Signals</span>
                    <span className="text-foreground font-bold">{buySellData.signals.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Oscillator Matrix Dashboard */}
            {oscillatorEnabled && oscillatorData && (
              <div className="mt-3 border border-white/5 rounded-lg overflow-hidden">
                <div className="bg-[#1B1F2B] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  OSCILLATOR MATRIX
                </div>
                <div className="bg-[#0d1526] p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Hyper Wave</span>
                    <span className={`font-bold ${oscillatorData.lastSig > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {oscillatorData.lastSig.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Signal</span>
                    <span className={`font-bold ${oscillatorData.lastSgD > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {oscillatorData.lastSgD.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Money Flow</span>
                    <span className={`font-bold ${oscillatorData.lastMfi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {oscillatorData.lastMfi.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Confluence</span>
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
                    <span className="text-muted-foreground/60">Reversals</span>
                    <span className="text-foreground font-bold">{oscillatorData.reversals.length}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Signals</span>
                    <span className="text-foreground font-bold">{oscillatorData.buySellSignals.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pro EMA Dashboard */}
            {proEmaEnabled && proEmaData && (
              <div className="mt-3 border border-white/5 rounded-lg overflow-hidden">
                <div className="bg-[#1B1F2B] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                  PRO EMA
                </div>
                <div className="bg-[#0d1526] p-2 space-y-1.5">
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
                    <span className="text-muted-foreground/60">Ribbon</span>
                    <span className={`font-bold ${proEmaData.ribbon === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {proEmaData.ribbon === 'bullish' ? '🟢 BULLISH' : '🔴 BEARISH'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">Crosses</span>
                    <span className="text-foreground font-bold">{proEmaData.crosses.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-[#0d1526] border border-white/5 rounded-lg overflow-hidden flex flex-col">
            {/* Chart header with pair info */}
            <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activePairInfo.color }} />
                <span className="text-xs font-bold text-foreground font-mono">{activePair}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/40 font-mono">Nến Nhật thời gian thực</span>
              <div className="flex-1" />
              <span className="text-[10px] text-muted-foreground/40 font-mono">Vẽ các Zone Kháng cự/Hỗ trợ AI</span>
            </div>

            {/* Main chart */}
            <div className="flex-1">
              {marketData.loading ? (
                <div className="flex items-center justify-center h-[520px]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground font-mono">Loading {activePair}...</span>
                  </div>
                </div>
              ) : marketData.error ? (
                <div className="flex items-center justify-center h-[520px]">
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
                  height={520}
                  smcAnalysis={smcResult.analysis}
                  alphaNetData={alphaNet.data}
                  matrixData={matrixData}
                  engineData={engineData}
                  tpSlData={tpSlData}
                  buySellData={buySellData}
                  oscillatorData={oscillatorData}
                  proEmaData={proEmaData}
                />
              )}
            </div>

            {/* Sub-indicator area */}
            <div className="border-t border-white/5">
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5">
                <span className="text-[9px] text-muted-foreground/40 font-mono tracking-widest mr-2">SUB</span>
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
                <SubIndicators candles={marketData.candles} indicators={marketData.indicators} activeTab={subTab} oscillatorData={oscillatorData} />
              )}
            </div>
          </div>

          {/* ── RIGHT: Signal Feed ── */}
          <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">TÍN HIỆU GẦN ĐÂY</h3>
              <span className="text-[10px] font-mono text-muted-foreground/50">{signals.length}</span>
            </div>
            <p className="text-[9px] text-muted-foreground/40 mb-3 font-mono">Click để xem lại vị trí</p>
            <div className="flex-1 overflow-hidden">
              <SignalFeed signals={signals} loading={signalsLoading} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SYSTEM LOG ═══ */}
      <div className="px-2 lg:px-4 pb-4">
        <div className="bg-[#0d1526] border border-white/5 rounded-lg px-4 py-2 flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest shrink-0">NHẬT KÝ HỆ THỐNG</span>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/60">
            {logs.slice(0, 4).map((log, i) => (
              <span key={i} className={i === 0 ? 'text-cyan-400/70' : ''}>{log}</span>
            ))}
            {logs.length === 0 && <span>Chờ dữ liệu...</span>}
          </div>
        </div>

        {/* AI SMC Action Points */}
        {smcResult.analysis && smcResult.analysis.action_points.length > 0 && (
          <div className="mt-2 bg-[#0d1526] border border-white/5 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest">🤖 AI PHÂN TÍCH SMC</span>
              {smcResult.analysis.trade_signal.has_signal && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  smcResult.analysis.trade_signal.type === 'Long'
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-red-400 bg-red-400/10'
                }`}>
                  {smcResult.analysis.trade_signal.type === 'Long' ? '▲ LONG' : '▼ SHORT'}
                </span>
              )}
              {smcResult.loading && (
                <span className="text-[10px] text-cyan-400/70 font-mono animate-pulse">Đang phân tích...</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {smcResult.analysis.action_points.map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono text-muted-foreground/80">
                  <span className="text-cyan-400 shrink-0">{i + 1}.</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
            {smcResult.analysis.trade_signal.has_signal && smcResult.analysis.trade_signal.entry_price && (
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/5 text-[10px] font-mono">
                <span className="text-muted-foreground/50">Entry: <span className="text-foreground">${smcResult.analysis.trade_signal.entry_price?.toLocaleString()}</span></span>
                <span className="text-emerald-400/70">TP1: ${smcResult.analysis.trade_signal.TP1?.toLocaleString()}</span>
                <span className="text-emerald-400/70">TP2: ${smcResult.analysis.trade_signal.TP2?.toLocaleString()}</span>
                <span className="text-emerald-400/70">TP3: ${smcResult.analysis.trade_signal.TP3?.toLocaleString()}</span>
                <span className="text-red-400/70">SL: ${smcResult.analysis.trade_signal.SL?.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {smcResult.error && (
          <div className="mt-2 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2 text-[10px] font-mono text-red-400/70">
            ⚠️ AI Error: {smcResult.error}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
};

export default Indicators;
