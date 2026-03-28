import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Candle } from '@/hooks/useMarketData';

export interface SmcLiquidityBox {
  type: 'Buyside' | 'Sellside';
  start_time: number;
  end_time: number;
  top_price: number;
  bottom_price: number;
}

export interface SmcTradeSignal {
  has_signal: boolean;
  type?: 'Long' | 'Short';
  entry_time?: number;
  entry_price?: number;
  TP1?: number;
  TP2?: number;
  TP3?: number;
  SL?: number;
}

export interface SmcAnalysis {
  liquidity_boxes: SmcLiquidityBox[];
  trade_signal: SmcTradeSignal;
  action_points: string[];
}

export function useSmcAnalysis(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  enabled: boolean,
) {
  const [analysis, setAnalysis] = useState<SmcAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || candles.length < 20) {
      setAnalysis(null);
      return;
    }

    let cancelled = false;

    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        const resp = await supabase.functions.invoke('smc-analysis', {
          body: {
            candles: candles.slice(-100).map(c => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
            })),
            symbol,
            timeframe,
          },
        });

        if (cancelled) return;

        // supabase-js may return error object OR put error in data
        if (resp.error) {
          const msg = typeof resp.error === 'object' && 'message' in resp.error
            ? (resp.error as any).message
            : String(resp.error);
          throw new Error(msg || 'AI analysis failed');
        }

        const result = resp.data;

        if (!result || typeof result !== 'object') {
          throw new Error('Empty AI response');
        }

        if ('error' in result && (result as any).error) {
          throw new Error((result as any).error);
        }

        // Validate minimum shape
        if (!Array.isArray((result as any).liquidity_boxes) || !(result as any).trade_signal) {
          throw new Error('Invalid AI response format');
        }

        setAnalysis(result as SmcAnalysis);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error');
          setAnalysis(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnalysis();

    return () => { cancelled = true; };
  }, [candles.length, symbol, timeframe, enabled]);

  return { analysis, loading, error };
}
