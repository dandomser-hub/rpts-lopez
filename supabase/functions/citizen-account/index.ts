import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      return json({ error: "Citizen account service is not configured" }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
    if (userError || !user?.id || !user.email) return json({ error: "Sign in to continue" }, 401);
    if (!user.email_confirmed_at) return json({ error: "Confirm your email before linking your taxpayer record" }, 403);

    const body = await req.json();
    if (body.action !== "link" || typeof body.taxpayer_id !== "string") {
      return json({ error: "Invalid request" }, 400);
    }
    const taxpayerId = body.taxpayer_id.trim();
    if (!taxpayerId || taxpayerId.length > 80) return json({ error: "Invalid taxpayer ID" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: taxpayer, error: taxpayerError } = await admin
      .from("taxpayer_users")
      .select("id, taxpayer_id, email, full_name, phone, address, is_active, auth_id")
      .eq("taxpayer_id", taxpayerId)
      .eq("is_active", true)
      .maybeSingle();

    if (taxpayerError) return json({ error: "Unable to verify taxpayer record" }, 500);
    if (!taxpayer || !taxpayer.email || taxpayer.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return json({ error: "Taxpayer ID and verified email did not match an active municipal record" }, 403);
    }
    if (taxpayer.auth_id && taxpayer.auth_id !== user.id) {
      return json({ error: "This taxpayer record is already linked to another citizen account" }, 409);
    }

    const { data: linked, error: linkError } = await admin
      .from("taxpayer_users")
      .update({ auth_id: user.id })
      .eq("id", taxpayer.id)
      .or(`auth_id.is.null,auth_id.eq.${user.id}`)
      .select("id, taxpayer_id, email, full_name, phone, address, is_active, auth_id")
      .maybeSingle();
    if (linkError || !linked) return json({ error: "Could not link this taxpayer record" }, 409);

    const { error: accessError } = await admin.rpc("link_taxpayer_properties", {
      target_taxpayer_user_id: taxpayer.id,
    });
    if (accessError) return json({ error: "Account linked, but property access could not be prepared" }, 500);

    return json({ taxpayer: linked });
  } catch {
    return json({ error: "Unable to process citizen account request" }, 500);
  }
});
