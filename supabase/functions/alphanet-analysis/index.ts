import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── ATR (Exponential Moving Average of True Range) ───
function calcATR(candles: Candle[], period: number): number[] {
  const atr = new Array(candles.length).fill(0);
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  atr[0] = tr[0];
  const k = 2 / (period + 1);
  for (let i = 1; i < candles.length; i++) {
    atr[i] = tr[i] * k + atr[i - 1] * (1 - k);
  }
  return atr;
}

// ─── SuperTrend calculation for a given factor ───
function calcSuperTrend(candles: Candle[], atr: number[], factor: number) {
  const n = candles.length;
  const upperBand = new Array(n).fill(0);
  const lowerBand = new Array(n).fill(0);
  const trend = new Array(n).fill(1); // 1 = bullish, -1 = bearish

  for (let i = 0; i < n; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    let up = hl2 + factor * atr[i];
    let dn = hl2 - factor * atr[i];

    if (i > 0) {
      if (dn > lowerBand[i - 1] || candles[i - 1].close < lowerBand[i - 1]) {
        lowerBand[i] = dn;
      } else {
        lowerBand[i] = lowerBand[i - 1];
      }
      if (up < upperBand[i - 1] || candles[i - 1].close > upperBand[i - 1]) {
        upperBand[i] = up;
      } else {
        upperBand[i] = upperBand[i - 1];
      }

      if (trend[i - 1] === 1) {
        trend[i] = candles[i].close < lowerBand[i] ? -1 : 1;
      } else {
        trend[i] = candles[i].close > upperBand[i] ? 1 : -1;
      }
    } else {
      upperBand[i] = up;
      lowerBand[i] = dn;
    }
  }
  return { trend, upperBand, lowerBand };
}

// ─── Performance score for a SuperTrend factor ───
function perfScore(candles: Candle[], atr: number[], factor: number, alpha: number): number {
  const { trend } = calcSuperTrend(candles, atr, factor);
  let score = 0;
  for (let i = 1; i < candles.length; i++) {
    const ret = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
    const aligned = (trend[i] === 1 && ret > 0) || (trend[i] === -1 && ret < 0);
    const k = 2 / (alpha + 1);
    score = (aligned ? Math.abs(ret) : -Math.abs(ret)) * k + score * (1 - k);
  }
  return score;
}

// ─── Simple 1-D K-Means (3 clusters: Best / Neutral / Worst) ───
function kMeans1D(values: number[], k = 3, iters = 20): { labels: number[]; centroids: number[] } {
  if (values.length === 0) return { labels: [], centroids: [] };
  const sorted = [...values].sort((a, b) => a - b);
  let centroids = Array.from({ length: k }, (_, i) => sorted[Math.floor((i / k) * sorted.length)]);
  let labels = new Array(values.length).fill(0);

  for (let it = 0; it < iters; it++) {
    // assign
    for (let i = 0; i < values.length; i++) {
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = Math.abs(values[i] - centroids[c]);
        if (d < bestD) { bestD = d; labels[i] = c; }
      }
    }
    // update centroids
    const sums = new Array(k).fill(0);
    const counts = new Array(k).fill(0);
    for (let i = 0; i < values.length; i++) {
      sums[labels[i]] += values[i];
      counts[labels[i]]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) centroids[c] = sums[c] / counts[c];
    }
  }
  return { labels, centroids };
}

// ─── SuperSmoother Filter ───
function superSmoother(input: number[], period: number): number[] {
  const pi = Math.PI;
  const a1 = Math.exp(-Math.SQRT2 * pi / period);
  const b1 = 2 * a1 * Math.cos(Math.SQRT2 * pi / period);
  const c3 = -(a1 * a1);
  const c2 = b1;
  const c1 = 1 - c2 - c3;
  const out = new Array(input.length).fill(0);
  for (let i = 2; i < input.length; i++) {
    out[i] = c1 * input[i] + c2 * out[i - 1] + c3 * out[i - 2];
  }
  return out;
}

