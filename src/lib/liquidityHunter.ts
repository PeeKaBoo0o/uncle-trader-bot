import type { Candle } from '@/hooks/useMarketData';

export interface LiquidityZone {
  price: number;
  type: 'high' | 'low';
  startIndex: number;
  endIndex: number;
  swept: boolean;
  sweptIndex?: number;
}

export interface LiquidityGrab {
  index: number;
  type: 'bull_grab' | 'bear_grab'; // bull_grab = swept lows (bullish), bear_grab = swept highs (bearish)
  price: number;
}

/**
 * Detect swing highs/lows as liquidity pools,
 * then mark sweeps (liquidity grabs) when price wicks through then closes back.
 * Inspired by the Alpha Net Liquidity Hunter Pine Script.
 */
export function computeLiquidityZones(
  candles: Candle[],
  swingLen: number = 10,
  zonePaddingPercent: number = 0.001
): { zones: LiquidityZone[]; grabs: LiquidityGrab[] } {
  if (candles.length < swingLen * 2 + 1) return { zones: [], grabs: [] };

  const zones: LiquidityZone[] = [];
  const grabs: LiquidityGrab[] = [];

  // 1. Find swing highs and swing lows
  for (let i = swingLen; i < candles.length - swingLen; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= swingLen; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isSwingHigh = false;
      }
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      zones.push({
        price: candles[i].high,
        type: 'high',
        startIndex: i,
        endIndex: candles.length - 1,
        swept: false,
      });
    }

    if (isSwingLow) {
      zones.push({
        price: candles[i].low,
        type: 'low',
        startIndex: i,
        endIndex: candles.length - 1,
        swept: false,
      });
    }
  }

  // 2. Detect liquidity grabs (sweeps)
  // A liquidity grab happens when price wicks beyond a zone but closes back inside
  for (const zone of zones) {
    if (zone.swept) continue;

    for (let i = zone.startIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      const padding = zone.price * zonePaddingPercent;

      if (zone.type === 'high') {
        // Price wicked above the high but closed below it → bear liquidity grab
        if (c.high > zone.price + padding && c.close < zone.price) {
          zone.swept = true;
          zone.sweptIndex = i;
          zone.endIndex = i;
          grabs.push({
            index: i,
            type: 'bear_grab',
            price: c.high,
          });
          break;
        }
        // Price closed decisively above → zone broken, no longer relevant
        if (c.close > zone.price + padding * 3) {
          zone.endIndex = i;
          break;
        }
      } else {
        // Price wicked below the low but closed above it → bull liquidity grab
        if (c.low < zone.price - padding && c.close > zone.price) {
          zone.swept = true;
          zone.sweptIndex = i;
          zone.endIndex = i;
          grabs.push({
            index: i,
            type: 'bull_grab',
            price: c.low,
          });
          break;
        }
        // Price closed decisively below → zone broken
        if (c.close < zone.price - padding * 3) {
          zone.endIndex = i;
          break;
        }
      }
    }
  }

  // Keep only recent/active zones (last 20)
  const activeZones = zones
    .filter(z => z.endIndex >= candles.length - 1 || z.swept)
    .slice(-20);

  return { zones: activeZones, grabs };
}
