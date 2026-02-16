import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetCompanyByInviteRequest {
  inviteCode?: string;
  invite?: string;
  incrementUsage?: boolean;
}

// Rate limiting: 20 requests per IP per hour
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Rate limiting by IP ---
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("cf-connecting-ip") || "unknown";
    const rateLimitKey = `invite_lookup_${clientIp}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

    const { data: rlData } = await supabase
      .from("otp_rate_limits")
      .select("request_count, first_request_at")
      .eq("phone", rateLimitKey)
      .gte("first_request_at", windowStart.toISOString())
      .maybeSingle();

    const currentCount = rlData?.request_count || 0;
    if (currentCount >= RATE_LIMIT_MAX) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    await supabase.from("otp_rate_limits").upsert({
      phone: rateLimitKey,
      ip_address: clientIp,
      request_count: currentCount + 1,
      first_request_at: rlData ? rlData.first_request_at : now.toISOString(),
      last_request_at: now.toISOString(),
    }, { onConflict: "phone" });

    // --- Main logic ---
    const body: GetCompanyByInviteRequest = await req.json().catch(() => ({}));

    const rawInvite = String(body.inviteCode ?? body.invite ?? "").trim();
    const inviteCode = rawInvite.match(/[A-Za-z0-9_-]{6,64}/)?.[0] || "";

    const incrementUsage = body.incrementUsage === true;

    if (!inviteCode) {
      return new Response(JSON.stringify({ error: "Invite code is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (inviteCode.length < 6 || inviteCode.length > 64) {
      return new Response(JSON.stringify({ error: "Invalid invite code" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const candidateCodes = Array.from(
      new Set([inviteCode, inviteCode.toLowerCase(), inviteCode.toUpperCase()])
    );

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, is_active, invite_max_uses, invite_uses_count, invite_expires_at, logo_url, brand_color, tagline")
      .in("invite_code", candidateCodes)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching company:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch company" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!data || data.is_active === false) {
      return new Response(JSON.stringify({ error: "Invalid or inactive invite link" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.invite_expires_at) {
      const expiryDate = new Date(data.invite_expires_at);
      if (expiryDate < new Date()) {
        return new Response(JSON.stringify({ error: "This invite link has expired" }), {
          status: 410,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const currentUses = data.invite_uses_count ?? 0;
    const maxUses = data.invite_max_uses;
    if (maxUses !== null && currentUses >= maxUses) {
      return new Response(JSON.stringify({ error: "This invite link has reached its usage limit" }), {
        status: 410,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (incrementUsage) {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ invite_uses_count: currentUses + 1 })
        .eq("id", data.id);

      if (updateError) {
        console.error("Error incrementing invite usage:", updateError);
      }
    }

    const remainingUses = maxUses === null ? null : maxUses - currentUses;

    return new Response(
      JSON.stringify({
        company: { 
          id: data.id, 
          name: data.name,
          logoUrl: data.logo_url,
          brandColor: data.brand_color,
          tagline: data.tagline,
        },
        inviteInfo: {
          remainingUses,
          expiresAt: data.invite_expires_at,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in get-company-by-invite:", error);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
