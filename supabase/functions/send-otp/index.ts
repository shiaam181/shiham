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

// Generate cryptographically secure 6-digit OTP
function generateSecureOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Generate 6-digit OTP (100000 to 999999)
  return String(100000 + (array[0] % 900000));
}

// Rate limiting constants
const MAX_OTP_PER_PHONE_PER_HOUR = 3;
const MAX_OTP_PER_IP_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { phone, type = 'login' }: SendOtpRequest = await req.json();
    phone = phone.replace(/\s+/g, '');

    // Input validation
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate phone format (basic E.164 validation)
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Ensure phone has + prefix for E.164 format (required by Twilio)
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }
    
    console.log(`Processing OTP request for phone: ${phone.slice(0, 5)}****`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Check rate limits
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

    // Check phone rate limit
    const { data: phoneRateData } = await supabase
      .from("otp_rate_limits")
      .select("*")
      .eq("phone", phone)
      .gte("first_request_at", oneHourAgo.toISOString())
      .maybeSingle();

    if (phoneRateData && phoneRateData.request_count >= MAX_OTP_PER_PHONE_PER_HOUR) {
      console.log(`Rate limit exceeded for phone: ${phone.slice(0, 4)}****`);
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check IP rate limit
    const { data: ipRateLimits } = await supabase
      .from("otp_rate_limits")
      .select("request_count")
      .eq("ip_address", clientIp)
      .gte("first_request_at", oneHourAgo.toISOString());

    const totalIpRequests = ipRateLimits?.reduce((sum, r) => sum + (r.request_count || 0), 0) || 0;
    if (totalIpRequests >= MAX_OTP_PER_IP_PER_HOUR) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: "Too many OTP requests from this location. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update rate limit tracking
    if (phoneRateData) {
      await supabase
        .from("otp_rate_limits")
        .update({ 
          request_count: phoneRateData.request_count + 1,
          last_request_at: now.toISOString(),
          ip_address: clientIp
        })
        .eq("id", phoneRateData.id);
    } else {
      await supabase
        .from("otp_rate_limits")
        .insert({ 
          phone, 
          ip_address: clientIp,
          request_count: 1,
          first_request_at: now.toISOString(),
          last_request_at: now.toISOString()
        });
    }

    // Clean up old rate limit records (older than 1 hour)
    await supabase
      .from("otp_rate_limits")
      .delete()
      .lt("first_request_at", oneHourAgo.toISOString());

    // Generate secure 6-digit OTP
    const otpCode = generateSecureOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database (upsert to replace any existing)
    await supabase.from("phone_otps").delete().eq("phone", phone);
    
    const { error: insertError } = await supabase
      .from("phone_otps")
      .insert({ 
        phone, 
        otp_code: otpCode, 
        expires_at: expiresAt.toISOString(),
        attempts: 0
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Twilio credentials - prioritize env vars (backend secrets)
    let twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    let twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    // Fallback to system_settings only if env vars not set
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      const { data: twilioSettings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "twilio_config")
        .maybeSingle();

      if (twilioSettings?.value) {
        const config = twilioSettings.value as { 
          account_sid?: string; 
          auth_token?: string; 
          phone_number?: string 
        };
        // Only use if not placeholder values
        if (config.account_sid && config.account_sid !== 'configured_via_backend') {
          twilioAccountSid = twilioAccountSid || config.account_sid;
        }
        if (config.auth_token && config.auth_token !== 'configured_via_backend') {
          twilioAuthToken = twilioAuthToken || config.auth_token;
        }
        if (config.phone_number && config.phone_number !== 'configured_via_backend') {
          twilioPhoneNumber = twilioPhoneNumber || config.phone_number;
        }
      }
    }

    console.log("Twilio config status:", {
      hasSid: !!twilioAccountSid,
      hasToken: !!twilioAuthToken,
      hasPhone: !!twilioPhoneNumber
    });

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      // In development, log OTP for testing (never in production)
      console.log(`[DEV] OTP for ${phone.slice(0, 4)}****: ${otpCode}`);
      return new Response(
        JSON.stringify({ success: true, message: "OTP generated (SMS not configured)" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get SMS template from settings or use default
    const { data: templateSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "sms_templates")
      .maybeSingle();

    let messageBody = `Your verification code is: ${otpCode}. Valid for 5 minutes.`;
    if (templateSettings?.value) {
      const templates = templateSettings.value as { otp_signup?: string; otp_login?: string };
      if (type === 'login' && templates.otp_login) {
        messageBody = templates.otp_login.replace('{{OTP}}', otpCode);
      } else if (templates.otp_signup) {
        messageBody = templates.otp_signup.replace('{{OTP}}', otpCode);
      }
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const smsResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioPhoneNumber,
        Body: messageBody,
      }),
    });

    if (!smsResponse.ok) {
      const errorText = await smsResponse.text();
      console.error("Twilio SMS error:", errorText);
      // Clean up OTP on failure
      await supabase.from("phone_otps").delete().eq("phone", phone);
      
      // Parse Twilio error for better user messaging
      let userMessage = "Failed to send SMS. Please try again.";
      try {
        const twilioError = JSON.parse(errorText);
        if (twilioError.code === 21408) {
          userMessage = "SMS delivery to this region is not enabled. Please contact administrator or use email verification.";
        } else if (twilioError.code === 21211) {
          userMessage = "Invalid phone number format. Please check and try again.";
        } else if (twilioError.code === 21614) {
          userMessage = "This phone number cannot receive SMS. Please use a different number.";
        }
      } catch (e) {
        // Keep default message
      }
      
      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`OTP sent successfully to ${phone.slice(0, 4)}**** from IP ${clientIp}`);

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
