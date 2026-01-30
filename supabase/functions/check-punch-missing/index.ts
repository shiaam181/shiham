import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STANDARD_WORK_DAY_MINUTES = 8 * 60; // 480 minutes (8 hours)
const MAX_SHIFT_HOURS = 24;

/**
 * This function checks for attendance records where:
 * - Check-in exists but no check-out
 * - More than 24 hours have passed since check-in
 * 
 * These records are marked as 'punch_missing' with no overtime calculated.
 * 
 * This should be run periodically (e.g., every hour via cron)
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff time (24 hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MAX_SHIFT_HOURS);
    const cutoffISO = cutoffTime.toISOString();

    console.log(`Checking for punch missing records with check-in before ${cutoffISO}`);

    // Find all attendance records with:
    // - check_in_time exists and is older than 24 hours
    // - check_out_time is null
    // - status is not already 'punch_missing'
    const { data: missingPunches, error: selectError } = await supabase
      .from("attendance")
      .select("id, user_id, date, check_in_time, status, admin_notes")
      .not("check_in_time", "is", null)
      .is("check_out_time", null)
      .lt("check_in_time", cutoffISO)
      .neq("status", "punch_missing");

    if (selectError) {
      console.error("Error fetching missing punches:", selectError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch records", details: selectError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${missingPunches?.length || 0} records with missing punches`);

    if (!missingPunches || missingPunches.length === 0) {
      return new Response(
        JSON.stringify({ message: "No missing punches found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update all found records
    let processedCount = 0;
    const errors: string[] = [];

    for (const record of missingPunches) {
      const { error: updateError } = await supabase
        .from("attendance")
        .update({
          status: "punch_missing",
          overtime_minutes: 0, // No OT for missing punch
          admin_notes: record.admin_notes 
            ? `${record.admin_notes}\n[System] Marked as punch missing - no checkout within 24 hours`
            : "[System] Marked as punch missing - no checkout within 24 hours",
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);

      if (updateError) {
        console.error(`Error updating record ${record.id}:`, updateError);
        errors.push(`Record ${record.id}: ${updateError.message}`);
      } else {
        processedCount++;
        console.log(`Updated record ${record.id} for user ${record.user_id} on ${record.date}`);
      }
    }

    const response = {
      message: `Processed ${processedCount} records with missing punches`,
      processed: processedCount,
      total: missingPunches.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Check punch missing completed:", response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Check punch missing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
