import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache (15 min)
const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 15 * 60 * 1000;

function cached(key: string): any | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  cache[key] = { data, ts: Date.now() };
}

// ─── CoinGecko ───
async function fetchTrending() {
  const c = cached("trending");
  if (c) return c;
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending");
    if (!res.ok) return [];
    const data = await res.json();
    const coins = (data.coins || []).slice(0, 7).map((c: any) => ({
      id: c.item.id,
      name: c.item.name,
      symbol: c.item.symbol,
      thumb: c.item.thumb,
      price_btc: c.item.price_btc,
      market_cap_rank: c.item.market_cap_rank,
      score: c.item.score,
    }));
    setCache("trending", coins);
    return coins;
  } catch { return []; }
}

async function fetchGlobal() {
  const c = cached("global");
  if (c) return c;
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global");
    if (!res.ok) return null;
    const data = await res.json();
    const g = {
      btc_dominance: data.data?.market_cap_percentage?.btc || 0,
      total_market_cap: data.data?.total_market_cap?.usd || 0,
      total_volume: data.data?.total_volume?.usd || 0,
      market_cap_change_24h: data.data?.market_cap_change_percentage_24h_usd || 0,
    };
    setCache("global", g);
    return g;
  } catch { return null; }
}

// ─── Fear & Greed ───
async function fetchFearGreed() {
  const c = cached("fng");
  if (c) return c;
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!res.ok) return null;
    const data = await res.json();
    const fng = data.data?.[0] || null;
    if (fng) {
      const result = { value: parseInt(fng.value), classification: fng.value_classification, timestamp: fng.timestamp };
      setCache("fng", result);
      return result;
    }
    return null;
  } catch { return null; }
}

