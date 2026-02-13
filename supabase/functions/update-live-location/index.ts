import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const { latitude, longitude, accuracy, speed, heading } = await req.json();

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, is_active")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not load your profile. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role - developers can track without a company
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const userRole = roleData?.role || "employee";
    const isDeveloper = userRole === "developer";

    if (!isDeveloper && !profile?.company_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Your account is not linked to a company. Please contact your administrator." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Your account is inactive. Please contact your administrator." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No consent check needed - tracking is managed by company/global settings

    // Check if global live tracking is enabled
    const { data: globalSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "live_tracking_enabled")
      .single();

    const globalEnabled = (globalSetting?.value as { enabled?: boolean })?.enabled ?? false;
    
    if (!globalEnabled) {
      return new Response(
        JSON.stringify({ success: false, error: "Live tracking is disabled by your administrator." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if company has live tracking enabled (skip for developers without company)
    let trackingInterval = 60;
    
    if (profile.company_id) {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("live_tracking_enabled, tracking_interval_seconds")
        .eq("id", profile.company_id)
        .single();

      if (companyError || !company?.live_tracking_enabled) {
        return new Response(
          JSON.stringify({ success: false, error: "Live tracking is not enabled for your company." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      trackingInterval = company.tracking_interval_seconds || 60;
    }

    // Insert the location record
    const { error: insertError } = await supabase
      .from("employee_live_locations")
      .insert({
        user_id: userId,
        company_id: profile.company_id,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        recorded_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to record location" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Location recorded",
        nextUpdateSeconds: trackingInterval
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
