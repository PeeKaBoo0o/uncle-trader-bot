import type { ExchangeAdapter, OHLCV, TickHandler } from './types';

const TF_MAP: Record<string, string> = {
  M1: '1m', M5: '5m', M15: '15m', M30: '30m',
  H1: '1h', H4: '4h', D1: '1d', W1: '1w',
};

const UNSUPPORTED = new Set(['XAUUSDT']);

export class BinanceAdapter implements ExchangeAdapter {
  readonly name = 'Binance';
  private readonly wsBase = 'wss://stream.binance.com:9443/ws';
  private readonly restBase = 'https://api.binance.com/api/v3';

  normalizeSymbol(pair: string): string {
    return pair.replace('/', '').toUpperCase();
  }

  normalizeInterval(tf: string): string {
    return TF_MAP[tf] || '4h';
  }

  supportsPair(pair: string): boolean {
    const sym = this.normalizeSymbol(pair);
    return !UNSUPPORTED.has(sym);
  }

  async fetchCandles(params: {
    symbol: string;
    interval: string;
    limit?: number;
    endTime?: number;
  }): Promise<OHLCV[]> {
    const url = new URL(`${this.restBase}/klines`);
    url.searchParams.set('symbol', params.symbol);
    url.searchParams.set('interval', params.interval);
    url.searchParams.set('limit', String(params.limit ?? 500));
    if (params.endTime) url.searchParams.set('endTime', String(params.endTime));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Binance REST error: ${res.status}`);

    const data: any[][] = await res.json();
    return data.map(k => ({
      time: k[0] as number,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  }

  subscribeKline(
    symbol: string,
    interval: string,
    onTick: TickHandler,
  ): () => void {
    const sym = symbol.toLowerCase();
    if (UNSUPPORTED.has(symbol.toUpperCase())) {
      return () => {}; // no-op for unsupported pairs
    }

    const url = `${this.wsBase}/${sym}@kline_${interval}`;
    let ws: WebSocket | null = null;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(url);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.e !== 'kline') return;
          const k = msg.k;
          onTick({
            time: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          });
        } catch { /* ignore */ }
      };

      ws.onclose = (e) => {
        if (!disposed && e.code !== 1000) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close(1000);
      }
    };
  }
}
