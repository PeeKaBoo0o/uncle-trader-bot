import type { Candle } from '@/hooks/useMarketData';

export interface OscillatorPoint {
  time: number;
  sig: number;
  sgD: number;
}

export interface MfiPoint {
  time: number;
  value: number;
}

export interface ReversalSignal {
  time: number;
  index: number;
  type: 'majorBuy' | 'majorSell' | 'minorBuy' | 'minorSell';
  price: number;
}

export interface BuySellOscSignal {
  time: number;
  index: number;
  type: 'BUY' | 'SELL';
  price: number;
}

export interface ConfluenceState {
  bullish: boolean;
  bearish: boolean;
  neutral: boolean;
  score: number; // -40 to +40
}

export interface OscillatorMatrixData {
  oscillator: OscillatorPoint[];
  mfi: MfiPoint[];
  reversals: ReversalSignal[];
  buySellSignals: BuySellOscSignal[];
  confluence: ConfluenceState;
  lastSig: number;
  lastSgD: number;
  lastMfi: number;
}

// ── Helpers ──

function sma(data: number[], period: number, endIdx: number): number {
  const start = Math.max(0, endIdx - period + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= endIdx; i++) {
    if (!isNaN(data[i])) { sum += data[i]; count++; }
  }
  return count > 0 ? sum / count : NaN;
}

function ema(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < data.length; i++) {
    if (isNaN(data[i])) continue;
    if (isNaN(prev)) {
      prev = data[i];
    } else {
      prev = data[i] * k + prev * (1 - k);
    }
    result[i] = prev;
  }
  return result;
}

function smaArray(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNaN(data[j])) { sum += data[j]; count++; }
    }
    result[i] = count > 0 ? sum / count : NaN;
  }
  return result;
}

function highest(candles: Candle[], endIdx: number, len: number): number {
  const start = Math.max(0, endIdx - len + 1);
  let h = -Infinity;
  for (let i = start; i <= endIdx; i++) h = Math.max(h, candles[i].high);
  return h;
}

function lowest(candles: Candle[], endIdx: number, len: number): number {
  const start = Math.max(0, endIdx - len + 1);
  let l = Infinity;
  for (let i = start; i <= endIdx; i++) l = Math.min(l, candles[i].low);
  return l;
}

function linreg(data: number[], endIdx: number, period: number): number {
  // Linear regression value at offset 0 (endpoint)
  const start = Math.max(0, endIdx - period + 1);
  const n = endIdx - start + 1;
  if (n < 2) return data[endIdx] ?? NaN;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const y = data[start + i];
    if (isNaN(y)) continue;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return data[endIdx];
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return intercept + slope * (n - 1); // value at the last point (offset 0)
}

/**
 * Money Flow Index calculation
 * MFI = 100 - 100 / (1 + positive_flow / negative_flow)
 */
function computeMFI(candles: Candle[], period: number): number[] {
  const n = candles.length;
  const mfi = new Array(n).fill(NaN);
  
  for (let i = period; i < n; i++) {
    let posFlow = 0;
    let negFlow = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      const typicalPrice = (candles[j].high + candles[j].low + candles[j].close) / 3;
      const prevTypical = j > 0 ? (candles[j-1].high + candles[j-1].low + candles[j-1].close) / 3 : typicalPrice;
      const rawMoneyFlow = typicalPrice * candles[j].volume;
      
      if (typicalPrice > prevTypical) {
        posFlow += rawMoneyFlow;
      } else if (typicalPrice < prevTypical) {
        negFlow += rawMoneyFlow;
      }
    }
    
    if (negFlow === 0) {
      mfi[i] = 100;
    } else {
      const moneyRatio = posFlow / negFlow;
      mfi[i] = 100 - (100 / (1 + moneyRatio));
    }
  }
  
  return mfi;
}

function rsi(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  if (data.length < period + 1) return result;
  
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  
  return result;
}

/**
 * Compute the Alpha Net Oscillator Matrix from candle data.
 * Ported from Pine Script v5.
 */
