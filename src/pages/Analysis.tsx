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
import { Sparkles, RefreshCw, History } from 'lucide-react';

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
  const [btcCommentary, setBtcCommentary] = useState('');
  const [xauCommentary, setXauCommentary] = useState('');
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [commentaryFailed, setCommentaryFailed] = useState(false);
  const [commentaryTime, setCommentaryTime] = useState('');
  const [commentaryDate, setCommentaryDate] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ asset: string; commentary: string; commentary_date: string; created_at: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const btcChartRef = useRef<HTMLDivElement>(null);
  const goldChartRef = useRef<HTMLDivElement>(null);
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

  // ── Load today's commentary from DB first ──
  useEffect(() => {
    const loadToday = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('market_commentaries')
        .select('asset, commentary, commentary_date, created_at')
        .eq('commentary_date', today);
      if (data && data.length > 0) {
        const btcRow = data.find(r => r.asset === 'BTC');
        const xauRow = data.find(r => r.asset === 'XAU');
        if (btcRow) setBtcCommentary(btcRow.commentary);
        if (xauRow) setXauCommentary(xauRow.commentary);
        const latest = data.reduce((a, b) => a.created_at > b.created_at ? a : b);
        setCommentaryTime(new Date(latest.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
        setCommentaryDate(today);
      }
    };
    loadToday();
  }, []);

  // ── Fetch AI Commentary ──
  const fetchCommentary = useCallback(async () => {
    if (commentaryLoading) return;
    if (!btcAI && !goldAI) return;
    setCommentaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-commentary', {
        body: {
          btc: btcAI ? { price: btcPrice, trend: btcAI.trend, support: btcAI.support, resistance: btcAI.resistance, entry: btcAI.entry, target: btcAI.target, stopLoss: btcAI.stopLoss, timeframe: btcTimeframe } : null,
          gold: goldAI ? { price: goldPrice, trend: goldAI.trend, support: goldAI.support, resistance: goldAI.resistance, entry: goldAI.entry, target: goldAI.target, stopLoss: goldAI.stopLoss, timeframe: goldTimeframe } : null,
          dxy: { value: dxy.value, changePercent: dxy.changePercent },
        },
      });
      if (error) throw error;
      if (data.credit_error || data.rate_limited) {
        setCommentaryFailed(true);
      } else {
        setBtcCommentary(data.btc_commentary || '');
        setXauCommentary(data.xau_commentary || '');
        setCommentaryFailed(false);
        setCommentaryDate(data.commentary_date || new Date().toISOString().slice(0, 10));
      }
      setCommentaryTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Commentary error:', e);
      setCommentaryFailed(true);
    } finally {
      setCommentaryLoading(false);
    }
  }, [btcAI, goldAI, btcPrice, goldPrice, dxy.value, dxy.changePercent, btcTimeframe, goldTimeframe, commentaryLoading]);

  // Auto-fetch commentary when AI points are ready & no existing commentary
  useEffect(() => {
    if ((btcAI || goldAI) && !btcCommentary && !xauCommentary && !commentaryLoading && !commentaryFailed) {
      fetchCommentary();
    }
  }, [btcAI, goldAI]);

  // ── Load history ──
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('market_commentaries')
      .select('asset, commentary, commentary_date, created_at')
      .lt('commentary_date', today)
      .order('commentary_date', { ascending: false })
      .limit(20);
    setHistory(data || []);
    setHistoryLoading(false);
  }, []);

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

  // Send signal with chart screenshot
  const handleSendSignal = useCallback(async (symbol: string) => {
    setSendingSignal(symbol);
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    try {
      // Capture chart screenshot
      const chartRef = symbol === 'BTCUSDT' ? btcChartRef : goldChartRef;
      let chartImage: string | null = null;
      if (chartRef.current) {
        try {
          const canvas = await html2canvas(chartRef.current, {
            backgroundColor: '#0b0e11',
            scale: 2,
            useCORS: true,
            logging: false,
          });
          chartImage = canvas.toDataURL('image/png');
        } catch (e) {
          console.warn('Chart capture failed:', e);
        }
      }

      await supabase.functions.invoke('signal-bot', {
        body: {
          mode: 'scan',
          symbols: [symbol],
          timeframe: symbol === 'BTCUSDT' ? btcTimeframe : goldTimeframe,
          chartImage,
        }
      });
      setLogs(prev => [`[${now}] ✅ Signal ${symbol} sent (with chart)`, ...prev].slice(0, 15));
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
      <div className="pt-24 px-2 lg:px-4">
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
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3">

          {/* ── LEFT: Charts + Commentary ── */}
          <div className="space-y-3 min-w-0">
            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

              {/* ── BTC Column ── */}
              <div className="space-y-2 cursor-pointer" onClick={() => navigate('/phan-tich/btc')} title="Nhấp để xem chi tiết BTC/USDT">
                {btcData.loading ? (
                  <div className="flex items-center justify-center h-[360px] bg-[#0d1117] rounded-xl">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground font-mono">Loading BTC/USDT...</span>
                    </div>
                  </div>
                ) : btcData.error ? (
                  <div className="flex items-center justify-center h-[360px] bg-[#0d1117] rounded-xl">
                    <span className="text-destructive text-sm">⚠️ {btcData.error}</span>
                  </div>
                ) : (
                  <TradingChart
                    key={`btc-${btcTimeframe}`}
                    candles={btcData.candles}
                    indicators={btcData.indicators}
                    zones={btcData.zones}
                    trendline={btcTrendlines.support}
                    trendlineResistance={btcTrendlines.resistance}
                    enabledIndicators={ENABLED_INDICATORS}
                    height={280}
                    label="₿ BTC/USDT · Binance"
                    scanning={scanning}
                    scanLabel={scanLabel}
                    timeframe={btcTimeframe}
                    onTimeframeChange={setBtcTimeframe}
                  />
                )}
                <AIActionCard ai={btcAI} symbol="₿ BTC/USDT" />
              </div>

              {/* ── GOLD Column ── */}
              <div className="space-y-2 cursor-pointer" onClick={() => navigate('/phan-tich/xau')} title="Nhấp để xem chi tiết XAU/USD">
                {goldData.loading ? (
                  <div className="flex items-center justify-center h-[360px] bg-[#0d1117] rounded-xl">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground font-mono">Loading XAU/USD...</span>
                    </div>
                  </div>
                ) : goldData.error ? (
                  <div className="flex items-center justify-center h-[360px] bg-[#0d1117] rounded-xl">
                    <span className="text-destructive text-sm">⚠️ {goldData.error}</span>
                  </div>
                ) : (
                  <TradingChart
                    key={`gold-${goldTimeframe}`}
                    candles={goldData.candles}
                    indicators={goldData.indicators}
                    zones={goldData.zones}
                    trendline={goldTrendlines.support}
                    trendlineResistance={goldTrendlines.resistance}
                    enabledIndicators={ENABLED_INDICATORS}
                    height={280}
                    label="🥇 XAU/USD (Gold)"
                    scanning={scanning}
                    scanLabel={scanLabel}
                    timeframe={goldTimeframe}
                    onTimeframeChange={setGoldTimeframe}
                  />
                )}
                <AIActionCard ai={goldAI} symbol="🥇 XAU/USD" isGold />
              </div>
            </div>

            {/* ── AI MARKET COMMENTARY ── */}
            <div className="glass-card rounded-xl p-5 border border-primary/10">
              <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">Nhận Định Thị Trường — AI Gemini</span>
                  {commentaryTime && (
                    <span className="text-[9px] text-muted-foreground/50 font-mono ml-2">cập nhật {commentaryTime}</span>
                  )}
              </div>

              {commentaryLoading && !btcCommentary && !xauCommentary ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[0, 1].map(i => (
                    <div key={i} className="space-y-3 animate-pulse p-3 rounded-lg bg-foreground/[0.02]">
                      <div className="h-3 bg-foreground/5 rounded w-1/3" />
                      <div className="h-3 bg-foreground/5 rounded w-full" />
                      <div className="h-3 bg-foreground/5 rounded w-11/12" />
                      <div className="h-3 bg-foreground/5 rounded w-4/5" />
                    </div>
                  ))}
                </div>
              ) : btcCommentary || xauCommentary ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BTC Column */}
                  <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.03] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">₿</span>
                      <span className="text-xs font-bold text-amber-400 font-mono">BTC/USDT</span>
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {btcCommentary || '⏳ Chưa có dữ liệu...'}
                    </div>
                  </div>
                  {/* XAU Column */}
                  <div className="rounded-lg border border-yellow-500/10 bg-yellow-500/[0.03] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">🥇</span>
                      <span className="text-xs font-bold text-yellow-400 font-mono">XAU/USD</span>
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {xauCommentary || '⏳ Chưa có dữ liệu...'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/40 text-center py-6">
                  ⏳ Đang chờ dữ liệu tín hiệu để viết nhận định...
                </div>
              )}

              {/* History toggle */}
              <div className="mt-4 pt-3 border-t border-foreground/5 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/40">
                  ⚠️ Nhận định bởi AI, chỉ mang tính tham khảo.
                </span>
                <button
                  onClick={() => {
                    setShowHistory(!showHistory);
                    if (!showHistory && history.length === 0) loadHistory();
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                >
                  <History className="w-3 h-3" />
                  {showHistory ? 'Ẩn lịch sử' : 'Xem lịch sử'}
                </button>
              </div>

              {/* History section */}
              {showHistory && (
                <div className="mt-3 space-y-3 max-h-[400px] overflow-y-auto">
                  {historyLoading ? (
                    <div className="text-[10px] text-muted-foreground/40 text-center py-4">Đang tải...</div>
                  ) : history.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground/40 text-center py-4">Chưa có nhận định cũ.</div>
                  ) : (
                    (() => {
                      // Group by date
                      const grouped: Record<string, typeof history> = {};
                      history.forEach(h => {
                        if (!grouped[h.commentary_date]) grouped[h.commentary_date] = [];
                        grouped[h.commentary_date].push(h);
                      });
                      return Object.entries(grouped).map(([date, items]) => (
                        <div key={date} className="rounded-lg border border-foreground/5 p-3">
                          <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 font-mono">
                            📅 {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {items.map((item, i) => (
                              <div key={i} className={`rounded-lg p-3 ${item.asset === 'BTC' ? 'border border-amber-500/10 bg-amber-500/[0.02]' : 'border border-yellow-500/10 bg-yellow-500/[0.02]'}`}>
                                <span className={`text-[10px] font-bold font-mono ${item.asset === 'BTC' ? 'text-amber-400' : 'text-yellow-400'}`}>
                                  {item.asset === 'BTC' ? '₿ BTC' : '🥇 XAU'}
                                </span>
                                <div className="text-[10px] text-muted-foreground/60 leading-relaxed mt-1 whitespace-pre-line">
                                  {item.commentary}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT SIDEBAR: Signal Feed + System Log ── */}
          <div className="space-y-3">
            {/* Signal Feed */}
            <div className="glass-card rounded-xl border border-foreground/5 overflow-hidden">
              <div className="px-3 py-2 border-b border-foreground/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground tracking-wider font-mono">📡 TÍN HIỆU REALTIME</span>
                <span className="text-[9px] text-muted-foreground/50 font-mono">{allSignals.length} tín hiệu</span>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {allSignals.length === 0 ? (
                  <div className="p-4 text-center text-[10px] text-muted-foreground/40">
                    Đang quét tín hiệu...
                  </div>
                ) : (
                  <div className="divide-y divide-foreground/5">
                    {allSignals.map((sig, i) => {
                      const style = SIGNAL_COLORS[sig.type] || SIGNAL_COLORS.info;
                      return (
                        <div key={i} className={`px-3 py-2.5 ${sig.isNew ? 'bg-primary/5' : ''} hover:bg-foreground/[0.02] transition-colors`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${style.dot} ${sig.isNew ? 'animate-pulse' : ''}`} />
                            <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${style.bg} ${style.border} border ${style.text}`}>
                              {style.label}
                            </span>
                            <span className="text-[9px] text-muted-foreground/40 font-mono ml-auto">
                              {sig.symbol?.replace('/USDT', '').replace('/', '')}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 leading-relaxed pl-3.5">
                            {sig.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* DXY Widget */}
            <div className="glass-card rounded-xl p-3 border border-foreground/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground font-mono">💵 DXY Index</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground font-mono">
                    {dxy.loading ? '...' : dxy.value?.toFixed(2)}
                  </span>
                  {!dxy.loading && dxy.changePercent !== null && (
                    <span className={`text-[10px] font-mono ${dxy.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {dxy.changePercent >= 0 ? '+' : ''}{dxy.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* System Log */}
            <div className="glass-card rounded-xl border border-foreground/5 overflow-hidden">
              <div className="px-3 py-2 border-b border-foreground/5">
                <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest font-mono">⚙️ SYSTEM LOG</span>
              </div>
              <div className="px-3 py-2 max-h-[160px] overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <span className="text-[9px] text-muted-foreground/30 font-mono">Chưa có log...</span>
                ) : (
                  logs.slice(0, 8).map((log, i) => (
                    <div key={i} className={`text-[9px] font-mono leading-relaxed ${i === 0 ? 'text-primary/70' : 'text-muted-foreground/50'}`}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="glass-card rounded-xl p-3 border border-foreground/5 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground/60 tracking-wider font-mono">🚀 HÀNH ĐỘNG</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSendSignal('BTCUSDT')}
                  disabled={!!sendingSignal}
                  className="px-2 py-2 rounded-lg text-[10px] font-bold text-amber-400 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all disabled:opacity-50 font-mono"
                >
                  {sendingSignal === 'BTCUSDT' ? '⏳...' : '📤 BTC Signal'}
                </button>
                <button
                  onClick={() => handleSendSignal('XAUUSDT')}
                  disabled={!!sendingSignal}
                  className="px-2 py-2 rounded-lg text-[10px] font-bold text-yellow-400 border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all disabled:opacity-50 font-mono"
                >
                  {sendingSignal === 'XAUUSDT' ? '⏳...' : '📤 XAU Signal'}
                </button>
              </div>
              <button
                onClick={() => setAutoSignal(!autoSignal)}
                className={`w-full px-2 py-2 rounded-lg text-[10px] font-bold font-mono border transition-all ${
                  autoSignal
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-muted-foreground/60 border-foreground/10 hover:bg-foreground/5'
                }`}
              >
                {autoSignal ? '🟢 Auto Scan: ON' : '⚪ Auto Scan: OFF'}
              </button>
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </main>
  );
};

export default Analysis;
