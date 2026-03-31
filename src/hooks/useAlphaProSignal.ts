import { useMemo } from 'react';
import {
  runAlphaNetProBuySellSignal,
  toLovableAlphaNetProSeries,
  defaultAlphaNetProConfig,
  type AlphaNetProConfig,
} from '@/lib/alpha-net-pro-buy-sell-signal';
import type { Candle } from '@/hooks/useMarketData';

export type AlphaProConfig = AlphaNetProConfig;
export const defaultAlphaProConfig: AlphaProConfig = { ...defaultAlphaNetProConfig };

export interface AlphaProResult {
  stopSeries: { time: number; value: number }[];
  wavyHighSeries: { time: number; value: number }[];
  wavyMidSeries: { time: number; value: number }[];
  wavyLowSeries: { time: number; value: number }[];
  tunnel1Series: { time: number; value: number }[];
  tunnel2Series: { time: number; value: number }[];
  fastMASeries: { time: number; value: number }[];
  slowMASeries: { time: number; value: number }[];
  trendStates: { time: number; bullish: boolean; bearish: boolean; zone: string }[];
  markers: {
    time: number;
    position: string;
    color: string;
    shape: string;
    text: string;
  }[];
  events: { time: number; type: string; price: number }[];
}

export function useAlphaProSignal(
  candles: Candle[],
  enabled: boolean,
  config: AlphaProConfig = defaultAlphaProConfig,
): AlphaProResult | null {
  return useMemo(() => {
    if (!enabled || candles.length < 30) return null;
    try {
      const engineCandles = candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
      const raw = runAlphaNetProBuySellSignal(engineCandles, config);
      return toLovableAlphaNetProSeries(raw) as AlphaProResult;
    } catch (e) {
      console.warn('[AlphaPro] Engine error:', e);
      return null;
    }
  }, [candles, enabled, config.atrPeriod, config.atrMultiplier, config.fastLength, config.slowLength, config.wavyLength, config.tunnelFastLength, config.tunnelSlowLength, config.fixedTimeframeMode]);
}
