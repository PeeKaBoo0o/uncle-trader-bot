import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY") || "";

const GEMINI_MODELS = [
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.0-flash",
];

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "create_trading_setups",
    description: "Create 3 trading scenarios for an asset",
    parameters: {
      type: "object",
      properties: {
        scenarios: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scenario: { type: "string", enum: ["A", "B", "C"] },
              title: { type: "string" },
              condition: { type: "string" },
              action: { type: "string" },
              invalidation: { type: "string" },
              probability: { type: "string", enum: ["high", "medium", "low"] },
              targets: { type: "array", items: { type: "number" } },
            },
            required: ["scenario", "title", "condition", "action", "invalidation", "probability", "targets"],
          },
        },
        market_context: { type: "string" },
        ai_summary: { type: "string" },
      },
      required: ["scenarios", "market_context", "ai_summary"],
    },
  },
};

// ---------- DATA FETCHERS ----------

async function fetchCryptoData(): Promise<Record<string, { price: number; change24h: number; change7d: number }>> {
  const ids = "bitcoin,ethereum,solana,ripple,binancecoin";
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const data = await res.json();
  const map: Record<string, string> = {
    bitcoin: "BTC", ethereum: "ETH", solana: "SOL", ripple: "XRP", binancecoin: "BNB",
  };
  const result: Record<string, any> = {};
  for (const [id, sym] of Object.entries(map)) {
    const d = data[id];
    if (d) {
      result[sym] = {
        price: d.usd,
        change24h: d.usd_24h_change ?? 0,
        change7d: d.usd_7d_change ?? 0,
      };
    }
  }
  return result;
}

async function fetchGoldPrice(): Promise<{ price: number; change24h: number }> {
  // Try CoinGecko XAUT first
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd&include_24hr_change=true");
    if (res.ok) {
      const data = await res.json();
      if (data["tether-gold"]) {
        return { price: data["tether-gold"].usd, change24h: data["tether-gold"].usd_24h_change ?? 0 };
      }
    }
  } catch { /* fallback */ }

  // Finnhub fallback
  if (FINNHUB_API_KEY) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=OANDA:XAU_USD&token=${FINNHUB_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data.c) {
          const change = ((data.c - data.pc) / data.pc) * 100;
          return { price: data.c, change24h: change };
        }
      }
    } catch { /* fallback */ }
  }

  throw new Error("Could not fetch gold price from any source");
}

// ---------- AI GENERATION (Gemini REST API) ----------

async function generateSetups(asset: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const toolDecl = {
    functionDeclarations: [{
      name: "create_trading_setups",
      description: "Create 3 trading scenarios for an asset",
      parameters: TOOL_SCHEMA.function.parameters,
    }],
  };

  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[${asset}] Trying model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          tools: [toolDecl],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["create_trading_setups"] } },
          generationConfig: { temperature: 0.7 },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[${asset}] Model ${model} failed: ${res.status} ${errText}`);
        continue;
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts;
      const fnCall = parts?.find((p: any) => p.functionCall);
      if (fnCall?.functionCall?.args) {
        console.log(`[${asset}] Success with ${model}`);
        return fnCall.functionCall.args;
      }

      // Fallback: try parsing text response as JSON
      const textPart = parts?.find((p: any) => p.text);
      if (textPart?.text) {
        try {
          const jsonMatch = textPart.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch {}
      }

      console.error(`[${asset}] Model ${model}: no function call in response`);
    } catch (e) {
      console.error(`[${asset}] Model ${model} error:`, e);
    }
  }
  throw new Error(`All AI models failed for ${asset}`);
}

// ---------- MAIN ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const vnDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const dateStr = vnDate.toISOString().split("T")[0];
    const dateDisplay = `${vnDate.getDate().toString().padStart(2, "0")}/${(vnDate.getMonth() + 1).toString().padStart(2, "0")}/${vnDate.getFullYear()}`;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const force = body.force === true;
    const assetsToGenerate = body.assets || ["BTC", "XAU"];

    // Fetch market data
    const [cryptoData, goldData] = await Promise.all([
      fetchCryptoData(),
      fetchGoldPrice(),
    ]);

    const results: Record<string, any> = {};

    for (const asset of assetsToGenerate) {
      // Check if already exists
      if (!force) {
        const { data: existing } = await supabase
          .from("daily_setups")
          .select("id")
          .eq("asset", asset)
          .eq("setup_date", dateStr)
          .maybeSingle();

        if (existing) {
          console.log(`[${asset}] Already exists for ${dateStr}, skipping`);
          results[asset] = { status: "exists" };
          continue;
        }
      }

      const isCrypto = asset === "BTC";
      const assetLabel = isCrypto ? "Bitcoin (BTC)" : "Vàng (XAU/USD)";
      const assetType = isCrypto ? "crypto" : "vàng";

      const systemPrompt = `Bạn là một chuyên gia phân tích kỹ thuật ${assetType}. Nhiệm vụ: tạo 3 kịch bản giao dịch cho ${assetLabel} ngày hôm nay.

