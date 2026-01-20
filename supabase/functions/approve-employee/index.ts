import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ApproveEmployeeRequest = {
  employeeUserId?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ApproveEmployeeRequest = await req.json().catch(() => ({}));
    const employeeUserId = String(body.employeeUserId ?? "").trim();

    if (!employeeUserId) {
      return new Response(JSON.stringify({ error: "employeeUserId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1) Validate JWT using client with auth header
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requesterUserId = user.id;
    console.log(`Authenticated user: ${requesterUserId}`);

    if (requesterUserId === employeeUserId) {
      return new Response(JSON.stringify({ error: "You cannot approve yourself" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2) Server-side authorization with service role
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: requesterRole, error: requesterRoleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterUserId)
      .in("role", ["owner", "developer", "admin"])
      .maybeSingle();

    if (requesterRoleError) {
      console.error("approve-employee: role lookup error", requesterRoleError);
      return new Response(JSON.stringify({ error: "Authorization failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!requesterRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get requester's company (developers can manage any company)
    const isDeveloper = requesterRole.role === 'developer';
    
    const { data: requesterProfile, error: requesterProfileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", requesterUserId)
      .maybeSingle();

    if (requesterProfileError) {
      console.error("approve-employee: requester profile error", requesterProfileError);
      return new Response(JSON.stringify({ error: "Failed to load requester profile" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requesterCompanyId = requesterProfile?.company_id;
    
    // Non-developers must have a company
    if (!isDeveloper && !requesterCompanyId) {
      return new Response(JSON.stringify({ error: "Requester has no company" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: employeeProfile, error: employeeProfileError } = await supabase
      .from("profiles")
      .select("company_id, is_active, full_name")
      .eq("user_id", employeeUserId)
      .maybeSingle();

    if (employeeProfileError) {
      console.error("approve-employee: employee profile error", employeeProfileError);
      return new Response(JSON.stringify({ error: "Failed to load employee profile" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!employeeProfile) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Developers can approve any employee, owners/admins only their company
    if (!isDeveloper && employeeProfile.company_id !== requesterCompanyId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (employeeProfile.is_active === true) {
      return new Response(
        JSON.stringify({ ok: true, message: "Employee already approved" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: true, registration_status: "approved" })
      .eq("user_id", employeeUserId);

    if (updateError) {
      console.error("approve-employee: update error", updateError);
      return new Response(JSON.stringify({ error: "Failed to approve employee" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Employee ${employeeUserId} approved by ${requesterUserId}`);

    return new Response(
      JSON.stringify({ ok: true, employeeUserId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("approve-employee: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
