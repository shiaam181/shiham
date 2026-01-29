import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterFaceRequest {
  images: string[]; // Array of base64 image data URLs (3-5 images)
}

/**
 * Face++ FaceSet Management
 * Creates a FaceSet for the user if not exists, then adds faces to it
 */
async function getOrCreateFaceSet(apiKey: string, apiSecret: string, userId: string): Promise<string> {
  const faceSetToken = `user_${userId.replace(/-/g, '_')}`;
  
  // Try to get existing faceset
  const getResponse = await fetch("https://api-us.faceplusplus.com/facepp/v3/faceset/getdetail", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      outer_id: faceSetToken,
    }),
  });

  const getData = await getResponse.json();
  
  if (getData.faceset_token) {
    console.log(`Existing FaceSet found for user ${userId}`);
    return getData.faceset_token;
  }

  // Create new faceset
  console.log(`Creating new FaceSet for user ${userId}`);
  const createResponse = await fetch("https://api-us.faceplusplus.com/facepp/v3/faceset/create", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      outer_id: faceSetToken,
      display_name: `Employee ${userId}`,
    }),
  });

  const createData = await createResponse.json();
  
  if (createData.faceset_token) {
    return createData.faceset_token;
  }
  
  throw new Error(`Failed to create FaceSet: ${JSON.stringify(createData)}`);
}

/**
 * Detect face in image and return face_token
 */
async function detectFace(apiKey: string, apiSecret: string, imageBase64: string): Promise<{
  faceToken: string | null;
  quality: number;
  error?: string;
}> {
  // Remove data URL prefix
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const response = await fetch("https://api-us.faceplusplus.com/facepp/v3/detect", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      image_base64: base64Data,
      return_attributes: "blur,eyestatus,facequality",
    }),
  });

  const data = await response.json();
  
  if (data.error_message) {
    console.error("Face++ detect error:", data.error_message);
    return { faceToken: null, quality: 0, error: data.error_message };
  }

  if (!data.faces || data.faces.length === 0) {
    return { faceToken: null, quality: 0, error: "No face detected" };
  }

  if (data.faces.length > 1) {
    return { faceToken: null, quality: 0, error: "Multiple faces detected" };
  }

  const face = data.faces[0];
  const faceToken = face.face_token;
  
  // Calculate quality score from attributes
  let quality = 70; // Base score
  if (face.attributes?.facequality?.value) {
    quality = face.attributes.facequality.value;
  } else if (face.attributes?.blur?.blurness?.value !== undefined) {
    // Lower blur = higher quality
    const blurScore = 100 - (face.attributes.blur.blurness.value * 100);
    quality = Math.max(0, Math.min(100, blurScore));
  }

  return { faceToken, quality };
}

/**
 * Add face to FaceSet
 */
async function addFaceToFaceSet(
  apiKey: string, 
  apiSecret: string, 
  faceSetToken: string, 
  faceToken: string
): Promise<boolean> {
  const response = await fetch("https://api-us.faceplusplus.com/facepp/v3/faceset/addface", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      faceset_token: faceSetToken,
      face_tokens: faceToken,
    }),
  });

  const data = await response.json();
  
  if (data.error_message) {
    console.error("Face++ addface error:", data.error_message);
    return false;
  }

  return data.face_added === 1;
}

/**
 * Register employee face with Face++ API
 * - Detects faces in 3-5 images
 * - Creates a FaceSet for the user
 * - Adds all face_tokens to the FaceSet
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

    const { images }: RegisterFaceRequest = await req.json();

    // Validate image count
    if (!images || !Array.isArray(images) || images.length < 3 || images.length > 5) {
      return new Response(
        JSON.stringify({ error: "Please provide 3-5 face images for registration", code: "INVALID_IMAGE_COUNT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all images are valid data URLs
    for (const img of images) {
      if (!img.startsWith('data:image/')) {
        return new Response(
          JSON.stringify({ error: "Invalid image format. Only camera captures are allowed.", code: "INVALID_FORMAT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Face registration request from user ${user.id} with ${images.length} images`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Get or create FaceSet for this user
    let faceSetToken: string;
    try {
      faceSetToken = await getOrCreateFaceSet(faceppApiKey, faceppApiSecret, user.id);
      console.log(`FaceSet token: ${faceSetToken}`);
    } catch (error) {
      console.error("FaceSet creation failed:", error);
      return new Response(
        JSON.stringify({ error: "Failed to initialize face storage", code: "FACESET_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Clear existing faces from FaceSet
    const removeResponse = await fetch("https://api-us.faceplusplus.com/facepp/v3/faceset/removeface", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: faceppApiKey,
        api_secret: faceppApiSecret,
        faceset_token: faceSetToken,
        face_tokens: "RemoveAllFaceTokens",
      }),
    });
    
    const removeData = await removeResponse.json();
    console.log(`Cleared existing faces: ${removeData.face_removed || 0}`);

    // Step 3: Detect and add faces from each image
    const registeredFaces: { faceToken: string; quality: number; imagePath: string }[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // Detect face
      const detection = await detectFace(faceppApiKey, faceppApiSecret, image);
      
      if (!detection.faceToken) {
        console.log(`Image ${i + 1} rejected: ${detection.error}`);
        continue;
      }

      if (detection.quality < 30) {
        console.log(`Image ${i + 1} rejected: low quality (${detection.quality})`);
        continue;
      }

      // Add face to FaceSet
      const added = await addFaceToFaceSet(faceppApiKey, faceppApiSecret, faceSetToken, detection.faceToken);
      
      if (!added) {
        console.log(`Image ${i + 1}: failed to add to FaceSet`);
        continue;
      }

      // Store image in Supabase storage
      const base64Data = image.split(',')[1];
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `${user.id}/face-ref-${i + 1}-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from("employee-photos")
        .upload(fileName, binaryData, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for image ${i + 1}:`, uploadError);
        continue;
      }

      registeredFaces.push({
        faceToken: detection.faceToken,
        quality: detection.quality,
        imagePath: fileName,
      });
      
      console.log(`Image ${i + 1} registered: face_token=${detection.faceToken}, quality=${detection.quality}`);
    }

    if (registeredFaces.length < 3) {
      return new Response(
        JSON.stringify({ 
          error: `Only ${registeredFaces.length} valid face images detected. Please capture 3-5 clear face images.`,
          code: "INSUFFICIENT_FACES",
          registered_count: registeredFaces.length
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Deactivate old face references and store new ones
    await supabase
      .from("face_reference_images")
      .update({ is_active: false })
      .eq("user_id", user.id);

    for (const face of registeredFaces) {
      await supabase
        .from("face_reference_images")
        .insert({
          user_id: user.id,
          image_path: face.imagePath,
          quality_score: face.quality,
          is_active: true,
          embedding: { face_token: face.faceToken, faceset_token: faceSetToken },
        });
    }

    // Step 5: Update profile
    await supabase
      .from("profiles")
      .update({
        face_embedding: { 
          provider: "facepp",
          faceset_token: faceSetToken,
          face_count: registeredFaces.length,
          registered_at: new Date().toISOString(),
        },
        face_reference_url: registeredFaces[0].imagePath,
      })
      .eq("user_id", user.id);

    console.log(`Face registration complete for user ${user.id}: ${registeredFaces.length} faces registered`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Face registered successfully with Face++",
        images_stored: registeredFaces.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Face registration error:", error);
    return new Response(
      JSON.stringify({ error: "Face registration failed", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
