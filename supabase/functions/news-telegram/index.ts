import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_CHAT_ID = "-1003722231058";
const NEWS_THREAD_ID = 329;

/** Generate an illustration image from news content via Lovable AI Gateway */
async function generateNewsImage(title: string, summary: string | null): Promise<Uint8Array | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, skipping image generation");
    return null;
  }

  const prompt = `Create a professional, editorial-style digital illustration for a financial news article. The image should be visually striking, modern, and suitable for a trading/finance Telegram channel. Do NOT include any text or words in the image. Topic: "${title}". ${summary ? `Context: ${summary.slice(0, 200)}` : ""}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Image generation failed:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl || !imageUrl.startsWith("data:image/")) {
      console.warn("No image returned from AI");
      return null;
    }

    // Extract base64 and decode to bytes
    const base64Data = imageUrl.split(",")[1];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Image generation error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch latest published news article
    const { data: article, error } = await supabase
      .from("news_articles")
      .select("title, summary, source, published_at, badge, stream")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !article) {
      console.log("No news article found:", error?.message);
      return new Response(JSON.stringify({ ok: true, sent: false, reason: "no_article" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format message
    const streamEmoji: Record<string, string> = {
      crypto: "₿",
      forex: "💱",
      gold: "🥇",
      stock: "📈",
      macro: "🌍",
    };

    const emoji = streamEmoji[article.stream] || "📰";
    const badge = article.badge ? `[${article.badge}] ` : "";
    const summary = article.summary
      ? `\n\n${article.summary.slice(0, 300)}${article.summary.length > 300 ? "..." : ""}`
      : "";

    const caption = `${emoji} <b>${badge}${article.title}</b>${summary}

📌 Nguồn: ${article.source}
🕐 ${new Date(article.published_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`;

    // Generate AI illustration
    console.log("Generating image for:", article.title);
    const imageBytes = await generateNewsImage(article.title, article.summary);

    let result: any;
    let res: Response;

    if (imageBytes) {
      // Send photo with caption via multipart form
      const formData = new FormData();
      formData.append("chat_id", TELEGRAM_CHAT_ID);
      formData.append("message_thread_id", String(NEWS_THREAD_ID));
      formData.append("caption", caption);
      formData.append("parse_mode", "HTML");
      formData.append("photo", new Blob([imageBytes], { type: "image/png" }), "news.png");

      res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData,
      });
    } else {
      // Fallback: send text only
      res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          message_thread_id: NEWS_THREAD_ID,
          text: caption,
          parse_mode: "HTML",
        }),
      });
    }

    result = await res.json();
    if (!res.ok) {
      console.error("Telegram error:", JSON.stringify(result));
      throw new Error(`Telegram API failed [${res.status}]: ${JSON.stringify(result)}`);
    }

    console.log("News sent to Telegram:", article.title, imageBytes ? "(with image)" : "(text only)");

    return new Response(JSON.stringify({ ok: true, sent: true, title: article.title, hasImage: !!imageBytes }), {
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
