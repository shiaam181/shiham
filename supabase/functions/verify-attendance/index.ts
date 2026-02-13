import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VerifyAttendanceRequest {
  challenge_token: string;
  captured_image: string; // Base64 data URL from live camera
  latitude: number;
  longitude: number;
  gps_timestamp: string; // ISO timestamp when GPS was captured
  action: 'check-in' | 'check-out';
}

const AWS_REGION = "ap-south-1"; // Mumbai region
const FACE_MATCH_THRESHOLD = 90; // AWS Rekognition similarity threshold (0-100)
const GPS_FRESHNESS_MS = 30000; // GPS must be within 30 seconds
const GPS_CLOCK_SKEW_MS = 5000; // Allow 5s clock skew

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
 * Call AWS Rekognition API
 */
async function callRekognition(
  operation: string,
  payload: Record<string, unknown>,
  accessKey: string,
  secretKey: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const host = `rekognition.${AWS_REGION}.amazonaws.com`;
  const path = '/';
  const payloadStr = JSON.stringify(payload);
  
  try {
    const { headers, url } = await signAWSRequest(
      'POST', operation, AWS_REGION, host, path, payloadStr, accessKey, secretKey
    );
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadStr,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Rekognition ${operation} error:`, data);
      return { success: false, error: data.Message || data.__type || 'Rekognition API error' };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error(`Rekognition ${operation} exception:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Detect face in captured image
 */
async function detectFace(
  imageBase64: string,
  accessKey: string,
  secretKey: string
): Promise<{ valid: boolean; error?: string }> {
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const result = await callRekognition('DetectFaces', {
    Image: { Bytes: base64Data },
    Attributes: ['DEFAULT'],
  }, accessKey, secretKey);
  
  if (!result.success) {
    return { valid: false, error: result.error };
  }
  
  const faces = result.data?.FaceDetails as Array<{
    Confidence?: number;
    Pose?: { Pitch?: number; Roll?: number; Yaw?: number };
    BoundingBox?: { Width?: number; Height?: number };
  }> || [];
  
  if (faces.length === 0) {
    return { valid: false, error: 'No face detected in image' };
  }
  
  // Rekognition may detect background posters/reflections as faces.
  // Pick the dominant (largest) face and only reject if a secondary face is comparably large.
  const faceAreas = faces
    .map((f, idx) => {
      const w = f.BoundingBox?.Width ?? 0;
      const h = f.BoundingBox?.Height ?? 0;
      return { idx, area: w * h };
    })
    .sort((a, b) => b.area - a.area);

  const primaryArea = faceAreas[0].area;
  const primaryFace = faces[faceAreas[0].idx];

  if (faces.length > 1) {
    const secondArea = faceAreas[1]?.area ?? 0;
    if (primaryArea > 0 && secondArea / primaryArea > 0.35) {
      return { valid: false, error: 'Multiple clear faces detected - please ensure only your face is in frame' };
    }
  }
  
  // Check for extreme head poses (potential static image)
  if (primaryFace.Pose) {
    const { Pitch, Roll, Yaw } = primaryFace.Pose;
    if (Math.abs(Pitch || 0) > 30 || Math.abs(Roll || 0) > 30 || Math.abs(Yaw || 0) > 40) {
      return { valid: false, error: 'Please face the camera directly' };
    }
  }
  
  return { valid: true };
}

/**
 * Search face against user's collection
 */
async function searchFaceInCollection(
  imageBase64: string,
  collectionId: string,
  accessKey: string,
  secretKey: string
): Promise<{ match: boolean; confidence: number; faceId?: string; error?: string }> {
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const result = await callRekognition('SearchFacesByImage', {
    CollectionId: collectionId,
    Image: { Bytes: base64Data },
    MaxFaces: 1,
    FaceMatchThreshold: FACE_MATCH_THRESHOLD,
    QualityFilter: 'AUTO',
  }, accessKey, secretKey);
  
  if (!result.success) {
    // Check for specific error types
    if (result.error?.includes('InvalidParameterException')) {
      return { match: false, confidence: 0, error: 'No face detected in captured image' };
    }
    return { match: false, confidence: 0, error: result.error };
  }
  
  const faceMatches = result.data?.FaceMatches as Array<{
    Similarity: number;
    Face: { FaceId: string; ExternalImageId?: string };
  }> || [];
  
  if (faceMatches.length === 0) {
    return { match: false, confidence: 0, error: 'No matching face found' };
  }
  
  const bestMatch = faceMatches[0];
  const similarity = bestMatch.Similarity;
  
  console.log(`Face search result: similarity=${similarity.toFixed(1)}%, threshold=${FACE_MATCH_THRESHOLD}%`);
  
  return {
    match: similarity >= FACE_MATCH_THRESHOLD,
    confidence: Math.round(similarity),
    faceId: bestMatch.Face.FaceId,
  };
}

/**
 * Production-grade attendance verification with AWS Rekognition:
 * 1. Validates challenge token (anti-replay)
 * 2. Validates GPS coordinates and timestamp freshness
 * 3. Detects face in captured image
 * 4. Searches against user's registered faces in collection
 * 5. Only marks attendance if ALL validations pass
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const awsAccessKey = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");

    if (!awsAccessKey || !awsSecretKey) {
      console.error("AWS credentials not configured");
      return new Response(
        JSON.stringify({ error: "Face verification service not configured", code: "SERVICE_NOT_CONFIGURED" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsData, error: authError } = await supabaseAuth.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    const body: VerifyAttendanceRequest = await req.json();
    const { challenge_token, captured_image, latitude, longitude, gps_timestamp, action } = body;

    // === INPUT VALIDATION ===
    if (!challenge_token) {
      return new Response(
        JSON.stringify({ error: "Challenge token is required", code: "MISSING_CHALLENGE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!captured_image || !captured_image.startsWith('data:image/')) {
      return new Response(
        JSON.stringify({ error: "Live camera image is required", code: "INVALID_IMAGE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (latitude === undefined || longitude === undefined || latitude === 0 || longitude === 0) {
      return new Response(
        JSON.stringify({ error: "Valid GPS coordinates are required", code: "MISSING_GPS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!gps_timestamp) {
      return new Response(
        JSON.stringify({ error: "GPS timestamp is required", code: "MISSING_GPS_TIMESTAMP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate GPS timestamp is fresh
    const gpsTime = new Date(gps_timestamp).getTime();
    const now = Date.now();
    const gpsAge = now - gpsTime;
    if (gpsAge > GPS_FRESHNESS_MS || gpsAge < -GPS_CLOCK_SKEW_MS) {
      return new Response(
        JSON.stringify({ error: "GPS data is stale. Please refresh location.", code: "STALE_GPS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!['check-in', 'check-out'].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action", code: "INVALID_ACTION" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Attendance verification for user ${user.id}: action=${action}`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === STEP 1: Validate challenge token (anti-replay) ===
    const { data: challenge, error: challengeError } = await supabase
      .from("attendance_challenges")
      .select("*")
      .eq("token", challenge_token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (challengeError || !challenge) {
      console.error("Challenge not found:", challengeError);
      return new Response(
        JSON.stringify({ error: "Invalid challenge token", code: "INVALID_CHALLENGE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(challenge.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Challenge token expired. Please request a new one.", code: "EXPIRED_CHALLENGE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (challenge.used_at) {
      return new Response(
        JSON.stringify({ error: "Challenge token already used. Request a new one.", code: "USED_CHALLENGE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark challenge as used immediately (anti-replay)
    await supabase
      .from("attendance_challenges")
      .update({ used_at: new Date().toISOString() })
      .eq("id", challenge.id);

    console.log(`Challenge ${challenge.id} validated and marked as used`);

    // === STEP 2: Get user's collection ID ===
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("face_embedding")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.face_embedding) {
      console.error("No face registered:", profileError);
      return new Response(
        JSON.stringify({ error: "Face not registered. Please complete face setup first.", code: "NO_FACE_REGISTERED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const faceEmbedding = profile.face_embedding as { collection_id?: string; provider?: string };
    
    if (faceEmbedding.provider !== 'aws_rekognition' || !faceEmbedding.collection_id) {
      return new Response(
        JSON.stringify({ error: "Face registration outdated. Please re-register your face.", code: "FACE_OUTDATED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const collectionId = faceEmbedding.collection_id;
    console.log(`Using collection: ${collectionId}`);

    // === STEP 3: Detect face in captured image ===
    const detection = await detectFace(captured_image, awsAccessKey, awsSecretKey);
    
    if (!detection.valid) {
      return new Response(
        JSON.stringify({ 
          error: detection.error || "Face detection failed",
          code: "FACE_DETECTION_FAILED"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Face detected in captured image');

    // === STEP 4: Search face against registered faces ===
    const searchResult = await searchFaceInCollection(
      captured_image, collectionId, awsAccessKey, awsSecretKey
    );
    
    if (!searchResult.match) {
      return new Response(
        JSON.stringify({ 
          error: "Face does not match registered photos.",
          code: "FACE_MISMATCH",
          confidence: searchResult.confidence,
          required: FACE_MATCH_THRESHOLD,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Face matched with confidence: ${searchResult.confidence}%`);

    // === STEP 5: Check for duplicate attendance ===
    const today = new Date().toISOString().split('T')[0];
    
    const { data: existingAttendance } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (action === 'check-in' && existingAttendance?.check_in_time) {
      return new Response(
        JSON.stringify({ error: "Already checked in today", code: "ALREADY_CHECKED_IN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'check-out' && !existingAttendance?.check_in_time) {
      return new Response(
        JSON.stringify({ error: "Must check in before checking out", code: "NOT_CHECKED_IN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'check-out' && existingAttendance?.check_out_time) {
      return new Response(
        JSON.stringify({ error: "Already checked out today", code: "ALREADY_CHECKED_OUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === STEP 6: Store captured photo ===
    const base64Data = captured_image.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const photoFileName = `${user.id}/${today}/${action}-${Date.now()}.jpg`;
    
    await supabase.storage
      .from("employee-photos")
      .upload(photoFileName, binaryData, {
        contentType: "image/jpeg",
        upsert: true,
      });

    // === STEP 7: Record attendance ===
    const nowISO = new Date().toISOString();
    
    if (action === 'check-in') {
      const { error: insertError } = await supabase
        .from("attendance")
        .insert({
          user_id: user.id,
          date: today,
          check_in_time: nowISO,
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          check_in_photo_url: photoFileName,
          check_in_face_verified: true,
          challenge_token: challenge_token,
          gps_timestamp: gps_timestamp,
          face_confidence: searchResult.confidence,
          verification_method: 'aws_rekognition',
          status: 'present',
        });

      if (insertError) {
        console.error("Attendance insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to record attendance", code: "DB_ERROR" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Calculate overtime based on 8-hour standard day
      const STANDARD_WORK_DAY_MINUTES = 8 * 60; // 480 minutes
      const MAX_SHIFT_HOURS = 24;
      
      const checkInTime = new Date(existingAttendance.check_in_time);
      const checkOutTime = new Date(nowISO);
      
      // Calculate total minutes worked
      const totalMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      const hoursWorked = totalMinutes / 60;
      
      let overtimeMinutes = 0;
      let status = 'present';
      
      // Check if checkout is more than 24 hours after check-in
      if (hoursWorked >= MAX_SHIFT_HOURS) {
        overtimeMinutes = 0;
        status = 'punch_missing';
        console.log(`Punch missing detected: ${hoursWorked.toFixed(2)} hours since check-in`);
      } else if (totalMinutes > STANDARD_WORK_DAY_MINUTES) {
        overtimeMinutes = totalMinutes - STANDARD_WORK_DAY_MINUTES;
        console.log(`Overtime calculated: ${overtimeMinutes} minutes (${(overtimeMinutes/60).toFixed(2)} hours)`);
      }
      
      const { error: updateError } = await supabase
        .from("attendance")
        .update({
          check_out_time: nowISO,
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          check_out_photo_url: photoFileName,
          check_out_face_verified: true,
          face_confidence: searchResult.confidence,
          verification_method: 'aws_rekognition',
          overtime_minutes: overtimeMinutes,
          status: status,
        })
        .eq("id", existingAttendance.id);

      if (updateError) {
        console.error("Attendance update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to record attendance", code: "DB_ERROR" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Attendance ${action} recorded for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: action,
        timestamp: nowISO,
        face_confidence: searchResult.confidence,
        location: { latitude, longitude },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Attendance verification error:", error);
    return new Response(
      JSON.stringify({ error: "Attendance verification failed", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
