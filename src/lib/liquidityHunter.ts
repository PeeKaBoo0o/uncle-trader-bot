import type { Candle } from '@/hooks/useMarketData';

export interface LiquidityZone {
  price: number;
  type: 'high' | 'low';
  startIndex: number;
  endIndex: number;
  swept: boolean;
}

export interface LiquidityGrab {
  index: number;
  type: 'buyside' | 'sellside';
  price: number;
}

export interface TradeEntry {
  entryIndex: number;
  entryPrice: number;
  type: 'Long' | 'Short';
  slTarget: number;
  tp1: number;
  tp2: number;
  tp3: number;
  exitIndex?: number;
  exitPrice?: number;
  result?: 'TP1' | 'TP2' | 'TP3' | 'SL';
  grabIndex: number;
  grabPrice: number;
}

export interface LiquidityResult {
  zones: LiquidityZone[];
  grabs: LiquidityGrab[];
  trades: TradeEntry[];
  stats: { total: number; tp: number; losses: number; winrate: number };
}

type TsState = 'waiting_liq_break' | 'waiting_execution' | 'entry_taken';

interface TsContext {
  state: TsState;
  startIndex: number;
  lastHourHigh: number;
  lastHourLow: number;
  brokenSweepIndex?: number;
  brokenSweepPrice?: number;
  brokenSweepSide?: 'buyside' | 'sellside';
  entryType?: 'Long' | 'Short';
  entryIndex?: number;
  entryPrice?: number;
  slTarget?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  hitTP1: boolean;
  hitTP2: boolean;
  hitTP3: boolean;
  highZone: LiquidityZone;
  lowZone: LiquidityZone;
}

function getHighest(candles: Candle[], endIndex: number, length: number): number {
  const start = Math.max(0, endIndex - length + 1);
  let hh = -Infinity;
  for (let i = start; i <= endIndex; i++) {
    if (candles[i].high > hh) hh = candles[i].high;
  }
  return hh;
}

function getLowest(candles: Candle[], endIndex: number, length: number): number {
  const start = Math.max(0, endIndex - length + 1);
  let ll = Infinity;
  for (let i = start; i <= endIndex; i++) {
    if (candles[i].low < ll) ll = candles[i].low;
  }
  return ll;
}

function computeAtr(candles: Candle[], atrLen: number): Float64Array {
  const atr = new Float64Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      atr[i] = candles[i].high - candles[i].low;
      continue;
    }

    const start = Math.max(0, i - atrLen + 1);
    let sum = 0;
    let count = 0;

    for (let j = start; j <= i; j++) {
      const prevClose = candles[Math.max(0, j - 1)].close;
      const tr = Math.max(
        candles[j].high - candles[j].low,
        Math.abs(candles[j].high - prevClose),
        Math.abs(candles[j].low - prevClose),
      );
      sum += tr;
      count++;
    }

    atr[i] = count > 0 ? sum / count : 0;
  }

  return atr;
}

/**
 * Liquidity Hunter port from Pine Script (Classic + Dynamic TP/SL core behavior).
 */
