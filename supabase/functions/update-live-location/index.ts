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
    // Authenticate user
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

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !claims.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.user.id;

    // Parse request body
    const { latitude, longitude, accuracy, speed, heading } = await req.json();

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee profile to find their company
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, is_active")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Employee not associated with a company" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Employee account is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if employee has consented to location tracking
    const { data: consent, error: consentError } = await supabase
      .from("employee_consent")
      .select("location_tracking_consented")
      .eq("user_id", userId)
      .single();

    if (consentError || !consent?.location_tracking_consented) {
      return new Response(
        JSON.stringify({ success: false, error: "Location tracking consent not given" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if global live tracking is enabled
    const { data: globalSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "live_tracking_enabled")
      .single();

    const globalEnabled = (globalSetting?.value as { enabled?: boolean })?.enabled ?? false;
    
    if (!globalEnabled) {
      return new Response(
        JSON.stringify({ success: false, error: "Live tracking is globally disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if company has live tracking enabled
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("live_tracking_enabled, tracking_interval_seconds")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company?.live_tracking_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: "Company has not enabled live tracking" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Optionally check if current time is within work hours
    // This would require shift information from the employee's profile

    // Insert the location record (company_id derived server-side for security)
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
        nextUpdateSeconds: company.tracking_interval_seconds || 60
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
