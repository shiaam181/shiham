import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateTokenRequest {
  action: "generate";
  tenant_id: string;
  user_id: string;
  purpose: "INVITE" | "RESET";
  created_by?: string;
  request_ip?: string;
  expires_hours?: number;
}

interface ValidateTokenRequest {
  action: "validate";
  raw_token: string;
  purpose: "INVITE" | "RESET";
  consume?: boolean;
}

// Rate limit: max tokens per user per purpose per hour
const RATE_LIMIT_PER_HOUR = 5;

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (body.action === "generate") {
      const { tenant_id, user_id, purpose, created_by, request_ip, expires_hours } = body as GenerateTokenRequest;

      if (!tenant_id || !user_id || !purpose) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Rate limit check
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("email_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user_id)
        .eq("purpose", purpose)
        .gte("created_at", oneHourAgo);

      if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait before requesting another token." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Invalidate previous active tokens for same user+purpose
      await supabase
        .from("email_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("purpose", purpose)
        .is("used_at", null);

      // Generate new token
      const rawToken = generateSecureToken();
      const tokenHash = await sha256(rawToken);

      const defaultExpiry = purpose === "INVITE" ? 24 : 1; // 24h for invite, 1h for reset
      const expiryHours = expires_hours || defaultExpiry;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase
        .from("email_tokens")
        .insert({
          tenant_id,
          user_id,
          token_hash: tokenHash,
          purpose,
          expires_at: expiresAt,
          created_by: created_by || null,
          request_ip: request_ip || null,
        });

      if (insertError) {
        console.error("Token insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to generate token" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Token generated: purpose=${purpose}, user=${user_id}, tenant=${tenant_id}`);

      return new Response(
        JSON.stringify({ success: true, raw_token: rawToken, expires_at: expiresAt }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else if (body.action === "validate") {
      const { raw_token, purpose, consume } = body as ValidateTokenRequest;

      if (!raw_token || !purpose) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const tokenHash = await sha256(raw_token);

      const { data: tokenRecord, error: fetchError } = await supabase
        .from("email_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .eq("purpose", purpose)
        .maybeSingle();

      // Generic error message to prevent enumeration
      const invalidResponse = new Response(
        JSON.stringify({ valid: false, error: "Invalid or expired token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

      if (fetchError || !tokenRecord) return invalidResponse;
      if (tokenRecord.used_at) return invalidResponse;
      if (new Date(tokenRecord.expires_at) < new Date()) return invalidResponse;

      // Consume token if requested
      if (consume) {
        await supabase
          .from("email_tokens")
          .update({ used_at: new Date().toISOString() })
          .eq("id", tokenRecord.id);
      }

      return new Response(
        JSON.stringify({
          valid: true,
          user_id: tokenRecord.user_id,
          tenant_id: tokenRecord.tenant_id,
          purpose: tokenRecord.purpose,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'generate' or 'validate'." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error in manage-email-tokens:", error.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
