export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EventSignalConfig {
  emaFastLength: number;
  emaSlowLength: number;
  emaTrendLength: number;
  takeProfitPercent: number;
}

export interface EventSignalMarker {
  time: number;
  price: number;
  type: 'buy' | 'sell' | 'tp-long' | 'tp-short';
  text: string;
}

export interface EventSignalLinePoint {
  time: number;
  value: number;
}

export interface EventSignalZone {
  time: number;
  entry: number;
  target: number;
  side: 'long' | 'short';
}

export interface EventSignalEvent {
  time: number;
  type: 'buy' | 'sell' | 'tp-long' | 'tp-short';
  price: number;
}

export interface EventSignalOutput {
  emaTrend: { time: number; value: number; trendState: number }[];
  markers: EventSignalMarker[];
  longEntryLine: EventSignalLinePoint[];
  shortEntryLine: EventSignalLinePoint[];
  longTpLine: EventSignalLinePoint[];
  shortTpLine: EventSignalLinePoint[];
  zones: EventSignalZone[];
  events: EventSignalEvent[];
}

export const defaultEventSignalConfig: EventSignalConfig = {
  emaFastLength: 5,
  emaSlowLength: 32,
  emaTrendLength: 200,
  takeProfitPercent: 0.01,
};

function ema(values: number[], length: number): number[] {
  const out: number[] = [];
  const k = 2 / (length + 1);
  for (let i = 0; i < values.length; i++) {
    if (i === 0) out.push(values[i]);
    else out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function crossOver(prevA: number, currA: number, prevB: number, currB: number): boolean {
  return prevA <= prevB && currA > currB;
}

function crossUnder(prevA: number, currA: number, prevB: number, currB: number): boolean {
  return prevA >= prevB && currA < currB;
}

export function runAlphaNetEventSignal(candles: Candle[], partial?: Partial<EventSignalConfig>): EventSignalOutput {
  const config = { ...defaultEventSignalConfig, ...partial };
  const closes = candles.map((c) => c.close);
  const emaFast = ema(closes, config.emaFastLength);
  const emaSlow = ema(closes, config.emaSlowLength);
  const emaTrend = ema(closes, config.emaTrendLength);

  const trendSeries: { time: number; value: number; trendState: number }[] = [];
  const markers: EventSignalMarker[] = [];
  const longEntryLine: EventSignalLinePoint[] = [];
  const shortEntryLine: EventSignalLinePoint[] = [];
  const longTpLine: EventSignalLinePoint[] = [];
  const shortTpLine: EventSignalLinePoint[] = [];
  const zones: EventSignalZone[] = [];
  const events: EventSignalEvent[] = [];

  let trendState = 0;
  let pos = 0;
  let entryPrice: number | null = null;
  let entryBar: number | null = null;
  let barsInTrade = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    if (i > 0) {
      if (crossOver(closes[i - 1], closes[i], emaTrend[i - 1], emaTrend[i])) trendState = 1;
      else if (crossUnder(closes[i - 1], closes[i], emaTrend[i - 1], emaTrend[i])) trendState = -1;
    }
    trendSeries.push({ time: candle.time, value: emaTrend[i], trendState });

    const longSignal = i > 0 ? crossOver(emaFast[i - 1], emaFast[i], emaSlow[i - 1], emaSlow[i]) : false;
    const shortSignal = i > 0 ? crossUnder(emaFast[i - 1], emaFast[i], emaSlow[i - 1], emaSlow[i]) : false;

    const newLong = longSignal && (pos === 0 || pos === -1);
    const newShort = shortSignal && (pos === 0 || pos === 1);

    if (newLong) {
      pos = 1;
      entryPrice = candle.close;
      entryBar = i;
      barsInTrade = 0;
    } else if (newShort) {
      pos = -1;
      entryPrice = candle.close;
      entryBar = i;
      barsInTrade = 0;
    } else {
      barsInTrade = pos !== 0 ? barsInTrade + 1 : 0;
    }

    const slopeEMA = i > 0 ? emaTrend[i] - emaTrend[i - 1] : 0;
    const absSlope = Math.abs(slopeEMA);
    const slopeWeight = Math.min((absSlope / candle.close) * 1000, 50);
    const distToEMA = Math.abs(candle.close - emaTrend[i]);
    const distWeight = Math.min((distToEMA / candle.close) * 10000, 50);
    const tpChance = Math.min(slopeWeight + distWeight, 100);

    if (newLong && entryPrice !== null) {
      markers.push({ time: candle.time, price: entryPrice, type: 'buy', text: `Buy : ${tpChance.toFixed(1)}%` });
      events.push({ time: candle.time, type: 'buy', price: candle.close });
    }
    if (newShort && entryPrice !== null) {
      markers.push({ time: candle.time, price: entryPrice, type: 'sell', text: `Sell : ${tpChance.toFixed(1)}%` });
      events.push({ time: candle.time, type: 'sell', price: candle.close });
    }

    const tpLong = pos === 1 && entryPrice !== null ? entryPrice * (1 + config.takeProfitPercent) : null;
    const tpShort = pos === -1 && entryPrice !== null ? entryPrice * (1 - config.takeProfitPercent) : null;

    longEntryLine.push({ time: candle.time, value: pos === 1 && entryPrice !== null ? entryPrice : NaN });
    shortEntryLine.push({ time: candle.time, value: pos === -1 && entryPrice !== null ? entryPrice : NaN });
    longTpLine.push({ time: candle.time, value: tpLong ?? NaN });
    shortTpLine.push({ time: candle.time, value: tpShort ?? NaN });

    if (pos === 1 && entryPrice !== null && tpLong !== null) zones.push({ time: candle.time, entry: entryPrice, target: tpLong, side: 'long' });
    if (pos === -1 && entryPrice !== null && tpShort !== null) zones.push({ time: candle.time, entry: entryPrice, target: tpShort, side: 'short' });

    const longTPhit = pos === 1 && barsInTrade >= 1 && tpLong !== null && candle.high >= tpLong;
    const shortTPhit = pos === -1 && barsInTrade >= 1 && tpShort !== null && candle.low <= tpShort;

    if (longTPhit && tpLong !== null) {
      markers.push({ time: candle.time, price: tpLong, type: 'tp-long', text: 'TP' });
      events.push({ time: candle.time, type: 'tp-long', price: tpLong });
      pos = 0;
      barsInTrade = 0;
      entryBar = null;
      entryPrice = null;
    }
    if (shortTPhit && tpShort !== null) {
      markers.push({ time: candle.time, price: tpShort, type: 'tp-short', text: 'TP' });
      events.push({ time: candle.time, type: 'tp-short', price: tpShort });
      pos = 0;
      barsInTrade = 0;
      entryBar = null;
      entryPrice = null;
    }
  }

  return {
    emaTrend: trendSeries,
    markers,
    longEntryLine,
    shortEntryLine,
    longTpLine,
    shortTpLine,
    zones,
    events,
  };
}

export function toLovableEventSignalSeries(output: EventSignalOutput) {
  return {
    emaTrendSeries: output.emaTrend.map((p) => ({
      time: Math.floor(p.time / 1000),
      value: p.value,
      color: p.trendState === 1 ? '#16a34a' : p.trendState === -1 ? '#dc2626' : '#9ca3af',
    })),
    longEntrySeries: output.longEntryLine.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    shortEntrySeries: output.shortEntryLine.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    longTpSeries: output.longTpLine.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    shortTpSeries: output.shortTpLine.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    markers: output.markers.map((m) => ({
      time: Math.floor(m.time / 1000),
      position: m.type === 'buy' || m.type === 'tp-short' ? 'belowBar' : 'aboveBar',
      color: m.type === 'buy' ? '#16a34a' : m.type === 'sell' ? '#dc2626' : '#d69094',
      shape: m.type === 'buy' ? 'arrowUp' : m.type === 'sell' ? 'arrowDown' : 'circle',
      text: m.text,
    })),
    zones: output.zones,
    events: output.events,
  };
}
