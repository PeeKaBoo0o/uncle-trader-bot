import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Country → Flag mapping ───
const FLAG_MAP: Record<string, string> = {
  "Mỹ": "🇺🇸", "Anh": "🇬🇧", "Nhật Bản": "🇯🇵", "Eurozone": "🇪🇺",
  "Úc": "🇦🇺", "Canada": "🇨🇦", "Thụy Sĩ": "🇨🇭", "New Zealand": "🇳🇿",
  "Trung Quốc": "🇨🇳", "Đức": "🇩🇪", "Pháp": "🇫🇷", "Ý": "🇮🇹",
  "Tây Ban Nha": "🇪🇸", "Hàn Quốc": "🇰🇷", "Ấn Độ": "🇮🇳",
  "Brazil": "🇧🇷", "Mexico": "🇲🇽", "Singapore": "🇸🇬",
  "Hồng Kông": "🇭🇰", "Indonesia": "🇮🇩", "Thái Lan": "🇹🇭",
  "Malaysia": "🇲🇾", "Philippines": "🇵🇭", "Việt Nam": "🇻🇳",
  "Nam Phi": "🇿🇦", "Thổ Nhĩ Kỳ": "🇹🇷", "Nga": "🇷🇺",
  "Hà Lan": "🇳🇱", "Bỉ": "🇧🇪", "Áo": "🇦🇹", "Bồ Đào Nha": "🇵🇹",
  "Hy Lạp": "🇬🇷", "Ireland": "🇮🇪", "Phần Lan": "🇫🇮",
  "Na Uy": "🇳🇴", "Thụy Điển": "🇸🇪", "Đan Mạch": "🇩🇰",
  "Ba Lan": "🇵🇱", "Séc": "🇨🇿", "Hungary": "🇭🇺",
  "Romania": "🇷🇴", "Israel": "🇮🇱", "Ả Rập Saudi": "🇸🇦",
};

const IMPACT_MAP: Record<number, string> = { 1: "low", 2: "medium", 3: "high" };

// ─── IMPORTANCE OVERRIDES (hardcoded) ───
// Keywords in event name → forced importance
const OVERRIDE_DOWN_TO_1: string[] = [
  // JPY
  "Thất Nghiệp Nhật", "Bán Lẻ Nhật",
  // CNY
  "PBoC", "Lãi Suất Cho Vay Cơ Bản",
  // CAD
  "Bán Lẻ Canada", "Doanh Số Bán Lẻ Canada",
  // AUD
  "Thay Đổi Việc Làm Úc", "Employment Change Úc",
  // EUR minor
  "CPI Pháp",
  // USD minor
  "Goolsbee",
];

const OVERRIDE_TO_2: string[] = [
  "Chicago PMI",
  "Thất Nghiệp Đức", "Tỷ Lệ Thất Nghiệp Đức",
  "CPI Ý", "Italy CPI",
  "CPI Eurozone", "Eurozone CPI",
  "Core CPI Eurozone", "CPI Lõi Eurozone",
  "GDP Canada", "GDP MoM Canada",
  "Fed Barr", "Barr",
];

const OVERRIDE_UP_TO_3: string[] = [
  "PMI Sản Xuất", "PMI Dịch Vụ", "ISM PMI",
  "Jobless Claims", "Đơn Xin Trợ Cấp Thất Nghiệp",
  "Trump",
  "CB Consumer Confidence", "Niềm Tin Tiêu Dùng CB",
  "JOLTS", "Cơ Hội Việc Làm JOLTS",
];

function applyOverrides(name: string, country: string, aiImportance: number): number {
  const text = `${name} ${country}`.toLowerCase();

  for (const kw of OVERRIDE_UP_TO_3) {
    if (text.includes(kw.toLowerCase())) return 3;
  }
  for (const kw of OVERRIDE_TO_2) {
    if (text.includes(kw.toLowerCase())) return 2;
  }
  for (const kw of OVERRIDE_DOWN_TO_1) {
    if (text.includes(kw.toLowerCase())) return 1;
  }

  return aiImportance;
}

