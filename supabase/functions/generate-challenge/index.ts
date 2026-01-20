import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate a one-time challenge token for anti-replay protection during attendance.
 * Token expires in 2 minutes and can only be used once.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: 401, message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with the user's auth token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate the JWT using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Claims error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: 401, message: claimsError?.message || "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log(`Authenticated user: ${userId}`);

    // Use service role for database operations (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing valid challenge (prevent token flooding)
    const { data: existingChallenge } = await supabase
      .from("attendance_challenges")
      .select("id, token, expires_at")
      .eq("user_id", userId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If valid unused challenge exists, return it
    if (existingChallenge) {
      console.log(`Returning existing challenge for user ${userId}`);
      return new Response(
        JSON.stringify({
          token: existingChallenge.token,
          expires_at: existingChallenge.expires_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate cryptographically secure random token
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const challengeToken = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Token expires in 2 minutes
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    // Insert new challenge
    const { data: challenge, error: insertError } = await supabase
      .from("attendance_challenges")
      .insert({
        user_id: userId,
        token: challengeToken,
        expires_at: expiresAt.toISOString(),
      })
      .select("token, expires_at")
      .single();

    if (insertError) {
      console.error("Challenge insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate challenge" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generated new challenge for user ${userId}, expires at ${expiresAt.toISOString()}`);

    return new Response(
      JSON.stringify({
        token: challenge.token,
        expires_at: challenge.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Challenge generation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
