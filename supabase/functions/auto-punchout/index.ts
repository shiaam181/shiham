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
    const { reason } = await req.json();

    // Check if auto punch-out on location off is enabled
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "auto_punchout_location_off")
      .single();

    const enabled = (setting?.value as { enabled?: boolean })?.enabled ?? false;
    if (!enabled) {
      return new Response(
        JSON.stringify({ success: false, error: "Auto punch-out on location off is not enabled." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find today's open attendance record
    const today = new Date().toISOString().split("T")[0];
    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("id, check_in_time, check_out_time")
      .eq("user_id", userId)
      .eq("date", today)
      .is("check_out_time", null)
      .maybeSingle();

    if (attError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch attendance record." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!attendance) {
      return new Response(
        JSON.stringify({ success: false, error: "No open attendance record found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto punch-out
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("attendance")
      .update({
        check_out_time: now,
        notes: reason || "Auto punch-out: Location services were turned off.",
        status: "present",
      })
      .eq("id", attendance.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to auto punch-out." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notification for the employee
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    await supabase.from("notifications").insert({
      user_id: userId,
      company_id: profile?.company_id || null,
      title: "Auto Punch-Out",
      message: "You were automatically punched out because your location services were turned off.",
      type: "attendance",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Auto punch-out completed.", check_out_time: now }),
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
