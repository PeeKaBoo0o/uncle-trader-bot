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

const VALID_RESOURCES = ["news", "signals", "events"] as const;
type ResourceName = typeof VALID_RESOURCES[number];

function resourceToTable(resource: string): string | null {
  switch (resource) {
    case "news": case "news_articles": return "news_articles";
    case "signals": case "signal": return "signals";
    case "events": case "event": case "economic_events": return "economic_events";
    default: return null;
  }
}

function normalizeResource(resource: string): ResourceName | null {
  const table = resourceToTable(resource);
  if (!table) return null;
  if (table === "news_articles") return "news";
  if (table === "signals") return "signals";
  if (table === "economic_events") return "events";
  return null;
}

/** Authenticate via AGENT_API_KEY header OR Supabase JWT (admin role required) */
async function authenticate(req: Request) {
  const agentKey = req.headers.get("x-agent-key");
  const AGENT_API_KEY = Deno.env.get("AGENT_API_KEY");

  if (agentKey && AGENT_API_KEY && agentKey === AGENT_API_KEY) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return { supabase, authMethod: "api_key" as const };
  }

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

type Ctx = { supabase: ReturnType<typeof createClient>; body: any; params: URLSearchParams; authMethod: string; userId?: string };

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

// ── NEW: Context endpoint ───────────────────────────────────

async function handleContext(ctx: Ctx) {
  const { supabase, authMethod, userId } = ctx;

  const [signalsRes, newsRes, eventsRes, statsRes] = await Promise.all([
    supabase
      .from("signals")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase
      .from("news_articles")
      .select("id,title,summary,stream,badge,published_at,source")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("economic_events")
      .select("*")
      .gte("event_time", new Date().toISOString())
      .order("event_time", { ascending: true })
      .limit(10),
    Promise.all([
      supabase.from("signals").select("*", { count: "exact", head: true }),
      supabase.from("news_articles").select("*", { count: "exact", head: true }),
      supabase.from("economic_events").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]),
  ]);

  const [sCnt, nCnt, eCnt, pCnt] = statsRes;

  let userInfo: any = { auth_method: authMethod };
  if (userId) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    userInfo.user_id = userId;
    userInfo.roles = roles?.map((r: any) => r.role) || [];
  } else {
    userInfo.roles = ["service_role"];
  }

  return json({
    latest_signals: signalsRes.data || [],
    latest_news: newsRes.data || [],
    upcoming_events: eventsRes.data || [],
    stats: {
      total_signals: sCnt.count ?? 0,
      total_news: nCnt.count ?? 0,
      total_events: eCnt.count ?? 0,
      total_users: pCnt.count ?? 0,
    },
    user: userInfo,
    timestamp: new Date().toISOString(),
  });
}

// ── NEW: Review endpoint ────────────────────────────────────

