import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is a developer
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has developer role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleData?.role !== "developer") {
      return new Response(
        JSON.stringify({ success: false, error: "Only developers can update Face++ credentials" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, apiSecret, action } = await req.json();

    if (action === "get") {
      // Return current credentials (masked)
      const currentApiKey = Deno.env.get("FACEPP_API_KEY") || "";
      const currentApiSecret = Deno.env.get("FACEPP_API_SECRET") || "";
      
      return new Response(
        JSON.stringify({
          success: true,
          configured: !!(currentApiKey && currentApiSecret),
          apiKeyMasked: currentApiKey ? `${currentApiKey.substring(0, 8)}...` : "",
          apiSecretMasked: currentApiSecret ? `${currentApiSecret.substring(0, 4)}...` : "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      // Test the credentials by making a simple API call
      const testApiKey = apiKey || Deno.env.get("FACEPP_API_KEY");
      const testApiSecret = apiSecret || Deno.env.get("FACEPP_API_SECRET");

      if (!testApiKey || !testApiSecret) {
        return new Response(
          JSON.stringify({ success: false, error: "No Face++ credentials available to test" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Test by calling Face++ API (detect endpoint with minimal params)
      const formData = new FormData();
      formData.append("api_key", testApiKey);
      formData.append("api_secret", testApiSecret);

      // Use a simple 1x1 white pixel base64 image for testing connectivity
      const testImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      formData.append("image_base64", testImageBase64.split(",")[1]);

      const response = await fetch("https://api-us.faceplusplus.com/facepp/v3/detect", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      // Check if the API responded (even with no faces, it's a valid response)
      if (result.error_message && result.error_message.includes("AUTHORIZATION_ERROR")) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid API credentials" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (result.error_message && result.error_message.includes("RATE_LIMIT")) {
        return new Response(
          JSON.stringify({ success: true, message: "Credentials valid (rate limited but connected)" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Any other response means credentials are valid
      return new Response(
        JSON.stringify({ success: true, message: "Face++ API credentials are valid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For "save" action - we can only store in system_settings since env vars are read-only
    // The actual secrets need to be updated via Lovable Cloud secrets
    if (action === "save") {
      // Store a reference/placeholder in system_settings to track that it's configured
      await supabase.from("system_settings").upsert({
        key: "facepp_config",
        value: {
          configured: true,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
      }, { onConflict: "key" });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Face++ configuration saved. Note: Actual API keys must be updated via Lovable Cloud secrets (FACEPP_API_KEY and FACEPP_API_SECRET)." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
