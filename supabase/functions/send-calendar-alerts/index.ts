import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_CHAT_ID = "-1003722231058";
const CALENDAR_THREAD_ID = 329;
const SITE_URL = "https://bright-build-beau.lovable.app";

const ALERT_VIDEO_URL =
  "https://epcvcvpplnmmlaxrzcby.supabase.co/storage/v1/object/public/news-images/calendar/alert-video.mp4";

const IMPORTANCE_STARS: Record<string, string> = {
  high: "⭐⭐⭐",
  medium: "⭐⭐",
  low: "⭐",
};

const IMPORTANCE_LABEL: Record<string, string> = {
  high: "3/3",
  medium: "2/3",
  low: "1/3",
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

    // Check for test mode
    let isTest = false;
    try {
      const body = await req.json();
      isTest = body?.test_send === true;
    } catch { /* no body */ }

    let events: any[] = [];

    if (isTest) {
      // Send a sample test alert
      events = [{
        id: "test",
        event_name: "Bảng Lương Phi Nông Nghiệp (NFP) (Tháng 3)",
        event_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        impact: "high",
        flag: "🇺🇸",
        estimate: "140K",
        prev: "151K",
      }];
    } else {
      const now = new Date();
      const minTime = new Date(now.getTime() + 9 * 60 * 1000);
      const maxTime = new Date(now.getTime() + 11 * 60 * 1000);

      console.log(`Checking alerts: ${minTime.toISOString()} → ${maxTime.toISOString()}`);

      const { data, error: fetchErr } = await supabase
        .from("economic_events")
        .select("*")
        .eq("impact", "high")
        .eq("telegram_alerted", false)
        .gte("event_time", minTime.toISOString())
        .lte("event_time", maxTime.toISOString())
        .order("event_time", { ascending: true });

      if (fetchErr) throw new Error(`DB error: ${fetchErr.message}`);
      events = data || [];
    }

    if (events.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_upcoming_events" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    let sentCount = 0;

    for (const ev of events) {
      const evTime = new Date(ev.event_time);
      const minutesUntil = Math.round(
        (evTime.getTime() - now.getTime()) / 60000
      );

      // Format time in GMT+7
      const vnTime = new Date(evTime.getTime() + 7 * 3600 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const timeStr = `${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())}`;

      const stars = IMPORTANCE_STARS[ev.impact] || "⭐⭐⭐";
      const impLabel = IMPORTANCE_LABEL[ev.impact] || "3/3";
      const flag = ev.flag || "🌐";

      const forecast = ev.estimate || "—";
      const previous = ev.prev || "—";

      // ─── Caption matching reference design ───
      const caption = `⚠️ <b>CẢNH BÁO SỰ KIỆN KINH TẾ</b>

${flag} <b>${ev.event_name}</b>
${stars}  Mức độ quan trọng: <b>${impLabel}</b>
🕐 Thời gian: <b>${timeStr}</b> (trong ~${minutesUntil} phút)

📊 <b>Dự báo:</b>
• Dự kiến: <b>${forecast}</b>
• Kỳ trước: <b>${previous}</b>`;

      // Inline keyboard: "Xem chi tiết" button
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: "👁 Xem chi tiết",
              url: `${SITE_URL}/lich-kinh-te`,
            },
          ],
        ],
      };

      // Try sending as video first, fallback to text
      let sendOk = false;
      try {
        const videoRes = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              message_thread_id: CALENDAR_THREAD_ID,
              video: ALERT_VIDEO_URL,
              caption: caption.slice(0, 1024),
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }),
          }
        );

        const videoResult = await videoRes.json();
        if (videoRes.ok) {
          sendOk = true;
        } else {
          console.warn("sendVideo failed, trying sendAnimation:", videoResult);

          // Try as animation (GIF-like)
          const animRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendAnimation`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                message_thread_id: CALENDAR_THREAD_ID,
                animation: ALERT_VIDEO_URL,
                caption: caption.slice(0, 1024),
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              }),
            }
          );

          const animResult = await animRes.json();
          if (animRes.ok) {
            sendOk = true;
          } else {
            console.warn("sendAnimation failed, fallback to text:", animResult);
          }
        }
      } catch (e) {
        console.error("Video/animation send error:", e);
      }

      // Fallback: text message
      if (!sendOk) {
        try {
          const textRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                message_thread_id: CALENDAR_THREAD_ID,
                text: caption,
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              }),
            }
          );

          const textResult = await textRes.json();
          if (!textRes.ok) {
            console.error("sendMessage also failed:", textResult);
            continue;
          }
        } catch (e) {
          console.error("Text send error:", e);
          continue;
        }
      }

      // Mark as alerted (skip for test)
      if (!isTest) {
        await supabase
          .from("economic_events")
          .update({ telegram_alerted: true })
          .eq("id", ev.id);
      }

      sentCount++;
      console.log(`Alert sent: ${ev.event_name} (in ~${minutesUntil}m)`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: sentCount,
        total_checked: events.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
