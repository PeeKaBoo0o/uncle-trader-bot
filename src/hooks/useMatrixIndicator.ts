import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';

export interface MatrixSignal {
  time: number;
  price: number;
  type: 'buy' | 'sell';
}

export interface MatrixData {
  upper: { time: number; value: number }[];
  lower: { time: number; value: number }[];
  mid: { time: number; value: number }[];
  signals: MatrixSignal[];
}

/**
 * Nadaraya-Watson Envelope — faithful port of Pine Script "Alpha Net Matrix Pro"
 * Repaint mode: full kernel regression computed on last 500 bars.
 */
export function useMatrixIndicator(
  candles: Candle[],
  enabled: boolean,
  bandwidth: number = 8,
  mult: number = 3,
): MatrixData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 30) return null;

    const n = candles.length;
    const len = Math.min(500, n);
    // priceLoseBars[i] = close of (i bars ago from last bar)
    // i=0 is the most recent bar, i=len-1 is oldest
    const src: number[] = [];
    for (let i = 0; i < len; i++) {
      src.push(candles[n - 1 - i].close);
    }

    const gauss = (x: number, h: number) => Math.exp(-(x * x) / (2 * h * h));

    // Compute NWE values for each point using full kernel regression
    const nwe: number[] = new Array(len).fill(0);
    let sae = 0;

    for (let i = 0; i < len; i++) {
      let sum = 0;
      let sumw = 0;
      for (let j = 0; j < len; j++) {
        const w = gauss(i - j, bandwidth);
        sum += src[j] * w;
        sumw += w;
      }
      nwe[i] = sum / sumw;
      sae += Math.abs(src[i] - nwe[i]);
    }

    // SAE envelope width
    sae = (sae / (len - 1)) * mult;

    // Build series data (reverse back to chronological order)
    const upper: { time: number; value: number }[] = [];
    const lower: { time: number; value: number }[] = [];
    const mid: { time: number; value: number }[] = [];

    for (let i = len - 1; i >= 0; i--) {
      const candleIdx = n - 1 - i;
      const t = candles[candleIdx].time;
      mid.push({ time: t, value: nwe[i] });
      upper.push({ time: t, value: nwe[i] + sae });
      lower.push({ time: t, value: nwe[i] - sae });
    }

    // ── Generate Buy/Sell signals matching Pine Script stateful logic ──
    // Pine uses non-repaint plotshape approach:
    // 1. Track crossover(close, upper) → crossPrice = close, crossDirection = "above"
    // 2. Track crossunder(close, lower) → crossPrice = close, crossDirection = "below"
    // 3. condSell = crossDirection=="above" && close < crossPrice && close < upper && close > lower
    // 4. condBuy  = crossDirection=="below" && close > crossPrice && close > lower && close < upper
    // 5. Plot on NEXT bar [1], then reset crossPrice/crossDirection
    //
    // We iterate chronologically (oldest → newest) to maintain state.
    const signals: MatrixSignal[] = [];

    // Build lookup: candleIdx → { upperVal, lowerVal }
    // mid/upper/lower arrays are chronological and correspond to the last `len` candles
    const startIdx = n - len; // candle index where NWE data starts

    let crossPrice: number | null = null;
    let crossDirection: string | null = null;

    for (let k = 0; k < len; k++) {
      const ci = startIdx + k; // candle index
      const close = candles[ci].close;
      const prevClose = k > 0 ? candles[ci - 1].close : null;
      const upperVal = nwe[len - 1 - k] + sae;
      const lowerVal = nwe[len - 1 - k] - sae;

      // Previous bar's upper/lower for crossover detection
      let prevUpper: number | null = null;
      let prevLower: number | null = null;
      if (k > 0) {
        prevUpper = nwe[len - k] + sae;
        prevLower = nwe[len - k] - sae;
      }

      // Detect crossover(close, upper): close > upper AND prevClose <= prevUpper
      const crossOverUpper = prevClose !== null && prevUpper !== null &&
        close > upperVal && prevClose <= prevUpper;
      // Detect crossunder(close, lower): close < lower AND prevClose >= prevLower
      const crossUnderLower = prevClose !== null && prevLower !== null &&
        close < lowerVal && prevClose >= prevLower;

      if (crossOverUpper) {
        crossPrice = close;
        crossDirection = 'above';
      } else if (crossUnderLower) {
        crossPrice = close;
        crossDirection = 'below';
      }

      // Compute conditions
      const condSell = crossPrice !== null && crossDirection === 'above' &&
        close < crossPrice && close < upperVal && close > lowerVal;
      const condBuy = crossPrice !== null && crossDirection === 'below' &&
        close > crossPrice && close > lowerVal && close < upperVal;

      // Pine plots condSell[1] / condBuy[1] → signal appears on NEXT bar
      // We store the condition and emit on the next iteration
      if (k > 0) {
        const prevCi = ci - 1;
        const prevCondSell = (() => {
          // We need previous bar's condition. Recompute inline for accuracy.
          const pc = candles[prevCi].close;
          const pu = nwe[len - k] + sae;
          const pl = nwe[len - k] - sae;
          // crossPrice/crossDirection at that point... This is tricky.
          // Instead, let's use a stored approach below.
          return false;
        })();
      }
    }

    // Cleaner approach: two-pass. First compute conditions, then shift by 1.
    const conditions: { sell: boolean; buy: boolean }[] = new Array(len).fill(null).map(() => ({ sell: false, buy: false }));

    crossPrice = null;
    crossDirection = null;

    for (let k = 0; k < len; k++) {
      const ci = startIdx + k;
      const close = candles[ci].close;
      const nweIdx = len - 1 - k; // index into nwe array (reversed)
      const upperVal = nwe[nweIdx] + sae;
      const lowerVal = nwe[nweIdx] - sae;

      // Crossover/crossunder detection
      if (k > 0) {
        const prevClose = candles[ci - 1].close;
        const prevUpper = nwe[nweIdx + 1] + sae;
        const prevLower = nwe[nweIdx + 1] - sae;

        if (close > upperVal && prevClose <= prevUpper) {
          crossPrice = close;
          crossDirection = 'above';
        } else if (close < lowerVal && prevClose >= prevLower) {
          crossPrice = close;
          crossDirection = 'below';
        }
      }

      conditions[k].sell = crossPrice !== null && crossDirection === 'above' &&
        close < crossPrice && close < upperVal && close > lowerVal;
      conditions[k].buy = crossPrice !== null && crossDirection === 'below' &&
        close > crossPrice && close > lowerVal && close < upperVal;

      // Reset after signal
      if (conditions[k].sell || conditions[k].buy) {
        crossPrice = null;
        crossDirection = null;
      }
    }

    // Apply [1] shift: signal on bar k uses condition from bar k-1
    for (let k = 1; k < len; k++) {
      const ci = startIdx + k;
      if (conditions[k - 1].sell) {
        signals.push({
          time: candles[ci].time,
          price: candles[ci].high,
          type: 'sell',
        });
      }
      if (conditions[k - 1].buy) {
        signals.push({
          time: candles[ci].time,
          price: candles[ci].low,
          type: 'buy',
        });
      }
    }

    return { upper, lower, mid, signals };
  }, [candles, enabled, bandwidth, mult]);
}
