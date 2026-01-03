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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
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

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Face verification service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Face verification request from user ${user.id}`);

    // Call the AI gateway for face verification
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a face verification AI assistant. Your job is to compare two face images and determine if they belong to the same person.

Analyze the following aspects:
1. Facial structure (face shape, proportions)
2. Key facial features (eyes, nose, mouth, eyebrows)
3. Distinguishing characteristics

Respond ONLY with a JSON object in this exact format:
{
  "match": true or false,
  "confidence": number between 0 and 100,
  "reason": "brief explanation of your decision"
}

Be strict but fair. Consider that lighting, angle, and expression may differ between photos. Focus on structural features that don't change.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare these two face images. The first is the reference photo (stored employee photo) and the second is the captured selfie. Determine if they are the same person."
              },
              {
                type: "image_url",
                image_url: { url: referenceImage }
              },
              {
                type: "image_url",
                image_url: { url: capturedImage }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Face verification service error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = await aiResponse.json();
    const content = data.choices?.[0]?.message?.content;

    console.log("AI Response received for user:", user.id);

    // Parse the JSON response
    let result;
    try {
      // Extract JSON from the response (it might have markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
      // Default to no match if we can't parse
      result = {
        match: false,
        confidence: 0,
        reason: "Unable to verify face. Please try again."
      };
    }

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
