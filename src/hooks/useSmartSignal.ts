import { useState, useEffect, useRef, useCallback } from 'react';
import type { Candle, Indicators, Zone } from '@/hooks/useMarketData';

export interface SmartSignal {
  id: string;
  time: string;
  message: string;
  type: 'buy' | 'sell' | 'alert' | 'info' | 'breakout' | 'support_touch' | 'volume_anomaly';
  symbol: string;
  badge: string;
  isNew?: boolean;
}

const SIGNAL_MESSAGES: Record<string, { badge: string; type: SmartSignal['type'] }> = {
  volume_anomaly: { badge: 'VOLUME', type: 'volume_anomaly' },
  breakout: { badge: 'BREAKOUT', type: 'breakout' },
  support_touch: { badge: 'HỖ TRỢ', type: 'support_touch' },
  bb_squeeze: { badge: 'BB SQUEEZE', type: 'alert' },
  bb_breakout: { badge: 'BB BREAK', type: 'buy' },
  bb_oversold: { badge: 'VIP SIGNAL', type: 'buy' },
  momentum: { badge: 'MOMENTUM', type: 'alert' },
  volume_spike: { badge: 'VOL SPIKE', type: 'volume_anomaly' },
  rsi_divergence: { badge: 'RSI DIV', type: 'alert' },
  support_bounce: { badge: 'BOUNCE', type: 'buy' },
};

