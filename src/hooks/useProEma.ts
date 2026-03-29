import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';

export interface ProEmaPoint {
  time: number;
  value: number;
}

export interface ProEmaCross {
  time: number;
  index: number;
  type: 'golden' | 'death';
  price: number;
}

export interface ProEmaData {
  ema20: ProEmaPoint[];
  ema50: ProEmaPoint[];
  ema100: ProEmaPoint[];
  ema200: ProEmaPoint[];
  crosses: ProEmaCross[];
  ribbon: 'bullish' | 'bearish';
  lastEma20: number;
  lastEma50: number;
  lastEma100: number;
  lastEma200: number;
}

function computeEma(closes: number[], period: number): number[] {
  const result = new Array(closes.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(closes[i])) continue;
    if (isNaN(prev)) {
      // seed with SMA
      if (i >= period - 1) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += closes[j];
        prev = sum / period;
      } else continue;
    } else {
      prev = closes[i] * k + prev * (1 - k);
    }
    result[i] = prev;
  }
  return result;
}

export function useProEma(
  candles: Candle[],
  enabled: boolean,
): ProEmaData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 200) return null;

    const closes = candles.map(c => c.close);
    const e20 = computeEma(closes, 20);
    const e50 = computeEma(closes, 50);
    const e100 = computeEma(closes, 100);
    const e200 = computeEma(closes, 200);

    const ema20: ProEmaPoint[] = [];
    const ema50: ProEmaPoint[] = [];
    const ema100: ProEmaPoint[] = [];
    const ema200: ProEmaPoint[] = [];

    for (let i = 0; i < candles.length; i++) {
      const t = candles[i].time;
      if (!isNaN(e20[i])) ema20.push({ time: t, value: e20[i] });
      if (!isNaN(e50[i])) ema50.push({ time: t, value: e50[i] });
      if (!isNaN(e100[i])) ema100.push({ time: t, value: e100[i] });
      if (!isNaN(e200[i])) ema200.push({ time: t, value: e200[i] });
    }

    // Golden Cross / Death Cross: EMA50 crosses EMA200
    const crosses: ProEmaCross[] = [];
    for (let i = 1; i < candles.length; i++) {
      if (isNaN(e50[i]) || isNaN(e200[i]) || isNaN(e50[i-1]) || isNaN(e200[i-1])) continue;
      
      if (e50[i-1] <= e200[i-1] && e50[i] > e200[i]) {
        crosses.push({ time: candles[i].time, index: i, type: 'golden', price: candles[i].low });
      }
      if (e50[i-1] >= e200[i-1] && e50[i] < e200[i]) {
        crosses.push({ time: candles[i].time, index: i, type: 'death', price: candles[i].high });
      }
    }

    const n = candles.length - 1;
    const ribbon: 'bullish' | 'bearish' = (!isNaN(e50[n]) && !isNaN(e200[n]) && e50[n] > e200[n]) ? 'bullish' : 'bearish';

    return {
      ema20, ema50, ema100, ema200, crosses, ribbon,
      lastEma20: e20[n] ?? 0,
      lastEma50: e50[n] ?? 0,
      lastEma100: e100[n] ?? 0,
      lastEma200: e200[n] ?? 0,
    };
  }, [candles, enabled]);
}
