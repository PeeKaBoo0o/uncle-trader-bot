import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STREAMS = ["hot", "whale", "macro", "event", "sentiment"];

const STREAM_KEYWORDS: Record<string, string[]> = {
  hot: ["Bitcoin", "BTC", "ETH", "Ethereum", "price", "rally", "surge", "drop", "pump"],
  whale: ["whale", "transfer", "DeFi", "TVL", "liquidity", "on-chain", "wallet", "exchange"],
  macro: ["regulation", "SEC", "Fed", "government", "law", "ban", "policy", "inflation", "interest rate"],
  event: ["launch", "mainnet", "upgrade", "airdrop", "halving", "token", "listing", "partnership"],
  sentiment: ["fear", "greed", "sentiment", "analysis", "prediction", "outlook", "market", "bull", "bear"],
};

const STREAM_BADGES: Record<string, { badge: string; badge_color: string }> = {
  hot: { badge: "TIN NÓNG", badge_color: "text-rose-400 bg-rose-400/10 border-rose-400/30" },
  whale: { badge: "CÁ VOI", badge_color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30" },
  macro: { badge: "VĨ MÔ", badge_color: "text-violet-400 bg-violet-400/10 border-violet-400/30" },
  event: { badge: "SỰ KIỆN", badge_color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  sentiment: { badge: "TÂM LÝ", badge_color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
};

// ─── Fetch news from CryptoCompare (free, no API key needed) ───
async function fetchCryptoCompareNews(): Promise<any[]> {
  try {
    const res = await fetch("https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular");
    if (!res.ok) return [];
    const data = await res.json();
    const articles = data.Data || data.data || [];
    return Array.isArray(articles) ? articles : [];
  } catch (e) {
    console.error("CryptoCompare fetch error:", e);
    return [];
  }
}

// ─── Fetch news from CoinGecko status updates ───
async function fetchCoinGeckoTrending(): Promise<any[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.coins || []).slice(0, 5);
  } catch { return []; }
}

// ─── Fetch RSS feed and parse ───
async function fetchRSS(url: string): Promise<any[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const xml = await res.text();
    
    const items: any[] = [];
    const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    
    for (const itemXml of itemMatches.slice(0, 10)) {
      const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";
      const desc = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || "";
      const link = itemXml.match(/<link[^>]*>(.*?)<\/link>/i)?.[1]?.trim() || "";
      const pubDate = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i)?.[1]?.trim() || "";
      const imgMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"/i) 
        || itemXml.match(/<enclosure[^>]*url="([^"]+)"/i)
        || itemXml.match(/<img[^>]*src="([^"]+)"/i);
      
      if (title) {
        items.push({
          title: title.replace(/<[^>]*>/g, ""),
          description: desc.replace(/<[^>]*>/g, "").slice(0, 500),
          link,
          pubDate,
          imageUrl: imgMatch?.[1] || null,
          source: "RSS",
        });
      }
    }
    return items;
  } catch (e) {
    console.error("RSS fetch error:", url, e);
    return [];
  }
}

// ─── Classify article into stream ───
function classifyToStream(title: string, body: string): string {
  const text = `${title} ${body}`.toLowerCase();
  let bestStream = "hot";
  let bestScore = 0;
  
  for (const [stream, keywords] of Object.entries(STREAM_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStream = stream;
    }
  }
  return bestStream;
}

