import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetCompanyByInviteRequest {
  inviteCode?: string;
  invite?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GetCompanyByInviteRequest = await req.json().catch(() => ({}));
    const inviteCode = (body.inviteCode ?? body.invite ?? "").trim();

    if (!inviteCode) {
      return new Response(JSON.stringify({ error: "Invite code is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Basic sanity check (most invite codes here are hex-like)
    if (inviteCode.length < 6 || inviteCode.length > 64) {
      return new Response(JSON.stringify({ error: "Invalid invite code" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, is_active")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (error) {
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

    return new Response(
      JSON.stringify({ company: { id: data.id, name: data.name } }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "An error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
