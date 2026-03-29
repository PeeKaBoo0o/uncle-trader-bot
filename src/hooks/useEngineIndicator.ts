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
  /** bar index where the line starts (the swing point) */
  startIndex: number;
  startTime: number;
  /** bar index where the break was confirmed */
  endIndex: number;
  endTime: number;
  price: number;
  type: 'BOS' | 'CHoCH';
  direction: 'bull' | 'bear';
  /** Was this a sweep (x) — wick through but close back? */
  isSweep: boolean;
}

export interface OrderBlock {
  top: number;
  bottom: number;
  avg: number;
  startTime: number;
  endTime: number;
  startIndex: number;
  endIndex: number;
  bull: boolean;
  mitigated: boolean;
  mitigatedTime?: number;
  volume: number;
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
// Helpers
// ═══════════════════════════════════════════════════════════════
function computeATR(candles: Candle[], period: number, endIdx?: number): number {
  const end = endIdx ?? candles.length - 1;
  const start = Math.max(1, end - period + 1);
  if (start > end) return 0;
  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
    sum += tr;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

// ═══════════════════════════════════════════════════════════════
// Pivot detection (ta.pivothigh / ta.pivotlow)
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
// Market Structure Detection — SMC style (BOS / CHoCH / Sweep)
// Closely follows the Pine Script "structure_smc" state machine
// ═══════════════════════════════════════════════════════════════
interface MSState {
  trend: number;     // 1=bull, -1=bear, 0=init
  bosLevel: number | null;    // Break of Structure level being watched
  chochLevel: number | null;  // Change of Character level
  bosStartIdx: number;
  chochStartIdx: number;
  main: number;      // current swing extreme
  mainIdx: number;
  stage: number;     // 0=init, 1=first, 2=running
}

function detectMarketStructure(
  candles: Candle[],
  pivots: SwingPoint[],
  pivotLen: number,
): { structures: StructureBreak[]; trend: number } {
  const structures: StructureBreak[] = [];
  if (candles.length < 30) return { structures, trend: 0 };

  // Build pivot lookup maps for "Adjusted Points" mode
  const pivotHighAt = new Map<number, number>();
  const pivotLowAt = new Map<number, number>();
  for (const p of pivots) {
    if (p.type === 'high') pivotHighAt.set(p.index, p.price);
    else pivotLowAt.set(p.index, p.price);
  }

  // Track recent pivots for adjusted points
  let recentPH: { idx: number; price: number } | null = null;
  let recentPL: { idx: number; price: number } | null = null;

  const st: MSState = {
    trend: 0, bosLevel: null, chochLevel: null,
    bosStartIdx: 0, chochStartIdx: 0,
    main: 0, mainIdx: 0, stage: 0,
  };

  // Helpers for finding extremes between two bar indices
  const findHighest = (from: number, to: number) => {
    let best = from;
    for (let k = from; k <= to; k++) {
      if (candles[k].high > candles[best].high) best = k;
    }
    return best;
  };
  const findLowest = (from: number, to: number) => {
    let best = from;
    for (let k = from; k <= to; k++) {
      if (candles[k].low < candles[best].low) best = k;
    }
    return best;
  };

  // Detect crossup / crossdn (two consecutive bullish/bearish candles momentum)
  let up = candles[0].high;
  let dn = candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    let crossup = false;
    let crossdn = false;

    if (c.high > up) {
      up = c.high; dn = c.low; crossup = true;
    }
    if (c.low < dn) {
      up = c.high; dn = c.low; crossdn = true;
    }

    // Update pivot tracking
    if (pivotHighAt.has(i)) {
      const p = pivotHighAt.get(i)!;
      if (!recentPH || p > recentPH.price) recentPH = { idx: i, price: p };
    }
    if (pivotLowAt.has(i)) {
      const p = pivotLowAt.get(i)!;
      if (!recentPL || p < recentPL.price) recentPL = { idx: i, price: p };
    }
    // Reset pivots when price exceeds them
    if (recentPH && c.high > recentPH.price) recentPH = null;
    if (recentPL && c.low < recentPL.price) recentPL = null;

    // Stage 0: initialization
    if (st.stage === 0) {
      st.stage = 1;
      st.chochLevel = c.high;
      st.chochStartIdx = i;
      st.bosLevel = null;
      st.bosStartIdx = i;
      st.main = c.low;
      st.mainIdx = i;
      st.trend = 0;
      continue;
    }

    // Stage 1: waiting for first directional break
    if (st.stage === 1) {
      // Track extremes
      if (c.high > (st.chochLevel ?? -Infinity)) {
        st.chochLevel = c.high;
        st.chochStartIdx = i;
      }
      if (c.low < st.main) {
        st.main = c.low;
        st.mainIdx = i;
      }

      // Check bearish CHoCH
      if (st.main !== null && c.close <= st.main) {
        st.trend = -1;
        st.stage = 2;
        const startIdx = st.mainIdx;
        structures.push({
          startIndex: startIdx, startTime: candles[startIdx].time,
          endIndex: i, endTime: c.time,
          price: st.main, type: 'CHoCH', direction: 'bear', isSweep: false,
        });
        // Setup for bear trend
        const hIdx = findHighest(st.mainIdx, i);
        st.chochLevel = candles[hIdx].high;
        st.chochStartIdx = hIdx;
        st.bosLevel = null;
        st.main = c.low;
        st.mainIdx = i;
        continue;
      }

      // Check bullish CHoCH
      if (st.chochLevel !== null && c.close >= st.chochLevel) {
        st.trend = 1;
        st.stage = 2;
        const startIdx = st.chochStartIdx;
        structures.push({
          startIndex: startIdx, startTime: candles[startIdx].time,
          endIndex: i, endTime: c.time,
          price: st.chochLevel, type: 'CHoCH', direction: 'bull', isSweep: false,
        });
        // Setup for bull trend
        const lIdx = findLowest(st.chochStartIdx, i);
        st.chochLevel = candles[lIdx].low;
        st.chochStartIdx = lIdx;
        st.bosLevel = null;
        st.main = c.high;
        st.mainIdx = i;
        continue;
      }
      continue;
    }

    // Stage 2: running — proper BOS/CHoCH/Sweep detection
    if (st.trend === -1) {
      // Bear trend: tracking lows for BOS, highs for CHoCH
      if (c.low < st.main) {
        st.main = c.low;
        st.mainIdx = i;
      }

      // Create BOS level when we get momentum confirmation
      if (st.bosLevel === null) {
        if (crossup && c.close > c.open && (i > 0 && candles[i - 1].close > candles[i - 1].open)) {
          st.bosLevel = st.main;
          st.bosStartIdx = st.mainIdx;
        }
      }

      // Adjusted Points: update CHoCH with better pivot
      if (st.bosLevel !== null && recentPH && recentPH.price < (st.chochLevel ?? Infinity)) {
        st.chochLevel = recentPH.price;
        st.chochStartIdx = recentPH.idx;
      }

      // Check sweep on BOS (wick through but close back)
      if (st.bosLevel !== null && c.low <= st.bosLevel && c.close >= st.bosLevel) {
        structures.push({
          startIndex: st.bosStartIdx, startTime: candles[st.bosStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.bosLevel, type: 'BOS', direction: 'bear', isSweep: true,
        });
        st.bosLevel = c.low;
        st.bosStartIdx = i;
        continue;
      }

      // Check BOS confirm (close below)
      if (st.bosLevel !== null && c.close <= st.bosLevel) {
        structures.push({
          startIndex: st.bosStartIdx, startTime: candles[st.bosStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.bosLevel, type: 'BOS', direction: 'bear', isSweep: false,
        });
        // Find new CHoCH level (highest between bosStart and now)
        const hIdx = findHighest(st.bosStartIdx, i);
        st.chochLevel = candles[hIdx].high;
        st.chochStartIdx = hIdx;
        st.bosLevel = null;
        st.main = c.low;
        st.mainIdx = i;
        continue;
      }

      // Check sweep on CHoCH
      if (st.chochLevel !== null && c.high >= st.chochLevel && c.close <= st.chochLevel) {
        structures.push({
          startIndex: st.chochStartIdx, startTime: candles[st.chochStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.chochLevel, type: 'CHoCH', direction: 'bull', isSweep: true,
        });
        st.chochLevel = c.high;
        st.chochStartIdx = i;
        continue;
      }

      // Check CHoCH confirm (close above — trend change to bull)
      if (st.chochLevel !== null && c.close >= st.chochLevel) {
        structures.push({
          startIndex: st.chochStartIdx, startTime: candles[st.chochStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.chochLevel, type: 'CHoCH', direction: 'bull', isSweep: false,
        });
        st.trend = 1;
        // Find new CHoCH level for bull (lowest between chochStart and now)
        const lIdx = st.bosLevel !== null
          ? findLowest(st.bosStartIdx, i)
          : findLowest(st.mainIdx, i);
        st.chochLevel = candles[lIdx].low;
        st.chochStartIdx = lIdx;
        st.bosLevel = null;
        st.main = c.high;
        st.mainIdx = i;
        continue;
      }
    } else {
      // Bull trend: tracking highs for BOS, lows for CHoCH
      if (c.high > st.main) {
        st.main = c.high;
        st.mainIdx = i;
      }

      // Create BOS level
      if (st.bosLevel === null) {
        if (crossdn && c.close < c.open && (i > 0 && candles[i - 1].close < candles[i - 1].open)) {
          st.bosLevel = st.main;
          st.bosStartIdx = st.mainIdx;
        }
      }

      // Adjusted Points: update CHoCH with better pivot
      if (st.bosLevel !== null && recentPL && recentPL.price > (st.chochLevel ?? -Infinity)) {
        st.chochLevel = recentPL.price;
        st.chochStartIdx = recentPL.idx;
      }

      // Sweep on BOS
      if (st.bosLevel !== null && c.high >= st.bosLevel && c.close <= st.bosLevel) {
        structures.push({
          startIndex: st.bosStartIdx, startTime: candles[st.bosStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.bosLevel, type: 'BOS', direction: 'bull', isSweep: true,
        });
        st.bosLevel = c.high;
        st.bosStartIdx = i;
        continue;
      }

      // BOS confirm
      if (st.bosLevel !== null && c.close >= st.bosLevel) {
        structures.push({
          startIndex: st.bosStartIdx, startTime: candles[st.bosStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.bosLevel, type: 'BOS', direction: 'bull', isSweep: false,
        });
        const lIdx = findLowest(st.bosStartIdx, i);
        st.chochLevel = candles[lIdx].low;
        st.chochStartIdx = lIdx;
        st.bosLevel = null;
        st.main = c.high;
        st.mainIdx = i;
        continue;
      }

      // Sweep on CHoCH
      if (st.chochLevel !== null && c.low <= st.chochLevel && c.close >= st.chochLevel) {
        structures.push({
          startIndex: st.chochStartIdx, startTime: candles[st.chochStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.chochLevel, type: 'CHoCH', direction: 'bear', isSweep: true,
        });
        st.chochLevel = c.low;
        st.chochStartIdx = i;
        continue;
      }

      // CHoCH confirm (trend change to bear)
      if (st.chochLevel !== null && c.close <= st.chochLevel) {
        structures.push({
          startIndex: st.chochStartIdx, startTime: candles[st.chochStartIdx].time,
          endIndex: i, endTime: c.time,
          price: st.chochLevel, type: 'CHoCH', direction: 'bear', isSweep: false,
        });
        st.trend = -1;
        const hIdx = st.bosLevel !== null
          ? findHighest(st.bosStartIdx, i)
          : findHighest(st.mainIdx, i);
        st.chochLevel = candles[hIdx].high;
        st.chochStartIdx = hIdx;
        st.bosLevel = null;
        st.main = c.low;
        st.mainIdx = i;
        continue;
      }
    }
  }

  return { structures, trend: st.trend };
}

// ═══════════════════════════════════════════════════════════════
// Order Block Detection (ATR-based sizing like Pine Script)
// ═══════════════════════════════════════════════════════════════
function detectOrderBlocks(
  candles: Candle[],
  structures: StructureBreak[],
  obLen: number = 5,
  mitigation: 'Close' | 'Wick' | 'Avg' = 'Close',
): OrderBlock[] {
  const obs: OrderBlock[] = [];
  if (candles.length < 10) return obs;

  const atrBase = computeATR(candles, 200);
  const atrUnit = atrBase / (5 / obLen);

  for (const s of structures) {
    if (s.isSweep) continue; // No OB on sweeps
    const idx = s.endIndex;
    if (idx < 2 || idx >= candles.length) continue;

    // Find the OB candle: highest/lowest between structure start and break
    if (s.direction === 'bull') {
      // Bull structure → bearish OB (supply became demand)
      // Find the lowest low between startIndex and endIndex
      let obIdx = s.startIndex;
      for (let j = s.startIndex; j < s.endIndex; j++) {
        if (candles[j].low < candles[obIdx].low) obIdx = j;
      }
      const obCandle = candles[obIdx];
      const top = obLen > 1
        ? Math.min(obCandle.low + atrUnit, obCandle.high)
        : obCandle.high;
      obs.push({
        top,
        bottom: obCandle.low,
        avg: (top + obCandle.low) / 2,
        startTime: obCandle.time,
        endTime: candles[candles.length - 1].time,
        startIndex: obIdx,
        endIndex: candles.length - 1,
        bull: true,
        mitigated: false,
        volume: obCandle.volume,
      });
    } else {
      // Bear structure → bullish OB (demand became supply)
      let obIdx = s.startIndex;
      for (let j = s.startIndex; j < s.endIndex; j++) {
        if (candles[j].high > candles[obIdx].high) obIdx = j;
      }
      const obCandle = candles[obIdx];
      const bottom = obLen > 1
        ? Math.max(obCandle.high - atrUnit, obCandle.low)
        : obCandle.low;
      obs.push({
        top: obCandle.high,
        bottom,
        avg: (obCandle.high + bottom) / 2,
        startTime: obCandle.time,
        endTime: candles[candles.length - 1].time,
        startIndex: obIdx,
        endIndex: candles.length - 1,
        bull: false,
        mitigated: false,
        volume: obCandle.volume,
      });
    }
  }

  // Check mitigation
  for (const ob of obs) {
    for (let i = ob.startIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      const mitiCheck = (bull: boolean) => {
        if (bull) {
          if (mitigation === 'Close') return Math.min(c.close, c.open) < ob.bottom;
          if (mitigation === 'Wick') return c.low < ob.bottom;
          return c.low < ob.avg;
        } else {
          if (mitigation === 'Close') return Math.max(c.close, c.open) > ob.top;
          if (mitigation === 'Wick') return c.high > ob.top;
          return c.high > ob.avg;
        }
      };
      if (mitiCheck(ob.bull)) {
        ob.mitigated = true;
        ob.mitigatedTime = c.time;
        ob.endTime = c.time;
        ob.endIndex = i;
        break;
      }
    }
  }

  // Remove overlapping OBs (keep most recent)
  const removeOverlap = (blocks: OrderBlock[]) => {
    for (let i = blocks.length - 1; i > 0; i--) {
      const a = blocks[i];
      const b = blocks[0]; // most recent
      if (a === b) continue;
      const overlaps =
        (a.bottom > b.bottom && a.bottom < b.top) ||
        (a.top < b.top && a.bottom > b.bottom) ||
        (a.top > b.top && a.bottom < b.bottom) ||
        (a.top < b.top && a.top > b.bottom);
      if (overlaps) blocks.splice(i, 1);
    }
  };

  const bullOBs = obs.filter(o => o.bull);
  const bearOBs = obs.filter(o => !o.bull);
  removeOverlap(bullOBs);
  removeOverlap(bearOBs);

  // Return last 5 active + last 3 mitigated
  const active = [...bullOBs, ...bearOBs].filter(o => !o.mitigated).slice(-5);
  const mitigated = [...bullOBs, ...bearOBs].filter(o => o.mitigated).slice(-3);
  return [...active, ...mitigated];
}

// ═══════════════════════════════════════════════════════════════
// Fair Value Gap Detection
// ═══════════════════════════════════════════════════════════════
function detectFVGs(candles: Candle[], mitigation: 'Close' | 'Wick' | 'Avg' = 'Close'): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const curr = candles[i];
    const mid = candles[i - 1];

    // Bullish FVG: current low > prev2 high AND mid candle bullish
    if (curr.low > prev2.high && mid.close > mid.open) {
      fvgs.push({
        top: curr.low, bottom: prev2.high,
        time: mid.time, index: i - 1,
        bull: true, mitigated: false,
      });
    }
    // Bearish FVG: prev2 low > current high AND mid candle bearish
    if (prev2.low > curr.high && mid.close < mid.open) {
      fvgs.push({
        top: prev2.low, bottom: curr.high,
        time: mid.time, index: i - 1,
        bull: false, mitigated: false,
      });
    }
  }

  // Check mitigation
  for (const fvg of fvgs) {
    for (let i = fvg.index + 2; i < candles.length; i++) {
      const c = candles[i];
      if (fvg.bull) {
        const hit = mitigation === 'Close' ? Math.min(c.close, c.open) < fvg.bottom
          : mitigation === 'Wick' ? c.low < fvg.bottom
          : c.low < (fvg.top + fvg.bottom) / 2;
        if (hit) { fvg.mitigated = true; break; }
      } else {
        const hit = mitigation === 'Close' ? Math.max(c.close, c.open) > fvg.top
          : mitigation === 'Wick' ? c.high > fvg.top
          : c.high > (fvg.top + fvg.bottom) / 2;
        if (hit) { fvg.mitigated = true; break; }
      }
    }
  }

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

  const highs = pivots.filter(p => p.type === 'high').slice(-30);
  const lows = pivots.filter(p => p.type === 'low').slice(-30);

  const findZone = (points: SwingPoint[], type: 'resistance' | 'support') => {
    if (points.length < 2) return;
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

  const currentPrice = candles[candles.length - 1].close;
  return zones
    .sort((a, b) => {
      const distA = Math.min(Math.abs(a.top - currentPrice), Math.abs(a.bottom - currentPrice));
      const distB = Math.min(Math.abs(b.top - currentPrice), Math.abs(b.bottom - currentPrice));
      return distA - distB;
    })
    .slice(0, 4);
}

// ═══════════════════════════════════════════════════════════════
// Main Hook
// ═══════════════════════════════════════════════════════════════
export function useEngineIndicator(candles: Candle[], enabled: boolean): EngineData | null {
  return useMemo(() => {
    if (!enabled || candles.length < 30) return null;

    const pivotStrength = 5;
    const swings = detectPivots(candles, pivotStrength);
    const { structures, trend } = detectMarketStructure(candles, swings, pivotStrength);
    const orderBlocks = detectOrderBlocks(candles, structures, 5, 'Close');
    const fvgs = detectFVGs(candles, 'Close');
    const trendZones = detectTrendZones(candles, swings);

    return { swings, structures, orderBlocks, fvgs, trendZones, trend };
  }, [candles, enabled]);
}
