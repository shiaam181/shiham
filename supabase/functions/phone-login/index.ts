import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PhoneLoginRequest {
  phone: string;
  otp: string;
}

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS_PER_PHONE = 5;

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
    const { phone, otp }: PhoneLoginRequest = await req.json();

    // Input validation
    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone number and OTP are required" }),
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

    // Validate OTP format (8 digits)
    if (!/^\d{8}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the OTP from database
    const { data: otpRecord, error: fetchError } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", phone)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP not found for phone:", phone.slice(0, 4) + "****");
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (new Date() > expiresAt) {
      await supabase.from("phone_otps").delete().eq("phone", phone);
      
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const attempts = (otpRecord.attempts || 0) + 1;

    // Check if too many failed attempts
    if (attempts > MAX_LOGIN_ATTEMPTS_PER_PHONE) {
      await supabase.from("phone_otps").delete().eq("phone", phone);
      
      console.log(`Login locked for phone: ${phone.slice(0, 4)}**** after ${attempts} failed attempts`);
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
        .eq("phone", phone);
      
      const remainingAttempts = MAX_LOGIN_ATTEMPTS_PER_PHONE - attempts;
      
      return new Response(
        JSON.stringify({ error: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // OTP is valid - delete it
    await supabase.from("phone_otps").delete().eq("phone", phone);

    // Get user profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, email")
      .eq("phone", phone)
      .single();

    if (profileError || !profileData) {
      console.log("Profile not found for phone:", phone.slice(0, 4) + "****");
      return new Response(
        JSON.stringify({ error: "No account found with this phone number" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate magic link for the user
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profileData.email,
    });

    if (linkError || !linkData) {
      console.error("Magic link generation error:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate login link" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Phone login successful for:", phone.slice(0, 4) + "****");

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
    console.error("Error in phone-login function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
