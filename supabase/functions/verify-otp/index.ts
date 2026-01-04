import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

// Rate limiting constants
const MAX_VERIFY_ATTEMPTS_PER_PHONE = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { phone, otp }: VerifyOtpRequest = await req.json();
    phone = phone.replace(/\s+/g, '');

    // Input validation
    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone number and OTP are required" }),
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

    // Get the OTP from database
    const { data: otpRecord, error: fetchError } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", phone)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP not found for phone:", phone);
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (new Date() > expiresAt) {
      // Delete expired OTP
      await supabase.from("phone_otps").delete().eq("phone", phone);
      
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const attempts = (otpRecord.attempts || 0) + 1;

    // Check if too many failed attempts
    if (attempts > MAX_VERIFY_ATTEMPTS_PER_PHONE) {
      // Delete OTP and implement lockout
      await supabase.from("phone_otps").delete().eq("phone", phone);
      
      console.log(`Account locked for phone: ${phone} after ${attempts} failed attempts`);
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please wait 15 minutes before requesting a new code." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use constant-time comparison to prevent timing attacks
    const isValidOtp = constantTimeCompare(otpRecord.otp_code, otp);

    if (!isValidOtp) {
      // Update attempts count with exponential backoff hint
      await supabase
        .from("phone_otps")
        .update({ attempts })
        .eq("phone", phone);
      
      const remainingAttempts = MAX_VERIFY_ATTEMPTS_PER_PHONE - attempts;
      
      console.log(`Invalid OTP attempt for phone: ${phone}, attempts: ${attempts}`);
      return new Response(
        JSON.stringify({ error: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // OTP is valid - delete it
    await supabase.from("phone_otps").delete().eq("phone", phone);

    console.log("OTP verified successfully for phone:", phone);

    return new Response(
      JSON.stringify({ success: true, verified: true, message: "Phone number verified successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

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

serve(handler);
