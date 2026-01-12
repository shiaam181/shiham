import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackInviteUsageRequest {
  companyId: string;
  inviteCode: string;
  userId: string;
  userEmail: string;
  userName?: string;
}

interface AdminUser {
  email: string;
  full_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TrackInviteUsageRequest = await req.json();
    
    const { companyId, inviteCode, userId, userEmail, userName } = body;
    
    if (!companyId || !inviteCode || !userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IP and user agent from request headers
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Insert invite usage record
    const { error: insertError } = await supabase
      .from("invite_usage_history")
      .insert({
        company_id: companyId,
        invite_code: inviteCode,
        user_id: userId,
        user_email: userEmail,
        user_name: userName || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error("Error tracking invite usage:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to track invite usage" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get company name for the email
    const { data: companyData } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();

    const companyName = companyData?.name || "Your Company";

    // Get all admin/owner users for this company to notify them
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .eq("company_id", companyId);

    if (adminProfiles && adminProfiles.length > 0) {
      // Get user roles to filter for admins and owners
      const userIds = adminProfiles.map(p => p.user_id);
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .in("role", ["admin", "owner", "developer"]);

      if (adminRoles && adminRoles.length > 0) {
        const adminUserIds = new Set(adminRoles.map(r => r.user_id));
        const adminsToNotify: AdminUser[] = adminProfiles
          .filter(p => adminUserIds.has(p.user_id))
          .map(p => ({ email: p.email, full_name: p.full_name }));

        // Send email notifications
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey && adminsToNotify.length > 0) {
          const resend = new Resend(resendApiKey);
          const joinDate = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          for (const admin of adminsToNotify) {
            try {
              await resend.emails.send({
                from: "Attendance System <onboarding@resend.dev>",
                to: [admin.email],
                subject: `🎉 New Employee Joined: ${userName || userEmail}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">New Team Member! 🎉</h1>
                    </div>
                    <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">
                        Hi ${admin.full_name},
                      </p>
                      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">
                        A new employee has joined <strong>${companyName}</strong> using your invite link!
                      </p>
                      <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Name:</td>
                            <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${userName || "Not provided"}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email:</td>
                            <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${userEmail}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Joined:</td>
                            <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${joinDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invite Code:</td>
                            <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${inviteCode}</td>
                          </tr>
                        </table>
                      </div>
                      <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                        You can manage employee roles and permissions from your admin dashboard.
                      </p>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
                      This is an automated notification from your attendance management system.
                    </p>
                  </div>
                `,
              });
              console.log(`Notification email sent to ${admin.email}`);
            } catch (emailError) {
              console.error(`Failed to send email to ${admin.email}:`, emailError);
            }
          }
        } else {
          console.log("RESEND_API_KEY not configured or no admins to notify");
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in track-invite-usage:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
