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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp }: PhoneLoginRequest = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone number and OTP are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify OTP first
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
      await supabase.from("phone_otps").delete().eq("phone", phone);
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if OTP matches
    if (otpRecord.otp_code !== otp) {
      const attempts = (otpRecord.attempts || 0) + 1;
      
      if (attempts >= 3) {
        await supabase.from("phone_otps").delete().eq("phone", phone);
        return new Response(
          JSON.stringify({ error: "Too many failed attempts. Please request a new code." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      await supabase.from("phone_otps").update({ attempts }).eq("phone", phone);
      return new Response(
        JSON.stringify({ error: `Invalid OTP. ${3 - attempts} attempts remaining.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // OTP is valid - delete it
    await supabase.from("phone_otps").delete().eq("phone", phone);

    // Get user by phone number
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, email")
      .eq("phone", phone)
      .single();

    if (profileError || !profileData) {
      console.log("No profile found for phone:", phone);
      return new Response(
        JSON.stringify({ error: "No account found with this phone number." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a magic link for the user (returns tokens)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profileData.email,
      options: {
        redirectTo: `${supabaseUrl.replace('.supabase.co', '')}/dashboard`,
      }
    });

    if (linkError || !linkData) {
      console.error("Failed to generate login link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate login session." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Phone login successful for:", phone);

    // Return the token hash for client-side verification
    return new Response(
      JSON.stringify({ 
        success: true, 
        email: profileData.email,
        token_hash: linkData.properties.hashed_token,
        verification_type: 'magiclink'
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in phone-login function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