// ─── AI Rewrite in Vietnamese ───
async function aiRewrite(title: string, body: string, stream: string): Promise<{ title: string; summary: string; full_content: string } | null> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_KEY) {
    console.error("LOVABLE_API_KEY not set");
    return null;
  }

  const streamLabel: Record<string, string> = {
    hot: "Tin Nóng Crypto",
    whale: "Phân tích Cá Voi & On-chain",
    macro: "Tin Vĩ Mô & Chính Sách",
    event: "Sự Kiện Crypto",
    sentiment: "Phân tích Tâm Lý Thị Trường",
  };

  const prompt = `Bạn là biên tập viên tin tức crypto chuyên nghiệp, viết bằng tiếng Việt cho website Uncle Trader.

Viết lại bài báo sau thành bài viết MỚI HOÀN TOÀN bằng tiếng Việt. TUYỆT ĐỐI không dịch nguyên văn, phải VIẾT LẠI với góc nhìn mới.

Chủ đề: ${streamLabel[stream] || "Tin Crypto"}

Tiêu đề gốc: ${title}
Nội dung gốc: ${body}

Yêu cầu:
1. Viết tiêu đề HẤP DẪN bằng tiếng Việt (không dài quá 80 ký tự)
2. Viết 3 bullet points TÓM TẮT (mỗi dòng bắt đầu bằng "• ")
3. Viết BÀI VIẾT ĐẦY ĐỦ 300-500 từ bằng tiếng Việt với:
   - Phân tích chuyên sâu
   - Đề cập đến tác động lên thị trường
   - Lời khuyên cho trader
   - Sử dụng markdown: ## cho heading, **bold** cho keyword quan trọng

Trả về theo format JSON:
{
  "title": "tiêu đề tiếng Việt",
  "summary": "• bullet 1\\n• bullet 2\\n• bullet 3",
  "full_content": "nội dung đầy đủ với markdown"
}

CHỈ trả về JSON, không giải thích thêm.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      console.error("AI rewrite failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    let rawJson = jsonMatch[1]!.trim();
    
    // Try to parse, with fallback extraction
    try {
      const parsed = JSON.parse(rawJson);
      return {
        title: parsed.title || title,
        summary: parsed.summary || "",
        full_content: parsed.full_content || "",
      };
    } catch {
      // Fallback: extract fields with regex
      const titleMatch = rawJson.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const summaryMatch = rawJson.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const fullContentStart = rawJson.indexOf('"full_content"');
      let fullContent = "";
      if (fullContentStart > -1) {
        const afterColon = rawJson.indexOf('"', fullContentStart + 15);
        if (afterColon > -1) {
          // Find the last closing quote before }
          const remaining = rawJson.slice(afterColon + 1);
          const endQuote = remaining.lastIndexOf('"');
          if (endQuote > -1) fullContent = remaining.slice(0, endQuote).replace(/\\n/g, "\n").replace(/\\"/g, '"');
        }
      }
      
      return {
        title: titleMatch?.[1]?.replace(/\\"/g, '"') || title,
        summary: summaryMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"') || "",
        full_content: fullContent || "",
      };
    }
  } catch (e) {
    console.error("AI rewrite error:", e);
    return null;
  }
}

// ─── AI Generate Image ───
async function aiGenerateImage(title: string, stream: string): Promise<string | null> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_KEY) return null;

  const styleMap: Record<string, string> = {
    hot: "dynamic crypto trading chart with red and green candles, digital futuristic style, dark background",
    whale: "giant whale silhouette in deep ocean with blockchain network nodes, dark blue tones",
    macro: "modern government building with digital currency symbols, professional news photo style",
    event: "futuristic cryptocurrency event stage with spotlights and blockchain visuals",
    sentiment: "abstract emotion visualization with bull and bear, data streams, dark moody lighting",
  };

  const prompt = `Professional crypto news illustration for article: "${title}". Style: ${styleMap[stream] || styleMap.hot}. High quality, editorial, no text, no watermarks, 16:9 aspect ratio, on a clean background`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      console.error("Image gen failed:", res.status);
      return null;
    }

    const data = await res.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) return null;

    // Upload to Supabase storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Decode base64 and upload
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `news/${Date.now()}-${stream}.png`;
    const { data: uploadData, error } = await supabase.storage
      .from("news-images")
      .upload(fileName, bytes, { contentType: "image/png", upsert: true });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage.from("news-images").getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Image gen error:", e);
    return null;
  }
}

// ─── Get free stock image from Unsplash ───
function getUnsplashImage(stream: string, index: number): string {
  const queries: Record<string, string[]> = {
    hot: ["cryptocurrency-trading", "bitcoin-chart", "crypto-market", "digital-currency", "blockchain"],
    whale: ["ocean-whale", "deep-sea", "blockchain-network", "data-center", "financial-technology"],
    macro: ["government-building", "federal-reserve", "economics", "global-finance", "stock-market"],
    event: ["technology-conference", "crypto-event", "innovation", "startup", "blockchain-summit"],
    sentiment: ["stock-chart", "market-analysis", "data-visualization", "trading-floor", "financial-graph"],
  };
  
  const q = queries[stream] || queries.hot;
  const query = q[index % q.length];
  return `https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=450&fit=crop&q=80`;
}

// ─── Search web image via Unsplash source ───
async function searchFreeImage(query: string): Promise<string> {
  // Use curated Unsplash images based on keywords
  const cryptoImages = [
    "photo-1639762681485-074b7f938ba0",
    "photo-1518546305927-5a555bb7020d",
    "photo-1622630998477-20aa696ecb05",
    "photo-1605792657660-596af9009e82",
    "photo-1642104704074-907c0698cbd9",
    "photo-1611974789855-9c2a0a7236a3",
    "photo-1535320903710-d993d3d77d29",
    "photo-1526304640581-d334cdbbf45e",
    "photo-1504384308090-c894fdcc538d",
    "photo-1611605698335-8b1569810432",
    "photo-1642790106117-e829e14a795f",
    "photo-1559526324-593bc073d938",
    "photo-1486406146926-c627a92ad1ab",
    "photo-1540575467063-178a50e2fd60",
    "photo-1590283603385-17ffb3a7f29f",
  ];
  
  const hash = query.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const idx = Math.abs(hash) % cryptoImages.length;
  return `https://images.unsplash.com/${cryptoImages[idx]}?w=800&h=450&fit=crop&auto=format`;
}

// ─── Count AI images generated today ───
async function countTodayAiImages(supabase: any): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  
  const { count } = await supabase
    .from("news_articles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString())
    .not("image_url", "is", null)
    .like("image_url", "%news-images%");
  
  return count || 0;
}

