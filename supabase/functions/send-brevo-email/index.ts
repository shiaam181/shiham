import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendEmailRequest {
  tenant_id?: string;
  to: string;
  to_name?: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
  metadata?: Record<string, string>;
}

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getBrevoCredentials(supabase: any): Promise<{ apiKey: string; defaultFromName: string; defaultFromEmail: string } | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "brevo_smtp_config")
    .maybeSingle();

  if (error || !data?.value) return null;

  const config = data.value as {
    smtp_api_key?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_username?: string;
    default_from_name?: string;
    default_from_email?: string;
  };

  const apiKey = config.smtp_api_key;
  if (!apiKey) return null;

  return {
    apiKey,
    defaultFromName: config.default_from_name || "HRMS Platform",
    defaultFromEmail: config.default_from_email || "noreply@hrms.app",
  };
}

async function getTenantEmailSettings(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from("tenant_email_settings")
    .select("*")
    .eq("company_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function getCompanyInfo(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("companies")
    .select("name, brand_color, logo_url")
    .eq("id", tenantId)
    .maybeSingle();
  return data;
}

async function sendViaBrevo(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  to: string,
  toName: string | undefined,
  subject: string,
  html: string,
  text: string | undefined,
  replyTo: string | undefined,
  category: string | undefined,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const body: any = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent: html,
  };

  if (text) body.textContent = text;
  if (replyTo) body.replyTo = { email: replyTo };
  if (category) body.tags = [category];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.messageId };
      }

      const errorText = await response.text();
      
      // Retry on 5xx errors
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        console.log(`Brevo API returned ${response.status}, retrying (attempt ${attempt + 1})...`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      return { success: false, error: `Brevo API error ${response.status}: ${errorText}` };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.log(`Network error, retrying (attempt ${attempt + 1})...`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return { success: false, error: `Network error: ${err.message}` };
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, to, to_name, subject, html, text, category, metadata }: SendEmailRequest = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get global Brevo credentials
    const credentials = await getBrevoCredentials(supabase);
    if (!credentials) {
      return new Response(
        JSON.stringify({ error: "Brevo SMTP not configured. Please configure in Developer Settings." }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let fromName = credentials.defaultFromName;
    let fromEmail = credentials.defaultFromEmail;
    let replyTo: string | undefined;

    // Apply tenant-specific settings if tenant_id provided
    if (tenant_id) {
      const tenantSettings = await getTenantEmailSettings(supabase, tenant_id);
      
      if (tenantSettings) {
        if (!tenantSettings.email_enabled) {
          return new Response(
            JSON.stringify({ error: "Email sending is disabled for this company" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        if (tenantSettings.from_name) fromName = tenantSettings.from_name;
        if (tenantSettings.from_email) fromEmail = tenantSettings.from_email;
        if (tenantSettings.reply_to_email) replyTo = tenantSettings.reply_to_email;
      }
    }

    // Send email
    const result = await sendViaBrevo(
      credentials.apiKey,
      fromEmail,
      fromName,
      to,
      to_name,
      subject,
      html,
      text,
      replyTo,
      category
    );

    // Log attempt (without secrets)
    console.log(`Email send ${result.success ? 'SUCCESS' : 'FAILED'}: to=${to}, subject="${subject.substring(0, 50)}", tenant=${tenant_id || 'global'}, messageId=${result.messageId || 'N/A'}`);

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error in send-brevo-email:", error.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