BẮT BUỘC: TOÀN BỘ NỘI DUNG VIẾT BẰNG TIẾNG VIỆT (chỉ giữ tên coin, ký hiệu $, và số).

Mỗi kịch bản gồm:
- scenario: "A" (tăng), "B" (đi ngang), "C" (giảm)
- title: Tiêu đề ngắn gọn tiếng Việt
- condition: Điều kiện xảy ra
- action: Hành động giao dịch cụ thể (entry, SL, TP)
- invalidation: Điều kiện hủy bỏ
- probability: "high" / "medium" / "low"
- targets: Mảng mức giá mục tiêu

${!isCrypto ? "Với XAU: phân tích dựa trên USD, lãi suất, địa chính trị, tương quan BTC. Phân tích thực tế, mức giá không quá xa giá hiện tại." : ""}`;

      let userPrompt = `Dữ liệu thị trường hiện tại (${dateDisplay}, GMT+7):\n\n`;

      if (isCrypto) {
        const btc = cryptoData.BTC;
        userPrompt += `BTC: $${btc.price.toLocaleString()} (24h: ${btc.change24h.toFixed(2)}%, 7d: ${btc.change7d.toFixed(2)}%)\n`;
        for (const sym of ["ETH", "SOL", "XRP", "BNB"]) {
          const d = cryptoData[sym];
          if (d) userPrompt += `${sym}: $${d.price.toLocaleString()} (24h: ${d.change24h.toFixed(2)}%)\n`;
        }
      } else {
        userPrompt += `XAU/USD: $${goldData.price.toFixed(2)} (24h: ${goldData.change24h.toFixed(2)}%)\n`;
        const btc = cryptoData.BTC;
        if (btc) userPrompt += `BTC (tương quan): $${btc.price.toLocaleString()} (24h: ${btc.change24h.toFixed(2)}%)\n`;
      }

      userPrompt += `\nHãy tạo 3 kịch bản giao dịch cho ${assetLabel} ngày hôm nay.`;

      const aiResult = await generateSetups(asset, systemPrompt, userPrompt);
      const price = isCrypto ? cryptoData.BTC.price : goldData.price;
      const change = isCrypto ? cryptoData.BTC.change24h : goldData.change24h;

      // Upsert to DB
      const { error } = await supabase.from("daily_setups").upsert(
        {
          asset,
          setup_date: dateStr,
          scenarios: aiResult.scenarios,
          market_context: aiResult.market_context,
          ai_summary: aiResult.ai_summary,
          current_price: price,
          price_change_24h: change,
        },
        { onConflict: "asset,setup_date" }
      );

      if (error) throw error;
      results[asset] = { status: "generated", scenarios: aiResult.scenarios.length };
    }

    return new Response(JSON.stringify({ ok: true, date: dateStr, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