// ─── AI extraction with fallback chain ───
async function extractWithAI(
  markdown: string,
  apiKey: string,
  models: string[]
): Promise<any[] | null> {
  const systemPrompt = `You extract economic calendar events from scraped vn.investing.com content. Return ONLY a valid JSON array, no markdown fences, no explanation.

Each object must have: date, time, country, currency, importance, name, actual, forecast, previous.

IMPORTANCE CLASSIFICATION:
importance=3 (HIGH - market-moving):
- Interest rate decisions (Lãi Suất, Fed Funds Rate, ECB Rate, BOJ Rate, BOE Rate, RBA Rate)
- Non-Farm Payrolls (NFP, Bảng Lương Phi Nông Nghiệp)
- CPI / Core CPI headline (YoY for US, EU, UK, JP, AU)
- GDP headline for major economies
- Unemployment Rate (US, EU, UK, JP, AU, CA)
- PMI Manufacturing/Services ISM
- Central bank speeches by heads (Fed Chair, ECB President, BOJ Governor, BOE Governor)
- FOMC Minutes, ECB Press Conference
- Retail Sales headline for US, EU
- Spring Forecast Statement / Budget

importance=2 (MEDIUM):
- PMI for individual countries (not ISM)
- CPI for smaller economies or sub-components
- Trade Balance, Current Account
- Employment Change, Jobless Claims
- Industrial Production, Factory Orders
- Consumer Confidence, Business Confidence
- Housing data, PPI
- Central bank member speeches (not heads)
- Bond Auctions (10Y, 30Y)

importance=1 (LOW):
- Minor auctions (3M, 6M bills)
- Small country data, revised/final readings
- Money supply, credit data, holidays

CRITICAL: Times/dates are GMT+7. Extract exactly as shown.`;

  const userPrompt = `Extract ALL economic calendar events from this content.
Rules:
- date: YYYY-MM-DD (year 2026)
- time: HH:MM 24h (GMT+7), or null
- country: Vietnamese name
- currency: code (USD, EUR, GBP, JPY, CNY, AUD, CAD, CHF, NZD, etc.)
- importance: 1, 2, or 3
- name: Vietnamese event name exactly as shown
- actual, forecast, previous: string or null
EXCLUDE holidays, ads, navigation.
Content: ${markdown}`;

  for (const model of models) {
    console.log(`Trying model: ${model}`);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Model ${model} failed: ${res.status} - ${errText}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";

      // Parse JSON
      let events: any[];
      try {
        events = JSON.parse(content);
      } catch {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          events = JSON.parse(jsonMatch[1].trim());
        } else {
          const arrayMatch = content.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            events = JSON.parse(arrayMatch[0]);
          } else {
            console.error(`Model ${model}: could not parse JSON`);
            continue;
          }
        }
      }

      if (Array.isArray(events) && events.length > 0) {
        console.log(`Model ${model} extracted ${events.length} events`);
        return events;
      }
    } catch (e) {
      console.error(`Model ${model} error:`, e);
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let targetUrl = "https://vn.investing.com/economic-calendar/";
    try {
      const body = await req.json();
      if (body?.url) targetUrl = body.url;
    } catch { /* default */ }

    console.log("Scraping:", targetUrl);

    // Fetch page
    const pageRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
    });

    if (!pageRes.ok) throw new Error(`Fetch failed: ${pageRes.status}`);

    const html = await pageRes.text();
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/td>/gi, " | ")
      .replace(/<\/th>/gi, " | ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60000);

    console.log("Text length:", textContent.length);

    // AI extraction with fallback chain
    const MODELS = [
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      "openai/gpt-5-nano",
    ];

    const events = await extractWithAI(textContent, LOVABLE_API_KEY, MODELS);

    if (!events) {
      throw new Error("All AI models failed to extract events");
    }

    // Upsert events
    let inserted = 0, updated = 0, skipped = 0;

    for (const ev of events) {
      if (!ev.date || !ev.name || !ev.country) { skipped++; continue; }

      // Apply importance overrides
      const finalImportance = applyOverrides(ev.name, ev.country, ev.importance || 2);
      const impact = IMPACT_MAP[finalImportance] || "medium";

      const eventTime = ev.time
        ? `${ev.date}T${ev.time}:00+07:00`
        : `${ev.date}T00:00:00+07:00`;

      const flag = FLAG_MAP[ev.country] || "🌐";

      // Check existing
      const { data: existing } = await supabase
        .from("economic_events")
        .select("id, actual, estimate, prev, impact")
        .eq("event_name", ev.name)
        .eq("country", ev.country)
        .gte("event_time", `${ev.date}T00:00:00+07:00`)
        .lte("event_time", `${ev.date}T23:59:59+07:00`)
        .limit(1);

      if (existing && existing.length > 0) {
        const ex = existing[0];
        const needsUpdate =
          (ev.actual && ev.actual !== ex.actual) ||
          (ev.forecast && ev.forecast !== ex.estimate) ||
          (ev.previous && ev.previous !== ex.prev) ||
          (impact !== ex.impact);

        if (needsUpdate) {
          await supabase
            .from("economic_events")
            .update({
              actual: ev.actual || ex.actual,
              estimate: ev.forecast || ex.estimate,
              prev: ev.previous || ex.prev,
              impact,
            })
            .eq("id", ex.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const { error: insertErr } = await supabase
          .from("economic_events")
          .insert({
            event_time: eventTime,
            country: ev.country,
            flag,
            event_name: ev.name,
            impact,
            actual: ev.actual || null,
            estimate: ev.forecast || null,
            prev: ev.previous || null,
          });

        if (insertErr) {
          console.error("Insert error:", ev.name, insertErr.message);
          skipped++;
        } else {
          inserted++;
        }
      }
    }

    const result = { ok: true, total_extracted: events.length, inserted, updated, skipped };
    console.log("Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
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
