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

    // Generate signals matching Pine Script logic
    // Pine iterates i=0..len-1 where i=0 is most recent
    // ▼ when src[i] > nwe[i]+sae AND src[i+1] < nwe[i]+sae (cross above upper)
    // ▲ when src[i] < nwe[i]-sae AND src[i+1] > nwe[i]-sae (cross below lower)
    // Sell: after ▼, if src[i-1] < src[i] and src[i-1] between bands
    // Buy: after ▲, if src[i-1] > src[i] and src[i-1] between bands
    const signals: { time: number; price: number; type: 'buy' | 'sell' }[] = [];

    for (let i = 0; i < len - 1; i++) {
      const upperVal = nwe[i] + sae;
      const lowerVal = nwe[i] - sae;

      // Cross above upper band: src[i] > upper AND src[i+1] < upper
      if (src[i] > upperVal && src[i + 1] < (nwe[i + 1] + sae)) {
        // Check sell condition: i > 1, src[i-1] < src[i], src[i-1] between bands
        if (i > 0) {
          const prevUpper = nwe[i - 1] + sae;
          const prevLower = nwe[i - 1] - sae;
          if (src[i - 1] < src[i] && src[i - 1] < prevUpper && src[i - 1] > prevLower) {
            // Pine: label at n-i+2 which is 2 bars after the signal in Pine's reverse indexing
            const candleIdx = n - 1 - i;
            if (candleIdx >= 0 && candleIdx < n) {
              signals.push({
                time: candles[candleIdx].time,
                price: candles[candleIdx].high,
                type: 'sell',
              });
            }
          }
        }
      }

      // Cross below lower band: src[i] < lower AND src[i+1] > lower
      if (src[i] < lowerVal && src[i + 1] > (nwe[i + 1] - sae)) {
        // Check buy condition: i > 1, src[i-1] > src[i], src[i-1] between bands
        if (i > 0) {
          const prevUpper = nwe[i - 1] + sae;
          const prevLower = nwe[i - 1] - sae;
          if (src[i - 1] > src[i] && src[i - 1] < prevUpper && src[i - 1] > prevLower) {
            const candleIdx = n - 1 - i;
            if (candleIdx >= 0 && candleIdx < n) {
              signals.push({
                time: candles[candleIdx].time,
                price: candles[candleIdx].low,
                type: 'buy',
              });
            }
          }
        }
      }
    }

    // Sort signals chronologically
    signals.sort((a, b) => a.time - b.time);

    return { upper, lower, mid, signals };
  }, [candles, enabled, bandwidth, mult]);
}
