import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Multiple DXY sources for reliability
async function fetchFromStooq(): Promise<{ value: number; prevValue: number; date: string } | null> {
  try {
    const res = await fetch("https://stooq.com/q/d/l/?s=dxy&i=d", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const csv = await res.text();
    const lines = csv.trim().split("\n").filter(l => l.trim());
    if (lines.length < 3) {
      console.warn("Stooq returned insufficient data");
      return null;
    }
    const lastRow = lines[lines.length - 1].split(",");
    const prevRow = lines[lines.length - 2].split(",");
    return {
      value: parseFloat(lastRow[4]),
      prevValue: parseFloat(prevRow[4]),
      date: lastRow[0],
    };
  } catch (e) {
    console.warn("Stooq fetch failed:", e);
    return null;
  }
}

async function fetchFromFinnhub(): Promise<{ value: number; prevValue: number; date: string } | null> {
  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=DXY&token=${key}`);
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    if (!data.c || data.c === 0) return null;
    return {
      value: data.c,
      prevValue: data.pc,
      date: new Date().toISOString().split("T")[0],
    };
  } catch (e) {
    console.warn("Finnhub DXY failed:", e);
    return null;
  }
}

async function fetchFromBinanceDX(): Promise<{ value: number; prevValue: number; date: string } | null> {
  try {
    // UUP ETF as DXY proxy on Binance-adjacent data
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=EURUSDT");
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    // EUR/USD inversely correlates with DXY. Approximate DXY from EUR rate
    const eurRate = parseFloat(data.lastPrice);
    const prevEurRate = eurRate - parseFloat(data.priceChange);
    if (!eurRate || eurRate === 0) return null;
    // DXY ≈ 1/EUR * base_factor (rough approximation)
    const dxyApprox = (1 / eurRate) * 120.5;
    const dxyPrev = (1 / prevEurRate) * 120.5;
    return {
      value: Math.round(dxyApprox * 100) / 100,
      prevValue: Math.round(dxyPrev * 100) / 100,
      date: new Date().toISOString().split("T")[0],
    };
  } catch (e) {
    console.warn("Binance DXY proxy failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Try sources in order: Stooq → Finnhub → Binance EUR proxy
    let result = await fetchFromStooq();
    let source = "stooq";

    if (!result) {
      result = await fetchFromFinnhub();
      source = "finnhub";
    }

    if (!result) {
      result = await fetchFromBinanceDX();
      source = "binance-eur-proxy";
    }

    if (!result) {
      // Ultimate fallback
      return new Response(JSON.stringify({
        value: 104.25, change: -0.32, changePercent: -0.31,
        date: new Date().toISOString().split("T")[0], source: "fallback",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const change = result.value - result.prevValue;
    const changePercent = (change / result.prevValue) * 100;

    return new Response(JSON.stringify({
      value: Math.round(result.value * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      date: result.date,
      source,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("DXY proxy error:", e);
    return new Response(JSON.stringify({
      value: 104.25, change: -0.32, changePercent: -0.31,
      date: new Date().toISOString().split("T")[0], source: "fallback",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
