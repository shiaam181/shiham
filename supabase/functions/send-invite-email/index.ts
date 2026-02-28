import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteRequest {
  employee_email: string;
  employee_name: string;
  tenant_id: string;
  invited_by: string;
}

function getInviteEmailHtml(companyName: string, employeeName: string, activationLink: string, brandColor: string): string {
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
          <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Welcome aboard, ${employeeName}!</h2>
          <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
            You've been invited to join <strong>${companyName}</strong>. Click the button below to set up your account and get started.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${activationLink}" style="display:inline-block;background-color:${brandColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
              Activate Your Account
            </a>
          </td></tr></table>
          <p style="margin:0 0 8px;color:#71717a;font-size:13px;">This link expires in 24 hours.</p>
          <p style="margin:0;color:#a1a1aa;font-size:12px;">If you didn't expect this invitation, please ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
          <p style="margin:0;color:#a1a1aa;font-size:11px;">Can't click the button? Copy this link:<br/><a href="${activationLink}" style="color:${brandColor};word-break:break-all;">${activationLink}</a></p>
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
    const { employee_email, employee_name, tenant_id, invited_by }: InviteRequest = await req.json();

    if (!employee_email || !employee_name || !tenant_id || !invited_by) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id, registration_status, is_active")
      .eq("email", employee_email)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.user_id;
      // If already active, don't re-invite
      if (existingProfile.is_active && existingProfile.registration_status === 'approved') {
        return new Response(
          JSON.stringify({ error: "This employee is already active" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      // Create user account with a random temporary password (they'll set real one during activation)
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: employee_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: employee_name },
      });

      if (authError || !authData.user) {
        console.error("User creation error:", authError);
        return new Response(
          JSON.stringify({ error: authError?.message || "Failed to create user" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      userId = authData.user.id;

      // Wait for trigger to create profile
      await new Promise(r => setTimeout(r, 1500));

      // Update profile with tenant info
      await supabase
        .from("profiles")
        .update({
          full_name: employee_name,
          company_id: tenant_id,
          is_active: false,
          registration_status: "pending_activation",
        })
        .eq("user_id", userId);
    }

    // Generate invite token
    const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/manage-email-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: "generate",
        tenant_id,
        user_id: userId,
        purpose: "INVITE",
        created_by: invited_by,
        expires_hours: 24,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.success || !tokenData.raw_token) {
      return new Response(
        JSON.stringify({ error: tokenData.error || "Failed to generate invite token" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("name, brand_color")
      .eq("id", tenant_id)
      .maybeSingle();

    const companyName = company?.name || "HRMS Platform";
    const brandColor = company?.brand_color || "#0284c7";

    // Build activation link - use configurable APP_BASE_URL from system settings
    const { data: baseUrlSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "app_base_url")
      .maybeSingle();
    
    const appBaseUrl = (baseUrlSetting?.value as { url?: string })?.url
      || req.headers.get("origin")
      || "https://shiham.lovable.app";
    const activationLink = `${appBaseUrl.replace(/\/$/, "")}/activate?token=${tokenData.raw_token}`;

    // Send email via Brevo
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-brevo-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        tenant_id,
        to: employee_email,
        to_name: employee_name,
        subject: `You're invited to join ${companyName}`,
        html: getInviteEmailHtml(companyName, employee_name, activationLink, brandColor),
        text: `Welcome to ${companyName}! Activate your account: ${activationLink}`,
        category: "invite",
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResult.success) {
      console.error("Email send failed:", emailResult.error);
      return new Response(
        JSON.stringify({ error: "User created but failed to send invite email. " + (emailResult.error || "") }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Invite sent: employee=${employee_email}, company=${companyName}`);

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-invite-email:", error.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
