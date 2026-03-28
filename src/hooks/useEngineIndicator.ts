import { useMemo } from 'react';
import type { Candle } from '@/hooks/useMarketData';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: 'high' | 'low';
}

export interface StructureBreak {
  index: number;
  time: number;
  price: number;
  type: 'BOS' | 'CHoCH';
  direction: 'bull' | 'bear';
  startTime: number;
  startIndex: number;
}

export interface OrderBlock {
  top: number;
  bottom: number;
  startTime: number;
  endTime: number;
  startIndex: number;
  endIndex: number;
  bull: boolean;
  mitigated: boolean;
}

export interface FairValueGap {
  top: number;
  bottom: number;
  time: number;
  index: number;
  bull: boolean;
  mitigated: boolean;
}

export interface TrendZone {
  top: number;
  bottom: number;
  startTime: number;
  endTime: number;
  type: 'resistance' | 'support';
}

export interface EngineData {
  swings: SwingPoint[];
  structures: StructureBreak[];
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  trendZones: TrendZone[];
  trend: number; // 1 = bull, -1 = bear
}

// ═══════════════════════════════════════════════════════════════
// Pivot detection (like ta.pivothigh / ta.pivotlow)
// ═══════════════════════════════════════════════════════════════
function detectPivots(candles: Candle[], strength: number): SwingPoint[] {
  const pivots: SwingPoint[] = [];
  for (let i = strength; i < candles.length - strength; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= strength; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivots.push({ index: i, time: candles[i].time, price: candles[i].high, type: 'high' });
    if (isLow) pivots.push({ index: i, time: candles[i].time, price: candles[i].low, type: 'low' });
  }
  return pivots;
}

// ═══════════════════════════════════════════════════════════════
// Market Structure Detection (BOS / CHoCH)
// ═══════════════════════════════════════════════════════════════
function detectMarketStructure(candles: Candle[], pivots: SwingPoint[]): { structures: StructureBreak[]; trend: number } {
  const structures: StructureBreak[] = [];
  if (pivots.length < 4) return { structures, trend: 0 };

  let trend = 0; // 0 = undefined, 1 = bull, -1 = bear
  let lastHH = -Infinity, lastLL = Infinity;
  let lastHHIdx = 0, lastLLIdx = 0;
  let lastHHTime = 0, lastLLTime = 0;

  const highs = pivots.filter(p => p.type === 'high');
  const lows = pivots.filter(p => p.type === 'low');

  // Initialize with first swing points
  if (highs.length > 0) { lastHH = highs[0].price; lastHHIdx = highs[0].index; lastHHTime = highs[0].time; }
  if (lows.length > 0) { lastLL = lows[0].price; lastLLIdx = lows[0].index; lastLLTime = lows[0].time; }

  // Track consecutive higher-highs/lower-lows for structure
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Check for Break of Structure (BOS) or Change of Character (CHoCH)
    if (trend >= 0) {
      // In uptrend or neutral - check for bearish break
      if (c.close < lastLL) {
        const isCHoCH = trend === 1;
        structures.push({
          index: i, time: c.time, price: lastLL,
          type: isCHoCH ? 'CHoCH' : 'BOS',
          direction: 'bear',
          startTime: lastLLTime, startIndex: lastLLIdx,
        });
        trend = -1;
        lastHH = -Infinity;
      }
    }
    if (trend <= 0) {
      // In downtrend or neutral - check for bullish break
      if (c.close > lastHH) {
        const isCHoCH = trend === -1;
        structures.push({
          index: i, time: c.time, price: lastHH,
          type: isCHoCH ? 'CHoCH' : 'BOS',
          direction: 'bull',
          startTime: lastHHTime, startIndex: lastHHIdx,
        });
        trend = 1;
        lastLL = Infinity;
      }
    }

    // Update swing tracking from pivot points
    const pivotAtI = pivots.filter(p => p.index === i);
    for (const p of pivotAtI) {
      if (p.type === 'high' && p.price > lastHH) {
        lastHH = p.price; lastHHIdx = p.index; lastHHTime = p.time;
      }
      if (p.type === 'low' && p.price < lastLL) {
        lastLL = p.price; lastLLIdx = p.index; lastLLTime = p.time;
      }
    }
  }

  return { structures: structures.slice(-20), trend };
}

