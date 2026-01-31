import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterFaceRequest {
  images: string[]; // Array of base64 image data URLs (3-5 images)
}

const AWS_REGION = "ap-south-1"; // Mumbai region

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
 * Detect face quality in an image using AWS Rekognition
 */
async function detectFaceQuality(
  imageBase64: string,
  accessKey: string,
  secretKey: string
): Promise<{ valid: boolean; quality: number; faceId?: string; error?: string }> {
  // Remove data URL prefix
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  // Use 'ALL' to get quality metrics (Brightness, Sharpness) - 'QUALITY' is not a valid attribute
  const result = await callRekognition('DetectFaces', {
    Image: { Bytes: base64Data },
    Attributes: ['ALL'],
  }, accessKey, secretKey);
  
  if (!result.success) {
    return { valid: false, quality: 0, error: result.error };
  }
  
  const faces = result.data?.FaceDetails as Array<{
    Confidence?: number;
    Quality?: { Brightness?: number; Sharpness?: number };
    BoundingBox?: { Width?: number; Height?: number };
  }> || [];
  
  if (faces.length === 0) {
    return { valid: false, quality: 0, error: 'No face detected in image' };
  }
  
  if (faces.length > 1) {
    return { valid: false, quality: 0, error: 'Multiple faces detected - please capture one face' };
  }
  
  const face = faces[0];
  const brightness = face.Quality?.Brightness || 0;
  const sharpness = face.Quality?.Sharpness || 0;
  const confidence = face.Confidence || 0;
  
  // Calculate quality score (average of brightness, sharpness, and confidence)
  const quality = Math.round((brightness + sharpness + confidence) / 3);
  
  // Face must be reasonably large in the frame
  const faceWidth = face.BoundingBox?.Width || 0;
  const faceHeight = face.BoundingBox?.Height || 0;
  
  if (faceWidth < 0.1 || faceHeight < 0.1) {
    return { valid: false, quality, error: 'Face too small - please move closer to camera' };
  }
  
  // Minimum quality threshold
  if (quality < 40) {
    return { valid: false, quality, error: 'Image quality too low - please ensure good lighting' };
  }
  
  console.log(`Face detected: brightness=${brightness.toFixed(1)}, sharpness=${sharpness.toFixed(1)}, confidence=${confidence.toFixed(1)}, quality=${quality}`);
  
  return { valid: true, quality };
}

/**
 * Create a Rekognition collection for the user if it doesn't exist
 */
async function ensureCollection(
  collectionId: string,
  accessKey: string,
  secretKey: string
): Promise<{ success: boolean; error?: string }> {
  // Try to describe the collection first
  const describeResult = await callRekognition('DescribeCollection', {
    CollectionId: collectionId,
  }, accessKey, secretKey);
  
  if (describeResult.success) {
    console.log(`Collection ${collectionId} already exists`);
    return { success: true };
  }
  
  // Create the collection
  const createResult = await callRekognition('CreateCollection', {
    CollectionId: collectionId,
  }, accessKey, secretKey);
  
  if (createResult.success) {
    console.log(`Collection ${collectionId} created`);
    return { success: true };
  }
  
  // Collection might already exist (race condition)
  if (createResult.error?.includes('ResourceAlreadyExistsException')) {
    return { success: true };
  }
  
  return { success: false, error: createResult.error };
}

/**
 * Delete all faces from a collection
 */
async function clearCollection(
  collectionId: string,
  accessKey: string,
  secretKey: string
): Promise<void> {
  // List all faces in the collection
  const listResult = await callRekognition('ListFaces', {
    CollectionId: collectionId,
    MaxResults: 100,
  }, accessKey, secretKey);
  
  if (!listResult.success || !listResult.data?.Faces) {
    console.log('No faces to clear or collection empty');
    return;
  }
  
  const faces = listResult.data.Faces as Array<{ FaceId: string }>;
  if (faces.length === 0) return;
  
  const faceIds = faces.map(f => f.FaceId);
  
  // Delete all faces
  await callRekognition('DeleteFaces', {
    CollectionId: collectionId,
    FaceIds: faceIds,
  }, accessKey, secretKey);
  
  console.log(`Cleared ${faceIds.length} faces from collection`);
}

/**
 * Index a face into the collection
 */
async function indexFace(
  collectionId: string,
  imageBase64: string,
  externalImageId: string,
  accessKey: string,
  secretKey: string
): Promise<{ success: boolean; faceId?: string; error?: string }> {
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const result = await callRekognition('IndexFaces', {
    CollectionId: collectionId,
    Image: { Bytes: base64Data },
    ExternalImageId: externalImageId,
    MaxFaces: 1,
    QualityFilter: 'AUTO',
    DetectionAttributes: ['DEFAULT'],
  }, accessKey, secretKey);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  const faceRecords = result.data?.FaceRecords as Array<{ Face: { FaceId: string } }> || [];
  
  if (faceRecords.length === 0) {
    return { success: false, error: 'No face indexed - image quality too low or no face detected' };
  }
  
  return { success: true, faceId: faceRecords[0].Face.FaceId };
}

/**
 * Register employee face with AWS Rekognition
 * - Detects faces in 3-5 images
 * - Creates a collection for the user
 * - Indexes all faces to the collection
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

    // Create a unique collection ID for this user
    const collectionId = `user-${user.id.replace(/-/g, '')}`;

    // Step 1: Ensure collection exists
    const collectionResult = await ensureCollection(collectionId, awsAccessKey, awsSecretKey);
    if (!collectionResult.success) {
      console.error("Collection creation failed:", collectionResult.error);
      return new Response(
        JSON.stringify({ error: "Failed to initialize face storage", code: "COLLECTION_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Clear existing faces from collection
    await clearCollection(collectionId, awsAccessKey, awsSecretKey);

    // Step 3: Validate and index faces from each image
    const registeredFaces: { faceId: string; quality: number; imagePath: string }[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // Detect and validate face quality
      const detection = await detectFaceQuality(image, awsAccessKey, awsSecretKey);
      
      if (!detection.valid) {
        console.log(`Image ${i + 1} rejected: ${detection.error}`);
        continue;
      }

      // Index face into collection
      const externalImageId = `face-${i + 1}-${Date.now()}`;
      const indexResult = await indexFace(collectionId, image, externalImageId, awsAccessKey, awsSecretKey);
      
      if (!indexResult.success) {
        console.log(`Image ${i + 1}: failed to index - ${indexResult.error}`);
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
        faceId: indexResult.faceId!,
        quality: detection.quality,
        imagePath: fileName,
      });
      
      console.log(`Image ${i + 1} registered: face_id=${indexResult.faceId}, quality=${detection.quality}`);
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
          embedding: { face_id: face.faceId, collection_id: collectionId },
        });
    }

    // Step 5: Update profile with AWS Rekognition metadata
    await supabase
      .from("profiles")
      .update({
        face_embedding: { 
          provider: "aws_rekognition",
          collection_id: collectionId,
          face_count: registeredFaces.length,
          region: AWS_REGION,
          registered_at: new Date().toISOString(),
        },
        face_reference_url: registeredFaces[0].imagePath,
      })
      .eq("user_id", user.id);

    console.log(`Face registration complete for user ${user.id}: ${registeredFaces.length} faces registered with AWS Rekognition`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Face registered successfully with AWS Rekognition",
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
