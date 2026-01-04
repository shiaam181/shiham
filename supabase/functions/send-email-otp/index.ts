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

    // Check which email service to use - prioritize EmailJS if configured
    let emailServiceType: 'emailjs' | 'resend' | null = null;
    let emailJSConfig: { service_id?: string; template_id?: string; public_key?: string } | null = null;
    let resendApiKey: string | null = null;

    // Check EmailJS config first (from system_settings only - it's a frontend service)
    const { data: emailJSSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "emailjs_config")
      .maybeSingle();

    if (emailJSSettings?.value) {
      const config = emailJSSettings.value as { service_id?: string; template_id?: string; public_key?: string };
      if (config.service_id && config.template_id && config.public_key) {
        emailJSConfig = config;
        emailServiceType = 'emailjs';
        console.log("Using EmailJS for email OTP");
      }
    }

    // Fallback to Resend if EmailJS not configured
    if (!emailServiceType) {
      resendApiKey = Deno.env.get("RESEND_API_KEY") || null;

      if (!resendApiKey) {
        const { data: resendSettings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "resend_config")
          .maybeSingle();

        if (resendSettings?.value) {
          const config = resendSettings.value as { api_key?: string };
          if (config.api_key && config.api_key !== 'configured_via_backend') {
            resendApiKey = config.api_key;
          }
        }
      }

      if (resendApiKey) {
        emailServiceType = 'resend';
        console.log("Using Resend for email OTP");
      }
    }

    console.log("Email service config:", { emailServiceType, hasEmailJS: !!emailJSConfig, hasResend: !!resendApiKey });
    
    if (!emailServiceType) {
      console.error("No email service configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured. Please configure EmailJS or Resend in Developer Settings." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
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

    // Send email based on configured service
    if (emailServiceType === 'emailjs' && emailJSConfig) {
      // For EmailJS, we need to use their REST API from the edge function
      try {
        const emailJSPayload = {
          service_id: emailJSConfig.service_id,
          template_id: emailJSConfig.template_id,
          user_id: emailJSConfig.public_key,
          template_params: {
            to_email: email,
            to_name: email.split('@')[0],
            otp_code: otpCode,
            subject: subject,
            message: `Your verification code is: ${otpCode}. This code expires in 10 minutes.`,
            // Support common EmailJS template variables
            verification_code: otpCode,
            code: otpCode,
          },
        };

        const emailJSResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailJSPayload),
        });

        if (!emailJSResponse.ok) {
          const errorText = await emailJSResponse.text();
          console.error("EmailJS error:", errorText);
          await supabase.from("phone_otps").delete().eq("phone", email);
          return new Response(
            JSON.stringify({ error: `EmailJS error: ${errorText}` }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        console.log(`OTP sent successfully via EmailJS to: ${email}`);
      } catch (emailError: any) {
        console.error("Error sending via EmailJS:", emailError);
        await supabase.from("phone_otps").delete().eq("phone", email);
        return new Response(
          JSON.stringify({ error: "Failed to send verification email via EmailJS" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else if (emailServiceType === 'resend' && resendApiKey) {
      // Use Resend
      const resend = new Resend(resendApiKey);
      
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
        console.error("Error sending email via Resend:", emailError);
        await supabase.from("phone_otps").delete().eq("phone", email);
        
        const errorObj = emailError as { message?: string; statusCode?: number; name?: string };
        const isValidationError = errorObj.name === 'validation_error' || errorObj.statusCode === 403;
        const errorMessage = isValidationError
          ? "Resend test domain (onboarding@resend.dev) only allows sending to your registered Resend email. Verify your domain at resend.com/domains OR configure EmailJS instead."
          : "Failed to send verification email via Resend";
        
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`OTP sent successfully via Resend to: ${email}`);
    }

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