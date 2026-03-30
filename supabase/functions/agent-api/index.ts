import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status);
}

/** Authenticate via AGENT_API_KEY header OR Supabase JWT (admin role required) */
async function authenticate(req: Request) {
  const agentKey = req.headers.get("x-agent-key");
  const AGENT_API_KEY = Deno.env.get("AGENT_API_KEY");

  if (agentKey && AGENT_API_KEY && agentKey === AGENT_API_KEY) {
    // API Key auth → use service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return { supabase, authMethod: "api_key" as const };
  }

  // JWT auth → verify user is admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser();
  if (userErr || !user) return null;

  // Check admin role using service role client
  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: hasRole } = await supabaseService.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (!hasRole) return null;

  return { supabase: supabaseService, authMethod: "jwt" as const, userId: user.id };
}

// ── Route handlers ──────────────────────────────────────────

type Ctx = { supabase: ReturnType<typeof createClient>; body: any; params: URLSearchParams };

// --- NEWS ---
async function handleNews(method: string, ctx: Ctx) {
  const { supabase, body, params } = ctx;

  if (method === "GET") {
    const limit = parseInt(params.get("limit") || "20");
    const offset = parseInt(params.get("offset") || "0");
    const { data, error: e, count } = await supabase
      .from("news_articles")
      .select("*", { count: "exact" })
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (e) return error(e.message, 500);
    return json({ data, count });
  }

  if (method === "POST") {
    if (!body?.title) return error("title is required");
    const { data, error: e } = await supabase.from("news_articles").insert({
      title: body.title,
      summary: body.summary || null,
      full_content: body.full_content || null,
      source: body.source || "",
      stream: body.stream || "hot",
      image_url: body.image_url || null,
      badge: body.badge || null,
      badge_color: body.badge_color || null,
      is_published: body.is_published ?? true,
      published_at: body.published_at || new Date().toISOString(),
    }).select().single();
    if (e) return error(e.message, 500);
    return json({ data }, 201);
  }

  if (method === "PUT" || method === "PATCH") {
    const id = params.get("id");
    if (!id) return error("id param required");
    const { data, error: e } = await supabase
      .from("news_articles")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (e) return error(e.message, 500);
    return json({ data });
  }

  if (method === "DELETE") {
    const id = params.get("id");
    if (!id) return error("id param required");
    const { error: e } = await supabase.from("news_articles").delete().eq("id", id);
    if (e) return error(e.message, 500);
    return json({ ok: true });
  }

  return error("Method not allowed", 405);
}

// --- SIGNALS ---
async function handleSignals(method: string, ctx: Ctx) {
  const { supabase, body, params } = ctx;

  if (method === "GET") {
    const limit = parseInt(params.get("limit") || "50");
    const symbol = params.get("symbol");
    let q = supabase
      .from("signals")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false })
      .limit(limit);
    if (symbol) q = q.eq("symbol", symbol);
    const { data, error: e, count } = await q;
    if (e) return error(e.message, 500);
    return json({ data, count });
  }

  if (method === "POST") {
    if (!body?.symbol || !body?.price || !body?.candle_time)
      return error("symbol, price, candle_time required");
    const { data, error: e } = await supabase.from("signals").insert({
      symbol: body.symbol,
      price: body.price,
      candle_time: body.candle_time,
      conditions: body.conditions || [],
      strength: body.strength || "TRUNG BÌNH",
      timeframe: body.timeframe || "H4",
      rsi: body.rsi || null,
      vol_ratio: body.vol_ratio || null,
    }).select().single();
    if (e) return error(e.message, 500);

    // Optional: send to Telegram
    if (body.send_telegram) {
      try {
        await sendTelegram(body);
      } catch (err) {
        console.error("Telegram send failed:", err);
      }
    }

    return json({ data }, 201);
  }

  return error("Method not allowed", 405);
}

// --- ECONOMIC EVENTS ---
async function handleEvents(method: string, ctx: Ctx) {
  const { supabase, body, params } = ctx;

  if (method === "GET") {
    const limit = parseInt(params.get("limit") || "50");
    const impact = params.get("impact");
    let q = supabase
      .from("economic_events")
      .select("*", { count: "exact" })
      .order("event_time", { ascending: true })
      .limit(limit);
    if (impact) q = q.eq("impact", impact);
    const { data, error: e, count } = await q;
    if (e) return error(e.message, 500);
    return json({ data, count });
  }

  if (method === "POST") {
    if (!body?.event_name || !body?.event_time || !body?.country)
      return error("event_name, event_time, country required");
    const { data, error: e } = await supabase.from("economic_events").insert({
      event_name: body.event_name,
      event_time: body.event_time,
      country: body.country,
      impact: body.impact || "medium",
      flag: body.flag || "🌐",
      actual: body.actual || null,
      estimate: body.estimate || null,
      prev: body.prev || null,
    }).select().single();
    if (e) return error(e.message, 500);
    return json({ data }, 201);
  }

  if (method === "PUT" || method === "PATCH") {
    const id = params.get("id");
    if (!id) return error("id param required");
    const { data, error: e } = await supabase
      .from("economic_events")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (e) return error(e.message, 500);
    return json({ data });
  }

  if (method === "DELETE") {
    const id = params.get("id");
    if (!id) return error("id param required");
    const { error: e } = await supabase.from("economic_events").delete().eq("id", id);
    if (e) return error(e.message, 500);
    return json({ ok: true });
  }

  return error("Method not allowed", 405);
}

