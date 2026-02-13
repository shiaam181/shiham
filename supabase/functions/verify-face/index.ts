import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyFaceRequest {
  referenceImage: string;
  capturedImage: string;
}

const AWS_REGION = "ap-south-1"; // Mumbai region
const FACE_MATCH_THRESHOLD = 90; // AWS Rekognition similarity threshold

/**
 * AWS Signature V4 signing for Rekognition API
 */
async function signAWSRequest(
  method: string,
  service: string,
  region: string,
  host: string,
  path: string,
  payload: string,
  accessKey: string,
  secretKey: string
): Promise<{ headers: Record<string, string>; url: string }> {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  const canonicalUri = path;
  const canonicalQuerystring = '';
  const payloadHash = await sha256Hex(payload);
  
  const canonicalHeaders = 
    `content-type:application/x-amz-json-1.1\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:RekognitionService.${service}\n`;
  
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  
  const canonicalRequest = 
    `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/rekognition/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
  
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, 'rekognition');
  const signature = await hmacHex(signingKey, stringToSign);
  
  const authorizationHeader = 
    `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': `RekognitionService.${service}`,
      'Authorization': authorizationHeader,
    },
    url: `https://${host}${path}`,
  };
}

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function hmacHex(key: ArrayBuffer, message: string): Promise<string> {
  const result = await hmacSha256(key, message);
  return Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode('AWS4' + key).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return await hmacSha256(kService, 'aws4_request');
}

/**
 * Compare two faces using AWS Rekognition CompareFaces API
 */
async function compareFaces(
  sourceImage: string,
  targetImage: string,
  accessKey: string,
  secretKey: string
): Promise<{ match: boolean; confidence: number; reason: string }> {
  const host = `rekognition.${AWS_REGION}.amazonaws.com`;
  const path = '/';
  
  // Remove data URL prefix if present
  const sourceBase64 = sourceImage.includes(',') ? sourceImage.split(',')[1] : sourceImage;
  const targetBase64 = targetImage.includes(',') ? targetImage.split(',')[1] : targetImage;
  
  const payload = JSON.stringify({
    SourceImage: { Bytes: sourceBase64 },
    TargetImage: { Bytes: targetBase64 },
    SimilarityThreshold: FACE_MATCH_THRESHOLD,
    QualityFilter: 'AUTO',
  });
  
  try {
    const { headers, url } = await signAWSRequest(
      'POST', 'CompareFaces', AWS_REGION, host, path, payload, accessKey, secretKey
    );
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Rekognition CompareFaces error:', data);
      
      // Handle specific error types
      if (data.__type?.includes('InvalidParameterException')) {
        if (data.Message?.includes('source')) {
          return { match: false, confidence: 0, reason: 'No face detected in reference image' };
        }
        if (data.Message?.includes('target')) {
          return { match: false, confidence: 0, reason: 'No face detected in captured image' };
        }
        return { match: false, confidence: 0, reason: 'Invalid image provided' };
      }
      
      return { match: false, confidence: 0, reason: 'Face comparison service error' };
    }
    
    const faceMatches = data.FaceMatches as Array<{ Similarity: number }> || [];
    
    if (faceMatches.length === 0) {
      const unmatchedFaces = data.UnmatchedFaces as Array<unknown> || [];
      if (unmatchedFaces.length > 0) {
        return { match: false, confidence: 0, reason: 'Face does not match registered photo' };
      }
      return { match: false, confidence: 0, reason: 'No matching face found' };
    }
    
    const bestMatch = faceMatches[0];
    const similarity = bestMatch.Similarity;
    
    console.log(`Face comparison result: similarity=${similarity.toFixed(1)}%`);
    
    return {
      match: similarity >= FACE_MATCH_THRESHOLD,
      confidence: Math.round(similarity),
      reason: similarity >= FACE_MATCH_THRESHOLD 
        ? 'Face verified successfully' 
        : `Face similarity too low (${Math.round(similarity)}%)`,
    };
  } catch (error) {
    console.error('CompareFaces exception:', error);
    return { match: false, confidence: 0, reason: 'Face verification failed' };
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token - REQUIRED for this endpoint
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the token
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    const awsAccessKey = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");

    if (!awsAccessKey || !awsSecretKey) {
      console.error("AWS credentials not configured");
      return new Response(
        JSON.stringify({ error: "Face verification service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { referenceImage, capturedImage }: VerifyFaceRequest = await req.json();

    if (!referenceImage || !capturedImage) {
      return new Response(
        JSON.stringify({ error: "Both reference and captured images are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate image format (must be valid data URLs or URLs)
    const isValidImageUrl = (url: string) => {
      return url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://');
    };

    if (!isValidImageUrl(referenceImage) || !isValidImageUrl(capturedImage)) {
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Face verification request from user ${user.id}`);

    // Compare faces using AWS Rekognition
    const result = await compareFaces(referenceImage, capturedImage, awsAccessKey, awsSecretKey);

    console.log(`Face verification result for user ${user.id}: match=${result.match}, confidence=${result.confidence}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Face verification error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Face verification failed",
        match: false,
        confidence: 0
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