// ─── MAIN ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 Starting news auto-fetch cycle...");

    // 1. Fetch raw news from multiple sources in parallel
    const [ccNews, trendingCoins, coinDeskRss, decryptRss, cointelegraphRss] = await Promise.all([
      fetchCryptoCompareNews(),
      fetchCoinGeckoTrending(),
      fetchRSS("https://www.coindesk.com/arc/outboundfeeds/rss/"),
      fetchRSS("https://decrypt.co/feed"),
      fetchRSS("https://cointelegraph.com/rss"),
    ]);

    console.log(`📰 Fetched: CC=${ccNews.length}, CoinDesk=${coinDeskRss.length}, Decrypt=${decryptRss.length}, CT=${cointelegraphRss.length}`);

    // 2. Normalize all articles
    const allRawArticles: Array<{title: string; body: string; imageUrl: string | null; source: string}> = [];

    for (const a of ccNews.slice(0, 15)) {
      allRawArticles.push({
        title: a.title || "",
        body: a.body?.slice(0, 1000) || a.title || "",
        imageUrl: a.imageurl || null,
        source: a.source_info?.name || "CryptoCompare",
      });
    }

    for (const a of coinDeskRss) {
      allRawArticles.push({ title: a.title, body: a.description, imageUrl: a.imageUrl, source: "CoinDesk" });
    }
    for (const a of decryptRss) {
      allRawArticles.push({ title: a.title, body: a.description, imageUrl: a.imageUrl, source: "Decrypt" });
    }
    for (const a of cointelegraphRss) {
      allRawArticles.push({ title: a.title, body: a.description, imageUrl: a.imageUrl, source: "CoinTelegraph" });
    }

    // 3. Classify and pick 1 article per stream
    const streamPicks: Record<string, typeof allRawArticles[0]> = {};
    const usedIndices = new Set<number>();

    for (const stream of STREAMS) {
      let bestIdx = -1;
      let bestScore = -1;

      for (let i = 0; i < allRawArticles.length; i++) {
        if (usedIndices.has(i)) continue;
        const a = allRawArticles[i];
        const text = `${a.title} ${a.body}`.toLowerCase();
        let score = 0;
        for (const kw of STREAM_KEYWORDS[stream]) {
          if (text.includes(kw.toLowerCase())) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        streamPicks[stream] = allRawArticles[bestIdx];
        usedIndices.add(bestIdx);
      }
    }

    // Fill any empty streams with remaining articles
    for (const stream of STREAMS) {
      if (!streamPicks[stream]) {
        for (let i = 0; i < allRawArticles.length; i++) {
          if (!usedIndices.has(i)) {
            streamPicks[stream] = allRawArticles[i];
            usedIndices.add(i);
            break;
          }
        }
      }
    }

    console.log(`🎯 Picked articles for streams: ${Object.keys(streamPicks).join(", ")}`);

    // 4. Check how many AI images we've generated today
    const aiImagesCount = await countTodayAiImages(supabase);
    const canGenerateImage = aiImagesCount < 6;
    let imageGenerated = false;

    console.log(`🖼️ AI images today: ${aiImagesCount}/6, can generate: ${canGenerateImage}`);

    // 5. Process each stream article: AI rewrite + image
    const insertArticles: any[] = [];

    for (const stream of STREAMS) {
      const raw = streamPicks[stream];
      if (!raw) continue;

      console.log(`📝 Processing ${stream}: "${raw.title.slice(0, 50)}..."`);

      // AI rewrite
      const rewritten = await aiRewrite(raw.title, raw.body, stream);
      
      if (!rewritten) {
        console.error(`❌ AI rewrite failed for ${stream}, skipping`);
        continue;
      }

      // Image: generate AI for first eligible article, rest use original or Unsplash
      let imageUrl: string | null = null;

      if (canGenerateImage && !imageGenerated) {
        console.log(`🎨 Generating AI image for ${stream}...`);
        imageUrl = await aiGenerateImage(rewritten.title, stream);
        if (imageUrl) {
          imageGenerated = true;
          console.log(`✅ AI image generated for ${stream}`);
        }
      }

      if (!imageUrl) {
        // Use original image from source or Unsplash fallback
        imageUrl = raw.imageUrl || await searchFreeImage(rewritten.title);
      }

      const badgeInfo = STREAM_BADGES[stream];

      insertArticles.push({
        title: rewritten.title,
        summary: rewritten.summary,
        full_content: rewritten.full_content,
        image_url: imageUrl,
        stream,
        source: `Uncle Trader · ${raw.source}`,
        badge: badgeInfo.badge,
        badge_color: badgeInfo.badge_color,
        is_published: true,
        published_at: new Date().toISOString(),
      });
    }

    // 6. Insert all articles
    if (insertArticles.length > 0) {
      const { data: inserted, error } = await supabase
        .from("news_articles")
        .insert(insertArticles)
        .select("id, title, stream");

      if (error) {
        console.error("❌ Insert error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`✅ Inserted ${inserted?.length || 0} articles`);

      return new Response(JSON.stringify({
        success: true,
        articles_count: inserted?.length || 0,
        articles: inserted,
        ai_image_generated: imageGenerated,
        total_ai_images_today: aiImagesCount + (imageGenerated ? 1 : 0),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, articles_count: 0, message: "No articles to insert" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ News auto-fetch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