// --- USERS ---
async function handleUsers(method: string, ctx: Ctx) {
  const { supabase, body, params } = ctx;

  if (method === "GET") {
    const userId = params.get("user_id");
    if (userId) {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_roles").select("*").eq("user_id", userId),
      ]);
      return json({
        profile: profileRes.data,
        roles: rolesRes.data?.map((r: any) => r.role) || [],
      });
    }
    // List all profiles
    const limit = parseInt(params.get("limit") || "50");
    const { data, error: e, count } = await supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (e) return error(e.message, 500);
    return json({ data, count });
  }

  if (method === "POST" && params.get("action") === "assign_role") {
    if (!body?.user_id || !body?.role) return error("user_id, role required");
    if (!["admin", "moderator", "user"].includes(body.role))
      return error("role must be admin, moderator, or user");
    const { data, error: e } = await supabase.from("user_roles").upsert(
      { user_id: body.user_id, role: body.role },
      { onConflict: "user_id,role" }
    ).select().single();
    if (e) return error(e.message, 500);
    return json({ data }, 201);
  }

  if (method === "DELETE" && params.get("action") === "remove_role") {
    if (!body?.user_id || !body?.role) return error("user_id, role required");
    const { error: e } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", body.user_id)
      .eq("role", body.role);
    if (e) return error(e.message, 500);
    return json({ ok: true });
  }

  if (method === "PUT" || method === "PATCH") {
    const userId = params.get("user_id");
    if (!userId) return error("user_id param required");
    const { data, error: e } = await supabase
      .from("profiles")
      .update({ display_name: body.display_name, avatar_url: body.avatar_url })
      .eq("user_id", userId)
      .select()
      .single();
    if (e) return error(e.message, 500);
    return json({ data });
  }

  return error("Method not allowed", 405);
}

// --- Telegram helper ---
async function sendTelegram(signal: any) {
  const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) return;

  const text = `🤖 <b>Agent Signal</b>\n\n` +
    `Symbol: <b>${signal.symbol}</b>\n` +
    `Price: <b>${signal.price}</b>\n` +
    `Strength: ${signal.strength || "TRUNG BÌNH"}\n` +
    `Timeframe: ${signal.timeframe || "H4"}\n` +
    `Conditions: ${(signal.conditions || []).join(", ")}\n` +
    `Time: ${signal.candle_time}`;

  await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
    }),
  });
}

// ── Main router ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate
  const auth = await authenticate(req);
  if (!auth) {
    return error("Unauthorized. Provide x-agent-key header or admin JWT.", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path: /agent-api/{resource}
  // pathParts might be: ["agent-api", "news"] or just ["news"]
  const resource = pathParts[pathParts.length - 1];
  const params = url.searchParams;
  
  let body: any = null;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const ctx: Ctx = { supabase: auth.supabase, body, params };

  switch (resource) {
    case "news":
      return handleNews(req.method, ctx);
    case "signals":
      return handleSignals(req.method, ctx);
    case "events":
      return handleEvents(req.method, ctx);
    case "users":
      return handleUsers(req.method, ctx);
    case "health":
      return json({ status: "ok", auth: auth.authMethod, timestamp: new Date().toISOString() });
    default:
      return json({
        endpoints: {
          "GET/POST/PUT/DELETE /news": "Quản lý tin tức (?id=...&limit=...&offset=...)",
          "GET/POST /signals": "Tín hiệu trading (?symbol=...&limit=...)",
          "GET/POST/PUT/DELETE /events": "Sự kiện kinh tế (?impact=...&id=...)",
          "GET/PUT /users": "Profiles (?user_id=...&limit=...)",
          "POST /users?action=assign_role": "Gán role {user_id, role}",
          "DELETE /users?action=remove_role": "Xoá role {user_id, role}",
          "GET /health": "Health check",
        },
        auth: "Header x-agent-key hoặc Authorization: Bearer <admin_jwt>",
      });
  }
});