async function handleReview(ctx: Ctx) {
  const { supabase, body } = ctx;

  if (!body?.resource) return error("resource is required (news|signal|event)");
  const table = resourceToTable(body.resource);
  if (!table) return error(`Invalid resource: ${body.resource}. Use: news, signal, event`);

  const mode = body.mode || "quality";
  if (!["quality", "risk", "improvement"].includes(mode))
    return error("mode must be: quality, risk, or improvement");

  let record: any = body.data || null;

  // If id provided, fetch the record
  if (body.id && !record) {
    const { data, error: e } = await supabase.from(table).select("*").eq("id", body.id).single();
    if (e) return error(`Record not found: ${e.message}`, 404);
    record = data;
  }

  if (!record) return error("Provide either 'id' to fetch or 'data' to review");

  const issues: string[] = [];
  const suggestions: string[] = [];
  let improved_version: any = null;

  // Review logic per resource + mode
  if (table === "news_articles") {
    if (!record.title || record.title.trim().length < 10)
      issues.push("Title is too short (< 10 chars)");
    if (record.title && record.title.length > 200)
      issues.push("Title is too long (> 200 chars)");
    if (!record.summary || record.summary.trim().length < 20)
      issues.push("Summary is missing or too short");
    if (!record.full_content || record.full_content.trim().length < 50)
      issues.push("Full content is missing or too short");
    if (!record.image_url)
      suggestions.push("Consider adding an image URL for better engagement");
    if (!record.badge)
      suggestions.push("Add a badge (e.g. 'Nóng', 'Phân tích') to categorize the article");
    if (record.source === "" || !record.source)
      suggestions.push("Add a source for credibility");

    if (mode === "improvement" || mode === "quality") {
      improved_version = { ...record };
      if (record.title) improved_version.title = record.title.trim();
      if (record.summary) improved_version.summary = record.summary.trim();
      if (!record.stream) improved_version.stream = "hot";
      if (!record.is_published) improved_version.is_published = true;
    }

    if (mode === "risk") {
      if (record.full_content && record.full_content.length > 10000)
        issues.push("Content exceeds 10k chars — may impact performance");
      if (record.image_url && !record.image_url.startsWith("https://"))
        issues.push("Image URL is not HTTPS — security risk");
    }
  }

  if (table === "signals") {
    if (!record.symbol) issues.push("Missing symbol");
    if (!record.price || record.price <= 0) issues.push("Invalid or missing price");
    if (!record.candle_time) issues.push("Missing candle_time");
    if (!record.conditions || record.conditions.length === 0)
      suggestions.push("Add conditions to explain signal triggers");
    if (record.strength === "TRUNG BÌNH")
      suggestions.push("Consider specifying exact strength instead of default");
    if (!record.rsi) suggestions.push("Include RSI for better signal context");
    if (!record.vol_ratio) suggestions.push("Include volume ratio for confirmation");

    if (mode === "risk") {
      if (record.price && record.symbol) {
        if (record.symbol.includes("BTC") && record.price < 1000)
          issues.push("BTC price seems unrealistically low — verify");
        if (record.symbol.includes("XAU") && record.price < 100)
          issues.push("XAU price seems unrealistically low — verify");
      }
    }

    if (mode === "improvement") {
      improved_version = { ...record };
      if (!record.timeframe) improved_version.timeframe = "H4";
      if (!record.conditions) improved_version.conditions = [];
    }
  }

  if (table === "economic_events") {
    if (!record.event_name) issues.push("Missing event_name");
    if (!record.event_time) issues.push("Missing event_time");
    if (!record.country) issues.push("Missing country");
    if (!record.impact || !["high", "medium", "low"].includes(record.impact))
      suggestions.push("Set impact to high/medium/low");
    if (record.flag === "🌐")
      suggestions.push("Set a country-specific flag emoji");
    if (!record.estimate && !record.prev)
      suggestions.push("Add estimate or previous values for context");

    if (mode === "risk") {
      const eventTime = new Date(record.event_time);
      if (eventTime < new Date())
        issues.push("Event time is in the past");
    }
  }

  const summary = issues.length === 0
    ? `${mode} review passed. ${suggestions.length} suggestion(s) available.`
    : `${mode} review found ${issues.length} issue(s) and ${suggestions.length} suggestion(s).`;

  return json({
    resource: normalizeResource(body.resource),
    mode,
    summary,
    issues,
    suggestions,
    improved_version,
    reviewed_record: record,
  });
}

// ── NEW: Preview Edit endpoint ──────────────────────────────