function generateSignal(
  candles: Candle[],
  indicators: Indicators | null,
  zones: Zone[],
  symbol: string,
): SmartSignal | null {
  if (!candles.length || !indicators) return null;

  const n = candles.length - 1;
  const curr = candles[n];
  const prev = candles[n - 1];
  if (!curr || !prev) return null;

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const volAvg10 = volumes.slice(Math.max(0, n - 9), n + 1).reduce((a, b) => a + b, 0) / Math.min(10, n + 1);
  const volRatio = volAvg10 > 0 ? curr.volume / volAvg10 : 1;
  const rsiVal = indicators.rsi[n];
  const bbUpper = indicators.bb.upper[n];
  const bbLower = indicators.bb.lower[n];
  const bbWidth = indicators.bb.bandwidth[n];
  const prevBbWidth = indicators.bb.bandwidth[n - 1];
  const supportZones = zones.filter(z => z.type === 'support');
  const resistanceZones = zones.filter(z => z.type === 'resistance');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const sym = symbol.replace('/USDT', '').replace('/', '');

  const conditions: { key: string; msg: string }[] = [];

  // 1. Volume Anomaly
  if (volRatio > 2) {
    conditions.push({ key: 'volume_anomaly', msg: `Volume ${sym} tăng ${(volRatio * 100).toFixed(0)}% so với trung bình — dấu hiệu bất thường` });
  }

  // 2. Breakout
  if (resistanceZones.some(z => prev.close < z.top && curr.close > z.top)) {
    conditions.push({ key: 'breakout', msg: `${sym} breakout khỏi vùng kháng cự — momentum tăng mạnh` });
  }

  // 3. Support Touch
  if (supportZones.some(z => Math.abs(curr.close - (z.top + z.bottom) / 2) / curr.close < 0.005)) {
    conditions.push({ key: 'support_touch', msg: `${sym} chạm vùng hỗ trợ AI — theo dõi phản ứng giá` });
  }

  // 4. BB Squeeze
  if (bbWidth && prevBbWidth && bbWidth < prevBbWidth * 0.92) {
    conditions.push({ key: 'bb_squeeze', msg: `BB Squeeze trên ${sym} — BB width giảm ${((1 - bbWidth / prevBbWidth) * 100).toFixed(1)}%` });
  }

  // 5. BB Breakout
  if (bbUpper && curr.close > bbUpper) {
    conditions.push({ key: 'bb_breakout', msg: `${sym} phá vỡ BB Upper — tín hiệu breakout mạnh` });
  }

  // 6. BB Oversold + Support
  if (bbLower && curr.close <= bbLower && supportZones.some(z => curr.close >= z.bottom && curr.close <= z.top)) {
    conditions.push({ key: 'bb_oversold', msg: `🔥 VIP: ${sym} chạm BB Lower + vùng hỗ trợ AI — cơ hội mua cực tốt` });
  }

  // 7. Momentum
  const twoBack = candles[n - 2];
  if (twoBack) {
    const pct = ((curr.close - twoBack.close) / twoBack.close) * 100;
    const threshold = sym === 'XAU' ? 0.8 : 1.5;
    if (Math.abs(pct) > threshold) {
      conditions.push({ key: 'momentum', msg: `${sym} ${pct > 0 ? 'tăng' : 'giảm'} ${Math.abs(pct).toFixed(2)}% trong 2 nến — momentum ${pct > 0 ? 'mạnh' : 'yếu'}` });
    }
  }

  // 8. Volume Spike + direction
  if (volRatio > 1.5 && Math.abs(curr.close - curr.open) / curr.open > 0.002) {
    const dir = curr.close > curr.open ? 'tăng' : 'giảm';
    conditions.push({ key: 'volume_spike', msg: `Volume spike ${sym} (${(volRatio * 100).toFixed(0)}%) + nến ${dir} — xác nhận xu hướng` });
  }

  // 9. RSI Divergence
  if (rsiVal && rsiVal > 60 && curr.close > prev.close && rsiVal < (indicators.rsi[n - 1] || 50)) {
    conditions.push({ key: 'rsi_divergence', msg: `RSI divergence bearish trên ${sym} — giá tăng nhưng RSI giảm` });
  }
  if (rsiVal && rsiVal < 40 && curr.close < prev.close && rsiVal > (indicators.rsi[n - 1] || 50)) {
    conditions.push({ key: 'rsi_divergence', msg: `RSI divergence bullish trên ${sym} — giá giảm nhưng RSI tăng` });
  }

  // 10. Support Bounce
  if (supportZones.some(z => prev.low >= z.bottom * 0.998 && prev.low <= z.top * 1.002) &&
      curr.close > prev.close && curr.close > curr.open) {
    conditions.push({ key: 'support_bounce', msg: `${sym} bounce từ hỗ trợ AI — nến đảo chiều tăng` });
  }

  if (conditions.length === 0) return null;

  // Pick random condition from pool
  const picked = conditions[Math.floor(Math.random() * conditions.length)];
  const meta = SIGNAL_MESSAGES[picked.key] || { badge: 'ALERT', type: 'alert' as const };

  return {
    id: `smart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: timeStr,
    message: picked.msg,
    type: meta.type,
    symbol: sym,
    badge: meta.badge,
    isNew: true,
  };
}

const INITIAL_SIGNALS: SmartSignal[] = [
  { id: 'init-1', time: '06:42', message: 'BTC breakout khỏi vùng kháng cự 68,000 — momentum tăng mạnh', type: 'breakout', symbol: 'BTC', badge: 'BREAKOUT' },
  { id: 'init-2', time: '06:15', message: 'XAU/USD chạm vùng hỗ trợ 2,290 — theo dõi phản ứng giá', type: 'support_touch', symbol: 'GOLD', badge: 'HỖ TRỢ' },
  { id: 'init-3', time: '05:58', message: 'Volume BTC tăng 340% so với trung bình — dấu hiệu bất thường', type: 'volume_anomaly', symbol: 'BTC', badge: 'VOLUME' },
  { id: 'init-4', time: '05:30', message: 'BTC phá vỡ vùng tích lũy 67.5k–68k với volume lớn', type: 'breakout', symbol: 'BTC', badge: 'BREAKOUT' },
  { id: 'init-5', time: '04:45', message: 'ETH tăng 5.2% — breakout trên EMA 200', type: 'buy', symbol: 'ETH', badge: 'MUA' },
  { id: 'init-6', time: '04:12', message: 'Vàng rebound từ hỗ trợ 2,290 — nến đảo chiều tăng H4', type: 'support_touch', symbol: 'GOLD', badge: 'HỖ TRỢ' },
  { id: 'init-7', time: '03:55', message: 'Volume XAU/USD tăng đột biến 280% — theo dõi breakout', type: 'volume_anomaly', symbol: 'GOLD', badge: 'VOLUME' },
];

export function useSmartSignals(
  candles: Candle[],
  indicators: Indicators | null,
  zones: Zone[],
  symbol: string,
  loading: boolean,
) {
  const [signals, setSignals] = useState<SmartSignal[]>(INITIAL_SIGNALS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback(() => {
    if (loading || !candles.length) return;
    const signal = generateSignal(candles, indicators, zones, symbol);
    if (signal) {
      setSignals(prev => {
        const updated = [signal, ...prev.map(s => ({ ...s, isNew: false }))].slice(0, 20);
        return updated;
      });
      // Remove "new" highlight after 2.5s
      setTimeout(() => {
        setSignals(prev => prev.map(s => s.id === signal.id ? { ...s, isNew: false } : s));
      }, 2500);
    }
  }, [candles, indicators, zones, symbol, loading]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(generate, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [generate]);

  return signals;
}
