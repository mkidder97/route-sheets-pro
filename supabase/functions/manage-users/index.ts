import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...payload } = await req.json();

    // --- check-setup: anyone can call, returns whether bootstrap is needed ---
    if (action === "check-setup") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      return new Response(
        JSON.stringify({ needsSetup: (count ?? 0) === 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- bootstrap: create first admin (only when 0 users exist) ---
    if (action === "bootstrap") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      if ((count ?? 0) > 0) {
        return new Response(
          JSON.stringify({ error: "System already has users. Bootstrap is disabled." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { email, password, full_name } = payload;
      if (!email || !password || !full_name) {
        return new Response(
          JSON.stringify({ error: "email, password, and full_name are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: newUser, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr) {
        return new Response(
          JSON.stringify({ error: createErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "admin" });

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- All other actions require admin auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check admin role using service role client to bypass RLS
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (roleRow?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- list: return all profiles with roles ---
    if (action === "list") {
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id, email, full_name, phone, is_active, inspector_id, created_at");
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string> = {};
      for (const r of roles ?? []) {
        roleMap[r.user_id] = r.role;
      }

      const users = (profiles ?? []).map((p) => ({
        ...p,
        role: roleMap[p.id] || "unknown",
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- create: create a new user with role ---
    if (action === "create") {
      const { email, password, full_name, role, inspector_id } = payload;
      if (!email || !password || !full_name || !role) {
        return new Response(
          JSON.stringify({ error: "email, password, full_name, and role are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const validRoles = [
        "admin",
        "office_manager",
        "inspector",
        "engineer",
        "construction_manager",
      ];
      if (!validRoles.includes(role)) {
        return new Response(
          JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: newUser, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr) {
        return new Response(
          JSON.stringify({ error: createErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });

      // If inspector_id provided, update the profile
      if (inspector_id) {
        await supabaseAdmin
          .from("user_profiles")
          .update({ inspector_id })
          .eq("id", newUser.user.id);
      }

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- deactivate: set is_active = false ---
    if (action === "deactivate") {
      const { user_id } = payload;
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabaseAdmin
        .from("user_profiles")
        .update({ is_active: false })
        .eq("id", user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
