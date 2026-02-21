import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- In-memory rate limiting ---
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(req: Request): Response | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0].trim() : null)
    || req.headers.get("cf-connecting-ip")
    || "unknown";

  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) rateLimitMap.delete(key);
  }

  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + RATE_WINDOW };
    rateLimitMap.set(ip, entry);
    return null;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }
  return null;
}

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const VALID_ROLES = [
  "admin",
  "office_manager",
  "field_ops",
  "engineer",
  "inspector",
  "construction_manager",
];

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function logAudit(
  supabaseAdmin: any,
  userId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  await supabaseAdmin.from("audit_log").insert({
    user_id: userId,
    action,
    target_table: "user_profiles",
    target_id: targetId,
    details,
  });
}

// --- Input validation helpers ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[\d\s\-()+]+$/;

function validateEmail(v: unknown): string | null {
  if (typeof v !== "string" || !EMAIL_RE.test(v)) return "Invalid email format.";
  if (v.length > 255) return "Email must be under 255 characters.";
  return null;
}
function validatePassword(v: unknown): string | null {
  if (typeof v !== "string" || v.length < 12) return "Password must be at least 12 characters.";
  if (v.length > 128) return "Password must be under 128 characters.";
  return null;
}
function validateFullName(v: unknown): string | null {
  if (typeof v !== "string" || v.trim().length === 0) return "Full name is required.";
  if (v.length > 200) return "Full name must be under 200 characters.";
  return null;
}
function validatePhone(v: unknown): string | null {
  if (typeof v !== "string") return "Phone must be a string.";
  if (v.length > 30) return "Phone must be under 30 characters.";
  if (!PHONE_RE.test(v)) return "Phone contains invalid characters.";
  return null;
}
function validateUuid(v: unknown): string | null {
  if (typeof v !== "string" || !UUID_RE.test(v)) return "Invalid user_id format (expected UUID).";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  // Rate limit check
  const rateLimitResponse = checkRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...payload } = await req.json();

    // --- check-setup: anyone can call ---
    if (action === "check-setup") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      return json(req, { needsSetup: (count ?? 0) === 0 });
    }

    // --- bootstrap: create first admin (only when 0 users exist) ---
    if (action === "bootstrap") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      if ((count ?? 0) > 0) {
        return json(req, { error: "System already has users. Bootstrap is disabled." }, 403);
      }

      const { email, password, full_name } = payload;
      const bErr = validateEmail(email) || validatePassword(password) || validateFullName(full_name);
      if (bErr) return json(req, { error: bErr }, 400);

      const { data: newUser, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr) return json(req, { error: createErr.message }, 400);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "admin" });

      return json(req, { success: true, user_id: newUser.user.id });
    }

    // --- Auth required for all other actions ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(req, { error: "Not authenticated" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json(req, { error: "Not authenticated" }, 401);

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const callerRole = roleRow?.role;
    const isAdmin = callerRole === "admin";
    const isOfficeManager = callerRole === "office_manager";

    // --- list: admin or office_manager ---
    if (action === "list") {
      if (!isAdmin && !isOfficeManager) {
        return json(req, { error: "Admin or office manager access required" }, 403);
      }

      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id, email, full_name, phone, is_active, inspector_id, created_at");
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string> = {};
      for (const r of roles ?? []) roleMap[r.user_id] = r.role;

      const users = (profiles ?? []).map((p: any) => ({
        ...p,
        role: roleMap[p.id] || "unknown",
      }));

      return json(req, { users });
    }

    // --- All remaining actions: admin only ---
    if (!isAdmin) return json(req, { error: "Admin access required" }, 403);

    // --- create ---
    if (action === "create") {
      const { email, password, full_name, role, inspector_id, phone } = payload;
      const cErr = validateEmail(email) || validatePassword(password) || validateFullName(full_name);
      if (cErr) return json(req, { error: cErr }, 400);
      if (!role || !VALID_ROLES.includes(role)) {
        return json(req, { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, 400);
      }
      if (phone !== undefined && phone !== null) {
        const pErr = validatePhone(phone);
        if (pErr) return json(req, { error: pErr }, 400);
      }

      const { data: newUser, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr) return json(req, { error: createErr.message }, 400);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });

      const profileUpdates: Record<string, unknown> = {};
      if (inspector_id) profileUpdates.inspector_id = inspector_id;
      if (phone) profileUpdates.phone = phone;
      if (Object.keys(profileUpdates).length > 0) {
        await supabaseAdmin
          .from("user_profiles")
          .update(profileUpdates)
          .eq("id", newUser.user.id);
      }

      await logAudit(supabaseAdmin, user.id, "create_user", newUser.user.id, {
        email, role, full_name,
      });

      return json(req, { success: true, user_id: newUser.user.id });
    }

    // --- update ---
    if (action === "update") {
      const { user_id, full_name, phone, role, inspector_id } = payload;
      const uIdErr = validateUuid(user_id);
      if (uIdErr) return json(req, { error: uIdErr }, 400);
      if (full_name !== undefined) {
        const fnErr = validateFullName(full_name);
        if (fnErr) return json(req, { error: fnErr }, 400);
      }
      if (phone !== undefined && phone !== null) {
        const phErr = validatePhone(phone);
        if (phErr) return json(req, { error: phErr }, 400);
      }
      if (role !== undefined && !VALID_ROLES.includes(role)) {
        return json(req, { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, 400);
      }

      const profileUpdates: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (phone !== undefined) profileUpdates.phone = phone;
      if (inspector_id !== undefined) profileUpdates.inspector_id = inspector_id || null;

      if (Object.keys(profileUpdates).length > 0) {
        await supabaseAdmin
          .from("user_profiles")
          .update(profileUpdates)
          .eq("id", user_id);
      }

      if (role && VALID_ROLES.includes(role)) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id, role }, { onConflict: "user_id" });
      }

      await logAudit(supabaseAdmin, user.id, "update_user", user_id, {
        ...profileUpdates,
        ...(role ? { role } : {}),
      });

      return json(req, { success: true });
    }

    // --- activate ---
    if (action === "activate") {
      const { user_id } = payload;
      const aErr = validateUuid(user_id);
      if (aErr) return json(req, { error: aErr }, 400);

      await supabaseAdmin
        .from("user_profiles")
        .update({ is_active: true })
        .eq("id", user_id);

      await logAudit(supabaseAdmin, user.id, "activate_user", user_id, {});

      return json(req, { success: true });
    }

    // --- deactivate ---
    if (action === "deactivate") {
      const { user_id } = payload;
      const dErr = validateUuid(user_id);
      if (dErr) return json(req, { error: dErr }, 400);

      await supabaseAdmin
        .from("user_profiles")
        .update({ is_active: false })
        .eq("id", user_id);

      await logAudit(supabaseAdmin, user.id, "deactivate_user", user_id, {});

      return json(req, { success: true });
    }

    return json(req, { error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json(req, { error: err.message }, 500);
  }
});
