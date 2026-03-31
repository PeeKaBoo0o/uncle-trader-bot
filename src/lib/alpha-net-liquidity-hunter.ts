export type BreakoutMethod = 'Close' | 'Wick';
export type EntryMethod = 'Classic' | 'Adaptive';
export type TpslMethod = 'Dynamic' | 'Fixed';
export type RiskAmount = 'Highest' | 'High' | 'Normal' | 'Low' | 'Lowest';
export type TradeDirection = 'Long' | 'Short';
export type TurtleState =
  | 'Waiting For Liquidity Break'
  | 'Waiting For Execution'
  | 'Entry Taken'
  | 'Take Profit'
  | 'Stop Loss'
  | 'Done';
export type TpResult = 'None' | 'TP1' | 'TP2' | 'TP3';

export interface Candle {
  time: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Sweep {
  startTime: number;
  endTime: number;
  side: 'Sellside' | 'Buyside';
  price: number;
}

export interface TurtleSoupTrade {
  state: TurtleState;
  startTime: number;
  lastHour?: number;
  lastHourHigh?: number;
  lastHourLow?: number;
  brokenSweep?: Sweep;
  slTarget?: number;
  tpTarget?: number;
  entryType?: TradeDirection;
  entryTime?: number;
  exitTime?: number;
  entryPrice?: number;
  exitPrice?: number;
  dayEndedBeforeExit?: number;
  hitTP1: boolean;
  hitTP2: boolean;
  hitTP3: boolean;
  tpResult: TpResult;
}

export interface IndicatorConfig {
  maxDistanceToLastBar: number;
  atrLen: number;
  mssOffset: number;
  higherTimeframeMinutes: number;
  breakoutMethod: BreakoutMethod;
  entryMethod: EntryMethod;
  tpslMethod: TpslMethod;
  riskAmount: RiskAmount;
  customSLATRMult: number;
  tpPercent: number;
  slPercent: number;
  RR: number;
  showHL: boolean;
  showLiqGrabs: boolean;
  showTPSL: boolean;
}

export interface IndicatorEvent {
  time: number;
  type: 'buy' | 'sell' | 'tp' | 'sl';
  tradeIndex: number;
  price?: number;
  tpResult?: TpResult;
}

export interface LiquidityZone {
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  side: 'buy' | 'sell';
  label: string;
}

export interface Marker {
  time: number;
  price: number;
  type:
    | 'liq-grab-buy'
    | 'liq-grab-sell'
    | 'entry-buy'
    | 'entry-sell'
    | 'tp'
    | 'sl'
    | 'exit';
  text?: string;
}

export interface LevelLine {
  fromTime: number;
  toTime: number;
  price: number;
  type: 'tp1' | 'tp2' | 'tp3' | 'sl' | 'entry-to-tp' | 'entry-to-sl';
}

export interface BacktestStats {
  totalEntries: number;
  tp1Count: number;
  tp2Count: number;
  tp3Count: number;
  losses: number;
  winrate: number;
}

export interface IndicatorOutput {
  trades: TurtleSoupTrade[];
  events: IndicatorEvent[];
  liquidityZones: LiquidityZone[];
  markers: Marker[];
  lines: LevelLine[];
  stats: BacktestStats;
}

export const defaultConfig: IndicatorConfig = {
  maxDistanceToLastBar: 4900,
  atrLen: 5,
  mssOffset: 10,
  higherTimeframeMinutes: 60,
  breakoutMethod: 'Wick',
  entryMethod: 'Classic',
  tpslMethod: 'Dynamic',
  riskAmount: 'Low',
  customSLATRMult: 6.5,
  tpPercent: 0.3,
  slPercent: 0.4,
  RR: 0.9,
  showHL: false,
  showLiqGrabs: true,
  showTPSL: true,
};

interface EngineState {
  trades: TurtleSoupTrade[];
  lastTS?: TurtleSoupTrade;
  highBreaks: number;
  lowBreaks: number;
  events: IndicatorEvent[];
}

function highest(candles: Candle[], endIndex: number, length: number, source: keyof Candle): number | undefined {
  if (endIndex < 0 || length <= 0 || endIndex - length + 1 < 0) return undefined;
  let value = -Infinity;
  for (let i = endIndex - length + 1; i <= endIndex; i++) value = Math.max(value, candles[i][source] as number);
  return Number.isFinite(value) ? value : undefined;
}

function lowest(candles: Candle[], endIndex: number, length: number, source: keyof Candle): number | undefined {
  if (endIndex < 0 || length <= 0 || endIndex - length + 1 < 0) return undefined;
  let value = Infinity;
  for (let i = endIndex - length + 1; i <= endIndex; i++) value = Math.min(value, candles[i][source] as number);
  return Number.isFinite(value) ? value : undefined;
}

function trueRange(curr: Candle, prev?: Candle): number {
  if (!prev) return curr.high - curr.low;
  return Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close));
}

