import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TradingChart from '@/components/indicators/TradingChart';
import SubIndicators from '@/components/indicators/SubIndicators';
import IndicatorPanel, { IndicatorConfig } from '@/components/indicators/IndicatorPanel';
import SignalFeed from '@/components/indicators/SignalFeed';
import { useMarketData, useSignals } from '@/hooks/useMarketData';
import { useSmartSignals } from '@/hooks/useSmartSignal';
import { useDXY } from '@/hooks/useDXY';
import { supabase } from '@/integrations/supabase/client';
import html2canvas from 'html2canvas';

const PAIRS = ['BTC/USDT', 'XAU/USDT'];
const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const SIGNAL_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  buy: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'MUA' },
  sell: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-400', label: 'BÁN' },
  alert: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'CẢNH BÁO' },
  breakout: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300', dot: 'bg-violet-400', label: 'BREAKOUT' },
  support_touch: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', text: 'text-cyan-300', dot: 'bg-cyan-400', label: 'HỖ TRỢ' },
  volume_anomaly: { bg: 'bg-orange-500/10', border: 'border-orange-500/25', text: 'text-orange-300', dot: 'bg-orange-400', label: 'VOLUME' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-300', dot: 'bg-blue-400', label: 'INFO' },
};

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

const Analysis: React.FC = () => {
  const [activePair, setActivePair] = useState('BTC/USDT');
  const [activeTimeframe, setActiveTimeframe] = useState('H4');
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [subTab, setSubTab] = useState<'rsi' | 'volume' | 'macd'>('rsi');
  const [logs, setLogs] = useState<string[]>([]);
  const [autoSignal, setAutoSignal] = useState(false);
  const [sendingSignal, setSendingSignal] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const autoSignalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const marketData = useMarketData(activePair, activeTimeframe);
  const { signals: dbSignals, loading: signalsLoading } = useSignals();
  const smartSignals = useSmartSignals(
    marketData.candles, marketData.indicators, marketData.zones, activePair, marketData.loading
  );
  const dxy = useDXY();

  // Also fetch gold data for the bottom 2-column section
  const goldData = useMarketData('XAU/USDT', activeTimeframe);
  const btcData = useMarketData('BTC/USDT', activeTimeframe);

  const goldSignals = useSmartSignals(
    goldData.candles, goldData.indicators, goldData.zones, 'XAU/USDT', goldData.loading
  );
  const btcSignals = useSmartSignals(
    btcData.candles, btcData.indicators, btcData.zones, 'BTC/USDT', btcData.loading
  );

  const toggleIndicator = (id: string) => {
    setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, enabled: !ind.enabled } : ind));
  };

  const enabledIds = indicators.filter(i => i.enabled).map(i => i.id);

  // Live price
  const lastCandle = marketData.candles[marketData.candles.length - 1];
  const livePrice = lastCandle ? lastCandle.close : 0;
  const prevCandle = marketData.candles[marketData.candles.length - 2];
  const priceChange = prevCandle ? ((livePrice - prevCandle.close) / prevCandle.close * 100) : 0;

  // AI Analysis from zones/actions
  const trend = marketData.actions
    ? (marketData.actions.target > livePrice ? '📈 Tăng (Bullish)' : '📉 Giảm (Bearish)')
    : '⏳ Đang phân tích...';
  const supportZone = marketData.zones.find(z => z.type === 'support');
  const resistanceZone = marketData.zones.find(z => z.type === 'resistance');

  // Log simulation
  useEffect(() => {
    if (!marketData.loading && marketData.candles.length > 0) {
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const sym = activePair.replace('/', '');
      const triggeredCount = smartSignals.filter(s => s.isNew).length;
      setLogs(prev => {
        const newLogs = [`[${now}] Scanning ${activeTimeframe} candle for ${sym}...`];
        if (triggeredCount > 0) {
          newLogs.push(`[${now}] ${sym}: Signal generated ✅`);
        }
        return [...newLogs, ...prev].slice(0, 12);
      });
    }
  }, [marketData.loading, activePair, activeTimeframe, smartSignals]);

  // Screenshot
  const handleScreenshot = useCallback(async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#0b1120',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${activePair.replace('/', '-')}_${activeTimeframe}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  }, [activePair, activeTimeframe]);

  // Send manual signal
  const handleSendSignal = useCallback(async (symbol: string) => {
    setSendingSignal(symbol);
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    try {
      const { data, error } = await supabase.functions.invoke('signal-bot', {
        body: { mode: 'scan', symbols: [symbol], timeframe: activeTimeframe }
      });
      if (error) throw error;
      setLogs(prev => [`[${now}] ✅ Signal ${symbol} sent to Telegram`, ...prev].slice(0, 12));
    } catch (e: any) {
      setLogs(prev => [`[${now}] ❌ Failed to send ${symbol}: ${e.message}`, ...prev].slice(0, 12));
    } finally {
      setSendingSignal(null);
    }
  }, [activeTimeframe]);

  // Auto-signal toggle
  useEffect(() => {
    if (autoSignal) {
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setLogs(prev => [`[${now}] 🤖 Auto-Signal BẬT — quét mỗi 60s`, ...prev].slice(0, 12));
      
      const runAutoScan = async () => {
        const ts = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setLogs(prev => [`[${ts}] 🔄 Auto scanning BTCUSDT + XAUUSDT...`, ...prev].slice(0, 12));
        try {
          await supabase.functions.invoke('signal-bot', {
            body: { mode: 'scan', symbols: ['BTCUSDT', 'XAUUSDT'], timeframe: activeTimeframe }
          });
          setLogs(prev => [`[${ts}] ✅ Auto scan complete`, ...prev].slice(0, 12));
        } catch {
          setLogs(prev => [`[${ts}] ❌ Auto scan failed`, ...prev].slice(0, 12));
        }
      };
      
      runAutoScan();
      autoSignalRef.current = setInterval(runAutoScan, 60000);
    } else {
      if (autoSignalRef.current) {
        clearInterval(autoSignalRef.current);
        autoSignalRef.current = null;
        const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setLogs(prev => [`[${now}] ⏸ Auto-Signal TẮT`, ...prev].slice(0, 12));
      }
    }
    return () => {
      if (autoSignalRef.current) clearInterval(autoSignalRef.current);
    };
  }, [autoSignal, activeTimeframe]);

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* TOP BAR */}
      <div className="pt-20 px-2 lg:px-4">
        <div className="glass-card rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          {/* Pairs */}
          <div className="flex gap-0.5">
            {PAIRS.map(p => (
              <button key={p} onClick={() => setActivePair(p)}
                className={`px-3 py-1.5 rounded font-mono font-bold transition-all ${
                  activePair === p
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground/60 hover:text-foreground'
                }`}>
                {p}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-foreground/10" />

          {/* Timeframes */}
          <div className="flex gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setActiveTimeframe(tf)}
                className={`px-2 py-1.5 rounded font-mono transition-all ${
                  activeTimeframe === tf
                    ? 'bg-secondary/20 text-secondary border border-secondary/30'
                    : 'text-muted-foreground/60 hover:text-foreground'
                }`}>
                {tf}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-foreground/10" />

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

          {/* Screenshot */}
          <button onClick={handleScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all">
            📸 <span className="hidden sm:inline">Chụp màn hình</span>
          </button>
        </div>
      </div>

      {/* 3-PANEL LAYOUT */}
      <div ref={dashboardRef} className="px-2 lg:px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-2 min-h-[70vh]">
          
          {/* LEFT - AI Analysis + Indicators */}
          <div className="glass-card rounded-lg p-3 space-y-4 overflow-y-auto max-h-[80vh]">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-primary/80 tracking-widest uppercase">🤖 AI PHÂN TÍCH</span>
              </div>

              <div className="space-y-2.5">
                <div className="bg-foreground/[0.03] rounded-lg p-2.5 border border-foreground/5">
                  <div className="text-[10px] text-muted-foreground/60 font-mono mb-1">📈 XU HƯỚNG</div>
                  <div className={`text-xs font-semibold ${marketData.actions && marketData.actions.target > livePrice ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trend}
                  </div>
                </div>

                <div className="bg-foreground/[0.03] rounded-lg p-2.5 border border-foreground/5">
                  <div className="text-[10px] text-muted-foreground/60 font-mono mb-1">🗝️ VÙNG THEN CHỐT</div>
                  <div className="text-xs text-foreground">
                    {supportZone && resistanceZone ? (
                      <>
                        <span className="text-emerald-400">S: ${((supportZone.top + supportZone.bottom) / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        {' | '}
                        <span className="text-red-400">R: ${((resistanceZone.top + resistanceZone.bottom) / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </>
                    ) : 'Đang tính toán...'}
                  </div>
                </div>

                <div className="bg-foreground/[0.03] rounded-lg p-2.5 border border-foreground/5">
                  <div className="text-[10px] text-muted-foreground/60 font-mono mb-1">🎯 KẾ HOẠCH</div>
                  {marketData.actions ? (
                    <div className="text-[10px] space-y-0.5">
                      <div className="text-primary">Entry: ${marketData.actions.entry.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className="text-emerald-400">TP: ${marketData.actions.target.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className="text-red-400">SL: ${marketData.actions.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">Đang phân tích...</span>}
                </div>
              </div>

              <button onClick={() => window.location.reload()}
                className="w-full py-2 rounded-lg text-[10px] font-bold text-primary border border-primary/20 hover:bg-primary/10 transition-all">
                🔄 Phân tích lại
              </button>
            </div>

            <div className="border-t border-foreground/5 pt-3">
              <IndicatorPanel indicators={indicators} onToggle={toggleIndicator} />
            </div>
          </div>

          {/* CENTER - Chart */}
          <div className="glass-card rounded-lg overflow-hidden">
            {marketData.loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-muted-foreground font-mono">Loading {activePair}...</span>
                </div>
              </div>
            ) : marketData.error ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <span className="text-destructive text-sm">⚠️ {marketData.error}</span>
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
            <div className="border-t border-foreground/5">
              <div className="flex gap-0.5 px-3 py-1.5 border-b border-foreground/5">
                {(['rsi', 'volume', 'macd'] as const).map(tab => (
                  <button key={tab} onClick={() => setSubTab(tab)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase font-bold transition-all ${
                      subTab === tab ? 'bg-foreground/5 text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
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

          {/* RIGHT - Signal Feed + DXY */}
          <div className="glass-card rounded-lg p-3 flex flex-col overflow-hidden">
            {/* Live indicator */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-foreground tracking-wider uppercase">BOT SIGNAL Live</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50">🟢 LIVE</span>
            </div>

            {/* Signal type legend */}
            <div className="flex flex-wrap gap-1 mb-3">
              {[
                { label: '🚀 Breakout', color: 'text-violet-300' },
                { label: '🛡️ Hỗ trợ', color: 'text-cyan-300' },
                { label: '📊 Volume', color: 'text-orange-300' },
              ].map(l => (
                <span key={l.label} className={`text-[9px] font-bold ${l.color} bg-foreground/5 px-1.5 py-0.5 rounded`}>
                  {l.label}
                </span>
              ))}
            </div>

            {/* DXY Widget */}
            <div className={`rounded-lg p-2.5 mb-3 border ${
              dxy.change > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DXY CORRELATION</span>
                <span className={`text-[10px] font-bold ${dxy.change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {dxy.loading ? '...' : dxy.value.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-mono ${dxy.change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {dxy.change > 0 ? '↑' : '↓'} {Math.abs(dxy.changePercent).toFixed(2)}%
                </span>
                <span className="text-[9px] text-muted-foreground/60">
                  {dxy.change > 0 ? 'DXY↑ = BTC/GOLD áp lực' : 'DXY↓ = BTC/GOLD hưởng lợi'}
                </span>
              </div>
            </div>

            {/* Smart Signal Feed */}
            <div className="flex-1 overflow-y-auto max-h-[450px] space-y-1.5 scrollbar-thin">
              {smartSignals.map(signal => {
                const style = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.alert;
                return (
                  <div key={signal.id}
                    className={`p-2.5 rounded-lg border-l-2 transition-all duration-500 ${style.bg} ${style.border} ${
                      signal.isNew ? 'ring-1 ring-primary/30 bg-primary/5' : ''
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        <span className={`text-[9px] font-bold ${style.text} uppercase`}>{style.label}</span>
                        <span className="text-[9px] font-bold text-foreground/60 px-1 py-0.5 rounded bg-foreground/5">{signal.symbol}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono">{signal.time}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{signal.message}</p>
                  </div>
                );
              })}
            </div>

            {/* DB Signal Feed (collapsed) */}
            {dbSignals.length > 0 && (
              <div className="mt-3 pt-3 border-t border-foreground/5">
                <div className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">
                  BOT SIGNALS ({dbSignals.length})
                </div>
                <SignalFeed signals={dbSignals.slice(0, 5)} loading={signalsLoading} />
              </div>
            )}

            {/* Telegram CTA */}
            <div className="mt-3 pt-3 border-t border-foreground/5">
              <a href="https://t.me/UNCLETRADER" target="_blank" rel="noopener noreferrer"
                className="btn-primary w-full py-2.5 rounded-xl text-[11px] font-bold text-center block">
                🚀 Tham Gia BOT SIGNAL Telegram
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="px-2 lg:px-4 pb-2">
        <div className="glass-card rounded-lg px-4 py-3 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => handleSendSignal('BTCUSDT')}
            disabled={sendingSignal === 'BTCUSDT'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingSignal === 'BTCUSDT' ? (
              <><span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> Đang gửi...</>
            ) : (
              <>📤 Gửi BTC Signal</>
            )}
          </button>

          <button
            onClick={() => handleSendSignal('XAUUSDT')}
            disabled={sendingSignal === 'XAUUSDT'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingSignal === 'XAUUSDT' ? (
              <><span className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /> Đang gửi...</>
            ) : (
              <>📤 Gửi Vàng Signal</>
            )}
          </button>

          <button
            onClick={() => setAutoSignal(prev => !prev)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              autoSignal
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'bg-foreground/5 border border-foreground/10 text-muted-foreground hover:text-foreground'
            }`}
          >
            {autoSignal ? '🤖 Auto-Signal ON' : '⏸ Tạm Dừng'}
          </button>
        </div>
      </div>

      {/* BOT SIGNAL SECTION — 2 columns: BTC left | GOLD right */}
      <div className="px-2 lg:px-4 pb-2">
        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-foreground tracking-wider uppercase">BOT SIGNAL — Tín Hiệu Realtime</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BTC Column */}
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-foreground/5">
                <span className="text-xs font-bold text-amber-400 font-mono">₿ BTC/USDT</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {btcData.candles.length > 0 ? `$${btcData.candles[btcData.candles.length - 1].close.toLocaleString()}` : '...'}
                </span>
              </div>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                {btcSignals.filter(s => s.symbol === 'BTC').length > 0 ? (
                  btcSignals.filter(s => s.symbol === 'BTC').map(signal => {
                    const style = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.alert;
                    return (
                      <div key={signal.id} className={`p-2 rounded-lg border-l-2 ${style.bg} ${style.border}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[9px] font-bold ${style.text} uppercase`}>{style.label}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">{signal.time}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{signal.message}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-muted-foreground/40 text-[10px]">Đang quét tín hiệu BTC...</div>
                )}
              </div>
            </div>

            {/* GOLD Column */}
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-foreground/5">
                <span className="text-xs font-bold text-yellow-400 font-mono">🥇 XAU/USDT</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {goldData.candles.length > 0 ? `$${goldData.candles[goldData.candles.length - 1].close.toLocaleString()}` : '...'}
                </span>
              </div>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                {goldSignals.filter(s => s.symbol === 'XAU').length > 0 ? (
                  goldSignals.filter(s => s.symbol === 'XAU').map(signal => {
                    const style = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.alert;
                    return (
                      <div key={signal.id} className={`p-2 rounded-lg border-l-2 ${style.bg} ${style.border}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[9px] font-bold ${style.text} uppercase`}>{style.label}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">{signal.time}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{signal.message}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-muted-foreground/40 text-[10px]">Đang quét tín hiệu GOLD...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM LOG */}
      <div className="px-2 lg:px-4 pb-4">
        <div className="glass-card rounded-lg px-4 py-2 flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest shrink-0">SYSTEM LOG</span>
          <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/60">
            {logs.slice(0, 5).map((log, i) => (
              <span key={i} className={i === 0 ? 'text-primary/60' : ''}>{log}</span>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
};

export default Analysis;