// ─── Finnhub Economic Calendar ───
async function fetchEconomicEvents() {
  const c = cached("econ_events");
  if (c) return c;
  const FINNHUB_KEY = Deno.env.get("FINNHUB_API_KEY");
  if (!FINNHUB_KEY) return [];
  try {
    const from = new Date().toISOString().split("T")[0];
    const to = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const res = await fetch(`https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${FINNHUB_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    const events = (data.economicCalendar || []).slice(0, 10).map((e: any) => ({
      country: e.country,
      event: e.event,
      time: e.time,
      impact: e.impact,
      actual: e.actual,
      estimate: e.estimate,
      prev: e.prev,
    }));
    setCache("econ_events", events);
    return events;
  } catch { return []; }
}

// ─── CoinMarketCal Events ───
async function fetchCryptoEvents() {
  const c = cached("crypto_events");
  if (c) return c;
  const CMC_KEY = Deno.env.get("COINMARKETCAL_API_KEY");
  if (!CMC_KEY) return [];
  try {
    const res = await fetch("https://developers.coinmarketcal.com/v1/events?max=10&sortBy=hot_events", {
      headers: { "x-api-key": CMC_KEY, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events = (data.body || []).map((e: any) => ({
      title: e.title?.en || e.title,
      coins: e.coins?.map((c: any) => c.symbol) || [],
      date: e.date_event,
      categories: e.categories?.map((c: any) => c.name) || [],
      source: e.source,
    }));
    setCache("crypto_events", events);
    return events;
  } catch { return []; }
}

// ─── Generate stream articles ───
function generateStreamArticles(stream: string, externalData: any): any[] {
  const { trending, global, fng, econEvents, cryptoEvents } = externalData;
  const now = new Date();
  const articles: any[] = [];

  if (stream === "hot" || stream === "all") {
    if (trending && trending.length > 0) {
      trending.slice(0, 3).forEach((coin: any, i: number) => {
        articles.push({
          id: `hot-trending-${coin.id}`,
          title: `${coin.name} (${coin.symbol.toUpperCase()}) đang trending — Top ${coin.score + 1} tìm kiếm`,
          source: "CoinGecko",
          published_at: new Date(now.getTime() - i * 1800000).toISOString(),
          summary: `• ${coin.name} đang nằm trong top trending trên CoinGecko\n• Market cap rank: #${coin.market_cap_rank || "N/A"}\n• Theo dõi biến động giá trong 24h tới`,
          stream: "hot",
          badge: "TRENDING",
          badge_color: "text-rose-400 bg-rose-400/10 border-rose-400/30",
        });
      });
    }
    if (global) {
      articles.push({
        id: "hot-global-mcap",
        title: `Tổng vốn hóa thị trường crypto: $${(global.total_market_cap / 1e12).toFixed(2)}T`,
        source: "CoinGecko",
        published_at: new Date(now.getTime() - 600000).toISOString(),
        summary: `• BTC Dominance: ${global.btc_dominance.toFixed(1)}%\n• Thay đổi 24h: ${global.market_cap_change_24h > 0 ? "+" : ""}${global.market_cap_change_24h.toFixed(2)}%\n• Volume 24h: $${(global.total_volume / 1e9).toFixed(1)}B`,
        stream: "hot",
        badge: "MARKET",
        badge_color: "text-rose-400 bg-rose-400/10 border-rose-400/30",
      });
    }
  }

  if (stream === "whale" || stream === "all") {
    articles.push({
      id: "whale-tvl-defi",
      title: "DeFi TVL update — Dòng tiền on-chain biến động",
      source: "DefiLlama",
      published_at: new Date(now.getTime() - 3600000).toISOString(),
      summary: "• TVL toàn thị trường DeFi đang biến động mạnh\n• Các protocol lending dẫn đầu dòng tiền\n• Theo dõi whale movements qua on-chain data",
      stream: "whale",
      badge: "WHALE",
      badge_color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
    });
  }

  if (stream === "macro" || stream === "all") {
    if (econEvents && econEvents.length > 0) {
      econEvents.slice(0, 3).forEach((ev: any, i: number) => {
        articles.push({
          id: `macro-econ-${i}`,
          title: `[${ev.country}] ${ev.event}`,
          source: "Finnhub",
          published_at: ev.time || new Date(now.getTime() - i * 7200000).toISOString(),
          summary: `• Sự kiện kinh tế: ${ev.event}\n• Dự báo: ${ev.estimate || "N/A"} | Trước đó: ${ev.prev || "N/A"}\n• Impact: ${ev.impact || "Medium"}`,
          stream: "macro",
          badge: ev.country,
          badge_color: "text-violet-400 bg-violet-400/10 border-violet-400/30",
        });
      });
    }
  }

  if (stream === "event" || stream === "all") {
    if (cryptoEvents && cryptoEvents.length > 0) {
      cryptoEvents.slice(0, 4).forEach((ev: any, i: number) => {
        articles.push({
          id: `event-cmc-${i}`,
          title: ev.title,
          source: "CoinMarketCal",
          published_at: ev.date || new Date(now.getTime() - i * 3600000).toISOString(),
          summary: `• Coins: ${ev.coins?.join(", ") || "Multiple"}\n• Categories: ${ev.categories?.join(", ") || "Event"}\n• Theo dõi tác động giá trước và sau sự kiện`,
          stream: "event",
          badge: "EVENT",
          badge_color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
        });
      });
    }
  }

  if (stream === "sentiment" || stream === "all") {
    if (fng) {
      articles.push({
        id: "sentiment-fng",
        title: `Fear & Greed Index: ${fng.value} — ${fng.classification}`,
        source: "Alternative.me",
        published_at: now.toISOString(),
        summary: `• Chỉ số hiện tại: ${fng.value}/100\n• Phân loại: ${fng.classification}\n• ${fng.value > 60 ? "Thị trường đang tham lam — cẩn thận với correction" : fng.value < 40 ? "Thị trường sợ hãi — có thể là cơ hội mua" : "Thị trường trung tính — chờ tín hiệu rõ ràng"}`,
        stream: "sentiment",
        badge: fng.value > 60 ? "GREED" : fng.value < 40 ? "FEAR" : "NEUTRAL",
        badge_color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
      });
    }
    if (global) {
      articles.push({
        id: "sentiment-market-mood",
        title: `Tâm lý thị trường: ${global.market_cap_change_24h > 0 ? "Tích cực" : "Tiêu cực"} — MCap ${global.market_cap_change_24h > 0 ? "+" : ""}${global.market_cap_change_24h.toFixed(2)}%`,
        source: "CoinGecko",
        published_at: new Date(now.getTime() - 1800000).toISOString(),
        summary: `• BTC Dominance: ${global.btc_dominance.toFixed(1)}%\n• Volume 24h: $${(global.total_volume / 1e9).toFixed(1)}B\n• ${global.market_cap_change_24h > 2 ? "Momentum tăng mạnh" : global.market_cap_change_24h < -2 ? "Áp lực bán tăng" : "Thị trường sideway"}`,
        stream: "sentiment",
        badge: "MOOD",
        badge_color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
      });
    }
  }

  return articles;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const stream = url.searchParams.get("stream") || "hot";
    const articleId = url.searchParams.get("id");

    // If requesting a specific article, check DB first
    if (articleId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .eq("id", articleId)
        .maybeSingle();

      if (data) {
        return new Response(JSON.stringify({ article: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch from DB first
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const query = supabase
      .from("news_articles")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(20);

    if (stream !== "all") {
      query.eq("stream", stream);
    }

    const { data: dbArticles } = await query;

    // Fetch external data in parallel
    const [trending, global, fng, econEvents, cryptoEvents] = await Promise.all([
      fetchTrending(),
      fetchGlobal(),
      fetchFearGreed(),
      fetchEconomicEvents(),
      fetchCryptoEvents(),
    ]);

    const liveArticles = generateStreamArticles(stream, { trending, global, fng, econEvents, cryptoEvents });

    // Merge DB + live articles
    const allArticles = [...(dbArticles || []), ...liveArticles]
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, 20);

    return new Response(JSON.stringify({
      articles: allArticles,
      market: { trending, global, fng },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("News aggregator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