// ═══════════════════════════════════════════════════════════════
// Order Block Detection
// ═══════════════════════════════════════════════════════════════
function detectOrderBlocks(candles: Candle[], structures: StructureBreak[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  if (candles.length < 10) return obs;

  for (const s of structures) {
    const idx = s.index;
    if (idx < 2 || idx >= candles.length) continue;

    if (s.direction === 'bull') {
      // Bullish OB: last bearish candle before the break
      for (let j = idx - 1; j >= Math.max(0, idx - 10); j--) {
        if (candles[j].close < candles[j].open) {
          obs.push({
            top: candles[j].high,
            bottom: candles[j].low,
            startTime: candles[j].time,
            endTime: candles[Math.min(candles.length - 1, idx + 20)].time,
            startIndex: j,
            endIndex: Math.min(candles.length - 1, idx + 20),
            bull: true,
            mitigated: false,
          });
          break;
        }
      }
    } else {
      // Bearish OB: last bullish candle before the break
      for (let j = idx - 1; j >= Math.max(0, idx - 10); j--) {
        if (candles[j].close > candles[j].open) {
          obs.push({
            top: candles[j].high,
            bottom: candles[j].low,
            startTime: candles[j].time,
            endTime: candles[Math.min(candles.length - 1, idx + 20)].time,
            startIndex: j,
            endIndex: Math.min(candles.length - 1, idx + 20),
            bull: false,
            mitigated: false,
          });
          break;
        }
      }
    }
  }

  // Check mitigation
  for (const ob of obs) {
    for (let i = ob.startIndex + 1; i < candles.length; i++) {
      if (ob.bull && candles[i].close < ob.bottom) {
        ob.mitigated = true;
        ob.endTime = candles[i].time;
        ob.endIndex = i;
        break;
      }
      if (!ob.bull && candles[i].close > ob.top) {
        ob.mitigated = true;
        ob.endTime = candles[i].time;
        ob.endIndex = i;
        break;
      }
    }
  }

  // Return last 5 unmitigated + last 3 mitigated
  const active = obs.filter(o => !o.mitigated).slice(-5);
  const mitigated = obs.filter(o => o.mitigated).slice(-3);
  return [...active, ...mitigated];
}

// ═══════════════════════════════════════════════════════════════
// Fair Value Gap Detection
// ═══════════════════════════════════════════════════════════════
function detectFVGs(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const curr = candles[i];

    // Bullish FVG: current low > prev2 high (gap up)
    if (curr.low > prev2.high) {
      fvgs.push({
        top: curr.low,
        bottom: prev2.high,
        time: candles[i - 1].time,
        index: i - 1,
        bull: true,
        mitigated: false,
      });
    }
    // Bearish FVG: prev2 low > current high (gap down)
    if (prev2.low > curr.high) {
      fvgs.push({
        top: prev2.low,
        bottom: curr.high,
        time: candles[i - 1].time,
        index: i - 1,
        bull: false,
        mitigated: false,
      });
    }
  }

  // Check mitigation
  for (const fvg of fvgs) {
    for (let i = fvg.index + 2; i < candles.length; i++) {
      if (fvg.bull && candles[i].close < fvg.bottom) {
        fvg.mitigated = true;
        break;
      }
      if (!fvg.bull && candles[i].close > fvg.top) {
        fvg.mitigated = true;
        break;
      }
    }
  }

  // Return last 5 active FVGs
  return fvgs.filter(f => !f.mitigated).slice(-5);
}

// ═══════════════════════════════════════════════════════════════
// Trendline Zones (support/resistance from pivot clusters)
// ═══════════════════════════════════════════════════════════════
function detectTrendZones(candles: Candle[], pivots: SwingPoint[]): TrendZone[] {
  const zones: TrendZone[] = [];
  if (candles.length < 20 || pivots.length < 3) return zones;

  const atr = computeATR(candles, 14);
  const threshold = atr * 0.5;
  const lastTime = candles[candles.length - 1].time;

  // Group nearby pivot highs into resistance zones
  const highs = pivots.filter(p => p.type === 'high').slice(-30);
  const lows = pivots.filter(p => p.type === 'low').slice(-30);

  const findZone = (points: SwingPoint[], type: 'resistance' | 'support') => {
    if (points.length < 2) return;
    // Find clusters of similar price levels
    const used = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      let touches = 1;
      let maxP = points[i].price;
      let minP = points[i].price;
      let earliest = points[i].time;

      for (let j = i + 1; j < points.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(points[j].price - points[i].price) <= threshold) {
          touches++;
          maxP = Math.max(maxP, points[j].price);
          minP = Math.min(minP, points[j].price);
          earliest = Math.min(earliest, points[j].time);
          used.add(j);
        }
      }

      if (touches >= 2) {
        zones.push({
          top: maxP + threshold * 0.2,
          bottom: minP - threshold * 0.2,
          startTime: earliest,
          endTime: lastTime,
          type,
        });
      }
      used.add(i);
    }
  };

  findZone(highs, 'resistance');
  findZone(lows, 'support');

  // Return top 2 closest zones
  const currentPrice = candles[candles.length - 1].close;
  return zones
    .sort((a, b) => {
      const distA = Math.min(Math.abs(a.top - currentPrice), Math.abs(a.bottom - currentPrice));
      const distB = Math.min(Math.abs(b.top - currentPrice), Math.abs(b.bottom - currentPrice));
      return distA - distB;
    })
    .slice(0, 4);
}

function computeATR(candles: Candle[], period: number): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
    sum += tr;
  }
  return sum / period;
}

// ═══════════════════════════════════════════════════════════════
// Main Hook
// ═══════════════════════════════════════════════════════════════
export function useEngineIndicator(candles: Candle[], enabled: boolean): EngineData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 30) return null;

    const pivotStrength = 5;
    const swings = detectPivots(candles, pivotStrength);
    const { structures, trend } = detectMarketStructure(candles, swings);
    const orderBlocks = detectOrderBlocks(candles, structures);
    const fvgs = detectFVGs(candles);
    const trendZones = detectTrendZones(candles, swings);

    return { swings, structures, orderBlocks, fvgs, trendZones, trend };
  }, [candles, enabled]);
}
