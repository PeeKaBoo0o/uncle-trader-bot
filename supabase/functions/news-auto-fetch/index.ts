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

// ─── AI Generate/Edit Image via Gemini API ───
async function aiGenerateImage(title: string, stream: string, originalImageUrl?: string | null): Promise<string | null> {
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_KEY) {
    console.error("GEMINI_API_KEY not set, skipping image generation");
    return null;
  }

  const styleMap: Record<string, string> = {
    hot: "vibrant crypto trading atmosphere, dramatic lighting with red/green accent glows, cinematic editorial quality",
    whale: "deep ocean blue tones with subtle blockchain/network overlay, mysterious and powerful mood",
    macro: "clean professional editorial style, modern financial/governmental aesthetic, sharp and authoritative",
    event: "energetic and futuristic tech event vibe, spotlight effects, innovation and excitement",
    sentiment: "moody atmospheric with data visualization overlay, abstract bull/bear energy, dramatic contrast",
  };

  const style = styleMap[stream] || styleMap.hot;

  let prompt: string;
  const parts: any[] = [];

  if (originalImageUrl && !originalImageUrl.includes("unsplash.com")) {
    prompt = `Transform this news image into a stunning, professional crypto editorial illustration. Style: ${style}. Context: "${title}". Make it more visually captivating and polished. Enhance colors, add cinematic depth and dramatic lighting. Keep the core subject recognizable but elevate the visual quality. No text, no watermarks. 16:9 aspect ratio.`;
    
    // Try to fetch original image and include as inline data
    try {
      const imgRes = await fetch(originalImageUrl);
      if (imgRes.ok) {
        const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
        const imgBase64 = btoa(String.fromCharCode(...imgBytes));
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
        parts.push({ inline_data: { mime_type: mimeType, data: imgBase64 } });
      }
    } catch {
      // If image fetch fails, just generate from text
    }
    parts.push({ text: prompt });
  } else {
    prompt = `Create a stunning, photorealistic crypto news illustration for: "${title}". Style: ${style}. Cinematic quality, dramatic lighting, rich colors, professional editorial photography feel. Highly detailed and visually captivating. No text, no watermarks. 16:9 aspect ratio.`;
    parts.push({ text: prompt });
  }

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`;
    
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!res.ok) {
      console.error("Gemini image gen failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    
    // Extract image from Gemini response
    const candidateParts = data.candidates?.[0]?.content?.parts || [];
    let imageBase64: string | null = null;
    let imageMimeType = "image/png";
    
    for (const part of candidateParts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data;
        imageMimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageBase64) {
      console.error("No image in Gemini response");
      return null;
    }

    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const ext = imageMimeType.includes("jpeg") || imageMimeType.includes("jpg") ? "jpg" : "png";
    const fileName = `news/${Date.now()}-${stream}.${ext}`;
    
    const { error } = await supabase.storage
      .from("news-images")
      .upload(fileName, bytes, { contentType: imageMimeType, upsert: true });

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

// ─── Get diverse stock image from Unsplash Source (random, unique per query) ───
function getStreamImage(stream: string, title: string): string {
  // Use Unsplash Source API with specific search queries per stream + title keywords
  const streamQueries: Record<string, string[]> = {
    hot: ["bitcoin,trading", "cryptocurrency,chart", "digital,finance", "crypto,market,bull", "blockchain,technology"],
    whale: ["ocean,deep", "technology,network", "data,server", "digital,abstract,blue", "blockchain,node"],
    macro: ["government,politics", "economy,finance", "federal,building", "global,business", "stock,market"],
    event: ["technology,conference", "innovation,future", "startup,launch", "digital,summit", "tech,event"],
    sentiment: ["chart,analysis", "market,graph", "trading,screen", "finance,data", "abstract,pattern"],
  };

  const queries = streamQueries[stream] || streamQueries.hot;
  // Use title hash to pick a query variant, ensuring different articles get different images
  const hash = title.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const query = queries[Math.abs(hash) % queries.length];
  
  // Use Unsplash Source with sig parameter for cache-busting (unique per article)
  const sig = Math.abs(hash).toString(36);
  return `https://source.unsplash.com/800x450/?${encodeURIComponent(query)}&sig=${sig}`;
}