export function computeLiquidityZones(
  candles: Candle[],
  mssOffset: number = 10,
  htfMultiplier: number = 4,
  breakoutMethod: 'Wick' | 'Close' = 'Wick',
): LiquidityResult {
  const len = candles.length;
  if (len < Math.max(30, mssOffset + htfMultiplier + 5)) {
    return { zones: [], grabs: [], trades: [], stats: { total: 0, tp: 0, losses: 0, winrate: 0 } };
  }

  const barLength = Math.max(2, htfMultiplier);
  const atr = computeAtr(candles, 5);

  const zones: LiquidityZone[] = [];
  const grabs: LiquidityGrab[] = [];
  const trades: TradeEntry[] = [];

  // Pine defaults in shared script
  const slATRMult = 3.5; // Risk = Low
  const RR = 0.9;

  let ts: TsContext | null = null;

  const startIdx = Math.max(barLength + mssOffset + 2, len - 800);

  for (let i = startIdx; i < len; i++) {
    const c = candles[i];

    if (!ts) {
      const lastHourHigh = getHighest(candles, i, barLength);
      const lastHourLow = getLowest(candles, i, barLength);

      const highZone: LiquidityZone = {
        price: lastHourHigh,
        type: 'high',
        startIndex: i,
        endIndex: len - 1,
        swept: false,
      };
      const lowZone: LiquidityZone = {
        price: lastHourLow,
        type: 'low',
        startIndex: i,
        endIndex: len - 1,
        swept: false,
      };

      zones.push(highZone, lowZone);

      ts = {
        state: 'waiting_liq_break',
        startIndex: i,
        lastHourHigh,
        lastHourLow,
        hitTP1: false,
        hitTP2: false,
        hitTP3: false,
        highZone,
        lowZone,
      };

      continue;
    }

    const breakDownValue = breakoutMethod === 'Close' ? c.close : c.low;
    const breakUpValue = breakoutMethod === 'Close' ? c.close : c.high;

    if (ts.state === 'waiting_liq_break') {
      if (i <= ts.startIndex) continue;

      if (breakDownValue < ts.lastHourLow) {
        ts.state = 'waiting_execution';
        ts.brokenSweepIndex = i;
        ts.brokenSweepPrice = ts.lastHourLow;
        ts.brokenSweepSide = 'sellside';
        ts.entryType = 'Long';
        ts.lowZone.swept = true;
        ts.lowZone.endIndex = i;

        grabs.push({ index: i, type: 'sellside', price: c.low });
      } else if (breakUpValue > ts.lastHourHigh) {
        ts.state = 'waiting_execution';
        ts.brokenSweepIndex = i;
        ts.brokenSweepPrice = ts.lastHourHigh;
        ts.brokenSweepSide = 'buyside';
        ts.entryType = 'Short';
        ts.highZone.swept = true;
        ts.highZone.endIndex = i;

        grabs.push({ index: i, type: 'buyside', price: c.high });
      }

      continue;
    }

    if (ts.state === 'waiting_execution') {
      if (ts.brokenSweepIndex === undefined || ts.entryType === undefined) continue;
      if (i <= ts.brokenSweepIndex || i - 1 < 0) continue;

      const prevMssHigh = getHighest(candles, i - 1, mssOffset);
      const prevMssLow = getLowest(candles, i - 1, mssOffset);

      if (ts.entryType === 'Short') {
        if (breakDownValue < prevMssLow) {
          const entryPrice = breakoutMethod === 'Close' ? c.close : prevMssLow;
          const slTarget = getHighest(candles, i, mssOffset) + atr[i] * slATRMult;
          const tpTarget = entryPrice - Math.abs(entryPrice - slTarget) * RR;

          ts.state = 'entry_taken';
          ts.entryIndex = i;
          ts.entryPrice = entryPrice;
          ts.slTarget = slTarget;
          ts.tp1 = entryPrice + (tpTarget - entryPrice) * 0.33;
          ts.tp2 = entryPrice + (tpTarget - entryPrice) * 0.66;
          ts.tp3 = tpTarget;
          ts.hitTP1 = false;
          ts.hitTP2 = false;
          ts.hitTP3 = false;
        }
      } else {
        if (breakUpValue > prevMssHigh) {
          const entryPrice = breakoutMethod === 'Close' ? c.close : prevMssHigh;
          const slTarget = getLowest(candles, i, mssOffset) - atr[i] * slATRMult;
          const tpTarget = entryPrice + Math.abs(entryPrice - slTarget) * RR;

          ts.state = 'entry_taken';
          ts.entryIndex = i;
          ts.entryPrice = entryPrice;
          ts.slTarget = slTarget;
          ts.tp1 = entryPrice + (tpTarget - entryPrice) * 0.33;
          ts.tp2 = entryPrice + (tpTarget - entryPrice) * 0.66;
          ts.tp3 = tpTarget;
          ts.hitTP1 = false;
          ts.hitTP2 = false;
          ts.hitTP3 = false;
        }
      }

      continue;
    }

    if (ts.state === 'entry_taken') {
      if (
        ts.entryIndex === undefined ||
        ts.entryPrice === undefined ||
        ts.slTarget === undefined ||
        ts.tp1 === undefined ||
        ts.tp2 === undefined ||
        ts.tp3 === undefined ||
        ts.brokenSweepIndex === undefined ||
        ts.brokenSweepPrice === undefined ||
        ts.entryType === undefined
      ) {
        continue;
      }

      const isLong = ts.entryType === 'Long';

      if (!ts.hitTP1 && ((isLong && c.high >= ts.tp1) || (!isLong && c.low <= ts.tp1))) ts.hitTP1 = true;
      if (!ts.hitTP2 && ((isLong && c.high >= ts.tp2) || (!isLong && c.low <= ts.tp2))) ts.hitTP2 = true;
      if (!ts.hitTP3 && ((isLong && c.high >= ts.tp3) || (!isLong && c.low <= ts.tp3))) ts.hitTP3 = true;

      let result: TradeEntry['result'] | undefined;
      let exitPrice: number | undefined;

      if (ts.hitTP3) {
        result = 'TP3';
        exitPrice = ts.tp3;
      } else if (ts.hitTP2 && ((isLong && c.low <= ts.tp1) || (!isLong && c.high >= ts.tp1))) {
        result = 'TP2';
        exitPrice = ts.tp2;
      } else if (ts.hitTP1 && ((isLong && c.low <= ts.entryPrice) || (!isLong && c.high >= ts.entryPrice))) {
        result = 'TP1';
        exitPrice = ts.tp1;
      } else if (!ts.hitTP1 && ((isLong && c.low <= ts.slTarget) || (!isLong && c.high >= ts.slTarget))) {
        result = 'SL';
        exitPrice = ts.slTarget;
      }

      if (result) {
        trades.push({
          entryIndex: ts.entryIndex,
          entryPrice: ts.entryPrice,
          type: ts.entryType,
          slTarget: ts.slTarget,
          tp1: ts.tp1,
          tp2: ts.tp2,
          tp3: ts.tp3,
          exitIndex: i,
          exitPrice,
          result,
          grabIndex: ts.brokenSweepIndex,
          grabPrice: ts.brokenSweepPrice,
        });

        ts.highZone.endIndex = i;
        ts.lowZone.endIndex = i;
        ts = null;
      }
    }
  }

  if (
    ts &&
    ts.state === 'entry_taken' &&
    ts.entryIndex !== undefined &&
    ts.entryPrice !== undefined &&
    ts.entryType !== undefined &&
    ts.slTarget !== undefined &&
    ts.tp1 !== undefined &&
    ts.tp2 !== undefined &&
    ts.tp3 !== undefined &&
    ts.brokenSweepIndex !== undefined &&
    ts.brokenSweepPrice !== undefined
  ) {
    trades.push({
      entryIndex: ts.entryIndex,
      entryPrice: ts.entryPrice,
      type: ts.entryType,
      slTarget: ts.slTarget,
      tp1: ts.tp1,
      tp2: ts.tp2,
      tp3: ts.tp3,
      grabIndex: ts.brokenSweepIndex,
      grabPrice: ts.brokenSweepPrice,
    });
  }

  const recentZones = zones.slice(-50);
  const completedTrades = trades.filter(t => t.result);
  const tpCount = completedTrades.filter(t => t.result && t.result !== 'SL').length;
  const slCount = completedTrades.filter(t => t.result === 'SL').length;
  const total = tpCount + slCount;

  return {
    zones: recentZones,
    grabs,
    trades,
    stats: {
      total,
      tp: tpCount,
      losses: slCount,
      winrate: total > 0 ? (tpCount / total) * 100 : 0,
    },
  };
}
