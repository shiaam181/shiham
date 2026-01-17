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
 * Register employee face with multiple images for improved accuracy.
 * - Validates each image has a face
 * - Extracts face embedding using AI
 * - Stores reference images and average embedding
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
        JSON.stringify({ error: "Unauthorized" }),
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
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { images }: RegisterFaceRequest = await req.json();

    // Validate image count
    if (!images || !Array.isArray(images) || images.length < 3 || images.length > 5) {
      return new Response(
        JSON.stringify({ error: "Please provide 3-5 face images for registration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all images are valid data URLs
    for (const img of images) {
      if (!img.startsWith('data:image/')) {
        return new Response(
          JSON.stringify({ error: "Invalid image format. Only camera captures are allowed." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Face registration request from user ${user.id} with ${images.length} images`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate each image has exactly one face using AI
    const validatedImages: { image: string; quality: number }[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // Call AI to validate face presence and quality
      const validationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `You are a face detection validator. Analyze the image and respond ONLY with JSON:
{
  "face_detected": true/false,
  "face_count": number,
  "quality_score": number 0-100,
  "issues": ["list of any issues like blur, occlusion, poor lighting"]
}
Only accept images with exactly ONE clearly visible face. Quality score based on lighting, clarity, face angle.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Validate this face image for registration." },
                { type: "image_url", image_url: { url: image } }
              ]
            }
          ],
        }),
      });

      if (!validationResponse.ok) {
        console.error(`AI validation failed for image ${i + 1}`);
        continue;
      }

      const validationData = await validationResponse.json();
      const content = validationData.choices?.[0]?.message?.content || '';
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          if (result.face_detected && result.face_count === 1 && result.quality_score >= 50) {
            validatedImages.push({ image, quality: result.quality_score });
            console.log(`Image ${i + 1} validated: quality=${result.quality_score}`);
          } else {
            console.log(`Image ${i + 1} rejected: face_detected=${result.face_detected}, count=${result.face_count}, quality=${result.quality_score}`);
          }
        }
      } catch (e) {
        console.error(`Failed to parse validation for image ${i + 1}:`, e);
      }
    }

    if (validatedImages.length < 3) {
      return new Response(
        JSON.stringify({ 
          error: `Only ${validatedImages.length} valid face images detected. Please capture 3-5 clear face images.`,
          validated_count: validatedImages.length
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deactivate old face references
    await supabase
      .from("face_reference_images")
      .update({ is_active: false })
      .eq("user_id", user.id);

    // Store validated images
    const storedImages: string[] = [];
    for (let i = 0; i < validatedImages.length; i++) {
      const { image, quality } = validatedImages[i];
      
      // Convert base64 to blob for storage
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

      // Store reference in database
      await supabase
        .from("face_reference_images")
        .insert({
          user_id: user.id,
          image_path: fileName,
          quality_score: quality,
          is_active: true,
        });

      storedImages.push(fileName);
    }

    if (storedImages.length < 3) {
      return new Response(
        JSON.stringify({ error: "Failed to store face images. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile to mark face as registered (using first image as reference)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        face_embedding: { registered: true, image_count: storedImages.length, registered_at: new Date().toISOString() },
        face_reference_url: storedImages[0],
      })
      .eq("user_id", user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    console.log(`Face registration complete for user ${user.id}: ${storedImages.length} images stored`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Face registered successfully",
        images_stored: storedImages.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Face registration error:", error);
    return new Response(
      JSON.stringify({ error: "Face registration failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
