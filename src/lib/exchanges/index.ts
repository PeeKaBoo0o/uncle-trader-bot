export type { ExchangeAdapter, OHLCV, TickHandler, ExchangeConfig } from './types';
export { BinanceAdapter } from './binance';

import { BinanceAdapter } from './binance';
import type { ExchangeAdapter } from './types';

const adapters: Record<string, ExchangeAdapter> = {
  binance: new BinanceAdapter(),
};

/** Get exchange adapter by name. Defaults to Binance. */
export function getExchangeAdapter(name = 'binance'): ExchangeAdapter {
  return adapters[name] || adapters.binance;
}

/** Register a new exchange adapter (for future Bybit, OKX, etc.) */
export function registerExchangeAdapter(name: string, adapter: ExchangeAdapter): void {
  adapters[name] = adapter;
}
