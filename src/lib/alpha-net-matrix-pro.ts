export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MatrixProConfig {
  bandwidth: number;
  multiplier: number;
  source: 'close' | 'open' | 'high' | 'low';
  repaint: boolean;
  maxBars: number;
}

export interface BandPoint {
  time: number;
  upper: number;
  lower: number;
  basis: number;
}

export interface MatrixMarker {
  time: number;
  price: number;
  type: 'buy' | 'sell' | 'cross-up' | 'cross-down';
  text: string;
}

export interface MatrixSignalEvent {
  time: number;
  type: 'buy' | 'sell';
  price: number;
}

export interface MatrixDashboard {
  repaintMode: boolean;
  totalBuySignals: number;
  totalSellSignals: number;
}

export interface MatrixProOutput {
  bands: BandPoint[];
  markers: MatrixMarker[];
  events: MatrixSignalEvent[];
  dashboard: MatrixDashboard;
}

export const defaultMatrixProConfig: MatrixProConfig = {
  bandwidth: 8,
  multiplier: 3,
  source: 'close',
  repaint: true,
  maxBars: 500,
};

function getSource(candle: Candle, source: MatrixProConfig['source']): number {
  return candle[source];
}

function gauss(x: number, h: number): number {
  return Math.exp(-((x * x) / (h * h * 2)));
}

function sma(values: number[], length: number, endIndex: number): number | undefined {
  if (endIndex - length + 1 < 0) return undefined;
  let sum = 0;
  for (let i = endIndex - length + 1; i <= endIndex; i++) sum += values[i];
  return sum / length;
}

function crossUnder(prevA: number, currA: number, prevB: number, currB: number): boolean {
  return prevA >= prevB && currA < currB;
}

function crossOver(prevA: number, currA: number, prevB: number, currB: number): boolean {
  return prevA <= prevB && currA > currB;
}

export function runAlphaNetMatrixPro(candles: Candle[], partial?: Partial<MatrixProConfig>): MatrixProOutput {
  const config = { ...defaultMatrixProConfig, ...partial };
  const maxBars = Math.min(config.maxBars, candles.length);
  const slice = candles.slice(-maxBars);
  const src = slice.map((c) => getSource(c, config.source));

  if (slice.length === 0) {
    return {
      bands: [],
      markers: [],
      events: [],
      dashboard: { repaintMode: config.repaint, totalBuySignals: 0, totalSellSignals: 0 },
    };
  }

  return config.repaint
    ? runRepaintingMode(slice, src, config)
    : runEndpointMode(slice, src, config);
}

function runEndpointMode(candles: Candle[], src: number[], config: MatrixProConfig): MatrixProOutput {
  const limit = candles.length;
  const weights: number[] = [];
  let den = 0;
  for (let i = 0; i < limit; i++) {
    const w = gauss(i, config.bandwidth);
    weights.push(w);
    den += w;
  }

  const out: number[] = new Array(limit).fill(NaN);
  const absDiff: number[] = new Array(limit).fill(NaN);
  const bands: BandPoint[] = [];
  const markers: MatrixMarker[] = [];
  const events: MatrixSignalEvent[] = [];

  let crossPrice: number | null = null;
  let crossDirection: 'above' | 'below' | null = null;

  for (let i = 0; i < limit; i++) {
    if (i < limit - 1) {
      let sum = 0;
      let sumW = 0;
      for (let j = 0; j <= i; j++) {
        const idx = i - j;
        const w = weights[j];
        sum += src[idx] * w;
        sumW += w;
      }
      out[i] = sumW > 0 ? sum / sumW : src[i];
      absDiff[i] = Math.abs(src[i] - out[i]);
    }
  }

  for (let i = 0; i < limit; i++) {
    const maeBase = sma(absDiff.map((v) => (Number.isFinite(v) ? v : 0)), Math.min(499, i + 1), i);
    if (maeBase === undefined || !Number.isFinite(out[i])) continue;
    const mae = maeBase * config.multiplier;
    const upper = out[i] + mae;
    const lower = out[i] - mae;
    bands.push({ time: candles[i].time, upper, lower, basis: out[i] });

    if (i === 0) continue;

    const prevClose = candles[i - 1].close;
    const currClose = candles[i].close;
    const prevUpper = bands[bands.length - 2]?.upper;
    const prevLower = bands[bands.length - 2]?.lower;
    if (prevUpper === undefined || prevLower === undefined) continue;

    if (crossOver(prevClose, currClose, prevUpper, upper)) {
      markers.push({ time: candles[i].time, price: candles[i].high, type: 'cross-down', text: '▼' });
      crossPrice = currClose;
      crossDirection = 'above';
    } else if (crossUnder(prevClose, currClose, prevLower, lower)) {
      markers.push({ time: candles[i].time, price: candles[i].low, type: 'cross-up', text: '▲' });
      crossPrice = currClose;
      crossDirection = 'below';
    }

    const condSell = crossPrice !== null && crossDirection === 'above' && currClose < crossPrice && currClose < upper && currClose > lower;
    const condBuy = crossPrice !== null && crossDirection === 'below' && currClose > crossPrice && currClose > lower && currClose < upper;

    if (condSell) {
      markers.push({ time: candles[i].time, price: candles[i].high, type: 'sell', text: 'Sell' });
      events.push({ time: candles[i].time, type: 'sell', price: currClose });
      crossPrice = null;
      crossDirection = null;
    }
    if (condBuy) {
      markers.push({ time: candles[i].time, price: candles[i].low, type: 'buy', text: 'Buy' });
      events.push({ time: candles[i].time, type: 'buy', price: currClose });
      crossPrice = null;
      crossDirection = null;
    }
  }

  return {
    bands,
    markers,
    events,
    dashboard: {
      repaintMode: false,
      totalBuySignals: events.filter((e) => e.type === 'buy').length,
      totalSellSignals: events.filter((e) => e.type === 'sell').length,
    },
  };
}

