import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';
import { computeOscillatorMatrix, type OscillatorMatrixData } from '@/lib/oscillatorMatrix';

export type { OscillatorMatrixData } from '@/lib/oscillatorMatrix';

export function useOscillatorMatrix(
  candles: Candle[],
  enabled: boolean,
): OscillatorMatrixData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 50) return null;
    return computeOscillatorMatrix(candles);
  }, [candles, enabled]);
}
