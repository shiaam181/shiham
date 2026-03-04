import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

async function testAwsLocationCredentials(
  accessKeyId: string, 
  secretAccessKey: string,
  region: string,
  mapName: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const service = "geo";
  const host = `maps.geo.${region}.amazonaws.com`;
  const endpoint = `https://${host}/maps/v0/maps/${mapName}`;
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  
  const canonicalUri = `/maps/v0/maps/${mapName}`;
  const canonicalQuerystring = "";
  const payloadHash = await sha256("");
  
  const canonicalHeaders = 
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n`;
  
  const signedHeaders = "host;x-amz-date";
  
  const canonicalRequest = 
    `GET\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await sign(signingKey, stringToSign);
  const signature = arrayBufferToHex(signatureBuffer);
  
  const authorizationHeader = 
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-Amz-Date": amzDate,
        "Authorization": authorizationHeader,
      },
    });
    
    console.log(`AWS Location Service response status: ${response.status}`);
    
    if (response.ok) {
      return { success: true, message: "AWS Location Service credentials are valid and map exists" };
    }
    
    const errorText = await response.text();
    console.log(`AWS Location Service error: ${errorText}`);
    
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    
    if (response.status === 403) {
      return { success: false, error: "Invalid AWS credentials or insufficient permissions for Location Service" };
    }
    
    if (response.status === 404) {
      return { success: false, error: `Map '${mapName}' not found. Please verify the map name exists in AWS Location Service.` };
    }
    
    return { success: false, error: errorData.message || `HTTP ${response.status}: ${errorText}` };
  } catch (error) {
    console.error("AWS Location test error:", error);
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

    // Verify user via getClaims (works with signing-keys)
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check if user has developer or owner role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData || !["developer", "owner"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Only developers or owners can test AWS Location credentials" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = await req.json();

    if (action === "get" || action === "get-config") {
      // Return current credentials status
      const accessKey = Deno.env.get("AWS_ACCESS_KEY_ID") || "";
      const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY") || "";
      const region = Deno.env.get("AWS_REGION") || "";
      const mapName = Deno.env.get("AWS_LOCATION_MAP_NAME") || "";
      const placeIndexName = Deno.env.get("AWS_LOCATION_PLACE_INDEX") || "";
      
      return new Response(
        JSON.stringify({
          success: true,
          configured: !!(accessKey && secretKey && region && mapName),
          hasAccessKey: !!accessKey,
          hasSecretKey: !!secretKey,
          hasRegion: !!region,
          hasMapName: !!mapName,
          region: region || "Not set",
          mapName: mapName || "Not set",
          placeIndexName: placeIndexName || "Not set",
          accessKeyMasked: accessKey ? `${accessKey.substring(0, 8)}...` : "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      const accessKey = Deno.env.get("AWS_ACCESS_KEY_ID");
      const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
      const region = Deno.env.get("AWS_REGION");
      const mapName = Deno.env.get("AWS_LOCATION_MAP_NAME");

      if (!accessKey || !secretKey) {
        return new Response(
          JSON.stringify({ success: false, error: "AWS credentials not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to Cloud secrets." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!region) {
        return new Response(
          JSON.stringify({ success: false, error: "AWS_REGION not configured. Add it to Cloud secrets (e.g., ap-south-1)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!mapName) {
        return new Response(
          JSON.stringify({ success: false, error: "AWS_LOCATION_MAP_NAME not configured. Create a map in AWS Location Service and add its name to Cloud secrets." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const testResult = await testAwsLocationCredentials(accessKey, secretKey, region, mapName);
      
      return new Response(
        JSON.stringify(testResult),
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
