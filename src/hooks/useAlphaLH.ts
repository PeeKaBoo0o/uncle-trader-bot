import { useMemo } from 'react';
import {
  runAlphaNetLiquidityHunter,
  toLovableSeries,
  defaultConfig,
  type IndicatorOutput,
} from '@/lib/alpha-net-liquidity-hunter';
import type { Candle } from '@/hooks/useMarketData';

export interface AlphaLHConfig {
  mssOffset: number;
  higherTimeframeMinutes: number;
  breakoutMethod: 'Close' | 'Wick';
  entryMethod: 'Classic' | 'Adaptive';
  tpslMethod: 'Dynamic' | 'Fixed';
  riskAmount: 'Highest' | 'High' | 'Normal' | 'Low' | 'Lowest';
  showHL: boolean;
  showLiqGrabs: boolean;
  showTPSL: boolean;
}

export const defaultAlphaLHConfig: AlphaLHConfig = {
  mssOffset: defaultConfig.mssOffset,
  higherTimeframeMinutes: defaultConfig.higherTimeframeMinutes,
  breakoutMethod: defaultConfig.breakoutMethod,
  entryMethod: defaultConfig.entryMethod,
  tpslMethod: defaultConfig.tpslMethod,
  riskAmount: defaultConfig.riskAmount,
  showHL: defaultConfig.showHL,
  showLiqGrabs: defaultConfig.showLiqGrabs,
  showTPSL: defaultConfig.showTPSL,
};

export interface AlphaLHResult {
  markers: any[];
  lines: any[];
  zones: any[];
  stats: { totalEntries: number; tp1Count: number; tp2Count: number; tp3Count: number; losses: number; winrate: number };
  events: any[];
  trades: any[];
  raw: IndicatorOutput;
}

export function useAlphaLH(
  candles: Candle[],
  enabled: boolean,
  config: AlphaLHConfig = defaultAlphaLHConfig,
): AlphaLHResult | null {
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

      const raw = runAlphaNetLiquidityHunter(engineCandles, {
        mssOffset: config.mssOffset,
        higherTimeframeMinutes: config.higherTimeframeMinutes,
        breakoutMethod: config.breakoutMethod,
        entryMethod: config.entryMethod,
        tpslMethod: config.tpslMethod,
        riskAmount: config.riskAmount,
        showHL: config.showHL,
        showLiqGrabs: config.showLiqGrabs,
        showTPSL: config.showTPSL,
      });

      const series = toLovableSeries(raw);

      return {
        markers: series.markers,
        lines: series.lines,
        zones: series.zones,
        stats: series.stats,
        events: series.events,
        trades: series.trades,
        raw,
      };
    } catch (e) {
      console.warn('[AlphaLH] Engine error:', e);
      return null;
    }
  }, [candles, enabled, config.mssOffset, config.higherTimeframeMinutes, config.breakoutMethod, config.entryMethod, config.tpslMethod, config.riskAmount, config.showHL, config.showLiqGrabs, config.showTPSL]);
}
