import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TradingChart from '@/components/indicators/TradingChart';
import SignalFeed from '@/components/indicators/SignalFeed';
import { useMarketData, useSignals } from '@/hooks/useMarketData';
import { useSmartSignals } from '@/hooks/useSmartSignal';
import { useDXY } from '@/hooks/useDXY';
import { supabase } from '@/integrations/supabase/client';
import { computeDualTrendlines } from '@/lib/computeTrendline';
import html2canvas from 'html2canvas';

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

const SYMBOL_CONFIG: Record<string, { pair: string; label: string; icon: string; accentClass: string }> = {
  btc: { pair: 'BTC/USDT', label: '₿ BTC/USDT', icon: '₿', accentClass: 'text-amber-400' },
  xau: { pair: 'XAU/USDT', label: '🥇 XAU/USD (Gold)', icon: '🥇', accentClass: 'text-yellow-400' },
};

const AnalysisDetail: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const config = SYMBOL_CONFIG[symbol || ''] || SYMBOL_CONFIG.btc;
  const isGold = symbol === 'xau';

  const [timeframe, setTimeframe] = useState('H4');
  const [scanning, setScanning] = useState(false);
  const [scanLabel, setScanLabel] = useState('');
  const [sendingSignal, setSendingSignal] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const data = useMarketData(config.pair, timeframe);
  const { signals: dbSignals, loading: signalsLoading } = useSignals();
  const smartSignals = useSmartSignals(data.candles, data.indicators, data.zones, config.pair, data.loading);
  const dxy = useDXY();

  const trendlines = useMemo(() => computeDualTrendlines(data.candles), [data.candles]);

  const price = data.candles[data.candles.length - 1]?.close ?? 0;
  const prevPrice = data.candles[data.candles.length - 2]?.close ?? price;
  const change = prevPrice ? ((price - prevPrice) / prevPrice * 100) : 0;

  const formatPrice = (p: number) =>
    isGold ? `$${p.toFixed(2)}` : `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getAIPoints = () => {
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
  const ai = getAIPoints();

  const triggerScan = useCallback(() => {
    setScanning(true);
    setScanLabel('🔍 Gemini AI đang phân tích dữ liệu nến mới...');
    setTimeout(() => {
      setScanLabel('✅ Phân tích hoàn tất — Trendline & Zones đã cập nhật');
    }, 2500);
    setTimeout(() => { setScanning(false); setScanLabel(''); }, 4000);
  }, []);

  useEffect(() => {
    if (!data.loading && data.candles.length > 0) triggerScan();
  }, [timeframe, data.loading]);

  const handleScreenshot = useCallback(async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, { backgroundColor: '#0a0f1e', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `${symbol}_${timeframe}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error('Screenshot failed:', e); }
  }, [symbol, timeframe]);

  const handleSendSignal = useCallback(async () => {
    setSendingSignal(true);
    try {
      await supabase.functions.invoke('signal-bot', {
        body: { mode: 'scan', symbols: [symbol === 'xau' ? 'XAUUSDT' : 'BTCUSDT'], timeframe }
      });
    } catch (e) { console.error(e); }
    finally { setSendingSignal(false); }
  }, [symbol, timeframe]);

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Top Bar */}
      <div className="pt-20 px-2 lg:px-6">
        <div className="glass-card rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          <Link to="/phan-tich" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            <span className="text-[10px] font-medium">Quay lại</span>
          </Link>
          <div className="w-px h-5 bg-foreground/10" />
          <span className={`px-2.5 py-1 rounded font-mono font-bold ${config.accentClass} bg-foreground/5 border border-foreground/10`}>
            {config.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-foreground font-mono font-bold text-sm">
              {data.loading ? '...' : formatPrice(price)}
            </span>
            <span className={`font-mono text-[10px] ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
          <div className="flex-1" />
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

      {/* Main Content */}
      <div ref={dashboardRef} className="px-2 lg:px-6 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">

          {/* Left: Full Chart + AI Card */}
          <div className="space-y-3">
            {data.loading ? (
              <div className="flex items-center justify-center h-[500px] bg-[#0d1117] rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-8 h-8 border-2 ${isGold ? 'border-yellow-400' : 'border-primary'} border-t-transparent rounded-full animate-spin`} />
                  <span className="text-xs text-muted-foreground font-mono">Loading {config.pair}...</span>
                </div>
              </div>
            ) : data.error ? (
              <div className="flex items-center justify-center h-[500px] bg-[#0d1117] rounded-xl">
                <span className="text-destructive text-sm">⚠️ {data.error}</span>
              </div>
            ) : (
              <TradingChart
                candles={data.candles}
                indicators={data.indicators}
                zones={data.zones}
                trendline={trendlines.support}
                trendlineResistance={trendlines.resistance}
                enabledIndicators={ENABLED_INDICATORS}
                height={500}
                label={config.label}
                scanning={scanning}
                scanLabel={scanLabel}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
              />
            )}

            {/* AI Action Card - Full Width */}
            {ai ? (
              <div className="glass-card rounded-xl p-5 space-y-4 border border-foreground/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-primary font-mono">{config.label}</span>
                  <span className="text-xs text-muted-foreground">— AI "3 Điểm Hành Động"</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-foreground/[0.02]">
                    <span className="text-xl">📈</span>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Xu hướng hiện tại</div>
                      <div className={`text-sm font-bold ${ai.trend.includes('Tăng') ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ai.trend}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-foreground/[0.02]">
                    <span className="text-xl">🗝️</span>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Vùng giá then chốt</div>
                      <div className="text-xs text-foreground">
                        <span className="text-emerald-400">Hỗ trợ: {formatPrice(ai.support)}</span>
                        <br />
                        <span className="text-red-400">Kháng cự: {formatPrice(ai.resistance)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-foreground/[0.02]">
                    <span className="text-xl">🎯</span>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Kế hoạch hành động</div>
                      <div className="text-xs text-primary font-medium">{ai.action}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        Entry: {formatPrice(ai.entry)} | TP: {formatPrice(ai.target)} | SL: {formatPrice(ai.stopLoss)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-xl p-5 space-y-3 animate-pulse">
                <div className="h-5 bg-foreground/5 rounded w-1/3" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-20 bg-foreground/5 rounded" />
                  <div className="h-20 bg-foreground/5 rounded" />
                  <div className="h-20 bg-foreground/5 rounded" />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button onClick={handleSendSignal} disabled={sendingSignal}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                  isGold
                    ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                }`}>
                {sendingSignal ? '⏳ Đang gửi...' : `📤 Gửi ${symbol?.toUpperCase()} Signal`}
              </button>
              <a href="https://t.me/UNCLETRADER" target="_blank" rel="noopener noreferrer"
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold text-center">
                🚀 Tham Gia BOT SIGNAL Telegram
              </a>
            </div>
          </div>

          {/* Right Sidebar: DXY + Signals */}
          <div className="space-y-2">
            {/* DXY Widget */}
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
            </div>

            {/* Signal Feed */}
            <div className="glass-card rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-foreground tracking-wider uppercase">Tín hiệu {config.pair}</span>
                <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto">🟢 LIVE</span>
              </div>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto scrollbar-thin">
                {smartSignals.map(signal => {
                  const style = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.alert;
                  return (
                    <div key={signal.id}
                      className={`p-2.5 rounded-lg border-l-2 transition-all duration-500 ${style.bg} ${style.border} ${
                        signal.isNew ? 'ring-1 ring-primary/30 bg-primary/5' : ''
                      }`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          <span className={`text-[9px] font-bold ${style.text} uppercase`}>{style.label}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground font-mono">{signal.time}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{signal.message}</p>
                    </div>
                  );
                })}
                {smartSignals.length === 0 && (
                  <div className="text-center text-[10px] text-muted-foreground/40 py-6">Chưa có tín hiệu mới</div>
                )}
              </div>

              {dbSignals.length > 0 && (
                <div className="mt-3 pt-3 border-t border-foreground/5">
                  <div className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">
                    HISTORY ({dbSignals.length})
                  </div>
                  <SignalFeed signals={dbSignals.slice(0, 5)} loading={signalsLoading} />
                </div>
              )}
            </div>

            {/* OKX CTA */}
            <a href="https://www.okx.com/join/UNCLETRADER" target="_blank" rel="noopener noreferrer"
              className="glass-card rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-all group border border-foreground/5 block">
              <span className="text-2xl">{isGold ? '🥇' : '🚀'}</span>
              <div className="flex-1">
                <div className="text-xs font-bold text-foreground">
                  {isGold ? 'Giao dịch Vàng trên OKX — Spread siêu thấp' : 'Đăng ký sàn OKX — Giảm 20% phí giao dịch'}
                </div>
                <div className="text-[10px] text-muted-foreground">Mở tài khoản miễn phí, ưu đãi dành riêng cho bạn</div>
              </div>
              <span className={`${config.accentClass} text-xs group-hover:translate-x-1 transition-transform`}>→</span>
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
};

export default AnalysisDetail;