function atr(candles: Candle[], endIndex: number, length: number): number | undefined {
  if (endIndex <= 0 || endIndex - length + 1 < 0) return undefined;
  let sum = 0;
  for (let i = endIndex - length + 1; i <= endIndex; i++) sum += trueRange(candles[i], candles[i - 1]);
  return sum / length;
}

function slATRMult(config: IndicatorConfig): number {
  switch (config.riskAmount) {
    case 'Highest': return 10;
    case 'High': return 6.5;
    case 'Normal': return 5.5;
    case 'Low': return 3.5;
    case 'Lowest': return 1.15;
    default: return config.customSLATRMult;
  }
}

function calcTpLevels(trade: TurtleSoupTrade): { tp1: number; tp2: number; tp3: number } {
  const entry = trade.entryPrice!;
  const target = trade.tpTarget!;
  return {
    tp1: entry + (target - entry) * 0.33,
    tp2: entry + (target - entry) * 0.66,
    tp3: target,
  };
}

function makeTrade(time: number): TurtleSoupTrade {
  return {
    state: 'Waiting For Liquidity Break',
    startTime: time,
    hitTP1: false,
    hitTP2: false,
    hitTP3: false,
    tpResult: 'None',
  };
}

function pushEvent(state: EngineState, event: IndicatorEvent) {
  state.events.push(event);
}

