import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResetRequest {
  email: string;
  request_ip?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function getConfiguredBaseUrl(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string" && value.trim()) {
    return normalizeBaseUrl(value);
  }

  if (typeof value === "object" && value !== null) {
    const url = (value as { url?: string }).url;
    if (url && url.trim()) return normalizeBaseUrl(url);
  }

  return null;
}

function toOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLovableDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "lovable.dev" || host.endsWith(".lovable.dev") || host.endsWith(".lovable.app");
  } catch {
    return true;
  }
}

function resolveAppBaseUrl(req: Request, settingValue: unknown): string | null {
  const configured = getConfiguredBaseUrl(settingValue);
  if (configured) return configured;

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    const fromForwarded = normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);
    if (!isLovableDomain(fromForwarded)) return fromForwarded;
  }

  const fromOrigin = toOrigin(req.headers.get("origin"));
  if (fromOrigin && !isLovableDomain(fromOrigin)) return normalizeBaseUrl(fromOrigin);

  const fromReferer = toOrigin(req.headers.get("referer"));
  if (fromReferer && !isLovableDomain(fromReferer)) return normalizeBaseUrl(fromReferer);

  return null;
}

function getResetEmailHtml(companyName: string, resetLink: string, brandColor: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <tr><td style="background-color:${brandColor};padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;">${companyName}</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Reset Your Password</h2>
          <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
            We received a request to reset your password. Click the button below to set a new password.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${resetLink}" style="display:inline-block;background-color:${brandColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
              Reset Password
            </a>
          </td></tr></table>
          <p style="margin:0 0 8px;color:#71717a;font-size:13px;">This link expires in 1 hour.</p>
          <p style="margin:0;color:#a1a1aa;font-size:12px;">If you didn't request this, your account is safe — just ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
          <p style="margin:0;color:#a1a1aa;font-size:11px;">Can't click the button? Copy this link:<br/><a href="${resetLink}" style="color:${brandColor};word-break:break-all;">${resetLink}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, request_ip }: ResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Always return success to prevent user enumeration
    const successResponse = new Response(
      JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists and is active
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, company_id, is_active, registration_status")
      .eq("email", email)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      // Return success anyway (no enumeration)
      return successResponse;
    }

    // Get company info for branding
    let companyName = "HRMS Platform";
    let brandColor = "#0284c7";

    if (profile.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name, brand_color")
        .eq("id", profile.company_id)
        .maybeSingle();
      if (company) {
        companyName = company.name;
        brandColor = company.brand_color || brandColor;
      }
    }

    // Generate reset token
    const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/manage-email-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: "generate",
        tenant_id: profile.company_id || "00000000-0000-0000-0000-000000000000",
        user_id: profile.user_id,
        purpose: "RESET",
        request_ip,
        expires_hours: 1,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.success) {
      console.error("Reset token generation failed:", tokenData.error);
      // Still return success to prevent enumeration
      return successResponse;
    }

    // Build reset link - use configurable APP_BASE_URL from system settings
    const { data: baseUrlSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "app_base_url")
      .maybeSingle();
    
    const appBaseUrl = (baseUrlSetting?.value as { url?: string })?.url
      || req.headers.get("origin")
      || "https://shiham.lovable.app";
    const resetLink = `${appBaseUrl.replace(/\/$/, "")}/reset-password?token=${tokenData.raw_token}`;

    // Send email via Brevo
    await fetch(`${supabaseUrl}/functions/v1/send-brevo-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        tenant_id: profile.company_id,
        to: email,
        to_name: profile.full_name,
        subject: `Reset your ${companyName} password`,
        html: getResetEmailHtml(companyName, resetLink, brandColor),
        text: `Reset your password: ${resetLink}`,
        category: "password_reset",
      }),
    });

    return successResponse;
  } catch (error: any) {
    console.error("Error in send-reset-email-brevo:", error.message);
    // Still return success to prevent enumeration
    return new Response(
      JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
