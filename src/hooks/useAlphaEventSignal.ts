import { useMemo } from 'react';
import {
  runAlphaNetEventSignal,
  toLovableEventSignalSeries,
  defaultEventSignalConfig,
  type EventSignalConfig,
} from '@/lib/alpha-net-event-signal';
import type { Candle } from '@/hooks/useMarketData';

export type AlphaEventConfig = EventSignalConfig;
export const defaultAlphaEventConfig: AlphaEventConfig = { ...defaultEventSignalConfig };

export interface AlphaEventResult {
  emaTrendSeries: { time: number; value: number; color: string }[];
  longEntrySeries: { time: number; value: number }[];
  shortEntrySeries: { time: number; value: number }[];
  longTpSeries: { time: number; value: number }[];
  shortTpSeries: { time: number; value: number }[];
  markers: {
    time: number;
    position: string;
    color: string;
    shape: string;
    text: string;
  }[];
  zones: { time: number; entry: number; target: number; side: 'long' | 'short' }[];
  events: { time: number; type: string; price: number }[];
}

export function useAlphaEventSignal(
  candles: Candle[],
  enabled: boolean,
  config: AlphaEventConfig = defaultAlphaEventConfig,
): AlphaEventResult | null {
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
      const raw = runAlphaNetEventSignal(engineCandles, config);
      return toLovableEventSignalSeries(raw);
    } catch (e) {
      console.warn('[AlphaEvent] Engine error:', e);
      return null;
    }
  }, [candles, enabled, config.emaFastLength, config.emaSlowLength, config.emaTrendLength, config.takeProfitPercent]);
}
