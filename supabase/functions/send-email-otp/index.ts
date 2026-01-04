import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailOtpRequest {
  email: string;
  type?: 'verification' | 'login';
}

// Generate a cryptographically secure 6-digit OTP
function generateSecureOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const otp = (array[0] % 1000000).toString().padStart(6, '0');
  return otp;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type = 'verification' }: SendEmailOtpRequest = await req.json();

    // Input validation
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Resend API key - first from system settings, then env vars
    let resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Check system_settings for Resend config
    const { data: resendSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "resend_config")
      .maybeSingle();

    if (resendSettings?.value) {
      const config = resendSettings.value as { api_key?: string };
      if (config.api_key) resendApiKey = config.api_key;
    }
    
    if (!resendApiKey) {
      console.error("Resend API key not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured. Please add Resend API key in Developer Settings." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Rate limiting: Check if too many requests from this email
    const { data: existingOtp } = await supabase
      .from("phone_otps") // Reusing the same table for email OTPs
      .select("*")
      .eq("phone", email) // Using phone column for email
      .single();

    if (existingOtp) {
      const createdAt = new Date(existingOtp.created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      
      // Rate limit: 1 OTP per 60 seconds
      if (diffSeconds < 60) {
        const waitTime = Math.ceil(60 - diffSeconds);
        console.log(`Rate limit: Email ${email} must wait ${waitTime}s`);
        return new Response(
          JSON.stringify({ error: `Please wait ${waitTime} seconds before requesting a new code` }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      // Delete old OTP
      await supabase.from("phone_otps").delete().eq("phone", email);
    }

    // Generate OTP
    const otpCode = generateSecureOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("phone_otps")
      .insert({
        phone: email, // Using phone column for email
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate verification code" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email via Resend
    const subject = type === 'login' 
      ? 'Your Login Verification Code' 
      : 'Your Verification Code';
    
    const { error: emailError } = await resend.emails.send({
      from: "AttendanceHub <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 420px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">Verification Code</h1>
            <p style="color: #666; font-size: 14px; margin: 0 0 24px 0;">
              ${type === 'login' ? 'Use this code to log in:' : 'Use this code to verify your email:'}
            </p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1a1a1a;">${otpCode}</span>
            </div>
            
            <p style="color: #999; font-size: 12px; margin: 0;">
              This code expires in 10 minutes. If you didn't request this code, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      // Clean up the OTP if email fails
      await supabase.from("phone_otps").delete().eq("phone", email);
      return new Response(
        JSON.stringify({ error: "Failed to send verification email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`OTP sent successfully to email: ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent to your email" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-email-otp function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