async function handlePreviewEdit(ctx: Ctx) {
  const { supabase, body } = ctx;

  if (!body?.resource) return error("resource is required");
  const table = resourceToTable(body.resource);
  if (!table) return error(`Invalid resource: ${body.resource}`);

  if (!body.changes || typeof body.changes !== "object" || Object.keys(body.changes).length === 0)
    return error("changes object is required and must not be empty");

  let before: any = null;

  if (body.id) {
    const { data, error: e } = await supabase.from(table).select("*").eq("id", body.id).single();
    if (e) return error(`Record not found: ${e.message}`, 404);
    before = data;
  } else {
    // Preview on provided data
    before = body.data || {};
  }

  // Build after state
  const after = { ...before, ...body.changes };

  // Build diff summary
  const diff_summary: string[] = [];
  const warnings: string[] = [];

  for (const key of Object.keys(body.changes)) {
    const oldVal = before[key];
    const newVal = body.changes[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      const oldDisplay = oldVal === null || oldVal === undefined ? "(empty)" : 
        typeof oldVal === "string" && oldVal.length > 80 ? oldVal.substring(0, 80) + "..." : String(oldVal);
      const newDisplay = newVal === null || newVal === undefined ? "(empty)" :
        typeof newVal === "string" && newVal.length > 80 ? newVal.substring(0, 80) + "..." : String(newVal);
      diff_summary.push(`${key}: "${oldDisplay}" → "${newDisplay}"`);
    }
  }

  // Validate dangerous changes
  const protectedFields = ["id", "created_at"];
  for (const key of protectedFields) {
    if (key in body.changes) {
      warnings.push(`Changing '${key}' is not recommended and will be ignored on apply`);
    }
  }

  if (table === "news_articles") {
    if (body.changes.is_published === false && before.is_published === true)
      warnings.push("This will unpublish the article — it will no longer be visible to users");
    if (body.changes.image_url && !body.changes.image_url.startsWith("https://"))
      warnings.push("New image URL is not HTTPS");
  }

  if (table === "signals" && body.changes.price) {
    const priceDiff = Math.abs(body.changes.price - (before.price || 0));
    const pctChange = before.price ? (priceDiff / before.price) * 100 : 100;
    if (pctChange > 20)
      warnings.push(`Price change is ${pctChange.toFixed(1)}% — verify this is intentional`);
  }

  return json({
    resource: normalizeResource(body.resource),
    id: body.id || null,
    before,
    after,
    diff_summary,
    warnings,
    changes_count: diff_summary.length,
  });
}

// ── NEW: Apply Edit endpoint ────────────────────────────────

async function handleApplyEdit(ctx: Ctx) {
  const { supabase, body } = ctx;

  if (!body?.resource) return error("resource is required");
  const table = resourceToTable(body.resource);
  if (!table) return error(`Invalid resource: ${body.resource}`);

  if (!body.id) return error("id is required for apply-edit");

  if (!body.changes || typeof body.changes !== "object" || Object.keys(body.changes).length === 0)
    return error("changes object is required and must not be empty");

  // Strip protected fields
  const sanitized = { ...body.changes };
  delete sanitized.id;
  delete sanitized.created_at;

  if (Object.keys(sanitized).length === 0)
    return error("No valid changes after removing protected fields");

  // Verify record exists
  const { data: existing, error: fetchErr } = await supabase
    .from(table)
    .select("*")
    .eq("id", body.id)
    .single();
  if (fetchErr) return error(`Record not found: ${fetchErr.message}`, 404);

  // Apply update
  const { data: updated, error: updateErr } = await supabase
    .from(table)
    .update(sanitized)
    .eq("id", body.id)
    .select()
    .single();

  if (updateErr) return error(`Update failed: ${updateErr.message}`, 500);

  return json({
    success: true,
    resource: normalizeResource(body.resource),
    id: body.id,
    before: existing,
    after: updated,
    applied_changes: Object.keys(sanitized),
  });
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

  const auth = await authenticate(req);
  if (!auth) {
    return error("Unauthorized. Provide x-agent-key header or admin JWT.", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
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

  const ctx: Ctx = { supabase: auth.supabase, body, params, authMethod: auth.authMethod, userId: (auth as any).userId };

  switch (resource) {
    case "news":
      return handleNews(req.method, ctx);
    case "signals":
      return handleSignals(req.method, ctx);
    case "events":
      return handleEvents(req.method, ctx);
    case "users":
      return handleUsers(req.method, ctx);
    case "context":
      if (req.method !== "GET") return error("GET only", 405);
      return handleContext(ctx);
    case "review":
      if (req.method !== "POST") return error("POST only", 405);
      return handleReview(ctx);
    case "preview-edit":
      if (req.method !== "POST") return error("POST only", 405);
      return handlePreviewEdit(ctx);
    case "apply-edit":
      if (req.method !== "POST") return error("POST only", 405);
      return handleApplyEdit(ctx);
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
          "GET /context": "App context: signals, news, events, stats, user info",
          "POST /review": "Review content {resource, id?, data?, mode}",
          "POST /preview-edit": "Preview changes {resource, id?, changes}",
          "POST /apply-edit": "Apply changes {resource, id, changes}",
          "GET /health": "Health check",
        },
        auth: "Header x-agent-key hoặc Authorization: Bearer <admin_jwt>",
      });
  }
});
