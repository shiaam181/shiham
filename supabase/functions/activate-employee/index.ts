import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ActivateRequest {
  user_id: string;
  password: string;
  tenant_id: string;
  token?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, password, tenant_id, token }: ActivateRequest = await req.json();

    if (!user_id || !password) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or password" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("user_id, is_active, registration_status")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileFetchError) {
      console.error("Profile fetch error:", profileFetchError);
      return new Response(
        JSON.stringify({ error: "Could not verify this invitation. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "This invited account could not be found. Please ask your administrator to send a new invitation." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (profile.is_active || profile.registration_status === "approved") {
      return new Response(
        JSON.stringify({ error: "Account activated. Please sign in with your password." }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (profile.registration_status !== "pending_activation") {
      return new Response(
        JSON.stringify({ error: "This invitation is no longer valid. Please ask your administrator to send a new one." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
      password,
    });

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message || "Failed to set password" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Activate user profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        is_active: true,
        registration_status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to activate profile. Please contact your administrator." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (token) {
      const consumeResponse = await fetch(`${supabaseUrl}/functions/v1/manage-email-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          action: "validate",
          raw_token: token,
          purpose: "INVITE",
          consume: true,
        }),
      });

      const consumeResult = await consumeResponse.json();
      if (!consumeResult?.valid) {
        console.warn("Invite token could not be consumed after activation:", consumeResult?.error);
      }
    }

    console.log(`Employee activated: user_id=${user_id}, tenant=${tenant_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in activate-employee:", error.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
