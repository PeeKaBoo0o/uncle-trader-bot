import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_CHAT_ID = "-1003722231058";
const CALENDAR_THREAD_ID = 329;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine target date (default: today GMT+7)
    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body?.date || "";
    } catch { targetDate = ""; }

    if (!targetDate) {
      const now = new Date();
      const vn = new Date(now.getTime() + 7 * 3600 * 1000);
      targetDate = vn.toISOString().split("T")[0];
    }

    console.log("Daily summary for:", targetDate);

    const dayStart = `${targetDate}T00:00:00+07:00`;
    const dayEnd = `${targetDate}T23:59:59+07:00`;

    // Query USD events with importance >= 2
    const { data: events, error: fetchErr } = await supabase
      .from("economic_events")
      .select("*")
      .in("impact", ["high", "medium"])
      .gte("event_time", dayStart)
      .lte("event_time", dayEnd)
      .order("event_time", { ascending: true });

    if (fetchErr) throw new Error(`DB error: ${fetchErr.message}`);

    // Filter USD only
    const usdEvents = (events || []).filter(ev =>
      ev.flag === "🇺🇸" || ev.country === "Mỹ" || ev.country === "US"
    );

    if (usdEvents.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: false, reason: "no_usd_events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const highImpact = usdEvents.filter(e => e.impact === "high");
    const mediumImpact = usdEvents.filter(e => e.impact === "medium");

    // Format date in Vietnamese
    const dateObj = new Date(`${targetDate}T12:00:00+07:00`);
    const days = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    const pad = (n: number) => String(n).padStart(2, "0");
    const vnDate = `${days[dateObj.getDay()]}, ${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()}`;

    // ─── Generate AI Thumbnail ───
    let imageUrl: string | null = null;
    try {
      const imgPrompt = `Create a professional financial news thumbnail for US economic calendar alert.
Style: Modern financial dashboard aesthetic with dark blue/navy background.
Include visual elements: US flag icon, calendar icon, clock showing 3PM.
CRITICAL TEXT ACCURACY: The title text MUST be exactly "LỊCH KINH TẾ MỸ" - note the last word is "MỸ" with tilde accent on the Y, NOT "MÝ" with acute accent.
Show "${usdEvents.length} sự kiện" and "${highImpact.length} quan trọng" as key stats.
Date: "${vnDate}"
Make it look like a premium financial news graphic with subtle gold accents.
Aspect ratio 16:9, ultra high resolution.`;

      const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: imgPrompt }],
          modalities: ["image", "text"],
        }),
      });

      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const imgBase64 = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imgBase64 && imgBase64.startsWith("data:image/")) {
          const base64Match = imgBase64.match(/^data:image\/(\w+);base64,(.+)$/);
          if (base64Match) {
            const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
            const rawBase64 = base64Match[2];
            const bytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
            const fileName = `calendar/${targetDate}-daily-summary.${ext}`;

            const { error: uploadErr } = await supabase.storage
              .from("news-images")
              .upload(fileName, bytes, {
                contentType: `image/${base64Match[1]}`,
                upsert: true,
              });

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
        console.error("Image gen failed:", imgRes.status);
      }
    } catch (imgErr) {
      console.error("Image generation error:", imgErr);
    }

    // ─── Build caption (Markdown for Telegram) ───
    let caption = `📅 <b>LỊCH KINH TẾ MỸ — ${vnDate}</b>\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // High impact events
    if (highImpact.length > 0) {
      caption += `🔴 <b>Sự kiện quan trọng (3 sao):</b>\n`;
      for (const ev of highImpact) {
        const evTime = new Date(ev.event_time);
        const vnTime = new Date(evTime.getTime() + 7 * 3600 * 1000);
        const timeStr = `${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())}`;
        const forecast = ev.estimate ? ` | Dự báo: ${ev.estimate}` : "";
        const prev = ev.prev ? ` | Kỳ trước: ${ev.prev}` : "";
        caption += `🕐 <b>${timeStr}</b> — ${ev.event_name}${forecast}${prev}\n`;
      }
      caption += `\n`;
    }

    // Medium impact events
    if (mediumImpact.length > 0) {
      caption += `🟡 <b>Sự kiện đáng chú ý (2 sao):</b>\n`;
      for (const ev of mediumImpact) {
        const evTime = new Date(ev.event_time);
        const vnTime = new Date(evTime.getTime() + 7 * 3600 * 1000);
        const timeStr = `${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())}`;
        caption += `🕐 ${timeStr} — ${ev.event_name}\n`;
      }
      caption += `\n`;
    }

    caption += `💡 <i>Lưu ý: Các sự kiện có thể gây biến động mạnh trên thị trường. Hãy quản lý rủi ro cẩn thận!</i>\n\n`;
    caption += `📍 <a href="https://bright-build-beau.lovable.app/lich-kinh-te">Xem chi tiết → AlphaNet Calendar</a>`;

    // ─── Send to Telegram ───
    let res: Response;

    if (imageUrl) {
      res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          message_thread_id: CALENDAR_THREAD_ID,
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
          message_thread_id: CALENDAR_THREAD_ID,
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

    console.log("Daily summary sent to Telegram");

    return new Response(JSON.stringify({
      ok: true,
      sent: true,
      date: targetDate,
      eventCount: usdEvents.length,
      highImpactCount: highImpact.length,
      mediumImpactCount: mediumImpact.length,
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
