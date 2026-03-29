import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';

export interface MatrixData {
  upper: { time: number; value: number }[];
  lower: { time: number; value: number }[];
  mid: { time: number; value: number }[];
  signals: { time: number; price: number; type: 'buy' | 'sell' }[];
}

/**
 * Nadaraya-Watson Envelope (NWE) — faithful port of Pine Script "Alpha Net Matrix Pro"
 * Non-repaint endpoint method: Gaussian kernel regression + SMA(|close - nwe|) envelope.
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

    // Gaussian window
    const gauss = (x: number, h: number) => Math.exp(-(x * x) / (2 * h * h));

    // Precompute kernel coefficients once
    const coefs: number[] = [];
    let den = 0;
    for (let i = 0; i <= lookback; i++) {
      const w = gauss(i, bandwidth);
      coefs.push(w);
      den += w;
    }

    // Step 1: Compute NWE (endpoint kernel regression) for each bar
    const nweValues: number[] = new Array(n).fill(NaN);

    for (let bar = lookback; bar < n; bar++) {
      let out = 0;
      for (let i = 0; i <= lookback; i++) {
        out += closes[bar - i] * coefs[i];
      }
      nweValues[bar] = out / den;
    }

    // Step 2: MAE = SMA of |close - nwe| over lookback window, then * mult
    // This matches Pine's: ta.sma(math.abs(close - out), 499) * mult
    const midValues: number[] = new Array(n).fill(NaN);
    const upperValues: number[] = new Array(n).fill(NaN);
    const lowerValues: number[] = new Array(n).fill(NaN);

    for (let bar = lookback; bar < n; bar++) {
      const nwe = nweValues[bar];
      if (isNaN(nwe)) continue;

      // SMA of |close - nwe| over last (lookback+1) bars where nwe is available
      let maeSum = 0;
      let maeCount = 0;
      for (let i = 0; i <= lookback; i++) {
        const idx = bar - i;
        if (idx < 0 || isNaN(nweValues[idx])) continue;
        maeSum += Math.abs(closes[idx] - nweValues[idx]);
        maeCount++;
      }
      const mae = maeCount > 0 ? (maeSum / maeCount) * mult : 0;

      midValues[bar] = nwe;
      upperValues[bar] = nwe + mae;
      lowerValues[bar] = nwe - mae;
    }

    // Build series
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

    // Generate Buy/Sell signals (matching Pine Script logic)
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

      // Sell condition (with [1] shift like Pine)
      const condSell = crossPrice !== null && crossDirection === 'above' && close < crossPrice && close < upperValues[i] && close > lowerValues[i];
      // Buy condition
      const condBuy = crossPrice !== null && crossDirection === 'below' && close > crossPrice && close > lowerValues[i] && close < upperValues[i];

      if (condSell) {
        signals.push({ time: candles[i].time, price: candles[i].high, type: 'sell' });
        crossPrice = null;
        crossDirection = null;
      }

      if (condBuy) {
        signals.push({ time: candles[i].time, price: candles[i].low, type: 'buy' });
        crossPrice = null;
        crossDirection = null;
      }
    }

    return { upper, lower, mid, signals };
  }, [candles, enabled, bandwidth, mult]);
}
