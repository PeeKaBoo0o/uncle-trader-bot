import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Fetch DXY CSV from Stooq
    const res = await fetch("https://stooq.com/q/d/l/?s=dxy&i=d", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      // Fallback static data
      return new Response(JSON.stringify({
        value: 104.25,
        change: -0.32,
        changePercent: -0.31,
        date: new Date().toISOString().split("T")[0],
        source: "fallback",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const csv = await res.text();
    const lines = csv.trim().split("\n").filter(l => l.trim());
    
    if (lines.length < 3) {
      console.warn("Stooq returned insufficient data, using fallback");
      return new Response(JSON.stringify({
        value: 104.25, change: -0.32, changePercent: -0.31,
        date: new Date().toISOString().split("T")[0], source: "fallback",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse last 2 rows: Date,Open,High,Low,Close
    const lastRow = lines[lines.length - 1].split(",");
    const prevRow = lines[lines.length - 2].split(",");

    const value = parseFloat(lastRow[4]);
    const prevValue = parseFloat(prevRow[4]);
    const change = value - prevValue;
    const changePercent = (change / prevValue) * 100;

    return new Response(JSON.stringify({
      value: Math.round(value * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      date: lastRow[0],
      high: parseFloat(lastRow[2]),
      low: parseFloat(lastRow[3]),
      source: "stooq",
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
