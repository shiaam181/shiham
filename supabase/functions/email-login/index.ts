import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailLoginRequest {
  email: string;
  otp: string;
}

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS = 5;

// Constant-time string comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp }: EmailLoginRequest = await req.json();

    // Input validation
    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the OTP from database (phone_otps table stores email OTPs too using "phone" column)
    const { data: otpRecord, error: fetchError } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", email)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP not found for email:", email);
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (new Date() > expiresAt) {
      await supabase.from("phone_otps").delete().eq("phone", email);
      
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const attempts = (otpRecord.attempts || 0) + 1;

    // Check if too many failed attempts
    if (attempts > MAX_LOGIN_ATTEMPTS) {
      await supabase.from("phone_otps").delete().eq("phone", email);
      
      console.log(`Login locked for email: ${email} after ${attempts} failed attempts`);
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please wait before requesting a new code." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use constant-time comparison to prevent timing attacks
    const isValidOtp = constantTimeCompare(otpRecord.otp_code, otp);

    if (!isValidOtp) {
      await supabase
        .from("phone_otps")
        .update({ attempts })
        .eq("phone", email);
      
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;
      
      return new Response(
        JSON.stringify({ error: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // OTP is valid - delete it
    await supabase.from("phone_otps").delete().eq("phone", email);

    // Get user profile to verify account exists
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, email")
      .eq("email", email)
      .single();

    if (profileError || !profileData) {
      console.log("Profile not found for email:", email);
      return new Response(
        JSON.stringify({ error: "No account found with this email" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate magic link token for the user (this is used internally, not sent via email)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profileData.email,
    });

    if (linkError || !linkData) {
      console.error("Magic link generation error:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate login session" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email OTP login successful for:", email);

    // Return the token_hash so the client can verify it directly (no email sent)
    return new Response(
      JSON.stringify({ 
        success: true, 
        email: profileData.email,
        token_hash: linkData.properties?.hashed_token,
        verification_type: 'magiclink'
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in email-login function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
