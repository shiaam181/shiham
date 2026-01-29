import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyAttendanceRequest {
  challenge_token: string;
  captured_image: string; // Base64 data URL from live camera
  latitude: number;
  longitude: number;
  gps_timestamp: string; // ISO timestamp when GPS was captured
  action: 'check-in' | 'check-out';
}

const FACE_MATCH_THRESHOLD = 70; // Face++ confidence threshold (0-100)
const GPS_FRESHNESS_MS = 30000; // GPS must be within 30 seconds
const GPS_CLOCK_SKEW_MS = 5000; // Allow 5s clock skew

/**
 * Detect face in captured image and return face_token
 */
async function detectFace(apiKey: string, apiSecret: string, imageBase64: string): Promise<{
  faceToken: string | null;
  error?: string;
}> {
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const response = await fetch("https://api-us.faceplusplus.com/facepp/v3/detect", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      image_base64: base64Data,
      return_attributes: "blur,headpose",
    }),
  });

  const data = await response.json();
  
  if (data.error_message) {
    console.error("Face++ detect error:", data.error_message);
    return { faceToken: null, error: data.error_message };
  }

  if (!data.faces || data.faces.length === 0) {
    return { faceToken: null, error: "No face detected in image" };
  }

  if (data.faces.length > 1) {
    return { faceToken: null, error: "Multiple faces detected" };
  }

  // Check for excessive blur (potential photo of photo)
  const face = data.faces[0];
  if (face.attributes?.blur?.blurness?.value > 80) {
    return { faceToken: null, error: "Image too blurry - use live camera" };
  }

  // Check for extreme head poses (potential static image)
  if (face.attributes?.headpose) {
    const { pitch_angle, roll_angle, yaw_angle } = face.attributes.headpose;
    if (Math.abs(pitch_angle) > 30 || Math.abs(roll_angle) > 30 || Math.abs(yaw_angle) > 40) {
      return { faceToken: null, error: "Please face the camera directly" };
    }
  }

  return { faceToken: face.face_token };
}

/**
 * Search face against user's FaceSet
 */
async function searchFace(
  apiKey: string,
  apiSecret: string,
  faceToken: string,
  faceSetToken: string
): Promise<{
  match: boolean;
  confidence: number;
  error?: string;
}> {
  const response = await fetch("https://api-us.faceplusplus.com/facepp/v3/search", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      face_token: faceToken,
      faceset_token: faceSetToken,
    }),
  });

  const data = await response.json();
  
  if (data.error_message) {
    console.error("Face++ search error:", data.error_message);
    return { match: false, confidence: 0, error: data.error_message };
  }

  if (!data.results || data.results.length === 0) {
    return { match: false, confidence: 0, error: "No matching face found" };
  }

  // Get the best match
  const bestMatch = data.results[0];
  const confidence = bestMatch.confidence;
  
  console.log(`Face search result: confidence=${confidence}, threshold=${FACE_MATCH_THRESHOLD}`);
  
  return {
    match: confidence >= FACE_MATCH_THRESHOLD,
    confidence: confidence,
  };
}

/**
 * Production-grade attendance verification with Face++:
 * 1. Validates challenge token (anti-replay)
 * 2. Validates GPS coordinates and timestamp freshness
 * 3. Detects face in captured image
 * 4. Searches against user's registered faces
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
    const faceppApiKey = Deno.env.get("FACEPP_API_KEY");
    const faceppApiSecret = Deno.env.get("FACEPP_API_SECRET");

    if (!faceppApiKey || !faceppApiSecret) {
      console.error("Face++ credentials not configured");
      return new Response(
        JSON.stringify({ error: "Face verification service not configured", code: "SERVICE_NOT_CONFIGURED" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // === STEP 2: Get user's FaceSet token ===
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

    const faceEmbedding = profile.face_embedding as { faceset_token?: string; provider?: string };
    
    if (faceEmbedding.provider !== 'facepp' || !faceEmbedding.faceset_token) {
      return new Response(
        JSON.stringify({ error: "Face registration outdated. Please re-register your face.", code: "FACE_OUTDATED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const faceSetToken = faceEmbedding.faceset_token;
    console.log(`Using FaceSet: ${faceSetToken}`);

    // === STEP 3: Detect face in captured image ===
    const detection = await detectFace(faceppApiKey, faceppApiSecret, captured_image);
    
    if (!detection.faceToken) {
      return new Response(
        JSON.stringify({ 
          error: detection.error || "Face detection failed",
          code: "FACE_DETECTION_FAILED"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Face detected: ${detection.faceToken}`);

    // === STEP 4: Search face against registered faces ===
    const searchResult = await searchFace(faceppApiKey, faceppApiSecret, detection.faceToken, faceSetToken);
    
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
          verification_method: 'facepp',
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
      const { error: updateError } = await supabase
        .from("attendance")
        .update({
          check_out_time: nowISO,
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          check_out_photo_url: photoFileName,
          check_out_face_verified: true,
        })
        .eq("user_id", user.id)
        .eq("date", today);

      if (updateError) {
        console.error("Attendance update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to record attendance", code: "DB_ERROR" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Attendance ${action} recorded successfully for user ${user.id} with Face++ confidence ${searchResult.confidence}%`);

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
    console.error("Verify attendance error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
