import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  phone: string;
  type?: 'signup' | 'login';
}

// Generate a 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, type = 'signup' }: SendOtpRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Twilio credentials from environment
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured. Please configure Twilio credentials in Developer Panel." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Store OTP in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing OTPs for this phone number
    await supabase
      .from("phone_otps")
      .delete()
      .eq("phone", phone);

    // Insert new OTP
    const { error: insertError } = await supabase
      .from("phone_otps")
      .insert({
        phone,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get SMS template from settings
    const { data: templateSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "sms_templates")
      .single();

    let messageBody: string;
    const templates = templateSettings?.value as { otp_signup?: string; otp_login?: string } | null;
    
    if (type === 'login' && templates?.otp_login) {
      messageBody = templates.otp_login.replace('{{OTP}}', otp);
    } else if (templates?.otp_signup) {
      messageBody = templates.otp_signup.replace('{{OTP}}', otp);
    } else {
      // Default template
      messageBody = `Your AttendanceHub verification code is: ${otp}. This code expires in 5 minutes.`;
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append("To", phone);
    formData.append("From", twilioPhoneNumber);
    formData.append("Body", messageBody);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioResult);
      
      // Clean up the OTP since SMS failed
      await supabase.from("phone_otps").delete().eq("phone", phone);
      
      return new Response(
        JSON.stringify({ error: twilioResult.message || "Failed to send SMS" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("OTP sent successfully to:", phone, "Message SID:", twilioResult.sid, "Type:", type);

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
