/**
 * Exchange Adapter – abstract data source interface for multi-exchange support.
 * Currently: Binance. Future: Bybit, OKX, etc.
 */

export interface OHLCV {
  time: number;   // open time in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExchangeConfig {
  name: string;
  wsBaseUrl: string;
  restBaseUrl: string;
  supportedPairs: string[];
}

export interface TickHandler {
  (candle: OHLCV): void;
}

export interface ExchangeAdapter {
  readonly name: string;

  /** Fetch historical candles from REST */
  fetchCandles(params: {
    symbol: string;
    interval: string;
    limit?: number;
    endTime?: number;
  }): Promise<OHLCV[]>;

  /** Subscribe to real-time kline stream; returns unsubscribe fn */
  subscribeKline(
    symbol: string,
    interval: string,
    onTick: TickHandler,
  ): () => void;

  /** Convert app symbol (BTC/USDT) to exchange format */
  normalizeSymbol(pair: string): string;

  /** Convert app timeframe (H4) to exchange interval (4h) */
  normalizeInterval(timeframe: string): string;

  /** Whether this exchange supports a given pair */
  supportsPair(pair: string): boolean;
}
