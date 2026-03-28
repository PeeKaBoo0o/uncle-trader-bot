import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Candle } from '@/hooks/useMarketData';

export interface AlphaNetData {
  algorithm: string;
  sensitivity: number;
  ai_strength: number;
  ai_state: 'TRENDING' | 'BEARISH';
  rz_state: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  supertrend_line: { time: number; value: number; trend: number }[];
  rz_bands: { up_band: number; lo_band: number; mean: number };
}

export function useAlphaNet(candles: Candle[], enabled: boolean) {
  const [data, setData] = useState<AlphaNetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevKey = useRef('');

  useEffect(() => {
    if (!enabled || candles.length < 30) {
      setData(null);
      setError(null);
      return;
    }

    const key = `${candles.length}-${candles[candles.length - 1]?.time}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: result, error: fnError } = await supabase.functions.invoke('alphanet-analysis', {
          body: {
            candles: candles.slice(-200).map(c => ({
              time: c.time, open: c.open, high: c.high,
              low: c.low, close: c.close, volume: c.volume,
            })),
          },
        });

        if (cancelled) return;

        if (fnError) throw new Error(fnError.message || 'AlphaNet analysis failed');
        if (result?.error) throw new Error(result.error);

        setData(result as AlphaNetData);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [candles.length, candles[candles.length - 1]?.time, enabled]);

  return { data, loading, error };
}