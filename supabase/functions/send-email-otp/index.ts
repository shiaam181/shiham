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
  // Use modulo to get exactly 6 digits (000000 to 999999)
  const otp = String(array[0] % 1000000).padStart(6, '0');
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

    // Email sending: use Resend (server-safe).
    // EmailJS frequently blocks non-browser/server calls, which causes OTP delivery to fail.
    let resendApiKey: string | null = null;

    const envResendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    if (envResendKey) resendApiKey = envResendKey;

    // Optional fallback (not recommended) in case the key was stored in system settings
    if (!resendApiKey) {
      const { data: resendSettings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "resend_config")
        .maybeSingle();

      if (resendSettings?.value) {
        const config = resendSettings.value as { api_key?: string };
        const candidate = (config.api_key ?? "").trim();
        if (candidate && candidate !== 'configured_via_backend') {
          resendApiKey = candidate;
        }
      }
    }

    console.log("Email service config:", {
      emailServiceType: 'resend',
      hasResend: !!resendApiKey,
      hasResendEnv: !!envResendKey,
    });

    if (!resendApiKey) {
      console.error("RESEND_API_KEY is missing");
      return new Response(
        JSON.stringify({
          error:
            "Email service not configured. Please add RESEND_API_KEY in the backend settings.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Rate limiting: Check if too many requests from this email
    const { data: existingOtp } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", email)
      .single();

    if (existingOtp) {
      const createdAt = new Date(existingOtp.created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      
      if (diffSeconds < 60) {
        const waitTime = Math.ceil(60 - diffSeconds);
        console.log(`Rate limit: Email ${email} must wait ${waitTime}s`);
        return new Response(
          JSON.stringify({ error: `Please wait ${waitTime} seconds before requesting a new code` }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      await supabase.from("phone_otps").delete().eq("phone", email);
    }

    // Generate 6-digit OTP
    const otpCode = generateSecureOtp();
    console.log(`Generated OTP for ${email}: ${otpCode.length} digits`);
    
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("phone_otps")
      .insert({
        phone: email,
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

    const subject = type === 'login' 
      ? 'Your Login Verification Code' 
      : 'Your Verification Code';

    // Send email via Resend
    const resend = new Resend(resendApiKey);

    const { error: emailError } = await resend.emails.send({
      from: "Zentrek <onboarding@resend.dev>",
      to: [email],
      subject,
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
      console.error("Error sending email via Resend:", emailError);
      await supabase.from("phone_otps").delete().eq("phone", email);

      const errorObj = emailError as { message?: string; statusCode?: number; name?: string };
      const isValidationError = errorObj.name === 'validation_error' || errorObj.statusCode === 403;
      const errorMessage = isValidationError
        ? "Email sending is blocked for this 'from' address. Please verify your sending domain and set a valid From address in your email provider."
        : "Failed to send verification email";

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`OTP sent successfully via Resend to: ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent to your email" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-email-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);