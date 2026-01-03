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
const MAX_CHECKS_PER_IP = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone }: CheckPhoneRequest = await req.json();

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Check rate limits using otp_rate_limits table
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

    const { data: ipRateLimits } = await supabase
      .from("otp_rate_limits")
      .select("request_count")
      .eq("ip_address", clientIp)
      .gte("first_request_at", oneHourAgo.toISOString());

    const totalIpRequests = ipRateLimits?.reduce((sum, r) => sum + (r.request_count || 0), 0) || 0;
    if (totalIpRequests >= MAX_CHECKS_PER_IP) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    console.log("Phone check for:", phone.slice(0, 4) + "****", "Exists:", exists, "IP:", clientIp);

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
