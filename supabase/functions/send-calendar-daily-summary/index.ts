import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_CHAT_ID = "-1003722231058";
const CALENDAR_THREAD_ID = 329; // same thread as news, adjust if needed

// Country flag for summary
const COUNTRY_CONFIG: Record<string, { flag: string; label: string }> = {
  "Mỹ": { flag: "🇺🇸", label: "MỸ" },
  "Anh": { flag: "🇬🇧", label: "ANH" },
  "Eurozone": { flag: "🇪🇺", label: "EUROZONE" },
  "Nhật Bản": { flag: "🇯🇵", label: "NHẬT BẢN" },
  "Úc": { flag: "🇦🇺", label: "ÚC" },
  "Canada": { flag: "🇨🇦", label: "CANADA" },
  "Trung Quốc": { flag: "🇨🇳", label: "TRUNG QUỐC" },
  "Thụy Sĩ": { flag: "🇨🇭", label: "THỤY SĨ" },
  "New Zealand": { flag: "🇳🇿", label: "NEW ZEALAND" },
};

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

    // Determine target date (default: today in GMT+7)
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

    console.log("Generating calendar summary for:", targetDate);

    // Fetch events for the target date
    const dayStart = `${targetDate}T00:00:00+07:00`;
    const dayEnd = `${targetDate}T23:59:59+07:00`;

    const { data: events, error: fetchErr } = await supabase
      .from("economic_events")
      .select("*")
      .gte("event_time", dayStart)
      .lte("event_time", dayEnd)
      .order("event_time", { ascending: true });

    if (fetchErr) throw new Error(`DB error: ${fetchErr.message}`);
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: false, reason: "no_events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const highImpact = events.filter(e => e.impact === "high");
    const mediumImpact = events.filter(e => e.impact === "medium");

    // Group by country for summary
    const byCountry: Record<string, typeof events> = {};
    for (const ev of events) {
      if (!byCountry[ev.country]) byCountry[ev.country] = [];
      byCountry[ev.country].push(ev);
    }

    // Determine primary country (most high-impact events)
    const countryHighCounts = Object.entries(byCountry)
      .map(([c, evts]) => ({ country: c, high: evts.filter(e => e.impact === "high").length, total: evts.length }))
      .sort((a, b) => b.high - a.high || b.total - a.total);

    const primaryCountry = countryHighCounts[0]?.country || "Mỹ";
    const config = COUNTRY_CONFIG[primaryCountry] || { flag: "🌐", label: "QUỐC TẾ" };

    // Format date in Vietnamese
    const dateObj = new Date(`${targetDate}T12:00:00+07:00`);
    const days = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    const pad = (n: number) => String(n).padStart(2, "0");
    const vnDate = `${days[dateObj.getDay()]}, ${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()}`;

    // Generate thumbnail image via AI
    let imageUrl: string | null = null;
    try {
      const imgPrompt = `Create a professional financial news thumbnail for economic calendar alert.
Style: Modern financial dashboard aesthetic with dark blue/navy background.
Include visual elements: ${config.flag} flag icon, calendar icon, clock icon.
CRITICAL TEXT ACCURACY: The title text MUST be exactly "LỊCH KINH TẾ ${config.label}" - ensure Vietnamese diacritics are correct.
Show "${events.length} sự kiện" and "${highImpact.length} quan trọng" as key stats.
Date shown: "${vnDate}"
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
          // Extract base64 data and upload to storage
          const base64Match = imgBase64.match(/^data:image\/(\w+);base64,(.+)$/);
          if (base64Match) {
            const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
            const rawBase64 = base64Match[2];
            const bytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
            const fileName = `calendar/${targetDate}-${primaryCountry}.${ext}`;

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

    // Build Telegram message
    const impactEmoji: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };

    let caption = `📅 <b>LỊCH KINH TẾ — ${vnDate}</b>\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    caption += `📊 Tổng: <b>${events.length}</b> sự kiện | 🔴 Quan trọng: <b>${highImpact.length}</b> | 🟡 TB: <b>${mediumImpact.length}</b>\n\n`;

    // Show high impact events detail
    if (highImpact.length > 0) {
      caption += `🔴 <b>SỰ KIỆN QUAN TRỌNG:</b>\n`;
      for (const ev of highImpact) {
        const evTime = new Date(ev.event_time);
        const vnTime = new Date(evTime.getTime() + 7 * 3600 * 1000);
        const timeStr = `${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())}`;
        const actualStr = ev.actual ? ` → <b>${ev.actual}</b>` : "";
        const forecastStr = ev.estimate ? ` (dự kiến: ${ev.estimate})` : "";
        caption += `⏰ ${timeStr} | ${ev.flag} ${ev.event_name}${forecastStr}${actualStr}\n`;
      }
      caption += `\n`;
    }

    // Show medium impact summary by country
    if (mediumImpact.length > 0) {
      caption += `🟡 <b>SỰ KIỆN TRUNG BÌNH:</b>\n`;
      for (const ev of mediumImpact.slice(0, 8)) {
        const evTime = new Date(ev.event_time);
        const vnTime = new Date(evTime.getTime() + 7 * 3600 * 1000);
        const timeStr = `${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())}`;
        caption += `⏰ ${timeStr} | ${ev.flag} ${ev.event_name}\n`;
      }
      if (mediumImpact.length > 8) {
        caption += `   ... và ${mediumImpact.length - 8} sự kiện khác\n`;
      }
      caption += `\n`;
    }

    caption += `🔗 <a href="https://bright-build-beau.lovable.app/lich-kinh-te">Xem chi tiết đầy đủ</a>`;

    // Send to Telegram
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

    console.log("Calendar summary sent to Telegram");

    return new Response(JSON.stringify({
      ok: true,
      sent: true,
      date: targetDate,
      eventCount: events.length,
      highImpactCount: highImpact.length,
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