export function computeOscillatorMatrix(
  candles: Candle[],
  mainLength: number = 7,
  signalLength: number = 3,
  signalType: 'SMA' | 'EMA' = 'SMA',
  mfiLength: number = 35,
  mfiSmooth: number = 6,
  reversalFactor: number = 4,
  buySellThreshold: number = 35,
): OscillatorMatrixData | null {
  const n = candles.length;
  if (n < 50) return null;

  const closes = candles.map(c => c.close);
  const hl2 = candles.map(c => (c.high + c.low) / 2);

  // ═══ HYPER WAVE OSCILLATOR ═══
  // Raw oscillator: linreg((close - avg(highest, lowest, sma_hl2)) / (highest - lowest) * 100, len, 0)
  const rawOsc = new Array(n).fill(NaN);
  
  for (let i = mainLength - 1; i < n; i++) {
    const hi = highest(candles, i, mainLength);
    const lo = lowest(candles, i, mainLength);
    const av = sma(hl2, mainLength, i);
    const range = hi - lo;
    
    if (range === 0) {
      rawOsc[i] = 0;
    } else {
      rawOsc[i] = (closes[i] - (hi + lo + av) / 3) / range * 100;
    }
  }
  
  // Apply linreg over mainLength window, then EMA with signalLength
  const linregValues = new Array(n).fill(NaN);
  for (let i = mainLength * 2; i < n; i++) {
    linregValues[i] = linreg(rawOsc, i, mainLength);
  }
  
  // sig = EMA(linreg_values, signalLength)
  const sigArray = ema(linregValues, signalLength);
  
  // sgD = signal line (SMA or EMA of sig, length 2)
  const sgDArray = signalType === 'SMA' ? smaArray(sigArray, 2) : ema(sigArray, 2);

  // ═══ SMART MONEY FLOW ═══
  const rawMfi = computeMFI(candles, mfiLength);
  // MFI centered at 0: mfi - 50
  const mfiCentered = rawMfi.map(v => isNaN(v) ? NaN : v - 50);
  // Smoothed with SMA
  const mfiSmoothed = smaArray(mfiCentered, mfiSmooth);

  // ═══ CONFLUENCE ═══
  // Track bullish/bearish thresholds (running averages)
  const blTAvg: number[] = []; // bullish MFI values
  const brTAvg: number[] = []; // bearish MFI values
  
  for (let i = 0; i < n; i++) {
    const mfVal = mfiSmoothed[i];
    if (isNaN(mfVal)) continue;
    
    if (mfVal > 0) {
      blTAvg.push(mfVal);
      if (blTAvg.length > mfiLength) blTAvg.shift();
    } else if (mfVal < 0) {
      brTAvg.push(mfVal);
      if (brTAvg.length > mfiLength) brTAvg.shift();
    }
  }
  
  const blAvg = blTAvg.length > 0 ? blTAvg.reduce((a, b) => a + b, 0) / blTAvg.length : 0;
  const brAvg = brTAvg.length > 0 ? brTAvg.reduce((a, b) => a + b, 0) / brTAvg.length : 0;

  // ═══ REVERSAL SIGNALS ═══
  const volData = candles.map(c => c.volume);
  const volSMA = smaArray(volData, 7);
  const rsiVol = rsi(volSMA, 7);
  // Center RSI at 0
  const rsiVolCentered = rsiVol.map(v => isNaN(v) ? NaN : v - 50);

  const reversals: ReversalSignal[] = [];
  
  for (let i = 20; i < n; i++) {
    const sig = sigArray[i];
    const mfVal = mfiSmoothed[i];
    const vol = volData[i];
    const vma = volSMA[i];
    const rsiV = rsiVolCentered[i];
    const sgD = sgDArray[i];
    
    if (isNaN(sig) || isNaN(mfVal) || isNaN(vma) || vma === 0) continue;
    
    const majorThreshold = reversalFactor !== 10 ? 1 + (reversalFactor / 10) : 2;
    const minorThreshold = reversalFactor !== 10 ? 0 + (reversalFactor / 10) : 2;
    
    const isMajorVol = vol > vma * majorThreshold;
    const isMinorVol = vol > vma * minorThreshold && !isMajorVol;
    
    // Major Buy: major volume + sig < -factor + mfi < bearish avg
    if (isMajorVol && sig < -reversalFactor && mfVal < brAvg) {
      reversals.push({ time: candles[i].time, index: i, type: 'majorBuy', price: candles[i].low });
    }
    // Major Sell: major volume + sig > factor + mfi > bullish avg
    if (isMajorVol && sig > reversalFactor && mfVal > blAvg) {
      reversals.push({ time: candles[i].time, index: i, type: 'majorSell', price: candles[i].high });
    }
    // Minor Buy: minor volume + sig < -20 + sig < sgD + rsi < -20
    if (isMinorVol && sig < -20 && sig < sgD && !isNaN(rsiV) && rsiV < -20) {
      reversals.push({ time: candles[i].time, index: i, type: 'minorBuy', price: candles[i].low });
    }
    // Minor Sell: minor volume + sig > 20 + sig > sgD + rsi > 20
    if (isMinorVol && sig > 20 && sig > sgD && !isNaN(rsiV) && rsiV > 20) {
      reversals.push({ time: candles[i].time, index: i, type: 'minorSell', price: candles[i].high });
    }
  }

  // ═══ BUY/SELL SIGNALS (from SIGNALS section) ═══
  const buySellSignals: BuySellOscSignal[] = [];
  
  for (let i = 1; i < n; i++) {
    const sig = sigArray[i];
    const sgD = sgDArray[i];
    const prevSig = sigArray[i - 1];
    const prevSgD = sgDArray[i - 1];
    
    if (isNaN(sig) || isNaN(sgD) || isNaN(prevSig) || isNaN(prevSgD)) continue;
    
    // Cross detection (any cross)
    const crossed = (prevSig <= prevSgD && sig > sgD) || (prevSig >= prevSgD && sig < sgD);
    
    if (!crossed) continue;
    
    // BUY: sig < -threshold and crossed signal
    if (sig < -buySellThreshold) {
      buySellSignals.push({ time: candles[i].time, index: i, type: 'BUY', price: candles[i].low });
    }
    // SELL: sig > +threshold and crossed signal
    if (sig > buySellThreshold) {
      buySellSignals.push({ time: candles[i].time, index: i, type: 'SELL', price: candles[i].high });
    }
  }

  // ═══ BUILD OUTPUT ═══
  const oscillator: OscillatorPoint[] = [];
  const mfi: MfiPoint[] = [];
  
  for (let i = 0; i < n; i++) {
    if (!isNaN(sigArray[i]) && !isNaN(sgDArray[i])) {
      oscillator.push({ time: candles[i].time, sig: sigArray[i], sgD: sgDArray[i] });
    }
    if (!isNaN(mfiSmoothed[i])) {
      mfi.push({ time: candles[i].time, value: mfiSmoothed[i] });
    }
  }

  const lastSig = sigArray[n - 1] ?? 0;
  const lastSgD = sgDArray[n - 1] ?? 0;
  const lastMfi = mfiSmoothed[n - 1] ?? 0;
  
  // Confluence state
  const isBullConfluence = lastSig > 0 && lastMfi > 0;
  const isBearConfluence = lastSig < 0 && lastMfi < 0;
  
  let score = 0;
  if (isBullConfluence && lastMfi > blAvg) score = 40;
  else if (isBearConfluence && lastMfi < brAvg) score = -40;
  else if (isBullConfluence) score = 20;
  else if (isBearConfluence) score = -20;

  return {
    oscillator,
    mfi,
    reversals,
    buySellSignals,
    confluence: {
      bullish: isBullConfluence,
      bearish: isBearConfluence,
      neutral: !isBullConfluence && !isBearConfluence,
      score,
    },
    lastSig,
    lastSgD,
    lastMfi,
  };
}
