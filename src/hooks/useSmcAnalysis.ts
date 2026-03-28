import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Candle } from '@/hooks/useMarketData';

const CREDITS_ERROR_MESSAGE = 'Lovable AI hết credits, vui lòng nạp thêm ở Settings → Workspace → Usage.';
const RATE_LIMIT_ERROR_MESSAGE = 'Lovable AI đang quá tải, vui lòng thử lại sau vài giây.';
const CREDITS_COOLDOWN_MS = 60_000;

const asObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const isCreditsError = (status?: number, message?: string, code?: string) =>
  status === 402 ||
  code === 'AI_CREDITS_EXHAUSTED' ||
  /hết credits|payment required|credit/i.test(message ?? '');

const isRateLimitError = (status?: number, message?: string, code?: string) =>
  status === 429 ||
  code === 'AI_RATE_LIMITED' ||
  /rate limit|too many requests|429/i.test(message ?? '');

const normalizeInvokeError = (respError: unknown, data: unknown) => {
  const respObj = asObject(respError);
  const dataObj = asObject(data);
  const context = asObject(respObj?.context);

  const status =
    toNumber(respObj?.status) ??
    toNumber(context?.status) ??
    toNumber(dataObj?.status);

  const message =
    (typeof dataObj?.error === 'string' && dataObj.error) ||
    (typeof respObj?.message === 'string' && respObj.message) ||
    (typeof dataObj?.message === 'string' && dataObj.message) ||
    'AI analysis failed';

  const code = typeof dataObj?.code === 'string' ? dataObj.code : undefined;

  if (isCreditsError(status, message, code)) {
    return { message: CREDITS_ERROR_MESSAGE, isCredits: true };
  }

  if (isRateLimitError(status, message, code)) {
    return { message: RATE_LIMIT_ERROR_MESSAGE, isCredits: false };
  }

  return { message, isCredits: false };
};

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
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!blockedUntil) return;

    const remaining = blockedUntil - Date.now();
    if (remaining <= 0) {
      setBlockedUntil(null);
      return;
    }

    const timer = window.setTimeout(() => setBlockedUntil(null), remaining);
    return () => window.clearTimeout(timer);
  }, [blockedUntil]);

  useEffect(() => {
    if (!enabled || candles.length < 20) {
      setAnalysis(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (blockedUntil && blockedUntil > Date.now()) {
      setAnalysis(null);
      setError(CREDITS_ERROR_MESSAGE);
      setLoading(false);
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
          const normalized = normalizeInvokeError(resp.error, resp.data);
          if (normalized.isCredits) {
            setBlockedUntil(Date.now() + CREDITS_COOLDOWN_MS);
          }
          throw new Error(normalized.message);
        }

        const result = resp.data;

        if (!result || typeof result !== 'object') {
          throw new Error('Empty AI response');
        }

        if ('error' in result && (result as any).error) {
          const normalized = normalizeInvokeError(null, result);
          if (normalized.isCredits) {
            setBlockedUntil(Date.now() + CREDITS_COOLDOWN_MS);
          }
          throw new Error(normalized.message);
        }

        // Validate minimum shape
        if (!Array.isArray((result as any).liquidity_boxes) || !(result as any).trade_signal) {
          throw new Error('Invalid AI response format');
        }

        setAnalysis(result as SmcAnalysis);
        setBlockedUntil(null);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          if (isCreditsError(undefined, message)) {
            setBlockedUntil(Date.now() + CREDITS_COOLDOWN_MS);
          }
          setError(message);
          setAnalysis(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnalysis();

    return () => { cancelled = true; };
  }, [candles.length, symbol, timeframe, enabled, blockedUntil]);

  return { analysis, loading, error };
}