// ─── Search web image with diverse pool per stream ───
async function searchFreeImage(title: string, stream: string): Promise<string> {
  // Large curated pool organized by stream category
  const imagePool: Record<string, string[]> = {
    hot: [
      "photo-1639762681485-074b7f938ba0", "photo-1518546305927-5a555bb7020d",
      "photo-1622630998477-20aa696ecb05", "photo-1605792657660-596af9009e82",
      "photo-1642104704074-907c0698cbd9", "photo-1611974789855-9c2a0a7236a3",
      "photo-1621761191319-c6fb62004040", "photo-1643408875993-fba601fccfea",
      "photo-1629877521896-2238eed29b5c", "photo-1624996752380-8ec242e0f85d",
    ],
    whale: [
      "photo-1535320903710-d993d3d77d29", "photo-1526304640581-d334cdbbf45e",
      "photo-1504384308090-c894fdcc538d", "photo-1558494949-ef010cbdcc31",
      "photo-1451187580459-43490279c0fa", "photo-1550751827-4bd374c3f58b",
      "photo-1563986768609-322da13575f2", "photo-1639322537228-f710d846310a",
      "photo-1516245834210-c4c142787335", "photo-1544197150-b99a580bb7a8",
    ],
    macro: [
      "photo-1486406146926-c627a92ad1ab", "photo-1540575467063-178a50e2fd60",
      "photo-1590283603385-17ffb3a7f29f", "photo-1611605698335-8b1569810432",
      "photo-1541354329998-f4d9a9f9297f", "photo-1569025743873-ea3a9ber956f",
      "photo-1526304640581-d334cdbbf45e", "photo-1559526324-593bc073d938",
      "photo-1554224155-8d04cb21cd6c", "photo-1460925895917-afdab827c52f",
    ],
    event: [
      "photo-1540575467063-178a50e2fd60", "photo-1504384308090-c894fdcc538d",
      "photo-1519389950473-47ba0277781c", "photo-1485827404703-89b55fcc595e",
      "photo-1531482615713-2afd69097998", "photo-1492684223f8-82d0fe8c085f",
      "photo-1505373877841-8d25f7d46678", "photo-1475721027785-f74eccf877e2",
      "photo-1587825140708-dfaf18c4228a", "photo-1560439514-4e9645039924",
    ],
    sentiment: [
      "photo-1611605698335-8b1569810432", "photo-1642790106117-e829e14a795f",
      "photo-1559526324-593bc073d938", "photo-1551288049-bebda4e38f71",
      "photo-1611162617213-7d7a39e9b1d7", "photo-1535320903710-d993d3d77d29",
      "photo-1504868584819-f8e8b4b6d7e3", "photo-1460925895917-afdab827c52f",
      "photo-1590283603385-17ffb3a7f29f", "photo-1543286386-713bdd548da4",
    ],
  };

  const pool = imagePool[stream] || imagePool.hot;
  
  // Use both title hash AND current timestamp to ensure uniqueness
  const titleHash = title.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const timeComponent = Math.floor(Date.now() / 60000); // changes every minute
  const idx = Math.abs(titleHash + timeComponent) % pool.length;
  
  return `https://images.unsplash.com/${pool[idx]}?w=800&h=450&fit=crop&auto=format`;
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

// ─── Send news notification to Telegram ───
async function sendNewsTelegram(articles: any[]) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !chatId) return;

  for (const a of articles) {
    const badge = a.badge || "TIN MỚI";
    const msg = `📰 <b>[${badge}]</b> ${a.title}\n\n${(a.summary || "").slice(0, 300)}\n\n🔗 <a href="https://id-preview--a7129c6f-cb5d-4456-aa98-b694e89b3f10.lovable.app/tin-tuc/${a.id}">Đọc đầy đủ</a>`;

    try {
      const res = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TELEGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML", message_thread_id: 329 }),
      });
      if (!res.ok) console.error("Telegram news send error:", await res.text());
    } catch (e) {
      console.error("Telegram news error:", e);
    }
  }
}

