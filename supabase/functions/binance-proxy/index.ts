import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const symbols = url.searchParams.get("symbols"); // e.g. ["BTCUSDT","XAUUSDT"]
    const symbol = url.searchParams.get("symbol");   // single symbol

    let binanceUrl: string;
    if (symbols) {
      binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`;
    } else if (symbol) {
      binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
    } else {
      return new Response(JSON.stringify({ error: "Missing 'symbols' or 'symbol' param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(binanceUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Binance API error:", res.status, text);
      return new Response(JSON.stringify({ error: "Binance API error", status: res.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("binance-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
