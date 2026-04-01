import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = "-1003722231058";

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const MAX_MSG_LENGTH = 3900;

const PROB_MAP: Record<string, string> = {
  high: "🟢 Cao",
  medium: "🟡 Trung bình",
  low: "🔴 Thấp",
};

const ASSET_EMOJI: Record<string, string> = {
  BTC: "₿",
  XAU: "🥇",
};

function formatSetupMessage(setups: any[], dateDisplay: string): string {
  let msg = `📊 <b>KỊCH BẢN GIAO DỊCH HÔM NAY</b>\n🗓️ ${dateDisplay}\n`;

  for (const setup of setups) {
    const emoji = ASSET_EMOJI[setup.asset] || "📈";
    msg += `\n${emoji} <b>${setup.asset}</b>\n`;
    msg += `🧠 <i>${setup.ai_summary}</i>\n\n`;

    for (const s of setup.scenarios) {
      const label = s.scenario === "A" ? "📈" : s.scenario === "B" ? "➡️" : "📉";
      msg += `${label} <b>${s.scenario}. ${s.title}</b>\n`;
      msg += `  Điều kiện: ${s.condition}\n`;
      msg += `  Hành động: ${s.action}\n`;
      if (s.targets?.length) {
        msg += `  Mục tiêu: ${s.targets.map((t: number) => `$${t.toLocaleString()}`).join(" → ")}\n`;
      }
      msg += `  Vô hiệu: ${s.invalidation}\n`;
      msg += `  Xác suất: ${PROB_MAP[s.probability] || s.probability}\n\n`;
    }
  }

  msg += `👉 <a href="https://alphanet.vn/phan-tich">Xem chi tiết → alphanet.vn/setups</a>`;

  // Truncate if too long
  if (msg.length > MAX_MSG_LENGTH) {
    msg = msg.substring(0, MAX_MSG_LENGTH - 30) + "\n\n⚠️ <i>Đã rút gọn...</i>";
  }

  return msg;
}

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

    // Fetch today's setups
    let { data: setups, error } = await supabase
      .from("daily_setups")
      .select("*")
      .eq("setup_date", dateStr)
      .in("asset", ["BTC", "XAU"])
      .order("asset");

    if (error) throw error;

    // If no setups, generate them first
    if (!setups || setups.length === 0) {
      console.log("No setups found, generating...");
      const genUrl = `${SUPABASE_URL}/functions/v1/generate-daily-setups`;
      const genRes = await fetch(genUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      });

      if (!genRes.ok) {
        const errText = await genRes.text();
        throw new Error(`Generate failed: ${errText}`);
      }

      // Re-fetch
      const refetch = await supabase
        .from("daily_setups")
        .select("*")
        .eq("setup_date", dateStr)
        .in("asset", ["BTC", "XAU"])
        .order("asset");

      setups = refetch.data;
      if (!setups || setups.length === 0) {
        throw new Error("Failed to generate setups");
      }
    }

    // Check if already sent
    const allSent = setups.every((s: any) => s.telegram_message_id);
    if (allSent && !force) {
      return new Response(JSON.stringify({ ok: true, status: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format and send
    const message = formatSetupMessage(setups, dateDisplay);

    const tgRes = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok) {
      throw new Error(`Telegram error: ${JSON.stringify(tgData)}`);
    }

    const messageId = tgData.result?.message_id;

    // Update all setups with message ID
    for (const setup of setups) {
      await supabase
        .from("daily_setups")
        .update({ telegram_message_id: messageId })
        .eq("id", setup.id);
    }

    return new Response(JSON.stringify({ ok: true, message_id: messageId, setups_count: setups.length }), {
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
