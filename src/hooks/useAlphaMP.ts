import { useMemo } from 'react';
import {
  runAlphaNetMatrixPro,
  toLovableMatrixSeries,
  defaultMatrixProConfig,
  type MatrixProConfig,
  type MatrixProOutput,
} from '@/lib/alpha-net-matrix-pro';
import type { Candle } from '@/hooks/useMarketData';

export type AlphaMPConfig = MatrixProConfig;
export const defaultAlphaMPConfig: AlphaMPConfig = { ...defaultMatrixProConfig };

export interface AlphaMPResult {
  upperSeries: { time: number; value: number }[];
  lowerSeries: { time: number; value: number }[];
  basisSeries: { time: number; value: number }[];
  markers: {
    time: number;
    position: string;
    color: string;
    shape: string;
    text: string;
  }[];
  dashboard: { repaintMode: boolean; totalBuySignals: number; totalSellSignals: number };
  events: { time: number; type: 'buy' | 'sell'; price: number }[];
}

export function useAlphaMP(
  candles: Candle[],
  enabled: boolean,
  config: AlphaMPConfig = defaultAlphaMPConfig,
): AlphaMPResult | null {
  return useMemo(() => {
    if (!enabled || candles.length < 30) return null;

    try {
      const engineCandles = candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const raw: MatrixProOutput = runAlphaNetMatrixPro(engineCandles, config);
      return toLovableMatrixSeries(raw);
    } catch (e) {
      console.warn('[AlphaMP] Engine error:', e);
      return null;
    }
  }, [candles, enabled, config.bandwidth, config.multiplier, config.source, config.repaint, config.maxBars]);
}
