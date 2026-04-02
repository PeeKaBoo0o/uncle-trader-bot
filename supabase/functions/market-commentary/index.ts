import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const buildPrompt = (asset: string, data: any, dxy: any) => {
  const isGold = asset === "XAU";
  const symbol = isGold ? "XAU/USD (Vàng)" : "BTC/USDT (Bitcoin)";

  return `Dữ liệu ${symbol} hiện tại:
- Giá: $${data?.price ?? "N/A"}
- Xu hướng: ${data?.trend ?? "N/A"}
- Hỗ trợ: $${data?.support ?? "N/A"} | Kháng cự: $${data?.resistance ?? "N/A"}
- Entry: $${data?.entry ?? "N/A"} | TP: $${data?.target ?? "N/A"} | SL: $${data?.stopLoss ?? "N/A"}
- Timeframe: ${data?.timeframe ?? "H4"}

DXY: ${dxy?.value ?? "N/A"} (${dxy?.changePercent ?? "N/A"}%)

Viết nhận định ngắn gọn 100-150 từ CHỈ cho ${symbol}. Tập trung vào xu hướng, mức giá quan trọng và khuyến nghị hành động.`;
};

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích tài chính, viết nhận định thị trường chuyên nghiệp bằng tiếng Việt.

Yêu cầu:
- Viết ngắn gọn 100-150 từ, súc tích, chuyên nghiệp
- Ngôn ngữ tự tin, góc nhìn rõ ràng
- Cấu trúc: Xu hướng → Mức giá quan trọng → Kịch bản giao dịch → Lưu ý
- Đề cập cụ thể các mức giá
- KHÔNG dùng markdown heading (#), chỉ text thuần với emoji
- Chia đoạn rõ ràng`;

async function generateCommentary(apiKey: string, asset: string, data: any, dxy: any): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(asset, data, dxy) },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 402) throw new Error("credit_error");
    if (status === 429) throw new Error("rate_limited");
    throw new Error(`AI gateway error ${status}`);
  }

  const result = await response.json();
  return result?.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { btc, gold, dxy } = await req.json();
    const today = new Date().toISOString().slice(0, 10);

    // Generate both commentaries in parallel
    const [btcCommentary, xauCommentary] = await Promise.all([
      btc ? generateCommentary(LOVABLE_API_KEY, "BTC", btc, dxy) : Promise.resolve(""),
      gold ? generateCommentary(LOVABLE_API_KEY, "XAU", gold, dxy) : Promise.resolve(""),
    ]);

    // Save to database (upsert by asset + date)
    const upserts = [];
    if (btcCommentary) {
      upserts.push(sb.from("market_commentaries").upsert({
        asset: "BTC",
        commentary_date: today,
        commentary: btcCommentary,
        market_data: { price: btc?.price, trend: btc?.trend, support: btc?.support, resistance: btc?.resistance, entry: btc?.entry, target: btc?.target, stopLoss: btc?.stopLoss, dxy: { value: dxy?.value, changePercent: dxy?.changePercent } },
      }, { onConflict: "asset,commentary_date" }));
    }
    if (xauCommentary) {
      upserts.push(sb.from("market_commentaries").upsert({
        asset: "XAU",
        commentary_date: today,
        commentary: xauCommentary,
        market_data: { price: gold?.price, trend: gold?.trend, support: gold?.support, resistance: gold?.resistance, entry: gold?.entry, target: gold?.target, stopLoss: gold?.stopLoss, dxy: { value: dxy?.value, changePercent: dxy?.changePercent } },
      }, { onConflict: "asset,commentary_date" }));
    }
    await Promise.all(upserts);

    return new Response(
      JSON.stringify({
        btc_commentary: btcCommentary,
        xau_commentary: xauCommentary,
        commentary_date: today,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("market-commentary error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";

    if (msg === "credit_error") {
      return new Response(
        JSON.stringify({ btc_commentary: "", xau_commentary: "", credit_error: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (msg === "rate_limited") {
      return new Response(
        JSON.stringify({ btc_commentary: "", xau_commentary: "", rate_limited: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
