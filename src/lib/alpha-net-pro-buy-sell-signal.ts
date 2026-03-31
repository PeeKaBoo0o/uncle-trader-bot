export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface AlphaNetProConfig {
  atrPeriod: number;
  atrMultiplier: number;
  smoothLength: number;
  fastLength: number;
  slowLength: number;
  wavyLength: number;
  tunnelFastLength: number;
  tunnelSlowLength: number;
  fixedTimeframeMode: boolean;
}

export interface LinePoint {
  time: number;
  value: number;
}

export interface Marker {
  time: number;
  price: number;
  type: 'buy' | 'sell' | 'atr-buy' | 'atr-sell';
  text: string;
}

export interface TrendStatePoint {
  time: number;
  bullish: boolean;
  bearish: boolean;
  zone: 'green' | 'blue' | 'lightBlue' | 'red' | 'orange' | 'yellow' | 'none';
}

export interface AlphaNetProEvent {
  time: number;
  type: 'buy' | 'sell' | 'atr-buy' | 'atr-sell' | 'bullish' | 'bearish';
  price: number;
}

export interface AlphaNetProOutput {
  stopLine: LinePoint[];
  wavyHigh: LinePoint[];
  wavyMid: LinePoint[];
  wavyLow: LinePoint[];
  tunnel1: LinePoint[];
  tunnel2: LinePoint[];
  fastMA: LinePoint[];
  slowMA: LinePoint[];
  trendStates: TrendStatePoint[];
  markers: Marker[];
  events: AlphaNetProEvent[];
}

export const defaultAlphaNetProConfig: AlphaNetProConfig = {
  atrPeriod: 38,
  atrMultiplier: 4,
  smoothLength: 20,
  fastLength: 12,
  slowLength: 26,
  wavyLength: 34,
  tunnelFastLength: 144,
  tunnelSlowLength: 169,
  fixedTimeframeMode: false,
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

function vwma(candles: Candle[], length: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - length + 1);
    let pv = 0;
    let vv = 0;
    for (let j = start; j <= i; j++) {
      const vol = candles[j].volume ?? 1;
      pv += candles[j].close * vol;
      vv += vol;
    }
    out.push(vv ? pv / vv : candles[i].close);
  }
  return out;
}

function trueRange(curr: Candle, prev?: Candle): number {
  if (!prev) return curr.high - curr.low;
  return Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close));
}

function atr(candles: Candle[], length: number): number[] {
  const tr = candles.map((c, i) => trueRange(c, i > 0 ? candles[i - 1] : undefined));
  return ema(tr, length);
}

function crossOver(prevA: number, currA: number, prevB: number, currB: number): boolean {
  return prevA <= prevB && currA > currB;
}

function crossUnder(prevA: number, currA: number, prevB: number, currB: number): boolean {
  return prevA >= prevB && currA < currB;
}

function barsSince(flags: boolean[], index: number): number {
  for (let i = index; i >= 0; i--) if (flags[i]) return index - i;
  return Number.POSITIVE_INFINITY;
}

function supertrend(candles: Candle[], atrValues: number[], period: number, multiplier: number): { value: number[]; direction: number[] } {
  const hl2 = candles.map((c) => (c.high + c.low) / 2);
  const upperBand = hl2.map((v, i) => v + multiplier * atrValues[i]);
  const lowerBand = hl2.map((v, i) => v - multiplier * atrValues[i]);
  const finalUpper: number[] = [];
  const finalLower: number[] = [];
  const st: number[] = [];
  const dir: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      finalUpper.push(upperBand[i]);
      finalLower.push(lowerBand[i]);
      st.push(upperBand[i]);
      dir.push(1);
      continue;
    }
    finalUpper.push(candles[i - 1].close > finalUpper[i - 1] ? Math.min(upperBand[i], finalUpper[i - 1]) : upperBand[i]);
    finalLower.push(candles[i - 1].close < finalLower[i - 1] ? Math.max(lowerBand[i], finalLower[i - 1]) : lowerBand[i]);

    let currentDir = dir[i - 1];
    if (st[i - 1] === finalUpper[i - 1]) currentDir = candles[i].close > finalUpper[i] ? -1 : 1;
    else currentDir = candles[i].close < finalLower[i] ? 1 : -1;

    dir.push(currentDir);
    st.push(currentDir === -1 ? finalLower[i] : finalUpper[i]);
  }

  return { value: st, direction: dir };
}