// ─── Main analysis ───
function analyzeAlphaNet(candles: Candle[]) {
  const n = candles.length;
  const atrLen = 10;
  const minMult = 1;
  const maxMult = 5;
  const step = 0.5;
  const perfAlpha = 10;
  const rzLength = 100;

  const atr = calcATR(candles, atrLen);

  // Generate factors and score each
  const factors: number[] = [];
  for (let f = minMult; f <= maxMult + 0.001; f += step) {
    factors.push(Math.round(f * 100) / 100);
  }

  const scores = factors.map(f => perfScore(candles, atr, f, perfAlpha));

  // K-Means clustering on scores → pick the "best" cluster
  const { labels, centroids } = kMeans1D(scores, 3);
  const bestCluster = centroids.indexOf(Math.max(...centroids));

  // Find all factors in the best cluster, pick the one with highest score
  let bestFactor = 3.0;
  let bestScore = -Infinity;
  for (let i = 0; i < factors.length; i++) {
    if (labels[i] === bestCluster && scores[i] > bestScore) {
      bestScore = scores[i];
      bestFactor = factors[i];
    }
  }

  // Run SuperTrend with the best factor
  const { trend, upperBand, lowerBand } = calcSuperTrend(candles, atr, bestFactor);
  const currentTrend = trend[n - 1];

  // AI Strength: normalize bestScore relative to range
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;
  const strengthPct = Math.min(99, Math.max(1, ((bestScore - minScore) / range) * 100));

  // SuperSmoother Reversal Zone Bands
  const hlc3 = candles.map(c => (c.high + c.low + c.close) / 3);
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });

  const ssMean = superSmoother(hlc3, rzLength);
  const ssRange = superSmoother(tr, rzLength);

  const rzOuterMult = 2.415;
  const rzMult2 = Math.PI * rzOuterMult;
  const rzGradSize = 0.5;

  // Per-candle RZ band arrays for chart rendering
  const rzUpperOuter: { time: number; value: number }[] = [];
  const rzUpperInner: { time: number; value: number }[] = [];
  const rzMeanLine: { time: number; value: number }[] = [];
  const rzLowerInner: { time: number; value: number }[] = [];
  const rzLowerOuter: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    const m = ssMean[i];
    const r = ssRange[i];
    const up = m + r * rzMult2;
    const lo = m - r * rzMult2;
    const upInner = up + r * rzGradSize * -4;
    const loInner = lo - r * rzGradSize * -4;
    const t = candles[i].time;
    rzUpperOuter.push({ time: t, value: up });
    rzUpperInner.push({ time: t, value: upInner });
    rzMeanLine.push({ time: t, value: m });
    rzLowerInner.push({ time: t, value: loInner });
    rzLowerOuter.push({ time: t, value: lo });
  }

  const lastMean = ssMean[n - 1];
  const lastRange = ssRange[n - 1];
  const upBand = lastMean + lastRange * rzMult2;
  const loBand = lastMean - lastRange * rzMult2;
  const up9 = upBand + lastRange * rzGradSize * -4;
  const lo9 = loBand - lastRange * rzGradSize * -4;

  const lastClose = candles[n - 1].close;
  let rzState = "In Range";
  if (lastClose > up9) rzState = "⚠ BEAR ZONE";
  else if (lastClose < lo9) rzState = "⚠ BULL ZONE";

  // Detect ALL signal changes (not just the last one)
  const signalPoints: { time: number; type: "BUY" | "SELL"; price: number; strength: number }[] = [];
  let consecutiveCount = 0;
  let lastSignalDir = 0;
  for (let i = 1; i < n; i++) {
    if (trend[i] === 1 && trend[i - 1] === -1) {
      if (lastSignalDir === 1) consecutiveCount++; else { consecutiveCount = 1; lastSignalDir = 1; }
      signalPoints.push({ time: candles[i].time, type: "BUY", price: candles[i].low, strength: consecutiveCount });
    } else if (trend[i] === -1 && trend[i - 1] === 1) {
      if (lastSignalDir === -1) consecutiveCount++; else { consecutiveCount = 1; lastSignalDir = -1; }
      signalPoints.push({ time: candles[i].time, type: "SELL", price: candles[i].high, strength: consecutiveCount });
    }
  }

  // Current signal (last bar)
  let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (n >= 2) {
    if (trend[n - 1] === 1 && trend[n - 2] === -1) signal = "BUY";
    else if (trend[n - 1] === -1 && trend[n - 2] === 1) signal = "SELL";
  }

  // SuperTrend line for chart overlay - return ALL points
  const stLine = candles.map((c, i) => ({
    time: c.time,
    value: trend[i] === 1 ? lowerBand[i] : upperBand[i],
    trend: trend[i],
  }));

  return {
    algorithm: "K-Means",
    sensitivity: Math.round(bestFactor * 100) / 100,
    ai_strength: Math.round(strengthPct * 10) / 10,
    ai_state: currentTrend === 1 ? "TRENDING" : "BEARISH",
    rz_state: rzState,
    signal,
    supertrend_line: stLine,
    signal_points: signalPoints,
    rz_bands: {
      up_band: Math.round(upBand * 100) / 100,
      lo_band: Math.round(loBand * 100) / 100,
      mean: Math.round(lastMean * 100) / 100,
    },
    rz_upper_outer: rzUpperOuter.slice(-200),
    rz_upper_inner: rzUpperInner.slice(-200),
    rz_mean: rzMeanLine.slice(-200),
    rz_lower_inner: rzLowerInner.slice(-200),
    rz_lower_outer: rzLowerOuter.slice(-200),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candles } = await req.json();

    if (!Array.isArray(candles) || candles.length < 30) {
      return new Response(
        JSON.stringify({ error: "Cần ít nhất 30 nến OHLC" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalized: Candle[] = candles
      .map((c: any) => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
      }))
      .filter(
        (c: Candle) =>
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close),
      );

    if (normalized.length < 30) {
      return new Response(
        JSON.stringify({ error: "Không đủ nến hợp lệ" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = analyzeAlphaNet(normalized);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("alphanet-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});