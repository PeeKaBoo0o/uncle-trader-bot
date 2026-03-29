import type { Candle } from '@/hooks/useMarketData';

/**
 * Alphanet Wyckoff Premium
 * Exact port of Pine Script v5 by faytterro
 *
 * RSI-based trend detection → sideways boxes → Wyckoff phase events
 * SC, AR, ST (accumulation) / BC, DAR, DST (distribution)
 * BUY/SELL breakout after sideways
 */

// ── RSI ──
function computeRSI(closes: number[], period: number): number[] {
  const rsi = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff; else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

// ── Pivot detection (left/right bars) ──
function pivotHighArr(highs: number[], left: number, right: number): (number | null)[] {
  const result: (number | null)[] = new Array(highs.length).fill(null);
  for (let i = left; i < highs.length - right; i++) {
    let ok = true;
    for (let j = 1; j <= left; j++) if (highs[i - j] >= highs[i]) { ok = false; break; }
    if (!ok) continue;
    for (let j = 1; j <= right; j++) if (highs[i + j] >= highs[i]) { ok = false; break; }
    if (ok) result[i] = highs[i];
  }
  return result;
}

function pivotLowArr(lows: number[], left: number, right: number): (number | null)[] {
  const result: (number | null)[] = new Array(lows.length).fill(null);
  for (let i = left; i < lows.length - right; i++) {
    let ok = true;
    for (let j = 1; j <= left; j++) if (lows[i - j] <= lows[i]) { ok = false; break; }
    if (!ok) continue;
    for (let j = 1; j <= right; j++) if (lows[i + j] <= lows[i]) { ok = false; break; }
    if (ok) result[i] = lows[i];
  }
  return result;
}

// ── Types ──

export interface WyckoffBox {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  phase: 'accumulation' | 'distribution' | 'sideways';
}

export interface WyckoffEvent {
  index: number;
  time: number;
  price: number;
  label: string; // SC, AR, ST, BC, Spring, UTAD
  type: 'accumulation' | 'distribution';
  location: 'above' | 'below';
}

export interface WyckoffSignal {
  index: number;
  time: number;
  price: number;
  type: 'BUY' | 'SELL';
}

export interface WyckoffPivot {
  index: number;
  time: number;
  price: number;
  direction: 'high' | 'low';
}

export interface WyckoffResult {
  boxes: WyckoffBox[];
  events: WyckoffEvent[];
  signals: WyckoffSignal[];
  pivots: WyckoffPivot[];
  currentPhase: 'accumulation' | 'distribution' | 'sideways' | 'bullish' | 'bearish';
  rsi: number[];
}

export function computeWyckoff(
  candles: Candle[],
  options?: {
    rsiLen?: number;
    sensitivity?: number;
    pivotLen?: number;
  }
): WyckoffResult {
  const n = candles.length;
  const rsiLen = options?.rsiLen ?? 14;
  const rsisens = options?.sensitivity ?? 10;
  const pivotLen = options?.pivotLen ?? 5;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const rsi = computeRSI(closes, rsiLen);
  const rsiHigh = 50 + rsisens;
  const rsiLow = 50 - rsisens;

  // ── Per-bar trend state (Pine: side, bull, bear) ──
  const side = new Array(n).fill(false);
  const bull = new Array(n).fill(false);
  const bear = new Array(n).fill(false);

  for (let i = 1; i < n; i++) {
    if (isNaN(rsi[i]) || isNaN(rsi[i - 1])) continue;
    side[i] = (rsi[i] < rsiHigh && rsi[i] > rsiLow) || (rsi[i - 1] < rsiHigh && rsi[i - 1] > rsiLow);
    bull[i] = rsi[i] > rsiHigh && rsi[i - 1] > rsiHigh;
    bear[i] = rsi[i] < rsiLow && rsi[i - 1] < rsiLow;
  }

  // ── Pine: myhigh / mylow over barssince(side start) ──
  // boxlen = ta.barssince(side and not side[1])
  // safeBoxlen = min(boxlen+1, 63)
  // y1 = myhigh(safeBoxlen)[2], y2 = mylow(safeBoxlen)[2]
  // x1 = valuewhen(side and not side[1], bar_index, 0)
  // x2 = valuewhen(not side and side[1], bar_index[1], 0) - 1

  const boxes: WyckoffBox[] = [];
  let sideStartIdx = -1; // x1: where side started

  for (let i = 1; i < n; i++) {
    // Detect side start
    if (side[i] && !side[i - 1]) {
      sideStartIdx = i;
    }

    // Detect side end: side[i-1] && !side[i]
    if (!side[i] && side[i - 1] && sideStartIdx >= 0) {
      const x1 = sideStartIdx;
      const x2 = i - 1; // Pine: valuewhen(not side and side[1], bar_index[1], 0) - 1

      if (x1 < x2) {
        // Compute range high/low within the sideways period (with [2] offset like Pine)
        const lookback = Math.min(x2 - x1 + 1, 63);
        let boxHigh = -Infinity;
        let boxLow = Infinity;
        // Pine uses [2] offset, so we look at range ending 2 bars before end
        const rangeEnd = Math.max(x1, x2 - 2);
        for (let j = x1; j <= rangeEnd; j++) {
          if (highs[j] > boxHigh) boxHigh = highs[j];
          if (lows[j] < boxLow) boxLow = lows[j];
        }
        // Fallback: if rangeEnd was too narrow, include full range
        if (boxHigh === -Infinity || boxLow === Infinity) {
          for (let j = x1; j <= x2; j++) {
            if (highs[j] > boxHigh) boxHigh = highs[j];
            if (lows[j] < boxLow) boxLow = lows[j];
          }
        }

        // Phase: determined by what comes AFTER sideways
        let phase: 'accumulation' | 'distribution' | 'sideways' = 'sideways';
        // Pine: after_trend is set by bull/bear state
        if (bull[i]) phase = 'accumulation';
        else if (bear[i]) phase = 'distribution';

        boxes.push({
          startIndex: x1,
          endIndex: x2,
          startTime: candles[x1].time,
          endTime: candles[x2].time,
          top: boxHigh,
          bottom: boxLow,
          phase,
        });
      }
      sideStartIdx = -1;
    }
  }

  // ── Pivot detection ──
  const ph = pivotHighArr(highs, pivotLen, pivotLen);
  const pl = pivotLowArr(lows, pivotLen, pivotLen);

  const pivots: WyckoffPivot[] = [];
  for (let i = 0; i < n; i++) {
    if (ph[i] !== null) pivots.push({ index: i, time: candles[i].time, price: ph[i]!, direction: 'high' });
    if (pl[i] !== null) pivots.push({ index: i, time: candles[i].time, price: pl[i]!, direction: 'low' });
  }

  // ── Wyckoff Events (Pine Script exact logic) ──
  const events: WyckoffEvent[] = [];

  // Pine: flags are reset each bar (bar_index != bar_index[1] always true)
  // But flags persist within the SAME phase detection run
  // Pine resets at each new bar, but flags accumulate — they're var flags
  // In Pine, isSCFlag := isSC ? true : isSCFlag means once SC found, flag stays true
  // Reset happens at: if bar_index != bar_index[1] → always true (every bar)
  // Wait, Pine resets flags EVERY bar?? Let me re-read...
  // "if bar_index != bar_index[1]" is always true in Pine (bar_index increments each bar)
  // So flags reset every bar → meaning each bar can independently be SC, AR, etc.
  // This means: on each bar, check conditions fresh (no persistent state)

  let scBarIndex = -1;
  let bcBarIndex = -1;
  let darBarIndex = -1;
  let pivotCounter = 0;

  for (let i = pivotLen; i < n - pivotLen; i++) {
    const rsiAtPivot = rsi[i]; // Pine: rsi[pivotLen] when checking at i+pivotLen
    if (isNaN(rsiAtPivot)) continue;

    const isPivotLow = pl[i] !== null;
    const isPivotHigh = ph[i] !== null;

    // UTAD / Spring (Pine: utad = rsi<rsiHigh and rsi[1]>rsiHigh)
    const utad = !isNaN(rsi[i]) && !isNaN(rsi[i - 1]) && rsi[i] < rsiHigh && rsi[i - 1] > rsiHigh;
    const spring = !isNaN(rsi[i]) && !isNaN(rsi[i - 1]) && rsi[i] > rsiLow && rsi[i - 1] < rsiLow;

    // Pine: flags reset every bar, so each event type can fire at most once per bar
    // But scBarIndex, bcBarIndex, darBarIndex persist across bars

    // ── Accumulation ──
    // SC: Selling Climax
    const isSC = isPivotLow && rsiAtPivot < rsiLow && !spring;
    if (isSC) {
      events.push({ index: i, time: candles[i].time, price: lows[i], label: 'SC', type: 'accumulation', location: 'below' });
      scBarIndex = i;
    }

    // AR: Automatic Rally (first pivot high after SC)
    if (scBarIndex > 0 && isPivotHigh && i > scBarIndex) {
      events.push({ index: i, time: candles[i].time, price: highs[i], label: 'AR', type: 'accumulation', location: 'above' });
      scBarIndex = -1; // consumed
    }

    // ST: Secondary Test (accumulation) — first pivot low after RSI was above rsiLow
    if (isPivotLow) pivotCounter++;
    if (rsiAtPivot < rsiLow) pivotCounter = 0;
    if (pivotCounter === 1 && isPivotLow) {
      events.push({ index: i, time: candles[i].time, price: lows[i], label: 'ST', type: 'accumulation', location: 'below' });
    }

    // ── Distribution ──
    // BC: Buying Climax
    const isBC = rsiAtPivot > rsiHigh && isPivotHigh && !utad;
    if (isBC) {
      events.push({ index: i, time: candles[i].time, price: highs[i], label: 'BC', type: 'distribution', location: 'above' });
      bcBarIndex = i;
    }

    // DAR: Automatic Reaction (first pivot low after BC)
    if (bcBarIndex > 0 && isPivotLow && i > bcBarIndex) {
      events.push({ index: i, time: candles[i].time, price: lows[i], label: 'AR', type: 'distribution', location: 'below' });
      darBarIndex = i;
      bcBarIndex = -1; // consumed
    }

    // DST: Distribution ST (first pivot high after DAR, but not BC)
    if (darBarIndex > 0 && isPivotHigh && i > darBarIndex && !isBC) {
      events.push({ index: i, time: candles[i].time, price: highs[i], label: 'ST', type: 'distribution', location: 'above' });
      darBarIndex = -1; // consumed
    }
  }

  // ── BUY/SELL breakout signals ──
  // Pine: bullBreak = endSide and bull and x1 < x2
  // endSide = side[1] and not side (offset -1)
  const signals: WyckoffSignal[] = [];
  for (let i = 2; i < n; i++) {
    const endSide = side[i - 1] && !side[i];
    if (endSide && bull[i]) {
      signals.push({ index: i - 1, time: candles[i - 1].time, price: lows[i - 1], type: 'BUY' });
    } else if (endSide && bear[i]) {
      signals.push({ index: i - 1, time: candles[i - 1].time, price: highs[i - 1], type: 'SELL' });
    }
  }

  // Current phase
  const lastRsi = rsi[n - 1];
  let currentPhase: WyckoffResult['currentPhase'] = 'sideways';
  if (!isNaN(lastRsi)) {
    if (side[n - 1]) currentPhase = 'sideways';
    else if (bull[n - 1]) currentPhase = 'bullish';
    else if (bear[n - 1]) currentPhase = 'bearish';
  }
  const lastBox = boxes[boxes.length - 1];
  if (lastBox && lastBox.endIndex >= n - 5) {
    currentPhase = lastBox.phase;
  }

  return { boxes, events, signals, pivots, currentPhase, rsi };
}
