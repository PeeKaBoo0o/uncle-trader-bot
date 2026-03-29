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

/** Per-bar data for rendering continuous SL/TP/Entry lines */
export interface TpSlBarData {
  time: number;
  longStop: number | null;
  longTake: number | null;
  longEntry: number | null;
  shortStop: number | null;
  shortTake: number | null;
  shortEntry: number | null;
}

export interface TpSlData {
  trades: TpSlTrade[];
  /** Per-bar line data for rendering (matches Pine Script plot behavior) */
  barData: TpSlBarData[];
  stats: {
    totalEntries: number;
    tpCount: number;
    slCount: number;
    winrate: number;
  };
  activeTrade: TpSlTrade | null;
}

/**
 * TP/SL indicator — exact port of Pine Script
 * "Alpha Net Stop Loss & Take Profit % (v5)" by theCrypster 2020
 *
 * Uses EMA 5/32 crossover for signals, fixed % SL and TP.
 * Matches Pine bar-by-bar evaluation including valuewhen and barssince logic.
 */
export function useTpSlIndicator(
  candles: Candle[],
  enabled: boolean,
  slPercent: number = 3.0,
  tpPercent: number = 3.0,
): TpSlData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 35) return null;

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const n = closes.length;
    const stopPer = slPercent / 100;
    const takePer = tpPercent / 100;

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

    // Pine-style state variables
    let longShort = 0; // 1=long, -1=short, 0=flat
    let longPrice = NaN;  // valuewhen(long_last, close)
    let shortPrice = NaN; // valuewhen(short_last, close)
    let barsSinceLong = Infinity;
    let barsSinceShort = Infinity;

    const trades: TpSlTrade[] = [];
    const barData: TpSlBarData[] = [];

    for (let i = 0; i < n; i++) {
      // Default bar data
      const bar: TpSlBarData = {
        time: candles[i].time,
        longStop: null, longTake: null, longEntry: null,
        shortStop: null, shortTake: null, shortEntry: null,
      };

      if (i < 1 || isNaN(ema5[i]) || isNaN(ema32[i]) || isNaN(ema5[i - 1]) || isNaN(ema32[i - 1])) {
        barData.push(bar);
        continue;
      }

      const crossover = ema5[i] > ema32[i] && ema5[i - 1] <= ema32[i - 1];
      const crossunder = ema5[i] < ema32[i] && ema5[i - 1] >= ema32[i - 1];

      // Pine: long_last / short_last use long_short[1] (previous bar value)
      const prevLS = longShort;
      const longLast = crossover && (prevLS === 0 || prevLS === -1);
      const shortLast = crossunder && (prevLS === 0 || prevLS === 1);

      // Update long_short (first pass — entry signals)
      if (longLast) {
        longShort = 1;
        longPrice = closes[i];
        barsSinceLong = 0;
      } else if (shortLast) {
        longShort = -1;
        shortPrice = closes[i];
        barsSinceShort = 0;
      } else {
        // Increment barsSince counters
        if (barsSinceLong < Infinity) barsSinceLong++;
        if (barsSinceShort < Infinity) barsSinceShort++;
      }

      // Compute SL/TP prices
      const longStop = longPrice * (1 - stopPer);
      const shortStop = shortPrice * (1 + stopPer);
      const longTake = longPrice * (1 + takePer);
      const shortTake = shortPrice * (1 - takePer);

      // Pine: longBar2 = barssince(long_last) >= 1 (skip entry bar)
      const longBar2 = barsSinceLong >= 1;
      const shortBar2 = barsSinceShort >= 1;

      // Check SL/TP hits
      const longSLhit = longShort === 1 && longBar2 && lows[i] < longStop;
      const shortSLhit = longShort === -1 && shortBar2 && highs[i] > shortStop;
      const longTPhit = longShort === 1 && longBar2 && highs[i] > longTake;
      const shortTPhit = longShort === -1 && shortBar2 && lows[i] < shortTake;

      // Record entry trades
      if (longLast) {
        trades.push({
          type: 'long', entryIndex: i, entryTime: candles[i].time,
          entryPrice: closes[i], slPrice: longStop, tpPrice: longTake, result: 'open',
        });
      } else if (shortLast) {
        trades.push({
          type: 'short', entryIndex: i, entryTime: candles[i].time,
          entryPrice: closes[i], slPrice: shortStop, tpPrice: shortTake, result: 'open',
        });
      }

      // Record TP/SL hits on open trades
      if (longTPhit || longSLhit || shortTPhit || shortSLhit) {
        const lastTrade = trades.length > 0 ? trades[trades.length - 1] : null;
        if (lastTrade && lastTrade.result === 'open') {
          if (longTPhit || shortTPhit) {
            lastTrade.result = 'TP';
            lastTrade.exitIndex = i;
            lastTrade.exitTime = candles[i].time;
          } else {
            lastTrade.result = 'SL';
            lastTrade.exitIndex = i;
            lastTrade.exitTime = candles[i].time;
          }
        }
      }

      // Set bar data for lines BEFORE resetting long_short
      if (longShort === 1 && !isNaN(longPrice)) {
        bar.longStop = longStop;
        bar.longTake = longTake;
        bar.longEntry = longPrice;
      }
      if (longShort === -1 && !isNaN(shortPrice)) {
        bar.shortStop = shortStop;
        bar.shortTake = shortTake;
        bar.shortEntry = shortPrice;
      }

      // Pine: reset long_short to 0 if SL or TP hit
      if ((longShort === 1 || longShort === 0) && longBar2 && (longSLhit || longTPhit)) {
        longShort = 0;
      }
      if ((longShort === -1 || longShort === 0) && shortBar2 && (shortSLhit || shortTPhit)) {
        longShort = 0;
      }

      barData.push(bar);
    }

    const tpCount = trades.filter(t => t.result === 'TP').length;
    const slCount = trades.filter(t => t.result === 'SL').length;
    const total = tpCount + slCount;

    return {
      trades,
      barData,
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
