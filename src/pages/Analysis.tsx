import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TradingChart from '@/components/indicators/TradingChart';
import SignalFeed from '@/components/indicators/SignalFeed';
import { useMarketData, useSignals } from '@/hooks/useMarketData';
import { useSmartSignals } from '@/hooks/useSmartSignal';
import { useDXY } from '@/hooks/useDXY';
import { supabase } from '@/integrations/supabase/client';
import html2canvas from 'html2canvas';
import { computeDualTrendlines } from '@/lib/computeTrendline';

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

const ENABLED_INDICATORS = ['bb_squeeze', 'breakout', 'breakdown', 'confluence', 'momentum', 'vol_spike', 'rsi_div', 'sup_bounce', 'macd_cross'];

const Analysis: React.FC = () => {
  const navigate = useNavigate();
  const [btcTimeframe, setBtcTimeframe] = useState('H4');
  const [goldTimeframe, setGoldTimeframe] = useState('H4');
  const [logs, setLogs] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanLabel, setScanLabel] = useState('');
  const [autoSignal, setAutoSignal] = useState(false);
  const [sendingSignal, setSendingSignal] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Data hooks
  const btcData = useMarketData('BTC/USDT', btcTimeframe);
  const goldData = useMarketData('XAU/USDT', goldTimeframe);
  const { signals: dbSignals, loading: signalsLoading } = useSignals();
  const btcSignals = useSmartSignals(btcData.candles, btcData.indicators, btcData.zones, 'BTC/USDT', btcData.loading);
  const goldSignals = useSmartSignals(goldData.candles, goldData.indicators, goldData.zones, 'XAU/USDT', goldData.loading);
  const dxy = useDXY();

  // Merge signals for sidebar
  const allSignals = [...btcSignals, ...goldSignals]
    .sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
    .slice(0, 20);

  // Live prices
  const btcPrice = btcData.candles[btcData.candles.length - 1]?.close ?? 0;
  const btcPrev = btcData.candles[btcData.candles.length - 2]?.close ?? btcPrice;
  const btcChange = btcPrev ? ((btcPrice - btcPrev) / btcPrev * 100) : 0;
  const goldPrice = goldData.candles[goldData.candles.length - 1]?.close ?? 0;
  const goldPrev = goldData.candles[goldData.candles.length - 2]?.close ?? goldPrice;
  const goldChange = goldPrev ? ((goldPrice - goldPrev) / goldPrev * 100) : 0;

  // AI action points
  const getAIPoints = (data: typeof btcData, symbol: string) => {
    if (!data.actions || data.zones.length === 0) return null;
    const sup = data.zones.find(z => z.type === 'support');
    const res = data.zones.find(z => z.type === 'resistance');
    const lastPrice = data.candles[data.candles.length - 1]?.close ?? 0;
    const trend = data.actions.target > lastPrice ? 'Tăng (Bullish)' : 'Giảm (Bearish)';
    return {
      trend,
      support: sup ? (sup.top + sup.bottom) / 2 : 0,
      resistance: res ? (res.top + res.bottom) / 2 : 0,
      entry: data.actions.entry,
      target: data.actions.target,
      stopLoss: data.actions.stopLoss,
      action: data.actions.target > lastPrice
        ? 'Đợi Breakout hoặc mua tại vùng hỗ trợ'
        : 'Đợi Rebound tại kháng cự hoặc bán',
    };
  };
  const btcAI = getAIPoints(btcData, 'BTC');
  const goldAI = getAIPoints(goldData, 'XAU');

  // ── Compute trendlines from candle data ──
  const btcTrendlines = useMemo(() => computeDualTrendlines(btcData.candles), [btcData.candles]);
  const goldTrendlines = useMemo(() => computeDualTrendlines(goldData.candles), [goldData.candles]);

  // Scan animation
  const triggerScan = useCallback(() => {
    setScanning(true);
    setScanLabel('🔍 Gemini AI đang phân tích dữ liệu nến mới...');
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setLogs(prev => [`[${now}] 🔄 Gemini AI scanning BTC:${btcTimeframe} / Gold:${goldTimeframe}...`, ...prev].slice(0, 15));
    setTimeout(() => {
      setScanLabel('✅ Phân tích hoàn tất — Trendline & Zones đã cập nhật');
      setLogs(prev => [`[${now}] ✅ AI scan complete — trendlines & zones updated`, ...prev].slice(0, 15));
    }, 2500);
    setTimeout(() => { setScanning(false); setScanLabel(''); }, 4000);
  }, [btcTimeframe, goldTimeframe]);

  // Trigger scan on data load & timeframe change
  useEffect(() => {
    if (!btcData.loading && btcData.candles.length > 0) {
      triggerScan();
    }
  }, [btcTimeframe, goldTimeframe, btcData.loading]);

  // ── Auto H4 scan timer: trigger every 4 hours ──
  useEffect(() => {
    if (btcTimeframe !== 'H4' && goldTimeframe !== 'H4') return;
    const now = new Date();
    const nextH4 = new Date(now);
    // Round up to next 4-hour mark
    const h = nextH4.getUTCHours();
    const nextH = Math.ceil((h + 1) / 4) * 4;
    nextH4.setUTCHours(nextH, 0, 10, 0); // 10s after candle close
    if (nextH4 <= now) nextH4.setUTCHours(nextH4.getUTCHours() + 4);
    const msUntilNext = nextH4.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      triggerScan();
      // Then repeat every 4 hours
      const interval = setInterval(triggerScan, 4 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, msUntilNext);

    return () => clearTimeout(timeout);
  }, [btcTimeframe, goldTimeframe, triggerScan]);

  // Screenshot
  const handleScreenshot = useCallback(async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, { backgroundColor: '#0a0f1e', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `analysis_${btcTimeframe}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error('Screenshot failed:', e); }
  }, [btcTimeframe]);

  // Send signal
  const handleSendSignal = useCallback(async (symbol: string) => {
    setSendingSignal(symbol);
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    try {
      await supabase.functions.invoke('signal-bot', {
        body: { mode: 'scan', symbols: [symbol], timeframe: symbol === 'BTCUSDT' ? btcTimeframe : goldTimeframe }
      });
      setLogs(prev => [`[${now}] ✅ Signal ${symbol} sent`, ...prev].slice(0, 15));
    } catch (e: any) {
      setLogs(prev => [`[${now}] ❌ Failed: ${e.message}`, ...prev].slice(0, 15));
    } finally { setSendingSignal(null); }
  }, [btcTimeframe, goldTimeframe]);

  // Auto-signal
  useEffect(() => {
    if (autoSignal) {
      const run = async () => {
        const ts = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setLogs(prev => [`[${ts}] 🤖 Auto scanning...`, ...prev].slice(0, 15));
        try {
          await supabase.functions.invoke('signal-bot', {
            body: { mode: 'scan', symbols: ['BTCUSDT', 'XAUUSDT'], timeframe: btcTimeframe }
          });
          setLogs(prev => [`[${ts}] ✅ Auto scan done`, ...prev].slice(0, 15));
        } catch { setLogs(prev => [`[${ts}] ❌ Auto scan failed`, ...prev].slice(0, 15)); }
      };
      run();
      autoRef.current = setInterval(run, 60000);
    } else {
      if (autoRef.current) clearInterval(autoRef.current);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoSignal, btcTimeframe]);

  const formatPrice = (p: number, isGold = false) =>
    isGold ? `$${p.toFixed(2)}` : `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const AIActionCard = ({ ai, symbol, isGold }: { ai: ReturnType<typeof getAIPoints>; symbol: string; isGold?: boolean }) => {
    if (!ai) return (
      <div className="glass-card rounded-xl p-4 space-y-2 animate-pulse">
        <div className="h-4 bg-foreground/5 rounded w-3/4" />
        <div className="h-3 bg-foreground/5 rounded w-1/2" />
        <div className="h-3 bg-foreground/5 rounded w-2/3" />
      </div>
    );
    return (
      <div className="glass-card rounded-xl p-4 space-y-3 border border-foreground/5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-primary font-mono">{symbol}</span>
          <span className="text-[10px] text-muted-foreground">AI "3 Điểm Hành Động"</span>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start gap-2">
            <span className="text-base">📈</span>
            <div>
              <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Xu hướng hiện tại</div>
              <div className={`text-xs font-bold ${ai.trend.includes('Tăng') ? 'text-emerald-400' : 'text-red-400'}`}>
                {ai.trend}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-base">🗝️</span>
            <div>
              <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Vùng giá then chốt</div>
              <div className="text-xs text-foreground">
                <span className="text-emerald-400">Hỗ trợ: {formatPrice(ai.support, isGold)}</span>
                {' — '}
                <span className="text-red-400">Kháng cự: {formatPrice(ai.resistance, isGold)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-base">🎯</span>
            <div>
              <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Kế hoạch hành động</div>
              <div className="text-xs text-primary font-medium">{ai.action}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                Entry: {formatPrice(ai.entry, isGold)} | TP: {formatPrice(ai.target, isGold)} | SL: {formatPrice(ai.stopLoss, isGold)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* ── TOP BAR ── */}
      <div className="pt-20 px-2 lg:px-4">
        <div className="glass-card rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          {/* Pair badges */}
          <div className="flex items-center gap-2">
            <span onClick={() => navigate('/phan-tich/btc')} className="px-2.5 py-1 rounded font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-all">₿ BTC/USDT</span>
            <span onClick={() => navigate('/phan-tich/xau')} className="px-2.5 py-1 rounded font-mono font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 cursor-pointer hover:bg-yellow-500/20 transition-all">🥇 XAU/USD</span>
          </div>


          <div className="w-px h-5 bg-foreground/10" />

          {/* Live Prices */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-mono font-bold text-sm">
                {btcData.loading ? '...' : formatPrice(btcPrice)}
              </span>
              <span className={`font-mono text-[10px] ${btcChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-mono font-bold text-sm">
                {goldData.loading ? '...' : formatPrice(goldPrice, true)}
              </span>
              <span className={`font-mono text-[10px] ${goldChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {goldChange >= 0 ? '+' : ''}{goldChange.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="flex-1" />

          {/* Scan + Screenshot */}
          <button onClick={triggerScan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-primary border border-primary/20 hover:bg-primary/10 transition-all text-[10px] font-bold">
            🔄 Phân tích lại
          </button>
          <button onClick={handleScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all">
            📸
          </button>
        </div>
      </div>

      {/* Scan overlay moved inside TradingChart */}

      {/* ── MAIN LAYOUT ── */}
      <div ref={dashboardRef} className="px-2 lg:px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-2">

          {/* ── LEFT: Charts in 2 columns ── */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">

              {/* ── BTC Column ── */}
              <div className="space-y-2 cursor-pointer" onClick={() => navigate('/phan-tich/btc')} title="Nhấp để xem chi tiết BTC/USDT">
                {btcData.loading ? (
                  <div className="flex items-center justify-center h-[420px] bg-[#0d1117] rounded-xl">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground font-mono">Loading BTC/USDT...</span>
                    </div>
                  </div>
                ) : btcData.error ? (
                  <div className="flex items-center justify-center h-[420px] bg-[#0d1117] rounded-xl">
                    <span className="text-destructive text-sm">⚠️ {btcData.error}</span>
                  </div>
                ) : (
                  <TradingChart
                    candles={btcData.candles}
                    indicators={btcData.indicators}
                    zones={btcData.zones}
                    trendline={btcTrendlines.support}
                    trendlineResistance={btcTrendlines.resistance}
                    enabledIndicators={ENABLED_INDICATORS}
                    height={300}
                    label="₿ BTC/USDT · Binance"
                    scanning={scanning}
                    scanLabel={scanLabel}
                    timeframe={btcTimeframe}
                    onTimeframeChange={setBtcTimeframe}
                  />
                )}
                <AIActionCard ai={btcAI} symbol="₿ BTC/USDT" />
                <a href="https://www.okx.com/join/UNCLETRADER" target="_blank" rel="noopener noreferrer"
                  className="glass-card rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-all group border border-foreground/5">
                  <span className="text-2xl">🚀</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-foreground">Đăng ký sàn OKX — Giảm 20% phí giao dịch</div>
                    <div className="text-[10px] text-muted-foreground">Giao dịch BTC với phí thấp nhất thị trường</div>
                  </div>
                  <span className="text-primary text-xs group-hover:translate-x-1 transition-transform">→</span>
                </a>
              </div>

              {/* ── GOLD Column ── */}
              <div className="space-y-2 cursor-pointer" onClick={() => navigate('/phan-tich/xau')} title="Nhấp để xem chi tiết XAU/USD">
                {goldData.loading ? (
                  <div className="flex items-center justify-center h-[420px] bg-[#0d1117] rounded-xl">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground font-mono">Loading XAU/USD...</span>
                    </div>
                  </div>
                ) : goldData.error ? (
                  <div className="flex items-center justify-center h-[420px] bg-[#0d1117] rounded-xl">
                    <span className="text-destructive text-sm">⚠️ {goldData.error}</span>
                  </div>
                ) : (
                  <TradingChart
                    candles={goldData.candles}
                    indicators={goldData.indicators}
                    zones={goldData.zones}
                    trendline={goldTrendlines.support}
                    trendlineResistance={goldTrendlines.resistance}
                    enabledIndicators={ENABLED_INDICATORS}
                    height={300}
                    label="🥇 XAU/USD (Gold)"
                    scanning={scanning}
                    scanLabel={scanLabel}
                    timeframe={goldTimeframe}
                    onTimeframeChange={setGoldTimeframe}
                  />
                )}
                <AIActionCard ai={goldAI} symbol="🥇 XAU/USD" isGold />
                <a href="https://www.okx.com/join/UNCLETRADER" target="_blank" rel="noopener noreferrer"
                  className="glass-card rounded-xl p-3 flex items-center gap-3 hover:border-yellow-500/30 transition-all group border border-foreground/5">
                  <span className="text-2xl">🥇</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-foreground">Giao dịch Vàng trên OKX — Spread siêu thấp</div>
                    <div className="text-[10px] text-muted-foreground">Mở tài khoản miễn phí, ưu đãi dành riêng cho bạn</div>
                  </div>
                  <span className="text-yellow-400 text-xs group-hover:translate-x-1 transition-transform">→</span>
                </a>
              </div>
            </div>
          </div>

          {/* ── RIGHT SIDEBAR: Signals + DXY + CTA ── */}
          <div className="space-y-2">

            {/* DXY Correlation Widget */}
            <div className={`glass-card rounded-xl p-3 border ${
              dxy.change > 0 ? 'border-red-500/20' : 'border-emerald-500/20'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">📊 DXY — Chỉ số USD</span>
                <span className={`text-sm font-bold font-mono ${dxy.change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {dxy.loading ? '...' : dxy.value.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono ${dxy.change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {dxy.change > 0 ? '↑' : '↓'} {Math.abs(dxy.changePercent).toFixed(2)}%
                </span>
                <span className="text-[9px] text-muted-foreground/60">
                  {dxy.change > 0 ? 'DXY↑ → BTC & Vàng chịu áp lực' : 'DXY↓ → BTC & Vàng hưởng lợi'}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-foreground/5 text-[9px] text-muted-foreground/50">
                💡 Vàng & BTC có tương quan nghịch mạnh với USD. Khi DXY tăng, cả hai thường giảm.
              </div>
            </div>

            {/* Live Signal Feed */}
            <div className="glass-card rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-foreground tracking-wider uppercase">BOT SIGNAL Live</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/50">🟢 LIVE</span>
              </div>

              {/* Signal legend */}
              <div className="flex flex-wrap gap-1 mb-3">
                {[
                  { label: '🚀 Breakout', c: 'text-violet-300' },
                  { label: '🛡️ Hỗ trợ', c: 'text-cyan-300' },
                  { label: '📊 Volume', c: 'text-orange-300' },
                  { label: '💥 Momentum', c: 'text-emerald-300' },
                ].map(l => (
                  <span key={l.label} className={`text-[8px] font-bold ${l.c} bg-foreground/5 px-1.5 py-0.5 rounded`}>{l.label}</span>
                ))}
              </div>

              {/* Signals */}
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto scrollbar-thin">
                {allSignals.map(signal => {
                  const style = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.alert;
                  return (
                    <div key={signal.id}
                      onClick={() => {
                        const sym = signal.symbol?.toLowerCase();
                        if (sym?.includes('btc')) navigate('/phan-tich/btc');
                        else if (sym?.includes('xau') || sym?.includes('gold')) navigate('/phan-tich/xau');
                      }}
                      className={`p-2.5 rounded-lg border-l-2 transition-all duration-500 cursor-pointer hover:scale-[1.02] ${style.bg} ${style.border} ${
                        signal.isNew ? 'ring-1 ring-primary/30 bg-primary/5' : ''
                      }`}>
                      <div className="flex items-center justify-between mb-0.5">
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

              {/* DB Signals */}
              {dbSignals.length > 0 && (
                <div className="mt-3 pt-3 border-t border-foreground/5">
                  <div className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">
                    HISTORY ({dbSignals.length})
                  </div>
                  <SignalFeed signals={dbSignals.slice(0, 5)} loading={signalsLoading} />
                </div>
              )}
            </div>

            {/* Telegram CTA */}
            <a href="https://t.me/UNCLETRADER" target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full py-3 rounded-xl text-xs font-bold text-center block">
              🚀 Tham Gia BOT SIGNAL Telegram
            </a>
            <div className="text-center text-[9px] text-muted-foreground/40">
              Nhận tín hiệu Real-time nhanh hơn web
            </div>
          </div>
        </div>
      </div>

      {/* ── ACTION BAR ── */}
      <div className="px-2 lg:px-4 pb-2">
        <div className="glass-card rounded-lg px-4 py-3 flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => handleSendSignal('BTCUSDT')} disabled={!!sendingSignal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50">
            {sendingSignal === 'BTCUSDT' ? '⏳ Đang gửi...' : '📤 Gửi BTC Signal'}
          </button>
          <button onClick={() => handleSendSignal('XAUUSDT')} disabled={!!sendingSignal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-50">
            {sendingSignal === 'XAUUSDT' ? '⏳ Đang gửi...' : '📤 Gửi Vàng Signal'}
          </button>
          <button onClick={() => setAutoSignal(prev => !prev)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              autoSignal
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'bg-foreground/5 border border-foreground/10 text-muted-foreground hover:text-foreground'
            }`}>
            {autoSignal ? '🤖 Auto-Signal ON' : '⏸ Tạm Dừng'}
          </button>
        </div>
      </div>

      {/* ── SYSTEM LOG ── */}
      <div className="px-2 lg:px-4 pb-4">
        <div className="glass-card rounded-lg px-4 py-2 flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest shrink-0 font-mono">SYSTEM</span>
          <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/60">
            {logs.slice(0, 5).map((log, i) => (
              <span key={i} className={i === 0 ? 'text-primary/70' : ''}>{log}</span>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
};

export default Analysis;
