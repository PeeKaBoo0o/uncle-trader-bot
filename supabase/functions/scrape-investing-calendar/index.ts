import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Country name → flag mapping
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

    // Determine date range from request body or default to this week
    let targetUrl = "https://vn.investing.com/economic-calendar/";
    try {
      const body = await req.json();
      if (body?.url) targetUrl = body.url;
    } catch { /* default */ }

    console.log("Scraping:", targetUrl);

    // Fetch the page HTML
    const pageRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch investing.com: ${pageRes.status}`);
    }

    const html = await pageRes.text();

    // Convert HTML to readable text (strip tags, keep table structure)
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
      .trim();

    // Take first 60000 chars for AI extraction
    const markdown = textContent.slice(0, 60000);

    console.log("Extracted text length:", markdown.length);

    // Use AI to extract events
    const systemPrompt = `You extract economic calendar events from scraped vn.investing.com content. Return ONLY a valid JSON array, no markdown fences, no explanation.

Each object must have: date, time, country, currency, importance, name, actual, forecast, previous.

IMPORTANCE CLASSIFICATION (the scraped markdown does NOT contain star icons, so you MUST classify based on event name):
importance=3 (HIGH - market-moving):
- Interest rate decisions (Lãi Suất, Fed Funds Rate, ECB Rate, BOJ Rate, BOE Rate, RBA Rate)
- Non-Farm Payrolls (NFP, Bảng Lương Phi Nông Nghiệp)
- CPI / Core CPI headline (Chỉ Số Giá Tiêu Dùng CPI YoY for major economies: US, EU, UK, JP, AU)
- GDP headline for major economies
- Unemployment Rate for major economies (US, EU, UK, JP, AU, CA)
- PMI Manufacturing/Services ISM
- Central bank speeches by heads (Fed Chair, ECB President, BOJ Governor, BOE Governor)
- FOMC Minutes, ECB Press Conference
- Retail Sales headline for US, EU
- Spring Forecast Statement / Budget

importance=2 (MEDIUM):
- PMI for individual countries (not ISM)
- CPI for smaller economies or sub-components (MoM, Core MoM)
- Trade Balance, Current Account for major economies
- Employment Change, Jobless Claims
- Industrial Production, Factory Orders
- Consumer Confidence, Business Confidence
- Housing data (Building Permits, Housing Starts)
- PPI (Producer Price Index)
- Central bank member speeches (not heads)
- Auction results for major bonds (10Y, 30Y)

importance=1 (LOW):
- Minor auction results (3M, 6M bills, Letras)
- Small country data
- Revised/final readings
- Money supply, credit data
- Vehicle sales, building consents for small economies
- Holidays

CRITICAL TIMEZONE RULES:
- Times and dates are in GMT+7 (Vietnam time). Extract exactly as shown.`;

    const userPrompt = `Extract ALL economic calendar events from this vn.investing.com content.
Rules:
- date: YYYY-MM-DD format (year 2026)
- time: HH:MM 24h format (GMT+7), or null
- country: Vietnamese name (Mỹ, Anh, Nhật Bản, Eurozone, Úc, etc.)
- currency: code (USD, EUR, GBP, JPY, CNY, AUD, CAD, CHF, NZD, etc.)
- importance: 1, 2, or 3 — classify by rules above
- name: Vietnamese event name exactly as shown
- actual, forecast, previous: string or null
CRITICAL: Only REAL economic events. EXCLUDE holidays, ads, navigation.
Content (first 60000 chars): ${markdown}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI extraction failed: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response length:", aiContent.length);

    // Parse JSON from AI response
    let events: any[];
    try {
      // Try direct parse first
      events = JSON.parse(aiContent);
    } catch {
      // Try extracting from code block
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        events = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try finding array in response
        const arrayMatch = aiContent.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          events = JSON.parse(arrayMatch[0]);
        } else {
          throw new Error("Could not parse AI response as JSON");
        }
      }
    }

    if (!Array.isArray(events)) {
      throw new Error("AI did not return an array");
    }

    console.log(`Extracted ${events.length} events from AI`);

    // Transform and upsert events
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const ev of events) {
      if (!ev.date || !ev.name || !ev.country) {
        skipped++;
        continue;
      }

      const eventTime = ev.time
        ? `${ev.date}T${ev.time}:00+07:00`
        : `${ev.date}T00:00:00+07:00`;

      const impact = IMPACT_MAP[ev.importance] || "medium";
      const flag = FLAG_MAP[ev.country] || "🌐";

      // Check if event already exists (same time + name + country)
      const { data: existing } = await supabase
        .from("economic_events")
        .select("id, actual, estimate, prev")
        .eq("event_name", ev.name)
        .eq("country", ev.country)
        .gte("event_time", `${ev.date}T00:00:00+07:00`)
        .lte("event_time", `${ev.date}T23:59:59+07:00`)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update actual/forecast/previous if changed
        const existingEv = existing[0];
        const needsUpdate =
          (ev.actual && ev.actual !== existingEv.actual) ||
          (ev.forecast && ev.forecast !== existingEv.estimate) ||
          (ev.previous && ev.previous !== existingEv.prev);

        if (needsUpdate) {
          await supabase
            .from("economic_events")
            .update({
              actual: ev.actual || existingEv.actual,
              estimate: ev.forecast || existingEv.estimate,
              prev: ev.previous || existingEv.prev,
            })
            .eq("id", existingEv.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Insert new event
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

    const result = {
      ok: true,
      total_extracted: events.length,
      inserted,
      updated,
      skipped,
    };

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