export function runAlphaNetLiquidityHunter(candles: Candle[], partial?: Partial<IndicatorConfig>): IndicatorOutput {
  const config = { ...defaultConfig, ...partial };
  if (candles.length === 0) {
    return {
      trades: [], events: [], liquidityZones: [], markers: [], lines: [],
      stats: { totalEntries: 0, tp1Count: 0, tp2Count: 0, tp3Count: 0, losses: 0, winrate: 0 },
    };
  }

  const tfInMin = inferTimeframeMinutes(candles);
  if (config.higherTimeframeMinutes <= tfInMin) throw new Error('Higher timeframe must be higher than current timeframe.');
  const barLength = Math.max(1, Math.floor(config.higherTimeframeMinutes / tfInMin));

  const state: EngineState = { trades: [], highBreaks: 0, lowBreaks: 0, events: [] };
  const startIndex = Math.max(0, candles.length - config.maxDistanceToLastBar);

  for (let i = startIndex; i < candles.length; i++) {
    const candle = candles[i];
    const currentAtr = atr(candles, i, config.atrLen);
    const high12 = highest(candles, i, barLength, 'high');
    const low12 = lowest(candles, i, barLength, 'low');
    const highMSS = highest(candles, i, config.mssOffset, 'high');
    const lowMSS = lowest(candles, i, config.mssOffset, 'low');
    const highMSSPrev = highest(candles, i - 1, config.mssOffset, 'high');
    const lowMSSPrev = lowest(candles, i - 1, config.mssOffset, 'low');
    const lastHourTime = i - barLength >= 0 ? candles[i - barLength].time : undefined;

    if ([currentAtr, high12, low12, highMSS, lowMSS, highMSSPrev, lowMSSPrev, lastHourTime].some(v => v === undefined)) continue;

    let createNewTS = true;
    if (state.lastTS && state.lastTS.exitPrice === undefined) createNewTS = false;

    if (createNewTS) {
      const ts = makeTrade(candle.time);
      ts.lastHourHigh = high12;
      ts.lastHourLow = low12;
      ts.lastHour = lastHourTime;
      state.trades.unshift(ts);
      state.lastTS = ts;
    }

    const lastTS = state.lastTS;
    if (!lastTS) continue;

    if (lastTS.state === 'Waiting For Liquidity Break' && candle.time > lastTS.startTime) {
      const brokeSell = (config.breakoutMethod === 'Close' ? candle.close : candle.low) < lastTS.lastHourLow!;
      const brokeBuy = (config.breakoutMethod === 'Close' ? candle.close : candle.high) > lastTS.lastHourHigh!;

      if (brokeSell) {
        lastTS.brokenSweep = {
          startTime: lastTS.lastHour!,
          endTime: candle.time,
          side: 'Sellside',
          price: lastTS.lastHourLow!,
        };
        lastTS.entryType = config.entryMethod === 'Classic' || state.highBreaks > state.lowBreaks ? 'Long' : 'Short';
        lastTS.state = 'Waiting For Execution';
      } else if (brokeBuy) {
        lastTS.brokenSweep = {
          startTime: lastTS.lastHour!,
          endTime: candle.time,
          side: 'Buyside',
          price: lastTS.lastHourHigh!,
        };
        lastTS.entryType = config.entryMethod === 'Classic' || state.highBreaks <= state.lowBreaks ? 'Short' : 'Long';
        lastTS.state = 'Waiting For Execution';
      }
    }

    if (lastTS.state === 'Waiting For Execution' && lastTS.brokenSweep && candle.time > lastTS.brokenSweep.endTime) {
      if (lastTS.entryType === 'Short') {
        const trigger = (config.breakoutMethod === 'Close' ? candle.close : candle.low) < lowMSSPrev!;
        if (trigger) {
          lastTS.state = 'Entry Taken';
          lastTS.entryTime = candle.time;
          lastTS.entryPrice = config.breakoutMethod === 'Close' ? candle.close : lowMSSPrev!;
          if (config.tpslMethod === 'Fixed') {
            lastTS.slTarget = lastTS.entryPrice * (1 + config.slPercent / 100);
            lastTS.tpTarget = lastTS.entryPrice * (1 - config.tpPercent / 100);
          } else {
            lastTS.slTarget = highMSS! + currentAtr! * slATRMult(config);
            lastTS.tpTarget = lastTS.entryPrice - Math.abs(lastTS.entryPrice - lastTS.slTarget) * config.RR;
          }
          pushEvent(state, { time: candle.time, type: 'sell', tradeIndex: 0, price: lastTS.entryPrice });
        }
      } else if (lastTS.entryType === 'Long') {
        const trigger = (config.breakoutMethod === 'Close' ? candle.close : candle.high) > highMSSPrev!;
        if (trigger) {
          lastTS.state = 'Entry Taken';
          lastTS.entryTime = candle.time;
          lastTS.entryPrice = config.breakoutMethod === 'Close' ? candle.close : highMSSPrev!;
          if (config.tpslMethod === 'Fixed') {
            lastTS.slTarget = lastTS.entryPrice * (1 - config.slPercent / 100);
            lastTS.tpTarget = lastTS.entryPrice * (1 + config.tpPercent / 100);
          } else {
            lastTS.slTarget = lowMSS! - currentAtr! * slATRMult(config);
            lastTS.tpTarget = lastTS.entryPrice + Math.abs(lastTS.entryPrice - lastTS.slTarget) * config.RR;
          }
          pushEvent(state, { time: candle.time, type: 'buy', tradeIndex: 0, price: lastTS.entryPrice });
        }
      }
    }

    if (lastTS.state === 'Entry Taken' && lastTS.entryPrice !== undefined && lastTS.tpTarget !== undefined && lastTS.slTarget !== undefined) {
      const { tp1, tp2, tp3 } = config.tpslMethod === 'Fixed'
        ? {
            tp1: lastTS.entryType === 'Long'
              ? lastTS.entryPrice * (1 + config.tpPercent * 0.33 / 100)
              : lastTS.entryPrice * (1 - config.tpPercent * 0.33 / 100),
            tp2: lastTS.entryType === 'Long'
              ? lastTS.entryPrice * (1 + config.tpPercent * 0.66 / 100)
              : lastTS.entryPrice * (1 - config.tpPercent * 0.66 / 100),
            tp3: lastTS.entryType === 'Long'
              ? lastTS.entryPrice * (1 + config.tpPercent / 100)
              : lastTS.entryPrice * (1 - config.tpPercent / 100),
          }
        : calcTpLevels(lastTS);

      if (!lastTS.hitTP1 && ((lastTS.entryType === 'Long' && candle.high >= tp1) || (lastTS.entryType === 'Short' && candle.low <= tp1))) lastTS.hitTP1 = true;
      if (!lastTS.hitTP2 && ((lastTS.entryType === 'Long' && candle.high >= tp2) || (lastTS.entryType === 'Short' && candle.low <= tp2))) lastTS.hitTP2 = true;
      if (!lastTS.hitTP3 && ((lastTS.entryType === 'Long' && candle.high >= tp3) || (lastTS.entryType === 'Short' && candle.low <= tp3))) lastTS.hitTP3 = true;

      const stopHit = config.tpslMethod === 'Fixed'
        ? (!lastTS.hitTP1 && ((lastTS.entryType === 'Long' && ((candle.low / lastTS.entryPrice) - 1) * 100 <= -config.slPercent) || (lastTS.entryType === 'Short' && ((candle.high / lastTS.entryPrice) - 1) * 100 >= config.slPercent)))
        : (!lastTS.hitTP1 && ((lastTS.entryType === 'Long' && candle.low <= lastTS.slTarget) || (lastTS.entryType === 'Short' && candle.high >= lastTS.slTarget)));

      if (lastTS.hitTP3) {
        lastTS.exitPrice = tp3;
        lastTS.exitTime = candle.time;
        lastTS.state = 'Take Profit';
        lastTS.tpResult = 'TP3';
        if (lastTS.entryType === 'Long') state.highBreaks += 1; else state.lowBreaks += 1;
        pushEvent(state, { time: candle.time, type: 'tp', tradeIndex: 0, price: tp3, tpResult: 'TP3' });
      } else if (lastTS.hitTP2 && ((lastTS.entryType === 'Long' && candle.low <= tp1) || (lastTS.entryType === 'Short' && candle.high >= tp1))) {
        lastTS.exitPrice = tp2;
        lastTS.exitTime = candle.time;
        lastTS.state = 'Take Profit';
        lastTS.tpResult = 'TP2';
        if (lastTS.entryType === 'Long') state.highBreaks += 1; else state.lowBreaks += 1;
        pushEvent(state, { time: candle.time, type: 'tp', tradeIndex: 0, price: tp2, tpResult: 'TP2' });
      } else if (lastTS.hitTP1 && ((lastTS.entryType === 'Long' && candle.low <= lastTS.entryPrice) || (lastTS.entryType === 'Short' && candle.high >= lastTS.entryPrice))) {
        lastTS.exitPrice = tp1;
        lastTS.exitTime = candle.time;
        lastTS.state = 'Take Profit';
        lastTS.tpResult = 'TP1';
        if (lastTS.entryType === 'Long') state.highBreaks += 1; else state.lowBreaks += 1;
        pushEvent(state, { time: candle.time, type: 'tp', tradeIndex: 0, price: tp1, tpResult: 'TP1' });
      } else if (stopHit) {
        lastTS.exitPrice = config.tpslMethod === 'Fixed'
          ? (lastTS.entryType === 'Long' ? lastTS.entryPrice * (1 - config.slPercent / 100) : lastTS.entryPrice * (1 + config.slPercent / 100))
          : lastTS.slTarget;
        lastTS.exitTime = candle.time;
        lastTS.state = 'Stop Loss';
        if (lastTS.entryType === 'Long') state.highBreaks -= 1; else state.lowBreaks -= 1;
        pushEvent(state, { time: candle.time, type: 'sl', tradeIndex: 0, price: lastTS.exitPrice });
      }
    }

    if (lastTS.state === 'Take Profit' || lastTS.state === 'Stop Loss') lastTS.state = 'Done';
  }

  return buildOutput(state.trades, state.events, config);
}

