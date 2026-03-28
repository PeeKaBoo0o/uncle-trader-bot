import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Mày là một chuyên gia giao dịch theo phương pháp Smart Money Concepts (SMC), chuyên săn thanh khoản (Liquidity Hunting) và giao dịch theo mô hình Turtle Soup.

Nhiệm vụ phân tích và trích xuất tọa độ:

1. Vùng Thanh Khoản (Liquidity Zones): Xác định 1 vùng thanh khoản bên mua (Buyside Liquidity - đỉnh cũ quan trọng) và 1 vùng thanh khoản bên bán (Sellside Liquidity - đáy cũ quan trọng). Trả về tọa độ vẽ Box.

2. Tín hiệu Entry (Turtle Soup & MSS): Kiểm tra xem giá có quét qua vùng thanh khoản nào chưa (Sweep) và có sự phá vỡ cấu trúc (MSS) để xác nhận vào lệnh không. Nếu có, hãy trả về tọa độ Entry, nếu không thì has_signal = false.

3. Mức TP / SL: Nếu có tín hiệu Entry, hãy tính toán 3 mức chốt lời (TP1, TP2, TP3) và 1 mức Stop Loss theo tỷ lệ R:R hợp lý.

4. 3 Điểm hành động: Đưa ra "3 điểm hành động" cực kỳ ngắn gọn (dưới 15 từ mỗi ý) dành cho Trader F0.

KHÔNG ĐƯỢC GIẢI THÍCH, KHÔNG CHỨA ĐỊNH DẠNG MARKDOWN. Chỉ trả về duy nhất một chuỗi JSON.`;

interface InputCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeCandles = (candles: unknown[]): InputCandle[] =>
  candles
    .map((c) => {
      const row = c as Partial<InputCandle>;
      return {
        time: Number(row.time),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      };
    })
    .filter((c) =>
      Number.isFinite(c.time) &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      Number.isFinite(c.volume)
    );

const buildFallbackAnalysis = (candles: InputCandle[], reason: string) => {
  const lastIndex = candles.length - 1;
  const latest = candles[lastIndex];

  const highIndex = candles.reduce(
    (best, candle, idx) => (candle.high > candles[best].high ? idx : best),
    0,
  );
  const lowIndex = candles.reduce(
    (best, candle, idx) => (candle.low < candles[best].low ? idx : best),
    0,
  );

  const highest = candles[highIndex].high;
  const lowest = candles[lowIndex].low;
  const range = Math.max(highest - lowest, latest.close * 0.005);
  const band = Math.max(range * 0.04, latest.close * 0.0015);

  const zoneStart = (idx: number) => candles[Math.max(0, idx - 16)].time;
  const zoneEnd = (idx: number) => candles[Math.min(lastIndex, idx + 16)].time;

  return {
    liquidity_boxes: [
      {
        type: "Buyside",
        start_time: zoneStart(highIndex),
        end_time: zoneEnd(highIndex),
        top_price: highest + band,
        bottom_price: highest - band,
      },
      {
        type: "Sellside",
        start_time: zoneStart(lowIndex),
        end_time: zoneEnd(lowIndex),
        top_price: lowest + band,
        bottom_price: lowest - band,
      },
    ],
    trade_signal: { has_signal: false },
    action_points: [
      "AI tạm dừng, đang dùng phân tích nội bộ.",
      "Canh phản ứng tại vùng thanh khoản gần nhất.",
      "Ưu tiên quản trị rủi ro, giữ SL cố định.",
    ],
    meta: {
      fallback: true,
      reason,
    },
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let recentCandles: InputCandle[] = [];

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const payload = await req.json();
    const candles = Array.isArray(payload?.candles) ? normalizeCandles(payload.candles) : [];
    const symbol = typeof payload?.symbol === "string" ? payload.symbol : "BTC/USDT";
    const timeframe = typeof payload?.timeframe === "string" ? payload.timeframe : "H4";

    if (candles.length < 20) {
      return jsonResponse({ error: "Cần ít nhất 20 nến OHLC hợp lệ" }, 400);
    }

    recentCandles = candles.slice(-100);

    const userPrompt = `Dữ liệu đầu vào: ${symbol} khung ${timeframe}.
Dưới đây là mảng dữ liệu ${recentCandles.length} nến OHLC:
${JSON.stringify(recentCandles)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "smc_analysis",
              description: "Return SMC liquidity analysis with zones, trade signal, and action points",
              parameters: {
                type: "object",
                properties: {
                  liquidity_boxes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["Buyside", "Sellside"] },
                        start_time: { type: "number", description: "Unix timestamp ms" },
                        end_time: { type: "number", description: "Unix timestamp ms" },
                        top_price: { type: "number" },
                        bottom_price: { type: "number" },
                      },
                      required: ["type", "start_time", "end_time", "top_price", "bottom_price"],
                    },
                  },
                  trade_signal: {
                    type: "object",
                    properties: {
                      has_signal: { type: "boolean" },
                      type: { type: "string", enum: ["Long", "Short"] },
                      entry_time: { type: "number", description: "Unix timestamp ms" },
                      entry_price: { type: "number" },
                      TP1: { type: "number" },
                      TP2: { type: "number" },
                      TP3: { type: "number" },
                      SL: { type: "number" },
                    },
                    required: ["has_signal"],
                  },
                  action_points: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["liquidity_boxes", "trade_signal", "action_points"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "smc_analysis" } },
      }),
    });

    if (!response.ok) {
      const reason = response.status === 402
        ? "Hết credits AI"
        : response.status === 429
          ? "AI đang quá tải"
          : `AI gateway lỗi ${response.status}`;

      const errText = await response.text();
      console.error("AI gateway fallback:", response.status, errText);

      return jsonResponse(buildFallbackAnalysis(recentCandles, reason), 200);
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return jsonResponse(buildFallbackAnalysis(recentCandles, "AI trả dữ liệu rỗng"), 200);
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch {
      return jsonResponse(buildFallbackAnalysis(recentCandles, "AI trả JSON không hợp lệ"), 200);
    }

    const typed = analysis as Record<string, unknown>;
    if (!Array.isArray(typed?.liquidity_boxes) || !typed?.trade_signal || !Array.isArray(typed?.action_points)) {
      return jsonResponse(buildFallbackAnalysis(recentCandles, "AI trả sai format"), 200);
    }

    return jsonResponse(analysis, 200);
  } catch (e) {
    console.error("smc-analysis error:", e);

    if (recentCandles.length >= 20) {
      return jsonResponse(buildFallbackAnalysis(recentCandles, "Lỗi xử lý tạm thời"), 200);
    }

    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});