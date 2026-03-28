import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Zone {
  top: number;
  bottom: number;
  type: 'support' | 'resistance';
}

export interface Indicators {
  bb: { upper: number[]; middle: number[]; lower: number[]; bandwidth: number[] };
  rsi: number[];
  ema20: number[];
  ema50: number[];
  ema200: number[];
  macd: { macdLine: number[]; signalLine: number[]; histogram: number[] };
  volAvg: number[];
}

export interface MarketData {
  candles: Candle[];
  indicators: Indicators | null;
  zones: Zone[];
  actions: { entry: number; target: number; stopLoss: number } | null;
  loading: boolean;
  error: string | null;
}

const SYMBOL_MAP: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'XAU/USDT': 'XAUUSDT',
  'SOL/USDT': 'SOLUSDT',
  'BNB/USDT': 'BNBUSDT',
  'XRP/USDT': 'XRPUSDT',
  'DOGE/USDT': 'DOGEUSDT',
  'WLD/USDT': 'WLDUSDT',
  'HYPE/USDT': 'HYPEUSDT',
  'PEPE/USDT': 'PEPEUSDT',
};

export function useMarketData(pair: string, timeframe: string) {
  const [data, setData] = useState<MarketData>({
    candles: [], indicators: null, zones: [], actions: null, loading: true, error: null
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const symbol = SYMBOL_MAP[pair] || pair.replace('/', '');
      const { data: result, error } = await supabase.functions.invoke('signal-bot', {
        body: { mode: 'indicators', symbol, timeframe, limit: 300 }
      });

      if (error) throw error;

      setData({
        candles: result.candles || [],
        indicators: result.indicators || null,
        zones: result.zones || [],
        actions: result.actions || null,
        loading: false,
        error: null,
      });
    } catch (e: any) {
      console.error('Market data fetch error:', e);
      setData(prev => ({ ...prev, loading: false, error: e.message || 'Failed to fetch data' }));
    }
  }, [pair, timeframe]);

  useEffect(() => {
    setData(prev => ({ ...prev, loading: true }));
    fetchData();

    // Refresh every 60 seconds
    intervalRef.current = setInterval(fetchData, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  return data;
}

export interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  conditions: string[];
  strength: string;
  price: number;
  rsi: number | null;
  vol_ratio: number | null;
  candle_time: string;
  sent_at: string;
}

export function useSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      const { data, error } = await supabase
        .from('signals')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setSignals(data as unknown as Signal[]);
      }
      setLoading(false);
    };

    fetchSignals();

    // Subscribe to realtime
    const channel = supabase
      .channel('signals-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, (payload) => {
        setSignals(prev => [payload.new as unknown as Signal, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { signals, loading };
}
