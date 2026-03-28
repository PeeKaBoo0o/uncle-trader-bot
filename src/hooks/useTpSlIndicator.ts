import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';

export interface TpSlTrade {
  type: 'long' | 'short';
  entryIndex: number;
  entryTime: number;
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  result: 'TP' | 'SL' | 'open';
  exitIndex?: number;
  exitTime?: number;
}

export interface TpSlData {
  trades: TpSlTrade[];
  stats: {
    totalEntries: number;
    tpCount: number;
    slCount: number;
    winrate: number;
  };
  /** Current active trade (if any) for drawing SL/TP zones */
  activeTrade: TpSlTrade | null;
}

/**
 * TP/SL indicator ported from Pine Script "Alpha Net Stop Loss & Take Profit %"
 * Uses EMA 5/32 crossover for signals, fixed % SL and TP.
 */
export function useTpSlIndicator(
  candles: Candle[],
  enabled: boolean,
  slPercent: number = 3.0,
  tpPercent: number = 9.0,
): TpSlData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 35) return null;

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const n = closes.length;
    const slFrac = slPercent / 100;
    const tpFrac = tpPercent / 100;

    // Compute EMA
    const ema = (data: number[], period: number): number[] => {
      const result: number[] = new Array(n).fill(NaN);
      if (n === 0) return result;
      result[0] = data[0];
      const k = 2 / (period + 1);
      for (let i = 1; i < n; i++) {
        result[i] = data[i] * k + result[i - 1] * (1 - k);
      }
      return result;
    };

    const ema5 = ema(closes, 5);
    const ema32 = ema(closes, 32);

    const trades: TpSlTrade[] = [];
    let longShort = 0; // 1=long, -1=short, 0=flat

    for (let i = 1; i < n; i++) {
      if (isNaN(ema5[i]) || isNaN(ema32[i]) || isNaN(ema5[i - 1]) || isNaN(ema32[i - 1])) continue;

      const crossover = ema5[i] > ema32[i] && ema5[i - 1] <= ema32[i - 1];
      const crossunder = ema5[i] < ema32[i] && ema5[i - 1] >= ema32[i - 1];

      const longLast = crossover && (longShort === 0 || longShort === -1);
      const shortLast = crossunder && (longShort === 0 || longShort === 1);

      if (longLast) {
        longShort = 1;
        trades.push({
          type: 'long',
          entryIndex: i,
          entryTime: candles[i].time,
          entryPrice: closes[i],
          slPrice: closes[i] * (1 - slFrac),
          tpPrice: closes[i] * (1 + tpFrac),
          result: 'open',
        });
      } else if (shortLast) {
        longShort = -1;
        trades.push({
          type: 'short',
          entryIndex: i,
          entryTime: candles[i].time,
          entryPrice: closes[i],
          slPrice: closes[i] * (1 + slFrac),
          tpPrice: closes[i] * (1 - tpFrac),
          result: 'open',
        });
      }

      // Check SL/TP hits for current open trade
      const lastTrade = trades.length > 0 ? trades[trades.length - 1] : null;
      if (lastTrade && lastTrade.result === 'open' && i > lastTrade.entryIndex) {
        if (lastTrade.type === 'long') {
          const slHit = lows[i] <= lastTrade.slPrice;
          const tpHit = highs[i] >= lastTrade.tpPrice;
          // Pessimistic: if both hit on same candle, count as SL
          if (slHit) {
            lastTrade.result = 'SL';
            lastTrade.exitIndex = i;
            lastTrade.exitTime = candles[i].time;
            longShort = 0;
          } else if (tpHit) {
            lastTrade.result = 'TP';
            lastTrade.exitIndex = i;
            lastTrade.exitTime = candles[i].time;
            longShort = 0;
          }
        } else {
          const slHit = highs[i] >= lastTrade.slPrice;
          const tpHit = lows[i] <= lastTrade.tpPrice;
          // Pessimistic: if both hit on same candle, count as SL
          if (slHit) {
            lastTrade.result = 'SL';
            lastTrade.exitIndex = i;
            lastTrade.exitTime = candles[i].time;
            longShort = 0;
          } else if (tpHit) {
            lastTrade.result = 'TP';
            lastTrade.exitIndex = i;
            lastTrade.exitTime = candles[i].time;
            longShort = 0;
          }
        }
      }
    }

    const tpCount = trades.filter(t => t.result === 'TP').length;
    const slCount = trades.filter(t => t.result === 'SL').length;
    const total = tpCount + slCount;

    return {
      trades,
      stats: {
        totalEntries: trades.length,
        tpCount,
        slCount,
        winrate: total > 0 ? (tpCount / total) * 100 : 0,
      },
      activeTrade: trades.length > 0 && trades[trades.length - 1].result === 'open'
        ? trades[trades.length - 1]
        : null,
    };
  }, [candles, enabled, slPercent, tpPercent]);
}
