import type { Candle } from '@/hooks/useMarketData';

/**
 * Alphanet Wyckoff Premium
 * Ported from Pine Script v5
 *
 * Detects Wyckoff phases:
 * - Accumulation / Distribution boxes (sideways ranges)
 * - SC (Selling Climax), AR (Automatic Rally), ST (Secondary Test)
 * - BC (Buying Climax), DAR (Automatic Reaction), DST (Distribution ST)
 * - Spring / UTAD events
 * - BUY/SELL breakout signals after sideways
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

// ── Pivot detection ──
function pivotHigh(highs: number[], left: number, right: number): (number | null)[] {
  const result: (number | null)[] = new Array(highs.length).fill(null);
  for (let i = left; i < highs.length - right; i++) {
    let is = true;
    for (let j = 1; j <= left; j++) if (highs[i - j] >= highs[i]) { is = false; break; }
    if (!is) continue;
    for (let j = 1; j <= right; j++) if (highs[i + j] >= highs[i]) { is = false; break; }
    if (is) result[i] = highs[i];
  }
  return result;
}

function pivotLow(lows: number[], left: number, right: number): (number | null)[] {
  const result: (number | null)[] = new Array(lows.length).fill(null);
  for (let i = left; i < lows.length - right; i++) {
    let is = true;
    for (let j = 1; j <= left; j++) if (lows[i - j] <= lows[i]) { is = false; break; }
    if (!is) continue;
    for (let j = 1; j <= right; j++) if (lows[i + j] <= lows[i]) { is = false; break; }
    if (is) result[i] = lows[i];
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
  label: string; // SC, AR, ST, BC, DAR, DST, Spring, UTAD
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

  // ── Determine trend state per bar ──
  // side = RSI within range OR previous RSI within range
  const side = new Array(n).fill(false);
  const bull = new Array(n).fill(false);
  const bear = new Array(n).fill(false);

  for (let i = 1; i < n; i++) {
    if (isNaN(rsi[i]) || isNaN(rsi[i - 1])) continue;
    side[i] = (rsi[i] < rsiHigh && rsi[i] > rsiLow) || (rsi[i - 1] < rsiHigh && rsi[i - 1] > rsiLow);
    bull[i] = rsi[i] > rsiHigh && rsi[i - 1] > rsiHigh;
    bear[i] = rsi[i] < rsiLow && rsi[i - 1] < rsiLow;
  }

  // ── Build sideways boxes ──
  const boxes: WyckoffBox[] = [];
  let sideStart = -1;

  for (let i = 1; i < n; i++) {
    // Detect side start: side[i] && !side[i-1]
    if (side[i] && !side[i - 1]) {
      sideStart = i;
    }
    // Detect side end: !side[i] && side[i-1]
    if (!side[i] && side[i - 1] && sideStart >= 0) {
      const endIdx = i - 1;
      if (endIdx > sideStart) {
        // Calculate high/low of the sideways range
        let boxHigh = -Infinity;
        let boxLow = Infinity;
        const safeLen = Math.min(endIdx - sideStart + 1, 63);
        for (let j = endIdx; j >= Math.max(sideStart, endIdx - safeLen + 1); j--) {
          if (highs[j] > boxHigh) boxHigh = highs[j];
          if (lows[j] < boxLow) boxLow = lows[j];
        }

        // Determine phase based on what comes after
        let phase: 'accumulation' | 'distribution' | 'sideways' = 'sideways';
        if (bull[i]) phase = 'accumulation';
        else if (bear[i]) phase = 'distribution';

        boxes.push({
          startIndex: sideStart,
          endIndex: endIdx,
          startTime: candles[sideStart].time,
          endTime: candles[endIdx].time,
          top: boxHigh,
          bottom: boxLow,
          phase,
        });
      }
      sideStart = -1;
    }
  }

  // ── Pivot detection ──
  const ph = pivotHigh(highs, pivotLen, pivotLen);
  const pl = pivotLow(lows, pivotLen, pivotLen);

  const pivots: WyckoffPivot[] = [];
  for (let i = 0; i < n; i++) {
    if (ph[i] !== null) pivots.push({ index: i, time: candles[i].time, price: ph[i]!, direction: 'high' });
    if (pl[i] !== null) pivots.push({ index: i, time: candles[i].time, price: pl[i]!, direction: 'low' });
  }

  // ── Wyckoff Events ──
  const events: WyckoffEvent[] = [];

  // Track flags like Pine Script (reset each new sideways)
  let scFound = false;
  let arFound = false;
  let stFound = false;
  let bcFound = false;
  let darFound = false;
  let dstFound = false;
  let scBarIdx = -1;
  let bcBarIdx = -1;
  let darBarIdx = -1;
  let pivotCounter = 0;

  for (let i = pivotLen; i < n - pivotLen; i++) {
    const rsiAtPivot = rsi[i];
    if (isNaN(rsiAtPivot)) continue;

    const isPivotLow = pl[i] !== null;
    const isPivotHigh = ph[i] !== null;

    // UTAD / Spring detection
    const utad = !isNaN(rsi[i]) && !isNaN(rsi[i - 1]) && rsi[i] < rsiHigh && rsi[i - 1] > rsiHigh;
    const spring = !isNaN(rsi[i]) && !isNaN(rsi[i - 1]) && rsi[i] > rsiLow && rsi[i - 1] < rsiLow;

    if (spring) {
      events.push({ index: i, time: candles[i].time, price: lows[i], label: 'Spring', type: 'accumulation', location: 'below' });
    }
    if (utad) {
      events.push({ index: i, time: candles[i].time, price: highs[i], label: 'UTAD', type: 'distribution', location: 'above' });
    }

    // ── Accumulation events ──
    // SC: Selling Climax
    if (isPivotLow && rsiAtPivot < rsiLow && !scFound && !spring) {
      events.push({ index: i, time: candles[i].time, price: lows[i], label: 'SC', type: 'accumulation', location: 'below' });
      scFound = true;
      scBarIdx = i;
    }

    // AR: Automatic Rally (after SC)
    if (scBarIdx > 0 && isPivotHigh && i > scBarIdx && !arFound) {
      events.push({ index: i, time: candles[i].time, price: highs[i], label: 'AR', type: 'accumulation', location: 'above' });
      arFound = true;
      scBarIdx = -1;
    }

    // ST: Secondary Test (accumulation)
    if (isPivotLow) pivotCounter++;
    if (rsiAtPivot < rsiLow) pivotCounter = 0;
    if (pivotCounter === 1 && isPivotLow && !stFound) {
      events.push({ index: i, time: candles[i].time, price: lows[i], label: 'ST', type: 'accumulation', location: 'below' });
      stFound = true;
    }

    // ── Distribution events ──
    // BC: Buying Climax
    if (rsiAtPivot > rsiHigh && isPivotHigh && !bcFound && !utad) {
      events.push({ index: i, time: candles[i].time, price: highs[i], label: 'BC', type: 'distribution', location: 'above' });
      bcFound = true;
      bcBarIdx = i;
    }

    // DAR: Automatic Reaction (after BC)
    if (bcBarIdx > 0 && isPivotLow && i > bcBarIdx && !darFound) {
      events.push({ index: i, time: candles[i].time, price: lows[i], label: 'AR', type: 'distribution', location: 'below' });
      darFound = true;
      darBarIdx = i;
      bcBarIdx = -1;
    }

    // DST: Distribution Secondary Test
    if (darBarIdx > 0 && isPivotHigh && i > darBarIdx && !dstFound && !bcFound) {
      events.push({ index: i, time: candles[i].time, price: highs[i], label: 'ST', type: 'distribution', location: 'above' });
      dstFound = true;
      darBarIdx = -1;
    }

    // Reset flags when new sideways starts
    if (side[i] && !side[i - 1]) {
      scFound = false; arFound = false; stFound = false;
      bcFound = false; darFound = false; dstFound = false;
      scBarIdx = -1; bcBarIdx = -1; darBarIdx = -1;
      pivotCounter = 0;
    }
  }

  // ── BUY/SELL breakout signals ──
  const signals: WyckoffSignal[] = [];
  for (let i = 2; i < n; i++) {
    if (!side[i] && side[i - 1]) {
      // End of sideways
      if (bull[i]) {
        signals.push({ index: i, time: candles[i].time, price: lows[i], type: 'BUY' });
      } else if (bear[i]) {
        signals.push({ index: i, time: candles[i].time, price: highs[i], type: 'SELL' });
      }
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
  // Check if we're in a box
  const lastBox = boxes[boxes.length - 1];
  if (lastBox && lastBox.endIndex >= n - 5) {
    currentPhase = lastBox.phase;
  }

  return { boxes, events, signals, pivots, currentPhase, rsi };
}
