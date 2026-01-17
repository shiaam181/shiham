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

/**
 * Production-grade attendance verification:
 * 1. Validates challenge token (anti-replay)
 * 2. Validates GPS coordinates and timestamp freshness
 * 3. Compares captured face against registered reference images
 * 4. Only marks attendance if ALL validations pass
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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

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

    // Validate required fields
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

    // Validate GPS timestamp is fresh (within 30 seconds)
    const gpsTime = new Date(gps_timestamp).getTime();
    const now = Date.now();
    const gpsAge = now - gpsTime;
    if (gpsAge > 30000 || gpsAge < -5000) { // Allow 5s clock skew
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

    // === STEP 1: Validate challenge token ===
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

    // Check if challenge is expired
    if (new Date(challenge.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Challenge token expired. Please request a new one.", code: "EXPIRED_CHALLENGE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if challenge was already used
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

    // === STEP 2: Get user's registered face reference images ===
    const { data: faceRefs, error: faceRefsError } = await supabase
      .from("face_reference_images")
      .select("image_path, quality_score")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("quality_score", { ascending: false })
      .limit(3);

    if (faceRefsError || !faceRefs || faceRefs.length === 0) {
      console.error("No face references found:", faceRefsError);
      return new Response(
        JSON.stringify({ error: "Face not registered. Please complete face setup first.", code: "NO_FACE_REGISTERED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signed URLs for reference images
    const referenceImages: string[] = [];
    for (const ref of faceRefs) {
      const { data: signedUrl } = await supabase.storage
        .from("employee-photos")
        .createSignedUrl(ref.image_path, 60);
      
      if (signedUrl?.signedUrl) {
        referenceImages.push(signedUrl.signedUrl);
      }
    }

    if (referenceImages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to load face references", code: "FACE_LOAD_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Loaded ${referenceImages.length} reference images for comparison`);

    // === STEP 3: Face verification using AI ===
    const faceVerificationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a strict face verification system for employee attendance. 
Compare the CAPTURED image against ALL REFERENCE images.

RULES:
1. The captured face MUST match the reference images (same person)
2. Check for signs of photo spoofing (screen reflections, paper edges, unusual lighting)
3. Verify the image appears to be from a live camera (not a photo of a photo)
4. Be strict - false positives are worse than false negatives

Respond ONLY with JSON:
{
  "match": true/false,
  "confidence": 0-100,
  "is_live": true/false,
  "spoof_detected": true/false,
  "reason": "brief explanation"
}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Verify this captured selfie against ${referenceImages.length} reference images. The captured image is the FIRST one. The remaining are reference images. Determine if they are the SAME person and if the capture appears to be a live camera feed (not a photo of a photo).` },
              { type: "image_url", image_url: { url: captured_image } },
              ...referenceImages.map(url => ({ type: "image_url" as const, image_url: { url } }))
            ]
          }
        ],
      }),
    });

    if (!faceVerificationResponse.ok) {
      const errorText = await faceVerificationResponse.text();
      console.error("Face verification API error:", faceVerificationResponse.status, errorText);
      
      if (faceVerificationResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Service busy. Please try again in a moment.", code: "RATE_LIMITED" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (faceVerificationResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service unavailable. Please contact admin.", code: "SERVICE_UNAVAILABLE" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Face verification service error", code: "VERIFICATION_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verificationData = await faceVerificationResponse.json();
    const content = verificationData.choices?.[0]?.message?.content || '';
    
    let verificationResult = {
      match: false,
      confidence: 0,
      is_live: false,
      spoof_detected: true,
      reason: "Verification failed"
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        verificationResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse verification result:", e);
    }

    console.log(`Face verification result: match=${verificationResult.match}, confidence=${verificationResult.confidence}, is_live=${verificationResult.is_live}, spoof=${verificationResult.spoof_detected}`);

    // === STEP 4: Validate verification result ===
    // Require: match=true, confidence>=70, is_live=true, spoof_detected=false
    const CONFIDENCE_THRESHOLD = 70;
    
    if (verificationResult.spoof_detected) {
      return new Response(
        JSON.stringify({ 
          error: "Spoof detected. Please use live camera only.",
          code: "SPOOF_DETECTED",
          details: verificationResult.reason
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!verificationResult.is_live) {
      return new Response(
        JSON.stringify({ 
          error: "Image does not appear to be from live camera.",
          code: "NOT_LIVE",
          details: verificationResult.reason
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!verificationResult.match || verificationResult.confidence < CONFIDENCE_THRESHOLD) {
      return new Response(
        JSON.stringify({ 
          error: "Face does not match registered photos.",
          code: "FACE_MISMATCH",
          confidence: verificationResult.confidence,
          required: CONFIDENCE_THRESHOLD,
          details: verificationResult.reason
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          face_confidence: verificationResult.confidence,
          verification_method: 'backend',
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

    console.log(`Attendance ${action} recorded successfully for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: action,
        timestamp: nowISO,
        face_confidence: verificationResult.confidence,
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