function runRepaintingMode(candles: Candle[], src: number[], config: MatrixProConfig): MatrixProOutput {
  const n = candles.length - 1;
  const nwe: number[] = [];
  let sae = 0;

  for (let i = 0; i <= Math.min(499, n - 1); i++) {
    let sum = 0;
    let sumW = 0;
    for (let j = 0; j <= Math.min(499, n - 1); j++) {
      const w = gauss(i - j, config.bandwidth);
      sum += src[j] * w;
      sumW += w;
    }
    const y2 = sum / sumW;
    sae += Math.abs(src[i] - y2);
    nwe.push(y2);
  }

  const denom = Math.max(1, Math.min(499, n - 1));
  sae = (sae / denom) * config.multiplier;

  const bands: BandPoint[] = [];
  const markers: MatrixMarker[] = [];
  const events: MatrixSignalEvent[] = [];

  let crossPrice: number | null = null;
  let crossDirection: 'above' | 'below' | null = null;

  for (let i = 0; i < nwe.length; i++) {
    const candleIndex = n - i;
    if (candleIndex < 0 || candleIndex >= candles.length) continue;

    const basis = nwe[i];
    const upper = basis + sae;
    const lower = basis - sae;
    bands.push({ time: candles[candleIndex].time, upper, lower, basis });

    if (i + 1 < nwe.length) {
      const curr = src[i];
      const next = src[i + 1];
      if (curr > upper && next < upper) {
        markers.push({ time: candles[candleIndex].time, price: src[i], type: 'cross-down', text: '▼' });
      }
      if (curr < lower && next > lower) {
        markers.push({ time: candles[candleIndex].time, price: src[i], type: 'cross-up', text: '▲' });
      }
      if (curr > upper) {
        crossPrice = curr;
        crossDirection = 'above';
      } else if (curr < lower) {
        crossPrice = curr;
        crossDirection = 'below';
      }

      const close = candles[candleIndex].close;
      const condSell = crossPrice !== null && crossDirection === 'above' && close < crossPrice && close < upper && close > lower;
      const condBuy = crossPrice !== null && crossDirection === 'below' && close > crossPrice && close > lower && close < upper;
      if (condSell) {
        markers.push({ time: candles[candleIndex].time, price: candles[candleIndex].high, type: 'sell', text: 'Sell' });
        events.push({ time: candles[candleIndex].time, type: 'sell', price: close });
        crossPrice = null;
        crossDirection = null;
      }
      if (condBuy) {
        markers.push({ time: candles[candleIndex].time, price: candles[candleIndex].low, type: 'buy', text: 'Buy' });
        events.push({ time: candles[candleIndex].time, type: 'buy', price: close });
        crossPrice = null;
        crossDirection = null;
      }
    }
  }

  bands.sort((a, b) => a.time - b.time);
  markers.sort((a, b) => a.time - b.time);
  events.sort((a, b) => a.time - b.time);

  return {
    bands,
    markers,
    events,
    dashboard: {
      repaintMode: true,
      totalBuySignals: events.filter((e) => e.type === 'buy').length,
      totalSellSignals: events.filter((e) => e.type === 'sell').length,
    },
  };
}

export function toLovableMatrixSeries(output: MatrixProOutput) {
  return {
    upperSeries: output.bands.map((p) => ({ time: Math.floor(p.time / 1000), value: p.upper })),
    lowerSeries: output.bands.map((p) => ({ time: Math.floor(p.time / 1000), value: p.lower })),
    basisSeries: output.bands.map((p) => ({ time: Math.floor(p.time / 1000), value: p.basis })),
    markers: output.markers.map((m) => ({
      time: Math.floor(m.time / 1000),
      position: m.type === 'buy' || m.type === 'cross-up' ? 'belowBar' : 'aboveBar',
      color: m.type === 'buy' || m.type === 'cross-up' ? '#14b8a6' : '#ef4444',
      shape: m.type === 'buy' ? 'arrowUp' : m.type === 'sell' ? 'arrowDown' : 'circle',
      text: m.text,
    })),
    dashboard: output.dashboard,
    events: output.events,
  };
}
