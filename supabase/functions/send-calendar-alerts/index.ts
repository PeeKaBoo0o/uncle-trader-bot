import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_CHAT_ID = "-1003722231058";
const CALENDAR_THREAD_ID = 329;

// Fixed alert video URL (stored in storage or external)
const ALERT_VIDEO_URL = "https://epcvcvpplnmmlaxrzcby.supabase.co/storage/v1/object/public/news-images/calendar/alert-video.mp4";

const IMPORTANCE_STARS: Record<string, string> = {
  high: "⭐⭐⭐",
  medium: "⭐⭐",
};

const IMPORTANCE_LABEL: Record<string, string> = {
  high: "3/3",
  medium: "2/3",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    // Window: events happening in 9-11 minutes from now
    const minTime = new Date(now.getTime() + 9 * 60 * 1000);
    const maxTime = new Date(now.getTime() + 11 * 60 * 1000);

    console.log(`Checking alerts: ${minTime.toISOString()} → ${maxTime.toISOString()}`);

    // Query: USD events, importance >= 2 (high or medium), not yet alerted
    const { data: events, error: fetchErr } = await supabase
      .from("economic_events")
      .select("*")
      .in("impact", ["high", "medium"])
      .eq("telegram_alerted", false)
      .gte("event_time", minTime.toISOString())
      .lte("event_time", maxTime.toISOString())
      .order("event_time", { ascending: true });

    if (fetchErr) throw new Error(`DB error: ${fetchErr.message}`);

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_upcoming_events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter USD only
    const usdEvents = events.filter(ev =>
      ev.flag === "🇺🇸" || ev.country === "Mỹ" || ev.country === "US"
    );

    if (usdEvents.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_usd_events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const ev of usdEvents) {
      const evTime = new Date(ev.event_time);
      const minutesUntil = Math.round((evTime.getTime() - now.getTime()) / 60000);

      // Format time in GMT+7
      const vnTime = new Date(evTime.getTime() + 7 * 3600 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const timeStr = `${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())}`;

      const stars = IMPORTANCE_STARS[ev.impact] || "⭐⭐";
      const impLabel = IMPORTANCE_LABEL[ev.impact] || "2/3";

      const forecast = ev.estimate || "—";
      const previous = ev.prev || "—";

      const caption = `🔔 <b>CẢNH BÁO SỰ KIỆN KINH TẾ</b>

🇺🇸 <b>${ev.event_name}</b>
${stars} Mức độ quan trọng: <b>${impLabel}</b>
⏰ Thời gian: <b>${timeStr}</b> (trong ~${minutesUntil} phút)
📊 Dự báo: <b>${forecast}</b> | Kỳ trước: <b>${previous}</b>

📍 <a href="https://bright-build-beau.lovable.app/lich-kinh-te">Xem chi tiết → AlphaNet Calendar</a>`;

      // Try sending as video first, fallback to text
      let res: Response;
      try {
        res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: CALENDAR_THREAD_ID,
            video: ALERT_VIDEO_URL,
            caption: caption.slice(0, 1024),
            parse_mode: "HTML",
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          console.warn("sendVideo failed, falling back to sendMessage:", result);
          // Fallback to text
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
          const fallbackResult = await res.json();
          if (!res.ok) {
            console.error("sendMessage also failed:", fallbackResult);
            continue;
          }
        }
      } catch (sendErr) {
        console.error("Send error for", ev.event_name, sendErr);
        continue;
      }

      // Mark as alerted
      await supabase
        .from("economic_events")
        .update({ telegram_alerted: true })
        .eq("id", ev.id);

      sentCount++;
      console.log(`Alert sent: ${ev.event_name} (in ~${minutesUntil}m)`);
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount, total_checked: usdEvents.length }), {
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
