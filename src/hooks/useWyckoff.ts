import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';
import { computeWyckoff, type WyckoffResult } from '@/lib/wyckoff';

export type { WyckoffResult } from '@/lib/wyckoff';

export function useWyckoff(
  candles: Candle[],
  enabled: boolean,
): WyckoffResult | null {
  return useMemo(() => {
    if (!enabled || candles.length < 30) return null;
    try {
      return computeWyckoff(candles);
    } catch (e) {
      console.error('Wyckoff computation error:', e);
      return null;
    }
  }, [candles, enabled]);
}
