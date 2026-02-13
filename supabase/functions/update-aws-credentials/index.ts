import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AWS_REGION = "ap-south-1";

// AWS Signature V4 signing
async function sign(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(msg));
  return signature;
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await sign(encoder.encode("AWS4" + key).buffer as ArrayBuffer, dateStamp);
  const kRegion = await sign(kDate, regionName);
  const kService = await sign(kRegion, serviceName);
  const kSigning = await sign(kService, "aws4_request");
  return kSigning;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function testAwsCredentials(accessKeyId: string, secretAccessKey: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const service = "rekognition";
  const host = `rekognition.${AWS_REGION}.amazonaws.com`;
  const endpoint = `https://${host}`;
  
  // List collections to test connectivity
  const payload = JSON.stringify({ MaxResults: 1 });
  const amzTarget = "RekognitionService.ListCollections";
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  
  const canonicalUri = "/";
  const canonicalQuerystring = "";
  const payloadHash = await sha256(payload);
  
  const canonicalHeaders = 
    `content-type:application/x-amz-json-1.1\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${amzTarget}\n`;
  
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  
  const canonicalRequest = 
    `POST\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, AWS_REGION, service);
  const signatureBuffer = await sign(signingKey, stringToSign);
  const signature = arrayBufferToHex(signatureBuffer);
  
  const authorizationHeader = 
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Date": amzDate,
        "X-Amz-Target": amzTarget,
        "Authorization": authorizationHeader,
      },
      body: payload,
    });
    
    if (response.ok) {
      return { success: true, message: "AWS Rekognition credentials are valid" };
    }
    
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    
    if (errorData.__type?.includes("UnrecognizedClientException") || 
        errorData.__type?.includes("InvalidSignatureException") ||
        errorData.__type?.includes("AccessDeniedException")) {
      return { success: false, error: "Invalid AWS credentials or insufficient permissions" };
    }
    
    // Other errors might still indicate valid credentials (e.g., throttling)
    return { success: true, message: "AWS credentials valid (received expected API response)" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

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
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check if user has developer role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "developer") {
      return new Response(
        JSON.stringify({ success: false, error: "Only developers can manage AWS credentials" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { accessKeyId, secretAccessKey, action } = await req.json();

    if (action === "get") {
      // Return current credentials status (masked)
      const currentAccessKey = Deno.env.get("AWS_ACCESS_KEY_ID") || "";
      const currentSecretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY") || "";
      
      return new Response(
        JSON.stringify({
          success: true,
          configured: !!(currentAccessKey && currentSecretKey),
          accessKeyMasked: currentAccessKey ? `${currentAccessKey.substring(0, 8)}...` : "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      // Test the credentials by making a simple API call
      const testAccessKey = accessKeyId || Deno.env.get("AWS_ACCESS_KEY_ID");
      const testSecretKey = secretAccessKey || Deno.env.get("AWS_SECRET_ACCESS_KEY");

      if (!testAccessKey || !testSecretKey) {
        return new Response(
          JSON.stringify({ success: false, error: "No AWS credentials available to test" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const testResult = await testAwsCredentials(testAccessKey, testSecretKey);
      
      return new Response(
        JSON.stringify(testResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For "save" action - we can only store in system_settings since env vars are read-only
    if (action === "save") {
      await supabase.from("system_settings").upsert({
        key: "aws_rekognition_config",
        value: {
          configured: true,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
      }, { onConflict: "key" });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "AWS Rekognition configuration saved. Note: Actual credentials must be updated via Lovable Cloud secrets (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)." 
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
