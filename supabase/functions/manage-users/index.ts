import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fix C-4: Replace CORS wildcard with origin validation
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// Fix M-4: Aligned with database ops_role enum
const VALID_ROLES = [
  "admin",
  "office_manager",
  "field_ops",
  "engineer",
  "inspector",
  "construction_manager",
];

function json(body: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Fix M-2: Audit logging helper
async function auditLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | null,
  action: string,
  targetTable: string | null,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      action,
      target_table: targetTable,
      target_id: targetId,
      details,
    });
  } catch {
    // Audit log failure should not break the operation
    console.error("Audit log write failed");
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...payload } = await req.json();

    // Fix H-6: Bootstrap token required for setup endpoints
    const bootstrapToken = Deno.env.get("BOOTSTRAP_TOKEN") || "";

    // --- check-setup: requires bootstrap token ---
    if (action === "check-setup") {
      if (bootstrapToken && payload.setup_token !== bootstrapToken) {
        return json({ error: "Invalid setup token" }, cors, 403);
      }
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      return json({ needsSetup: (count ?? 0) === 0 }, cors);
    }

    // --- bootstrap: create first admin (only when 0 users exist) ---
    if (action === "bootstrap") {
      if (bootstrapToken && payload.setup_token !== bootstrapToken) {
        return json({ error: "Invalid setup token" }, cors, 403);
      }

      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      if ((count ?? 0) > 0) {
        return json(
          { error: "System already has users. Bootstrap is disabled." },
          cors,
          403,
        );
      }

      const { email, password, full_name } = payload;
      if (!email || !password || !full_name) {
        return json(
          { error: "email, password, and full_name are required." },
          cors,
          400,
        );
      }

      const { data: newUser, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr) return json({ error: createErr.message }, cors, 400);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "admin" });

      await auditLog(supabaseAdmin, newUser.user.id, "bootstrap_admin", "user_roles", newUser.user.id, { email });

      return json({ success: true, user_id: newUser.user.id }, cors);
    }

    // --- Auth required for all other actions ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, cors, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, cors, 401);

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
        return json(
          { error: "Admin or office manager access required" },
          cors,
          403,
        );
      }

      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select(
          "id, email, full_name, phone, is_active, inspector_id, created_at",
        );
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string> = {};
      for (const r of roles ?? []) roleMap[r.user_id] = r.role;

      const users = (profiles ?? []).map((p: any) => ({
        ...p,
        role: roleMap[p.id] || "unknown",
      }));

      return json({ users }, cors);
    }

    // --- All remaining actions: admin only ---
    if (!isAdmin)
      return json({ error: "Admin access required" }, cors, 403);

    // --- create ---
    if (action === "create") {
      const { email, password, full_name, role, inspector_id, phone } =
        payload;
      if (!email || !password || !full_name || !role) {
        return json(
          { error: "email, password, full_name, and role are required." },
          cors,
          400,
        );
      }
      if (!VALID_ROLES.includes(role)) {
        return json(
          {
            error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
          },
          cors,
          400,
        );
      }

      const { data: newUser, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr) return json({ error: createErr.message }, cors, 400);

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

      await auditLog(supabaseAdmin, user.id, "create_user", "user_profiles", newUser.user.id, { email, role });

      return json({ success: true, user_id: newUser.user.id }, cors);
    }

    // --- update ---
    if (action === "update") {
      const { user_id, full_name, phone, role, inspector_id } = payload;
      if (!user_id) return json({ error: "user_id is required." }, cors, 400);

      const profileUpdates: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (phone !== undefined) profileUpdates.phone = phone;
      if (inspector_id !== undefined)
        profileUpdates.inspector_id = inspector_id || null;

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

      await auditLog(supabaseAdmin, user.id, "update_user", "user_profiles", user_id, { ...profileUpdates, role });

      return json({ success: true }, cors);
    }

    // --- activate ---
    if (action === "activate") {
      const { user_id } = payload;
      if (!user_id) return json({ error: "user_id is required." }, cors, 400);

      await supabaseAdmin
        .from("user_profiles")
        .update({ is_active: true })
        .eq("id", user_id);

      await auditLog(supabaseAdmin, user.id, "activate_user", "user_profiles", user_id, {});

      return json({ success: true }, cors);
    }

    // --- deactivate ---
    if (action === "deactivate") {
      const { user_id } = payload;
      if (!user_id) return json({ error: "user_id is required." }, cors, 400);

      await supabaseAdmin
        .from("user_profiles")
        .update({ is_active: false })
        .eq("id", user_id);

      await auditLog(supabaseAdmin, user.id, "deactivate_user", "user_profiles", user_id, {});

      return json({ success: true }, cors);
    }

    return json({ error: `Unknown action: ${action}` }, cors, 400);
  } catch (err) {
    const cors = getCorsHeaders(req);
    return json({ error: err.message }, cors, 500);
  }
});
