import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';

export interface MatrixData {
  upper: { time: number; value: number }[];
  lower: { time: number; value: number }[];
  mid: { time: number; value: number }[];
  signals: { time: number; price: number; type: 'buy' | 'sell' }[];
}

/**
 * Nadaraya-Watson Envelope (NWE) — ported from Pine Script "Alpha Net Matrix Pro"
 * Uses Gaussian kernel regression with bandwidth h, then MAE * mult for envelope.
 */
export function useMatrixIndicator(
  candles: Candle[],
  enabled: boolean,
  bandwidth: number = 8,
  mult: number = 3,
): MatrixData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 30) return null;

    const closes = candles.map(c => c.close);
    const n = closes.length;
    const lookback = Math.min(499, n - 1);

    // Gaussian window function
    const gauss = (x: number, h: number) => Math.exp(-(x * x) / (2 * h * h));

    // Precompute coefficients for non-repaint endpoint method
    const coefs: number[] = [];
    let den = 0;
    for (let i = 0; i <= lookback; i++) {
      const w = gauss(i, bandwidth);
      coefs.push(w);
      den += w;
    }

    // Compute NWE (smoothed) values and upper/lower bands for each bar
    const midValues: number[] = new Array(n).fill(NaN);
    const upperValues: number[] = new Array(n).fill(NaN);
    const lowerValues: number[] = new Array(n).fill(NaN);

    // For each bar, compute the endpoint NWE
    for (let bar = lookback; bar < n; bar++) {
      let out = 0;
      for (let i = 0; i <= lookback; i++) {
        out += closes[bar - i] * coefs[i];
      }
      out /= den;

      // MAE = SMA of |close - out| over lookback window
      let maeSum = 0;
      let maeCount = 0;
      for (let i = 0; i <= lookback && (bar - i) >= 0; i++) {
        // For the MAE, we re-compute NWE at each offset (simplified: use same out as approx)
        let localOut = 0;
        let localDen = 0;
        for (let j = 0; j <= Math.min(lookback, bar - i); j++) {
          const idx = bar - i - j;
          if (idx < 0) break;
          localOut += closes[idx] * coefs[j];
          localDen += coefs[j];
        }
        if (localDen > 0) {
          localOut /= localDen;
          maeSum += Math.abs(closes[bar - i] - localOut);
          maeCount++;
        }
      }
      const mae = maeCount > 0 ? (maeSum / maeCount) * mult : 0;

      midValues[bar] = out;
      upperValues[bar] = out + mae;
      lowerValues[bar] = out - mae;
    }

    // Build series data
    const upper: { time: number; value: number }[] = [];
    const lower: { time: number; value: number }[] = [];
    const mid: { time: number; value: number }[] = [];

    for (let i = 0; i < n; i++) {
      if (isNaN(midValues[i])) continue;
      const t = candles[i].time;
      mid.push({ time: t, value: midValues[i] });
      upper.push({ time: t, value: upperValues[i] });
      lower.push({ time: t, value: lowerValues[i] });
    }

    // Generate Buy/Sell signals based on crossovers (like the Pine Script)
    const signals: { time: number; price: number; type: 'buy' | 'sell' }[] = [];
    
    let crossPrice: number | null = null;
    let crossDirection: string | null = null;

    for (let i = lookback + 1; i < n; i++) {
      if (isNaN(upperValues[i]) || isNaN(lowerValues[i]) || isNaN(upperValues[i - 1]) || isNaN(lowerValues[i - 1])) continue;

      const close = closes[i];
      const prevClose = closes[i - 1];

      // Crossover: close crosses above upper
      if (close > upperValues[i] && prevClose <= upperValues[i - 1]) {
        crossPrice = close;
        crossDirection = 'above';
      }
      // Crossunder: close crosses below lower
      if (close < lowerValues[i] && prevClose >= lowerValues[i - 1]) {
        crossPrice = close;
        crossDirection = 'below';
      }

      // Sell condition
      if (crossPrice !== null && crossDirection === 'above' && close < crossPrice && close < upperValues[i] && close > lowerValues[i]) {
        signals.push({ time: candles[i].time, price: candles[i].high, type: 'sell' });
        crossPrice = null;
        crossDirection = null;
      }

      // Buy condition
      if (crossPrice !== null && crossDirection === 'below' && close > crossPrice && close > lowerValues[i] && close < upperValues[i]) {
        signals.push({ time: candles[i].time, price: candles[i].low, type: 'buy' });
        crossPrice = null;
        crossDirection = null;
      }

      // Arrow markers for crossunder/crossover of bands
      // ▲ when close crosses under lower band
      if (close < lowerValues[i] && prevClose >= lowerValues[i - 1]) {
        // Already handled above for crossDirection
      }
      // ▼ when close crosses over upper band
      if (close > upperValues[i] && prevClose <= upperValues[i - 1]) {
        // Already handled above
      }
    }

    return { upper, lower, mid, signals };
  }, [candles, enabled, bandwidth, mult]);
}
