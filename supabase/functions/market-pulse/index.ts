import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_CHAT_ID = "-1003722231058";

interface MarketData {
  fngToday: number;
  fngYesterday: number;
  fngLabel: string;
  btcPrice: number;
  btcChange24h: number;
}

interface Analysis {
  caseName: string;
  action: string;
  emoji: string;
  actionEmoji: string;
  insight: string;
  mood: string;
  moodDesc: string;
  color: string;
}

function analyzeMarket(data: MarketData): Analysis {
  const { fngToday, fngYesterday, btcChange24h } = data;
  const fngChange = fngToday - fngYesterday;

  // EXTREME FEAR + BTC DROP
  if (fngToday < 20 && btcChange24h < -3) {
    return {
      caseName: "EXTREME FEAR + BTC DROP",
      action: "CANH MUA",
      emoji: "😱",
      actionEmoji: "🟢",
      insight: `Thị trường cực kỳ sợ hãi (F&G: ${fngToday}) và BTC giảm ${btcChange24h.toFixed(1)}%. Lịch sử cho thấy đây thường là vùng tích lũy tốt.`,
      mood: "EXTREME FEAR",
      moodDesc: "extreme fear, panic selling atmosphere, dark red tones",
      color: "#FF4444",
    };
  }

  // EXTREME GREED + BTC PUMP
  if (fngToday > 75 && btcChange24h > 5) {
    return {
      caseName: "EXTREME GREED + BTC PUMP",
      action: "CHỐT LỜI / SIẾT SL",
      emoji: "🤑",
      actionEmoji: "🔴",
      insight: `Tham lam cực độ (F&G: ${fngToday}) kết hợp BTC tăng ${btcChange24h.toFixed(1)}%. Rủi ro điều chỉnh cao, nên chốt lời một phần.`,
      mood: "EXTREME GREED",
      moodDesc: "extreme greed, euphoria, bright green and gold tones",
      color: "#FF6600",
    };
  }

  // DIVERGENCE - BULL TRAP
  if (fngChange > 5 && btcChange24h <= 0) {
    return {
      caseName: "DIVERGENCE - BẪY TĂNG GIÁ",
      action: "CẢNH BÁO BẪY",
      emoji: "⚠️",
      actionEmoji: "🟡",
      insight: `F&G tăng +${fngChange} điểm nhưng BTC không tăng (${btcChange24h.toFixed(1)}%). Có thể là bẫy tăng giá — cẩn thận.`,
      mood: "DIVERGENCE WARNING",
      moodDesc: "warning, divergence, yellow and orange cautious tones",
      color: "#FFD700",
    };
  }

  // NEUTRAL ZONE
  if (fngToday >= 40 && fngToday <= 60) {
    return {
      caseName: "VÙNG TRUNG LẬP",
      action: "QUAN SÁT",
      emoji: "😐",
      actionEmoji: "⚪",
      insight: `Thị trường trung lập (F&G: ${fngToday}). Chưa có tín hiệu rõ ràng, chờ breakout hoặc sự kiện macro.`,
      mood: "NEUTRAL",
      moodDesc: "neutral, calm, balanced gray and blue tones",
      color: "#888888",
    };
  }

  // FEAR ZONE
  if (fngToday < 25) {
    return {
      caseName: "VÙNG SỢ HÃI",
      action: "THEO DÕI VÙNG HỖ TRỢ",
      emoji: "😨",
      actionEmoji: "🟢",
      insight: `Thị trường sợ hãi (F&G: ${fngToday}). Theo dõi các vùng hỗ trợ mạnh, cơ hội DCA có thể xuất hiện.`,
      mood: "FEAR",
      moodDesc: "fear, uncertainty, dark blue and purple atmosphere",
      color: "#4488FF",
    };
  }

  // EXTREME GREED (without pump)
  if (fngToday > 75) {
    return {
      caseName: "THAM LAM CỰC ĐỘ",
      action: "THẬN TRỌNG",
      emoji: "🤑",
      actionEmoji: "🟡",
      insight: `F&G ở mức tham lam cực độ (${fngToday}). Thị trường có thể điều chỉnh bất cứ lúc nào.`,
      mood: "EXTREME GREED",
      moodDesc: "greed, overconfidence, orange and red warning tones",
      color: "#FF6600",
    };
  }

  // GREED ZONE
  if (fngToday > 55) {
    return {
      caseName: "VÙNG THAM LAM",
      action: "GIỮ LỆNH + TRAILING SL",
      emoji: "😏",
      actionEmoji: "🟢",
      insight: `Thị trường tham lam vừa phải (F&G: ${fngToday}). Xu hướng tăng, giữ vị thế và siết trailing stop-loss.`,
      mood: "GREED",
      moodDesc: "greed, bullish momentum, green and gold optimistic tones",
      color: "#44CC44",
    };
  }

  // DEFAULT
  return {
    caseName: "QUAN SÁT THỊ TRƯỜNG",
    action: "QUAN SÁT",
    emoji: "🔍",
    actionEmoji: "⚪",
    insight: `F&G: ${fngToday}, BTC: ${btcChange24h > 0 ? "+" : ""}${btcChange24h.toFixed(1)}%. Chưa có setup rõ ràng, tiếp tục theo dõi.`,
    mood: "NEUTRAL",
    moodDesc: "neutral observation, calm professional atmosphere",
    color: "#888888",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let useTestData = false;
    try {
      const body = await req.json();
      useTestData = body?.test === true;
    } catch {}

    // ─── Fetch Data ───
    let marketData: MarketData;

    if (useTestData) {
      marketData = { fngToday: 15, fngYesterday: 22, fngLabel: "Extreme Fear", btcPrice: 65000, btcChange24h: -4.2 };
    } else {
      // Fear & Greed
      const fngRes = await fetch("https://api.alternative.me/fng/?limit=2");
      const fngData = await fngRes.json();
      const fngToday = parseInt(fngData.data?.[0]?.value || "50");
      const fngYesterday = parseInt(fngData.data?.[1]?.value || "50");
      const fngLabel = fngData.data?.[0]?.value_classification || "Neutral";

      // BTC Price from CoinGecko
      const btcRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true");
      const btcData = await btcRes.json();
      const btcPrice = btcData.bitcoin?.usd || 0;
      const btcChange24h = btcData.bitcoin?.usd_24h_change || 0;

      marketData = { fngToday, fngYesterday, fngLabel, btcPrice, btcChange24h };
    }

    console.log("Market data:", JSON.stringify(marketData));

    // ─── Analyze ───
    const analysis = analyzeMarket(marketData);
    const fngChange = marketData.fngToday - marketData.fngYesterday;
    const fngChangeStr = fngChange >= 0 ? `+${fngChange}` : `${fngChange}`;

    // ─── AI Thumbnail via Lovable AI Gateway ───
    let imageUrl: string | null = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const fngVal = marketData.fngToday;
        const arrowDir = marketData.btcChange24h > 0 ? "upward green" : "downward red";
        const imgPrompt = `Create a clean, minimalist cryptocurrency Fear & Greed Index infographic image.

Layout (centered, dark navy background #0f1629 with very subtle grid lines):
1. TOP: A large semi-circular gauge meter (speedometer style) with gradient from red (left/fear) through yellow (middle) to blue-green (right/greed). The needle points to ${fngVal}/100.
2. CENTER: The number "${fngVal}" displayed very large and bold in white, centered below the gauge.
3. BOTTOM-LEFT: Bitcoin ₿ symbol icon in white/gray.
4. BOTTOM-CENTER: Text "FEAR & GREED INDEX" in bold white uppercase.
5. BOTTOM-RIGHT: A ${arrowDir} arrow with "${fngChangeStr}%" text showing the change.
6. WATERMARK: "UNCLETRADER" text in subtle gray at bottom-right corner.

Style: Ultra-clean, professional fintech dashboard aesthetic. Minimal elements, high contrast on dark background. No gradients on background, just solid dark navy. The gauge is the hero element.
Do NOT include: people, faces, complex charts, candlesticks, paragraphs of text, logos other than Bitcoin symbol.
Aspect ratio: 16:9, 800x450 pixels.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: imgPrompt }],
            modalities: ["image", "text"],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const images = aiData.choices?.[0]?.message?.images;

          if (images && images.length > 0) {
            const dataUrl = images[0].image_url?.url;
            if (dataUrl) {
              // Extract base64 data from data URI
              const base64Data = dataUrl.split(",")[1];
              const mimeMatch = dataUrl.match(/data:([^;]+);/);
              const mimeType = mimeMatch?.[1] || "image/png";
              const ext = mimeType.includes("jpeg") ? "jpg" : "png";
              const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

              const now = new Date();
              const vn = new Date(now.getTime() + 7 * 3600 * 1000);
              const dateStr = vn.toISOString().split("T")[0];
              const timeStr2 = `${String(vn.getUTCHours()).padStart(2,"0")}${String(vn.getUTCMinutes()).padStart(2,"0")}`;
              const fileName = `thumbnails/${dateStr}-${timeStr2}-market-pulse.${ext}`;

              const { error: uploadErr } = await supabase.storage
                .from("news-images")
                .upload(fileName, bytes, { contentType: mimeType, upsert: true });

              if (!uploadErr) {
                const { data: urlData } = supabase.storage.from("news-images").getPublicUrl(fileName);
                imageUrl = urlData?.publicUrl || null;
                console.log("Thumbnail uploaded:", imageUrl);
              } else {
                console.error("Upload error:", uploadErr);
              }
            }
          }
        } else {
          const errText = await aiRes.text();
          console.error("AI Gateway error:", aiRes.status, errText);
        }
      } catch (e) {
        console.error("Image gen error:", e);
      }
    }
        console.error("Image gen error:", e);
      }
    }

    // ─── Format Caption ───
    const now = new Date();
    const vnTime = new Date(now.getTime() + 7 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const timeStr = `${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())} GMT+7`;

    const btcDir = marketData.btcChange24h >= 0 ? "+" : "";
    const caption = `🧠 <b>UNCLETRADER MARKET PULSE</b>

${analysis.emoji} <b>${analysis.caseName}</b>

📊 F&amp;G: <b>${marketData.fngToday}</b> (${fngChangeStr}) | ₿ $${marketData.btcPrice.toLocaleString()} (<b>${btcDir}${marketData.btcChange24h.toFixed(1)}%</b>)

🔍 ${analysis.insight}

${analysis.actionEmoji} <b>Action: ${analysis.action}</b>

🕐 ${timeStr}`;

    // ─── Send to Telegram ───
    let res: Response;

    if (imageUrl) {
      res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          photo: imageUrl,
          caption: caption.slice(0, 1024),
          parse_mode: "HTML",
        }),
      });
    } else {
      res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: caption,
          parse_mode: "HTML",
        }),
      });
    }

    const result = await res.json();
    if (!res.ok) {
      console.error("Telegram error:", JSON.stringify(result));
      throw new Error(`Telegram API failed: ${JSON.stringify(result)}`);
    }

    console.log("Market pulse sent:", analysis.caseName);

    return new Response(JSON.stringify({
      ok: true,
      sent: true,
      analysis: analysis.caseName,
      action: analysis.action,
      fng: marketData.fngToday,
      btcPrice: marketData.btcPrice,
      hasImage: !!imageUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