function buildOutput(trades: TurtleSoupTrade[], events: IndicatorEvent[], config: IndicatorConfig): IndicatorOutput {
  const liquidityZones: LiquidityZone[] = [];
  const markers: Marker[] = [];
  const lines: LevelLine[] = [];

  for (const trade of trades) {
    if (trade.brokenSweep && config.showHL) {
      const offset = Math.abs((trade.lastHourHigh ?? trade.brokenSweep.price) - (trade.lastHourLow ?? trade.brokenSweep.price)) / 6 || trade.brokenSweep.price * 0.001;
      if (trade.brokenSweep.price === trade.lastHourHigh) {
        liquidityZones.push({
          startTime: trade.brokenSweep.startTime,
          endTime: trade.brokenSweep.endTime,
          top: trade.lastHourHigh! + offset,
          bottom: trade.lastHourHigh! - offset,
          side: 'buy',
          label: 'TARGET LIQUIDITY',
        });
      } else {
        liquidityZones.push({
          startTime: trade.brokenSweep.startTime,
          endTime: trade.brokenSweep.endTime,
          top: trade.lastHourLow! + offset,
          bottom: trade.lastHourLow! - offset,
          side: 'sell',
          label: 'TARGET LIQUIDITY',
        });
      }
    }

    if (trade.brokenSweep && config.showLiqGrabs) {
      markers.push({
        time: trade.brokenSweep.endTime,
        price: trade.brokenSweep.price,
        type: trade.brokenSweep.side === 'Buyside' ? 'liq-grab-sell' : 'liq-grab-buy',
      });
    }

    if (trade.entryTime && trade.entryPrice && trade.entryType) {
      markers.push({
        time: trade.entryTime,
        price: trade.entryPrice,
        type: trade.entryType === 'Long' ? 'entry-buy' : 'entry-sell',
        text: trade.entryType === 'Long' ? 'Buy' : 'Sell',
      });

      if (config.showTPSL && trade.tpTarget !== undefined && trade.slTarget !== undefined) {
        const endTime = trade.exitTime ?? trade.entryTime;
        const { tp1, tp2, tp3 } = calcTpLevels(trade);
        lines.push({ fromTime: trade.entryTime, toTime: trade.entryTime, price: trade.tpTarget, type: 'entry-to-tp' });
        lines.push({ fromTime: trade.entryTime, toTime: trade.entryTime, price: trade.slTarget, type: 'entry-to-sl' });
        lines.push({ fromTime: trade.entryTime, toTime: endTime, price: tp1, type: 'tp1' });
        lines.push({ fromTime: trade.entryTime, toTime: endTime, price: tp2, type: 'tp2' });
        lines.push({ fromTime: trade.entryTime, toTime: endTime, price: tp3, type: 'tp3' });
        lines.push({ fromTime: trade.entryTime, toTime: endTime, price: trade.slTarget, type: 'sl' });
      }
    }

    if (trade.dayEndedBeforeExit) {
      markers.push({ time: trade.dayEndedBeforeExit, price: trade.exitPrice ?? trade.entryPrice ?? 0, type: 'exit', text: 'Exit' });
    }

    if (trade.exitTime && trade.exitPrice && trade.tpResult !== 'None') {
      markers.push({ time: trade.exitTime, price: trade.exitPrice, type: 'tp', text: trade.tpResult });
    }
    if (trade.exitTime && trade.exitPrice && trade.state === 'Done' && trade.tpResult === 'None') {
      markers.push({ time: trade.exitTime, price: trade.exitPrice, type: 'sl', text: 'SL' });
    }
  }

  const closed = trades.filter(t => t.entryPrice !== undefined && t.exitTime !== undefined);
  const tp1Count = closed.filter(t => t.tpResult === 'TP1').length;
  const tp2Count = closed.filter(t => t.tpResult === 'TP2').length;
  const tp3Count = closed.filter(t => t.tpResult === 'TP3').length;
  const losses = closed.filter(t => t.tpResult === 'None').length;
  const totalEntries = closed.length;
  const wins = tp1Count + tp2Count + tp3Count;
  const winrate = totalEntries > 0 ? (wins / totalEntries) * 100 : 0;

  return {
    trades,
    events,
    liquidityZones,
    markers,
    lines,
    stats: { totalEntries, tp1Count, tp2Count, tp3Count, losses, winrate },
  };
}