// ─── MAIN ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 Starting news auto-fetch cycle...");

    // 0. Fetch recent titles to avoid duplicates (last 48h)
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recentArticles } = await supabase
      .from("news_articles")
      .select("title, source")
      .gte("created_at", since48h);
    
    const recentTitles = new Set(
      (recentArticles || []).map((a: any) => a.title?.toLowerCase().trim())
    );
    // Also extract key phrases for fuzzy matching
    const recentPhrases = new Set(
      (recentArticles || []).map((a: any) => {
        const t = a.title?.toLowerCase().trim() || "";
        // Extract first 5 significant words as a fingerprint
        return t.replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ0-9\s]/g, "")
          .split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(" ");
      })
    );

    console.log(`🔍 Found ${recentTitles.size} recent articles for dedup`);

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

    // Helper: check if article is duplicate
    const isDuplicate = (title: string): boolean => {
      const lower = title.toLowerCase().trim();
      if (recentTitles.has(lower)) return true;
      // Fuzzy check: extract phrase fingerprint and compare
      const phrase = lower.replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ0-9\s]/g, "")
        .split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(" ");
      if (phrase && recentPhrases.has(phrase)) return true;
      return false;
    };

    for (const a of ccNews.slice(0, 15)) {
      if (isDuplicate(a.title || "")) continue;
      allRawArticles.push({
        title: a.title || "",
        body: a.body?.slice(0, 1000) || a.title || "",
        imageUrl: a.imageurl || null,
        source: a.source_info?.name || "CryptoCompare",
      });
    }

    for (const a of coinDeskRss) {
      if (isDuplicate(a.title)) continue;
      allRawArticles.push({ title: a.title, body: a.description, imageUrl: a.imageUrl, source: "CoinDesk" });
    }
    for (const a of decryptRss) {
      if (isDuplicate(a.title)) continue;
      allRawArticles.push({ title: a.title, body: a.description, imageUrl: a.imageUrl, source: "Decrypt" });
    }
    for (const a of cointelegraphRss) {
      if (isDuplicate(a.title)) continue;
      allRawArticles.push({ title: a.title, body: a.description, imageUrl: a.imageUrl, source: "CoinTelegraph" });
    }

    console.log(`✅ After dedup: ${allRawArticles.length} unique articles`);

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

    // AI images: no daily cap, Gemini API has its own quota
    let aiImagesGenerated = 0;


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

      // Image strategy:
      // 1. Try AI generation if budget allows (spread across streams)
      // 2. Use original source image if available
      // 3. Fall back to diverse Unsplash image based on stream + title
      let imageUrl: string | null = null;

      console.log(`🎨 Generating AI image for ${stream}...`);
      imageUrl = await aiGenerateImage(rewritten.title, stream, raw.imageUrl);
      if (imageUrl) {
        aiImagesGenerated++;
        console.log(`✅ AI image generated for ${stream} (${aiImagesGenerated} this cycle)`);
      }

      if (!imageUrl && raw.imageUrl && !raw.imageUrl.includes("unsplash.com")) {
        // Use original source image (but not Unsplash placeholders)
        imageUrl = raw.imageUrl;
      }

      if (!imageUrl) {
        // Fallback: diverse Unsplash image unique to this stream + title
        imageUrl = await searchFreeImage(rewritten.title, stream);
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

      // Send Telegram notifications to news topic
      if (inserted && inserted.length > 0) {
        await sendNewsTelegram(inserted);
        console.log(`📨 Sent ${inserted.length} news notifications to Telegram topic 329`);
      }

      return new Response(JSON.stringify({
        success: true,
        articles_count: inserted?.length || 0,
        articles: inserted,
        ai_images_generated: aiImagesGenerated,
        total_ai_images_today: aiImagesCount + aiImagesGenerated,
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
