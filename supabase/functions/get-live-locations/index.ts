import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmployeeLocation {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  company_id: string;
  company_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Please sign in to view live locations", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT using getClaims (works with signing-keys)
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Your session has expired. Please sign in again", code: "INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const userRole = roleData?.role || "employee";
    const isDeveloper = userRole === "developer";
    const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

    if (!isDeveloper && !isOwnerOrAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "You need Owner, Admin, or Developer role to view live locations", code: "ACCESS_DENIED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's company ID (for non-developers)
    let companyFilter: string | null = null;
    
    if (!isDeveloper) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .single();
      
      companyFilter = profile?.company_id || null;
      
      // For owners/admins without a company, return empty locations (not an error)
      if (!companyFilter) {
        return new Response(
          JSON.stringify({ success: true, locations: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse query params or body for optional company filter (developers only)
    let requestedCompanyId: string | null = null;
    
    // Try URL params first
    const url = new URL(req.url);
    requestedCompanyId = url.searchParams.get("company_id");
    
    // If not in URL, try request body
    if (!requestedCompanyId && req.method === "POST") {
      try {
        const body = await req.json();
        requestedCompanyId = body?.company_id || null;
      } catch {
        // No body or invalid JSON, that's fine
      }
    }
    
    if (isDeveloper && requestedCompanyId) {
      companyFilter = requestedCompanyId;
    }

    // Get latest location per employee using a subquery approach
    // We use DISTINCT ON to get only the most recent location per user
    let query = supabase.rpc("get_latest_employee_locations", { 
      p_company_id: companyFilter 
    });

    // Since we can't use RPC without defining it, let's use a simpler approach:
    // Get all recent locations and filter in code
    let locationsQuery = supabase
      .from("employee_live_locations")
      .select("*")
      .order("recorded_at", { ascending: false })
      .gte("recorded_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (companyFilter) {
      locationsQuery = locationsQuery.eq("company_id", companyFilter);
    } else if (!isDeveloper) {
      // Non-developers without company filter should see nothing
      return new Response(
        JSON.stringify({ success: true, locations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Developers without filter see ALL locations (including null company_id)

    const { data: locations, error: locationsError } = await locationsQuery;

    if (locationsError) {
      console.error("Locations query error:", locationsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch locations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique latest location per user
    const latestByUser = new Map<string, typeof locations[0]>();
    for (const loc of locations || []) {
      if (!latestByUser.has(loc.user_id)) {
        latestByUser.set(loc.user_id, loc);
      }
    }

    const uniqueUserIds = Array.from(latestByUser.keys());

    if (uniqueUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, locations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, department, position, company_id")
      .in("user_id", uniqueUserIds);

    if (profilesError) {
      console.error("Profiles error:", profilesError);
    }

    const profilesMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    // Get company names for developer view
    let companiesMap = new Map<string, string>();
    if (isDeveloper) {
      const companyIds = Array.from(new Set((locations || []).map(l => l.company_id).filter(Boolean)));
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        
        companiesMap = new Map((companies || []).map(c => [c.id, c.name]));
      }
    }

    // Combine data
    const result: EmployeeLocation[] = [];
    for (const [userId, loc] of latestByUser) {
      const profile = profilesMap.get(userId);
      if (profile) {
        result.push({
          user_id: userId,
          full_name: profile.full_name,
          email: profile.email,
          department: profile.department,
          position: profile.position,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          speed: loc.speed,
          heading: loc.heading,
          recorded_at: loc.recorded_at,
          company_id: loc.company_id,
          company_name: isDeveloper ? companiesMap.get(loc.company_id) : undefined,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, locations: result }),
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
