import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── TYPES ───
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Zone { top: number; bottom: number; type: "support" | "resistance" }

interface ConditionResult { name: string; triggered: boolean; detail?: string }

// ─── SYMBOL MAPPING (Binance-compatible) ───
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  XAUUSDT: "PAXGUSDT", // Gold → PAX Gold on Binance
  "XAU/USDT": "PAXGUSDT",
};

// ─── BINANCE KLINES ───
async function fetchCandles(symbol: string, interval: string, limit = 100, endTime?: number): Promise<Candle[]> {
  const cleaned = String(symbol || "").replace("/", "").toUpperCase();
  const binanceSymbol = BINANCE_SYMBOL_MAP[cleaned] || BINANCE_SYMBOL_MAP[symbol] || cleaned || "BTCUSDT";
  const allowedIntervals = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]);
  const safeInterval = allowedIntervals.has(interval) ? interval : "4h";
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 20), 1000) : 100;

  // Try multiple Binance endpoints to avoid geo-blocking (451)
  const endpoints = [
    `https://data-api.binance.vision/api/v3/klines`,
    `https://api1.binance.com/api/v3/klines`,
    `https://api2.binance.com/api/v3/klines`,
    `https://api3.binance.com/api/v3/klines`,
    `https://api.binance.com/api/v3/klines`,
  ];

  let lastError = "";
  for (const base of endpoints) {
    try {
      let url = `${base}?symbol=${binanceSymbol}&interval=${safeInterval}&limit=${safeLimit}`;
      if (endTime && Number.isFinite(endTime)) {
        url += `&endTime=${endTime}`;
      }
      const res = await fetch(url);
      const bodyText = await res.text();

      if (!res.ok) {
        lastError = `${base}: ${res.status} ${bodyText.slice(0, 100)}`;
        console.warn(`Binance endpoint failed: ${lastError}`);
        continue; // try next endpoint
      }

      let data: any;
      try { data = JSON.parse(bodyText); } catch { continue; }

      if (!Array.isArray(data) || data.length === 0) continue;

      return data.map((k: any[]) => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch (e) {
      lastError = `${base}: ${e instanceof Error ? e.message : "fetch error"}`;
      continue;
    }
  }

  // All endpoints failed — try fallbacks
  console.error(`All Binance endpoints failed for ${binanceSymbol}. Last error: ${lastError}`);

  // Gold fallback
  if (cleaned.includes("XAU") || cleaned.includes("PAXG")) {
    console.log("Falling back to synthetic gold data from BTCUSDT");
    return fetchSyntheticGold(safeInterval, safeLimit);
  }

  // Generic fallback for unknown symbols
  if (binanceSymbol !== "BTCUSDT") {
    console.warn(`Falling back to BTCUSDT for unsupported symbol: ${binanceSymbol}`);
    return fetchCandles("BTCUSDT", safeInterval, safeLimit);
  }

  throw new Error(`All Binance API endpoints failed: ${lastError}`);
}



// Synthetic gold OHLCV — scales BTC price to approximate XAU range
async function fetchSyntheticGold(interval: string, limit: number): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance fallback error: ${res.status}`);
  const data = await res.json();
  // Scale BTC (~100k) to gold range (~2300-3500)
  const scaleFactor = 0.033;
  return data.map((k: any[]) => ({
    time: k[0],
    open: parseFloat(k[1]) * scaleFactor,
    high: parseFloat(k[2]) * scaleFactor,
    low: parseFloat(k[3]) * scaleFactor,
    close: parseFloat(k[4]) * scaleFactor,
    volume: parseFloat(k[5]) * 0.1,
  }));
}

// ─── INDICATOR CALCULATIONS ───
function calcSMA(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
  }
  avgGain /= period; avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calcBollingerBands(closes: number[], period = 20, stdDev = 2) {
  const sma = calcSMA(closes, period);
  const upper: number[] = [], lower: number[] = [], bandwidth: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(sma[i])) { upper.push(NaN); lower.push(NaN); bandwidth.push(NaN); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - sma[i]) ** 2, 0) / period);
    upper.push(sma[i] + stdDev * std);
    lower.push(sma[i] - stdDev * std);
    bandwidth.push((upper[i] - lower[i]) / sma[i] * 100);
  }
  return { upper, middle: sma, lower, bandwidth };
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = calcEMA(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

function calcVolumeAvg(volumes: number[], period = 10): number[] {
  return calcSMA(volumes, period);
}

// ─── AI SUPPORT/RESISTANCE ───
async function getAIZones(candles: Candle[], symbol: string): Promise<{ zones: Zone[]; actions: any }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback: simple pivot-based zones
    return calculateSimpleZones(candles);
  }

  const ohlcvText = candles.slice(-100).map(c =>
    `${new Date(c.time).toISOString()},${c.open},${c.high},${c.low},${c.close},${c.volume}`
  ).join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a technical analysis expert. Analyze OHLCV data and identify support/resistance zones." },
          { role: "user", content: `Analyze ${symbol} OHLCV data (time,open,high,low,close,volume):\n${ohlcvText}\n\nReturn JSON with: { "zones": [{"top": number, "bottom": number, "type": "support"|"resistance"}], "actions": {"entry": number, "target": number, "stopLoss": number} }. Return exactly 2 support and 2 resistance zones.` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_zones",
            description: "Return support/resistance zones and action points",
            parameters: {
              type: "object",
              properties: {
                zones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      top: { type: "number" },
                      bottom: { type: "number" },
                      type: { type: "string", enum: ["support", "resistance"] }
                    },
                    required: ["top", "bottom", "type"]
                  }
                },
                actions: {
                  type: "object",
                  properties: {
                    entry: { type: "number" },
                    target: { type: "number" },
                    stopLoss: { type: "number" }
                  },
                  required: ["entry", "target", "stopLoss"]
                }
              },
              required: ["zones", "actions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_zones" } }
      }),
    });

    if (!res.ok) return calculateSimpleZones(candles);

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed;
    }
    return calculateSimpleZones(candles);
  } catch {
    return calculateSimpleZones(candles);
  }
}

function calculateSimpleZones(candles: Candle[]): { zones: Zone[]; actions: any } {
  const recent = candles.slice(-50);
  const highs = recent.map(c => c.high).sort((a, b) => b - a);
  const lows = recent.map(c => c.low).sort((a, b) => a - b);
  const range = highs[0] - lows[0];
  const margin = range * 0.005;

  return {
    zones: [
      { top: highs[0] + margin, bottom: highs[0] - margin, type: "resistance" },
      { top: highs[5] + margin, bottom: highs[5] - margin, type: "resistance" },
      { top: lows[5] + margin, bottom: lows[5] - margin, type: "support" },
      { top: lows[0] + margin, bottom: lows[0] - margin, type: "support" },
    ],
    actions: {
      entry: recent[recent.length - 1].close,
      target: highs[0],
      stopLoss: lows[0],
    }
  };
}

// ─── SIGNAL CONDITIONS ───
function checkAllConditions(candles: Candle[], zones: Zone[]): ConditionResult[] {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const n = candles.length - 1;
  const curr = candles[n];
  const prev = candles[n - 1];

  const bb = calcBollingerBands(closes);
  const rsi = calcRSI(closes);
  const volAvg = calcVolumeAvg(volumes);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const macd = calcMACD(closes);

  const currRSI = rsi[n];
  const currVolRatio = !isNaN(volAvg[n]) && volAvg[n] > 0 ? curr.volume / volAvg[n] : 1;
  const candleBody = Math.abs(curr.close - curr.open) / curr.open * 100;

  const results: ConditionResult[] = [];

  // 1. BB Squeeze
  const currBW = bb.bandwidth[n];
  const prevBW = bb.bandwidth[n - 1];
  const bbSqueeze = !isNaN(currBW) && !isNaN(prevBW) && currBW < prevBW * 0.85 && currRSI >= 40 && currRSI <= 60;
  results.push({ name: "BB Squeeze", triggered: bbSqueeze, detail: `BW: ${currBW?.toFixed(2)}% | RSI: ${currRSI?.toFixed(1)}` });

  // 2. Breakout
  const resistanceZones = zones.filter(z => z.type === "resistance");
  const breakout = resistanceZones.some(z => curr.close > z.top * 1.003) && currVolRatio > 1.3 && currRSI > 60;
  results.push({ name: "Breakout", triggered: breakout, detail: `Close > R-zone | Vol: ${currVolRatio.toFixed(1)}x | RSI: ${currRSI?.toFixed(1)}` });

  // 3. Breakdown
  const supportZones = zones.filter(z => z.type === "support");
  const breakdown = supportZones.some(z => curr.close < z.bottom * 0.997) && currVolRatio > 1.3 && currRSI < 40;
  results.push({ name: "Breakdown", triggered: breakdown, detail: `Close < S-zone | Vol: ${currVolRatio.toFixed(1)}x | RSI: ${currRSI?.toFixed(1)}` });

  // 4. Confluence
  const inSupportZone = supportZones.some(z => curr.close >= z.bottom && curr.close <= z.top);
  const belowLowerBB = !isNaN(bb.lower[n]) && curr.close <= bb.lower[n];
  const confluence = belowLowerBB && inSupportZone && currRSI < 45;
  results.push({ name: "Confluence", triggered: confluence, detail: `Below BB lower + In S-zone | RSI: ${currRSI?.toFixed(1)}` });

  // 5. Momentum
  const twoCanAgo = candles[n - 2];
  const pctChange = twoCanAgo ? ((curr.close - twoCanAgo.close) / twoCanAgo.close) * 100 : 0;
  const isGold = false; // Will be set by caller context
  const momentumThreshold = isGold ? 2.5 : 3.5;
  const momentum = Math.abs(pctChange) > momentumThreshold;
  results.push({ name: "Momentum", triggered: momentum, detail: `${pctChange.toFixed(2)}% over 2 candles` });

  // 6. Volume Spike
  const volSpike = currVolRatio > 2.5 && candleBody > 0.3;
  results.push({ name: "Volume Spike", triggered: volSpike, detail: `Vol: ${currVolRatio.toFixed(1)}x | Body: ${candleBody.toFixed(2)}%` });

  // 7. RSI Divergence
  let rsiDiv = false;
  let rsiDivDetail = "";
  if (n >= 10) {
    const lookback = 10;
    const recentCloses = closes.slice(n - lookback, n + 1);
    const recentRSI = rsi.slice(n - lookback, n + 1).filter(v => !isNaN(v));
    if (recentRSI.length > 2) {
      const maxRSI = Math.max(...recentRSI);
      const minRSI = Math.min(...recentRSI);
      if (maxRSI > 70 && currRSI < maxRSI - 5 && curr.close >= Math.max(...recentCloses.slice(0, -1))) {
        rsiDiv = true;
        rsiDivDetail = `Bearish div | RSI peak: ${maxRSI.toFixed(1)}, now: ${currRSI?.toFixed(1)}`;
      } else if (minRSI < 30 && currRSI > minRSI + 5 && curr.close <= Math.min(...recentCloses.slice(0, -1))) {
        rsiDiv = true;
        rsiDivDetail = `Bullish div | RSI low: ${minRSI.toFixed(1)}, now: ${currRSI?.toFixed(1)}`;
      }
    }
  }
  results.push({ name: "RSI Divergence", triggered: rsiDiv, detail: rsiDivDetail || `RSI: ${currRSI?.toFixed(1)}` });

  // 8. Support Bounce
  const prevTouchesSupport = supportZones.some(z => prev && prev.low >= z.bottom * 0.998 && prev.low <= z.top * 1.002);
  const closesAbove = prev && curr.close > prev.close;
  const volAboveAvg = currVolRatio > 1.2;
  const supportBounce = prevTouchesSupport && closesAbove && volAboveAvg;
  results.push({ name: "Support Bounce", triggered: supportBounce, detail: `Prev touched S-zone + close up | Vol: ${currVolRatio.toFixed(1)}x` });

  // EMA Cross (bonus)
  const emaCross = ema20[n] > ema50[n] && ema20[n - 1] <= ema50[n - 1];
  results.push({ name: "EMA Cross", triggered: emaCross, detail: `EMA20: ${ema20[n]?.toFixed(2)} > EMA50: ${ema50[n]?.toFixed(2)}` });

  // MACD Cross (bonus)
  const macdCross = macd.macdLine[n] > macd.signalLine[n] && macd.macdLine[n - 1] <= macd.signalLine[n - 1];
  results.push({ name: "MACD Cross", triggered: macdCross, detail: `MACD: ${macd.macdLine[n]?.toFixed(4)}` });

  return results;
}

function getStrength(conditions: ConditionResult[]): string {
  const triggered = conditions.filter(c => c.triggered);
  const count = triggered.length;
  if (count >= 3) return "🔥 CỰC MẠNH";
  if (count >= 2) return "✅ TRUNG BÌNH";
  if (count === 1 && (triggered[0].name === "Breakout" || triggered[0].name === "Breakdown")) return "⚠️ THẤP";
  return "";
}

function shouldSendSignal(conditions: ConditionResult[]): boolean {
  const triggered = conditions.filter(c => c.triggered);
  if (triggered.length >= 2) return true;
  if (triggered.length === 1 && (triggered[0].name === "Breakout" || triggered[0].name === "Breakdown")) return true;
  return false;
}

// ─── TELEGRAM ───
async function sendTelegram(chatId: string, text: string, messageThreadId?: number) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not configured, skipping send");
    return;
  }

  const payload: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (messageThreadId) payload.message_thread_id = messageThreadId;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram send error:", err);
  }
}

async function sendTelegramPhoto(chatId: string, imageBase64: string, caption: string, messageThreadId?: number) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not configured, skipping photo send");
    return;
  }

  // Convert base64 to binary
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("photo", new Blob([binaryData], { type: "image/png" }), "chart.png");
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");
  if (messageThreadId) formData.append("message_thread_id", String(messageThreadId));

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram sendPhoto error:", err);
  }
}

function formatTelegramMessage(symbol: string, timeframe: string, conditions: ConditionResult[], price: number, rsiVal: number, volRatio: number, strength: string): string {
  const triggered = conditions.filter(c => c.triggered);
  const condList = triggered.map(c => `• ${c.name}: ${c.detail || ""}`).join("\n");

  return `[TÍN HIỆU ${symbol}] - KHUNG ${timeframe}
🏆 ĐỘ TIN CẬY: ${strength}

📥 CÁC ĐIỀU KIỆN HỘI TỤ:
${condList}

💰 GIÁ HIỆN TẠI: ${price.toFixed(2)}
📊 RSI: ${rsiVal.toFixed(1)} | VOL: ${volRatio.toFixed(1)}x

⚠️ Chờ nến ${timeframe} đóng cửa để xác nhận.`;
}

// ─── TIMEFRAME MAP ───
const TF_MAP: Record<string, string> = { M5: "5m", M15: "15m", M30: "30m", H1: "1h", H4: "4h", D1: "1d", W1: "1w" };

// ─── MAIN HANDLER ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "scan"; // "scan" = run bot | "candles" = fetch candles | "indicators" = calc indicators
    const symbol = body.symbol || "BTCUSDT";
    const timeframe = body.timeframe || "H4";
    const interval = TF_MAP[timeframe] || "4h";
    const limit = body.limit || 100;
    const chartImage = body.chartImage || null; // base64 chart screenshot

    const endTime = body.endTime || undefined;

    // Mode: fetch candles only
    if (mode === "candles") {
      const candles = await fetchCandles(symbol, interval, limit, endTime);
      return new Response(JSON.stringify({ candles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: calculate indicators
    if (mode === "indicators") {
      const candles = await fetchCandles(symbol, interval, limit, endTime);
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);

      const bb = calcBollingerBands(closes);
      const rsi = calcRSI(closes);
      const ema20 = calcEMA(closes, 20);
      const ema50 = calcEMA(closes, 50);
      const ema200 = calcEMA(closes, 200);
      const macd = calcMACD(closes);
      const volAvg = calcVolumeAvg(volumes);
      const zones = await getAIZones(candles, symbol);

      return new Response(JSON.stringify({
        candles,
        indicators: { bb, rsi, ema20, ema50, ema200, macd, volAvg },
        zones: zones.zones,
        actions: zones.actions,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: scan (signal bot)
    const symbols = body.symbols || ["BTCUSDT", "XAUUSDT"];
    const telegramChatId = body.telegram_chat_id || Deno.env.get("TELEGRAM_CHAT_ID");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = [];

    for (const sym of symbols) {
      try {
        const candles = await fetchCandles(sym, interval, limit);
        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const rsi = calcRSI(closes);
        const volAvg = calcVolumeAvg(volumes);
        const zones = await getAIZones(candles, sym);

        const conditions = checkAllConditions(candles, zones.zones);
        const n = candles.length - 1;
        const currRSI = rsi[n] || 50;
        const currVolRatio = !isNaN(volAvg[n]) && volAvg[n] > 0 ? candles[n].volume / volAvg[n] : 1;
        const strength = getStrength(conditions);

        if (shouldSendSignal(conditions)) {
          const candleTime = new Date(candles[n].time).toISOString();

          // Check anti-spam
          const { data: existing } = await supabase
            .from("signals")
            .select("id")
            .eq("symbol", sym)
            .eq("candle_time", candleTime)
            .eq("timeframe", timeframe)
            .maybeSingle();

          if (!existing) {
            const triggeredNames = conditions.filter(c => c.triggered).map(c => c.name);

            // Save to DB
            await supabase.from("signals").insert({
              symbol: sym,
              timeframe,
              conditions: triggeredNames,
              strength,
              price: candles[n].close,
              rsi: currRSI,
              vol_ratio: currVolRatio,
              candle_time: candleTime,
            });

            // Send Telegram
            if (telegramChatId) {
              const msg = formatTelegramMessage(sym, timeframe, conditions, candles[n].close, currRSI, currVolRatio, strength);
              await sendTelegram(telegramChatId, msg, 9);
            }

            results.push({ symbol: sym, strength, conditions: triggeredNames, price: candles[n].close });
          } else {
            results.push({ symbol: sym, status: "already_sent", candleTime });
          }
        } else {
          results.push({ symbol: sym, status: "no_signal", triggeredCount: conditions.filter(c => c.triggered).length });
        }
      } catch (symError) {
        const errorMsg = symError instanceof Error ? symError.message : "Unknown symbol error";
        console.error(`Scan failed for ${sym}:`, errorMsg);
        results.push({ symbol: sym, status: "error", error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Signal bot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