export function inferTimeframeMinutes(candles: Candle[]): number {
  if (candles.length < 2) return 1;
  const diffs: number[] = [];
  for (let i = 1; i < Math.min(candles.length, 20); i++) diffs.push(candles[i].time - candles[i - 1].time);
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)] || 60_000;
  return Math.max(1, Math.round(median / 60_000));
}

export function toLovableSeries(output: IndicatorOutput) {
  return {
    markers: output.markers.map(m => ({ time: Math.floor(m.time / 1000), position: m.type.includes('buy') || m.type === 'tp' ? 'belowBar' : 'aboveBar', color: markerColor(m.type), shape: markerShape(m.type), text: m.text ?? '' })),
    lines: output.lines,
    zones: output.liquidityZones,
    stats: output.stats,
    events: output.events,
    trades: output.trades,
  };
}

function markerColor(type: Marker['type']): string {
  switch (type) {
    case 'entry-buy':
    case 'liq-grab-buy':
    case 'tp': return '#16a34a';
    case 'entry-sell':
    case 'liq-grab-sell':
    case 'sl': return '#dc2626';
    default: return '#eab308';
  }
}

function markerShape(type: Marker['type']): 'arrowUp' | 'arrowDown' | 'circle' | 'square' {
  switch (type) {
    case 'entry-buy': return 'arrowUp';
    case 'entry-sell': return 'arrowDown';
    case 'tp': return 'circle';
    case 'sl': return 'square';
    default: return 'circle';
  }
}
