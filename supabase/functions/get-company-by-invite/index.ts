import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetCompanyByInviteRequest {
  inviteCode?: string;
  invite?: string;
  incrementUsage?: boolean; // Set to true when actually signing up
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GetCompanyByInviteRequest = await req.json().catch(() => ({}));

    // Some apps/chat clients can mangle links (trailing punctuation, etc.).
    // Extract a safe invite token so valid invites don't get rejected.
    const rawInvite = String(body.inviteCode ?? body.invite ?? "").trim();
    const inviteCode = rawInvite.match(/[A-Za-z0-9_-]{6,64}/)?.[0] || "";

    const incrementUsage = body.incrementUsage === true;

    if (!inviteCode) {
      return new Response(JSON.stringify({ error: "Invite code is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Extra guardrail: keep the token size bounded.
    if (inviteCode.length < 6 || inviteCode.length > 64) {
      return new Response(JSON.stringify({ error: "Invalid invite code" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Check if invite has expired
    if (data.invite_expires_at) {
      const expiryDate = new Date(data.invite_expires_at);
      if (expiryDate < new Date()) {
        return new Response(JSON.stringify({ error: "This invite link has expired" }), {
          status: 410,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Check if invite has reached max uses
    const currentUses = data.invite_uses_count ?? 0;
    const maxUses = data.invite_max_uses; // null = unlimited
    if (maxUses !== null && currentUses >= maxUses) {
      return new Response(JSON.stringify({ error: "This invite link has reached its usage limit" }), {
        status: 410,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Increment usage if requested (during actual signup)
    if (incrementUsage) {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ invite_uses_count: currentUses + 1 })
        .eq("id", data.id);

      if (updateError) {
        console.error("Error incrementing invite usage:", updateError);
      }
    }

    // Calculate remaining uses
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
    return new Response(JSON.stringify({ error: error?.message || "An error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
