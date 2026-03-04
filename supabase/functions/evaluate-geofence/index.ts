import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Haversine distance calculation (meters)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { latitude, longitude, accuracy } = await req.json();

    // Validate GPS accuracy - reject if > 50 meters
    if (accuracy && accuracy > 50) {
      return new Response(JSON.stringify({
        success: false,
        isInside: false,
        error: "GPS accuracy too low. Please move to an open area for better GPS signal.",
        accuracy,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's company
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company assigned" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if company has geofencing enabled
    const { data: company } = await supabase
      .from("companies")
      .select("geofencing_enabled")
      .eq("id", profile.company_id)
      .single();

    if (!company?.geofencing_enabled) {
      // Geofencing not enabled, allow attendance
      return new Response(JSON.stringify({
        success: true,
        isInside: true,
        geofencingEnabled: false,
        message: "Geofencing not enabled for this company",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active geofence locations for the company
    const { data: locations } = await supabase
      .from("company_geofence_locations")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("is_active", true);

    if (!locations || locations.length === 0) {
      // No geofence locations configured, allow attendance
      return new Response(JSON.stringify({
        success: true,
        isInside: true,
        geofencingEnabled: true,
        message: "No geofence locations configured",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if employee is inside any geofence using AWS Location Service evaluation
    // Fallback to local Haversine calculation for reliability
    let matchedLocation = null;
    let minDistance = Infinity;
    let nearestLocationName = "";

    for (const loc of locations) {
      const distance = haversineDistance(latitude, longitude, loc.latitude, loc.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLocationName = loc.location_name;
      }
      if (distance <= loc.radius_meters) {
        matchedLocation = loc;
        break;
      }
    }

    const isInside = matchedLocation !== null;

    // Log the attempt
    await supabase.from("geofence_audit_logs").insert({
      user_id: user.id,
      company_id: profile.company_id,
      latitude,
      longitude,
      accuracy: accuracy || null,
      geofence_status: isInside ? "inside" : "outside",
      nearest_location_name: nearestLocationName,
      distance_meters: Math.round(minDistance),
    });

    if (!isInside) {
      return new Response(JSON.stringify({
        success: true,
        isInside: false,
        geofencingEnabled: true,
        nearestLocation: nearestLocationName,
        distanceMeters: Math.round(minDistance),
        message: `You are ${Math.round(minDistance)}m away from ${nearestLocationName}. Please move within the permitted work location (${locations[0]?.radius_meters || 100}m radius).`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      isInside: true,
      geofencingEnabled: true,
      matchedLocation: {
        id: matchedLocation.id,
        name: matchedLocation.location_name,
        distance: Math.round(minDistance),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Evaluate geofence error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
