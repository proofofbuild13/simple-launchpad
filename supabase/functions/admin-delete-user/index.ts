import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const { data: roleRow } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (roleRow?.role !== "super_admin") {
      return json({ error: "super_admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetId = body?.user_id as string | undefined;
    if (!targetId || typeof targetId !== "string") {
      return json({ error: "user_id required" }, 400);
    }
    if (targetId === userData.user.id) {
      return json({ error: "Cannot delete yourself" }, 400);
    }

    const admin = createClient(url, service);

    // Use the caller's client so auth.uid() works inside the RPC
    const { data: rpc, error: rpcErr } = await callerClient.rpc("admin_delete_user", {
      _user_id: targetId,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);
    if ((rpc as any)?.blocked) return json(rpc, 200);

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: `Domain rows deleted, but auth user removal failed: ${delErr.message}` }, 500);

    return json({ ok: true, deleted: true }, 200);
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
