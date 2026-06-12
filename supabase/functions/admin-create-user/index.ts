// Admin-only: creates an auth user with confirmed email and assigns a role.
// Caller must be admin or super_admin. Only super_admin may create admin/super_admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "builder" | "startup" | "admin" | "super_admin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "content-type": "application/json" } });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
  }

  // Verify caller
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
  }

  const admin = createClient(url, service);
  const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (callerRoles ?? []).map((r: any) => r.role);
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isSuper = roles.includes("super_admin");
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...cors, "content-type": "application/json" } });
  }

  const body = await req.json().catch(() => ({}));
  const email: string = (body.email ?? "").trim().toLowerCase();
  const password: string = body.password ?? "";
  const full_name: string = (body.full_name ?? "").trim();
  const role: Role = body.role ?? "admin";

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "email and password are required" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  }
  if (!["builder", "startup", "admin", "super_admin"].includes(role)) {
    return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  }
  if ((role === "admin" || role === "super_admin") && !isSuper) {
    return new Response(JSON.stringify({ error: "Only super_admin can create admin/super_admin users" }), { status: 403, headers: { ...cors, "content-type": "application/json" } });
  }

  // Create the auth user with confirmed email so they can sign in immediately.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: full_name ? { full_name } : undefined,
  });
  if (createErr || !created.user) {
    return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create user" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  }

  const newId = created.user.id;

  // Ensure profile exists (handle_new_user trigger usually does this, but be safe).
  await admin.from("profiles").upsert({ id: newId, full_name: full_name || email }, { onConflict: "id" });

  // Replace any existing roles with the requested role.
  await admin.from("user_roles").delete().eq("user_id", newId);
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newId, role });
  if (roleErr) {
    return new Response(JSON.stringify({ error: `User created but role assignment failed: ${roleErr.message}`, user_id: newId }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }

  await admin.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_role: isSuper ? "super_admin" : "admin",
    action_type: "admin_user_created",
    entity_type: "auth.users",
    entity_id: newId,
    metadata: { email, role, full_name },
  });

  return new Response(JSON.stringify({ user_id: newId, email, role }), {
    status: 200,
    headers: { ...cors, "content-type": "application/json" },
  });
});
