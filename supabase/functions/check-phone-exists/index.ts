import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckPhoneRequest {
  phone: string;
}

// Rate limiting to prevent enumeration
const MAX_CHECKS_PER_USER = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token - require authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with service role for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user is authenticated
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseAuth.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      console.log("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    let { phone }: CheckPhoneRequest = await req.json();
    phone = phone.replace(/\s+/g, '');

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate phone format
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limits per user (not IP)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

    const { data: userRateLimits } = await supabase
      .from("otp_rate_limits")
      .select("request_count")
      .eq("phone", `check_${user.id}`)
      .gte("first_request_at", oneHourAgo.toISOString());

    const totalUserRequests = userRateLimits?.reduce((sum, r) => sum + (r.request_count || 0), 0) || 0;
    if (totalUserRequests >= MAX_CHECKS_PER_USER) {
      console.log(`Rate limit exceeded for user: ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Track this check for rate limiting
    await supabase.from("otp_rate_limits").upsert({
      phone: `check_${user.id}`,
      ip_address: null,
      request_count: totalUserRequests + 1,
      first_request_at: oneHourAgo.toISOString(),
      last_request_at: now.toISOString()
    }, { onConflict: "phone" });

    // Check if user exists with this phone number (using service role to bypass RLS)
    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.error("Error checking phone:", error);
      return new Response(
        JSON.stringify({ error: "Failed to check phone number" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const exists = !!profileData;
    
    // Add artificial delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    console.log("Phone check for:", phone.slice(0, 4) + "****", "Exists:", exists, "User:", user.id);

    return new Response(
      JSON.stringify({ exists }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-phone-exists function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