export function runAlphaNetProBuySellSignal(candles: Candle[], partial?: Partial<AlphaNetProConfig>): AlphaNetProOutput {
  const config = { ...defaultAlphaNetProConfig, ...partial };
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const stopLineVals = ema(closes, config.fastLength);
  const wavyHighVals = ema(highs, config.wavyLength);
  const wavyMidVals = ema(closes, config.wavyLength);
  const wavyLowVals = ema(lows, config.wavyLength);
  const tunnel1Vals = ema(closes, config.tunnelFastLength);
  const tunnel2Vals = ema(closes, config.tunnelSlowLength);
  const smoothPrice = ema(closes, 1);
  const fastMA = ema(smoothPrice, config.fastLength);
  const slowMA = ema(smoothPrice, config.slowLength);
  const atrVals = atr(candles, config.atrPeriod);
  const st = supertrend(candles, atrVals, config.atrPeriod, config.atrMultiplier);

  const stopLine: LinePoint[] = [];
  const wavyHigh: LinePoint[] = [];
  const wavyMid: LinePoint[] = [];
  const wavyLow: LinePoint[] = [];
  const tunnel1: LinePoint[] = [];
  const tunnel2: LinePoint[] = [];
  const fastMALine: LinePoint[] = [];
  const slowMALine: LinePoint[] = [];
  const trendStates: TrendStatePoint[] = [];
  const markers: Marker[] = [];
  const events: AlphaNetProEvent[] = [];

  const buyCondFlags: boolean[] = [];
  const sellCondFlags: boolean[] = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    stopLine.push({ time: candle.time, value: stopLineVals[i] });
    wavyHigh.push({ time: candle.time, value: wavyHighVals[i] });
    wavyMid.push({ time: candle.time, value: wavyMidVals[i] });
    wavyLow.push({ time: candle.time, value: wavyLowVals[i] });
    tunnel1.push({ time: candle.time, value: tunnel1Vals[i] });
    tunnel2.push({ time: candle.time, value: tunnel2Vals[i] });
    fastMALine.push({ time: candle.time, value: fastMA[i] });
    slowMALine.push({ time: candle.time, value: slowMA[i] });

    const bull = fastMA[i] > slowMA[i];
    const bear = fastMA[i] < slowMA[i];
    const green = bull && smoothPrice[i] > fastMA[i];
    const blue = bear && smoothPrice[i] > fastMA[i] && smoothPrice[i] > slowMA[i];
    const lightBlue = bear && smoothPrice[i] > fastMA[i] && smoothPrice[i] < slowMA[i];
    const red = bear && smoothPrice[i] < fastMA[i];
    const orange = bull && smoothPrice[i] < fastMA[i] && smoothPrice[i] < slowMA[i];
    const yellow = bull && smoothPrice[i] < fastMA[i] && smoothPrice[i] > slowMA[i];

    const buycond = green && !(i > 0 && (fastMA[i - 1] > slowMA[i - 1] && smoothPrice[i - 1] > fastMA[i - 1]));
    const sellcond = red && !(i > 0 && (fastMA[i - 1] < slowMA[i - 1] && smoothPrice[i - 1] < fastMA[i - 1]));
    buyCondFlags.push(buycond);
    sellCondFlags.push(sellcond);

    const bullish = barsSince(buyCondFlags, i) < barsSince(sellCondFlags, i);
    const bearish = barsSince(sellCondFlags, i) < barsSince(buyCondFlags, i);
    const buy = i > 0 ? (barsSince(sellCondFlags, i - 1) < barsSince(buyCondFlags, i - 1)) && buycond : false;
    const sell = i > 0 ? (barsSince(buyCondFlags, i - 1) < barsSince(sellCondFlags, i - 1)) && sellcond : false;

    const zone: TrendStatePoint['zone'] = green ? 'green' : blue ? 'blue' : lightBlue ? 'lightBlue' : red ? 'red' : orange ? 'orange' : yellow ? 'yellow' : 'none';
    trendStates.push({ time: candle.time, bullish, bearish, zone });

    if (buy) {
      markers.push({ time: candle.time, price: candle.low, type: 'buy', text: 'BUY next bar' });
      events.push({ time: candle.time, type: 'buy', price: candle.close });
    }
    if (sell) {
      markers.push({ time: candle.time, price: candle.high, type: 'sell', text: 'SELL next bar' });
      events.push({ time: candle.time, type: 'sell', price: candle.close });
    }

    if (i > 0) {
      const longAtr = st.direction[i] - st.direction[i - 1] < 0;
      const shortAtr = st.direction[i] - st.direction[i - 1] > 0;
      if (longAtr) {
        markers.push({ time: candle.time, price: candle.low, type: 'atr-buy', text: 'Buy' });
        events.push({ time: candle.time, type: 'atr-buy', price: candle.close });
      }
      if (shortAtr) {
        markers.push({ time: candle.time, price: candle.high, type: 'atr-sell', text: 'Sell' });
        events.push({ time: candle.time, type: 'atr-sell', price: candle.close });
      }
    }

    if (bullish) events.push({ time: candle.time, type: 'bullish', price: candle.close });
    if (bearish) events.push({ time: candle.time, type: 'bearish', price: candle.close });
  }

  return {
    stopLine,
    wavyHigh,
    wavyMid,
    wavyLow,
    tunnel1,
    tunnel2,
    fastMA: fastMALine,
    slowMA: slowMALine,
    trendStates,
    markers,
    events,
  };
}

export function toLovableAlphaNetProSeries(output: AlphaNetProOutput) {
  return {
    stopSeries: output.stopLine.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    wavyHighSeries: output.wavyHigh.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    wavyMidSeries: output.wavyMid.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    wavyLowSeries: output.wavyLow.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    tunnel1Series: output.tunnel1.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    tunnel2Series: output.tunnel2.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    fastMASeries: output.fastMA.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    slowMASeries: output.slowMA.map((p) => ({ time: Math.floor(p.time / 1000), value: p.value })),
    trendStates: output.trendStates,
    markers: output.markers.map((m) => ({
      time: Math.floor(m.time / 1000),
      position: m.type.includes('sell') ? 'aboveBar' : 'belowBar',
      color: m.type.includes('sell') ? '#ef4444' : '#22c55e',
      shape: m.type.includes('sell') ? 'arrowDown' : 'arrowUp',
      text: m.text,
    })),
    events: output.events,
  };
}
