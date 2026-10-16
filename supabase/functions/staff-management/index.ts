import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Authentication required" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Staff management is not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Your session is invalid or expired. Sign in again." }, 401);
    }

    const { data: staffProfile, error: profileError } = await supabase
      .from("staff_users")
      .select("id, role_id")
      .eq("auth_id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!staffProfile) return jsonResponse({ error: "An active staff account is required" }, 403);

    const { data: role, error: roleError } = await supabase
      .from("staff_roles")
      .select("code")
      .eq("id", staffProfile.role_id)
      .maybeSingle();

    if (roleError) throw roleError;
    if (role?.code !== "admin") return jsonResponse({ error: "Administrator access is required" }, 403);

    const { action, email, password, full_name, office_id, role_id } = await req.json();
    if (action !== "create_staff") return jsonResponse({ error: "Unknown action" }, 400);

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return jsonResponse({ error: "A valid email address is required" }, 400);
    }
    if (typeof password !== "string" || password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters long" }, 400);
    }
    if (typeof full_name !== "string" || !full_name.trim()) {
      return jsonResponse({ error: "Full name is required" }, 400);
    }
    if (typeof office_id !== "string" || !office_id || typeof role_id !== "string" || !role_id) {
      return jsonResponse({ error: "Office and role are required" }, 400);
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim(), role: "staff" },
    });
    if (createError) return jsonResponse({ error: createError.message }, 400);

    const { error: insertError } = await supabase.from("staff_users").insert({
      auth_id: created.user.id,
      email: normalizedEmail,
      full_name: full_name.trim(),
      office_id,
      role_id,
      is_active: true,
    });

    if (insertError) {
      const { error: rollbackError } = await supabase.auth.admin.deleteUser(created.user.id);
      if (rollbackError) {
        console.error("Could not roll back Auth user after staff profile insert failed", rollbackError);
      }
      return jsonResponse({ error: insertError.message }, 400);
    }

    return jsonResponse({ success: true, user_id: created.user.id });
  } catch (err) {
    console.error("Staff management request failed", err);
    return jsonResponse({ error: "Unable to complete the staff management request" }, 500);
  }
});
