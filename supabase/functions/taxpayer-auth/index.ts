import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SESSION_LIFETIME_HOURS = 8;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearerToken(req: Request): string | null {
  const value = req.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
}

function randomSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("taxpayer_auth_configuration_missing");
      return jsonResponse({ error: "Authentication service is unavailable. Please try again later." }, 503);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json();
    const action = body?.action;

    if (action === "login") {
      const taxpayerId = typeof body.taxpayer_id === "string" ? body.taxpayer_id.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!taxpayerId || !password) {
        return jsonResponse({ error: "Invalid Taxpayer ID or password" }, 401);
      }

      const { data: taxpayer, error: lookupError } = await supabase
        .from("taxpayer_users")
        .select("id, taxpayer_id, full_name, email, phone, address, is_active")
        .eq("taxpayer_id", taxpayerId)
        .eq("is_active", true)
        .maybeSingle();

      if (lookupError) {
        console.error("taxpayer_auth_account_lookup_failed", lookupError.message);
        return jsonResponse({ error: "Authentication service is unavailable. Please try again later." }, 503);
      }
      if (!taxpayer) {
        console.warn("taxpayer_auth_account_missing_or_inactive");
        return jsonResponse({ error: "Invalid Taxpayer ID or password" }, 401);
      }

      const { data: verified, error: verifyError } = await supabase.rpc(
        "verify_taxpayer_password",
        { input_taxpayer_id: taxpayerId, input_password: password },
      );

      if (verifyError) {
        console.error("taxpayer_auth_password_verifier_failed", verifyError.message);
        return jsonResponse({ error: "Authentication service is unavailable. Please try again later." }, 503);
      }
      if (!verified) {
        console.warn("taxpayer_auth_password_mismatch");
        return jsonResponse({ error: "Invalid Taxpayer ID or password" }, 401);
      }

      const sessionToken = randomSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_LIFETIME_HOURS * 60 * 60 * 1000);
      const { error: sessionError } = await supabase.from("taxpayer_sessions").insert({
        token_hash: await hashToken(sessionToken),
        taxpayer_user_id: taxpayer.id,
        expires_at: expiresAt.toISOString(),
      });

      if (sessionError) {
        console.error("taxpayer_auth_session_create_failed", sessionError.message);
        return jsonResponse({ error: "Authentication service is unavailable. Please try again later." }, 503);
      }

      return jsonResponse({
        taxpayer: {
          id: taxpayer.id,
          taxpayer_id: taxpayer.taxpayer_id,
          full_name: taxpayer.full_name,
          email: taxpayer.email,
          phone: taxpayer.phone,
          address: taxpayer.address,
        },
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
      });
    }

    if (action === "portal_data" || action === "logout") {
      const token = bearerToken(req);
      if (!token) return jsonResponse({ error: "Your session is invalid or expired. Please sign in again." }, 401);

      const { data: session, error: sessionError } = await supabase
        .from("taxpayer_sessions")
        .select("taxpayer_user_id, expires_at, revoked_at, taxpayer:taxpayer_users!inner(id, taxpayer_id, full_name, email, phone, address, party_id, is_active)")
        .eq("token_hash", await hashToken(token))
        .maybeSingle();

      if (sessionError) {
        console.error("taxpayer_auth_session_lookup_failed", sessionError.message);
        return jsonResponse({ error: "Authentication service is unavailable. Please try again later." }, 503);
      }

      const taxpayer = session?.taxpayer as {
        id: string;
        taxpayer_id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        party_id: string | null;
        is_active: boolean;
      } | null;
      const expired = !session || new Date(session.expires_at).getTime() <= Date.now();
      if (!session || session.revoked_at || expired || !taxpayer?.is_active) {
        return jsonResponse({ error: "Your session is invalid or expired. Please sign in again." }, 401);
      }

      if (action === "logout") {
        const { error: revokeError } = await supabase
          .from("taxpayer_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token_hash", await hashToken(token))
          .is("revoked_at", null);
        if (revokeError) console.error("taxpayer_auth_session_revoke_failed", revokeError.message);
        return jsonResponse({ success: true });
      }

      let propertyIds: string[] = [];
      if (taxpayer.party_id) {
        const { data: interests, error: interestsError } = await supabase
          .from("property_interests")
          .select("property_id")
          .eq("party_id", taxpayer.party_id);
        if (interestsError) {
          console.error("taxpayer_portal_property_scope_failed", interestsError.message);
          return jsonResponse({ error: "Unable to load taxpayer account data. Please try again." }, 500);
        }
        propertyIds = [...new Set((interests || []).map((item) => item.property_id))];
      }

      const propertiesRequest = propertyIds.length
        ? supabase.from("properties").select(`*,
            barangay:jurisdictions!barangay_id(name),
            units:property_units(*),
            interests:property_interests!inner(*, party:parties(*))
          `).in("id", propertyIds).eq("interests.party_id", taxpayer.party_id).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });
      const chargesRequest = propertyIds.length
        ? supabase.from("tax_charges").select(`*,
            property:properties!property_id(pin, tax_declaration_number),
            property_unit:property_units!property_unit_id(unit_type, classification),
            assessment:assessments!assessment_id(market_value, assessment_level_percent, assessed_value)
          `).in("property_id", propertyIds).neq("status", "cancelled").order("due_date", { ascending: true })
        : Promise.resolve({ data: [], error: null });
      const paymentsRequest = supabase.from("payments").select(`*,
          receipt:receipts(receipt_number, status),
          allocations:payment_allocations(
            allocated_amount,
            tax_charge:tax_charges(tax_year, quarter, levy_type)
          )
        `).eq("taxpayer_id", taxpayer.id).order("payment_date", { ascending: false }).limit(20);

      const [propertiesResult, chargesResult, paymentsResult] = await Promise.all([
        propertiesRequest,
        chargesRequest,
        paymentsRequest,
      ]);
      const dataError = propertiesResult.error || chargesResult.error || paymentsResult.error;
      if (dataError) {
        console.error("taxpayer_portal_data_load_failed", dataError.message);
        return jsonResponse({ error: "Unable to load taxpayer account data. Please try again." }, 500);
      }

      return jsonResponse({
        properties: propertiesResult.data || [],
        charges: chargesResult.data || [],
        payments: paymentsResult.data || [],
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("taxpayer_auth_unhandled_error", error instanceof Error ? error.message : "unknown_error");
    return jsonResponse({ error: "Authentication service is unavailable. Please try again later." }, 500);
  }
});
