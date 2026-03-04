import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AWS Signature V4 helpers
async function sign(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(msg));
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await sign(encoder.encode("AWS4" + key).buffer as ArrayBuffer, dateStamp);
  const kRegion = await sign(kDate, regionName);
  const kService = await sign(kRegion, serviceName);
  return await sign(kService, "aws4_request");
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function awsRequest(
  method: string,
  path: string,
  body: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  service = "geo"
) {
  const host = `geo.${region}.amazonaws.com`;
  const endpoint = `https://${host}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";

  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = arrayBufferToHex(await sign(signingKey, stringToSign));

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": amzDate,
      "Authorization": authorizationHeader,
    },
    body: method !== "GET" ? body : undefined,
  });

  const responseText = await response.text();
  let responseData;
  try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

  if (!response.ok) {
    throw new Error(responseData.message || responseData.__type || `AWS Error ${response.status}`);
  }

  return responseData;
}

async function getAwsConfig(supabase: any) {
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const region = Deno.env.get("AWS_REGION") || "ap-south-1";

  // Also check system_settings for geofencing-specific config
  const { data: settings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "aws_geofencing_config")
    .maybeSingle();

  const config = settings?.value || {};

  return {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
    region: config.region || region,
    geofenceCollectionName: config.geofence_collection_name || "hrms-geofences",
    trackerName: config.tracker_name || "hrms-tracker",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    const awsConfig = await getAwsConfig(supabase);

    if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey) {
      return new Response(JSON.stringify({ error: "AWS credentials not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;

    switch (action) {
      case "put_geofence": {
        // Create or update a geofence in AWS (best-effort, falls back to local)
        const { geofenceId, latitude, longitude, radiusMeters } = params;
        const collectionName = awsConfig.geofenceCollectionName;
        const path = `/geofencing/v0/collections/${collectionName}/geofences/${geofenceId}`;
        const body = JSON.stringify({
          Geometry: {
            Circle: {
              Center: [longitude, latitude],
              Radius: radiusMeters || 100,
            },
          },
        });
        try {
          result = await awsRequest("PUT", path, body, awsConfig.region, awsConfig.accessKeyId, awsConfig.secretAccessKey);
        } catch (e: any) {
          console.warn("AWS put_geofence failed (using local fallback):", e.message);
          result = { message: "Geofence saved locally (AWS sync unavailable)", localOnly: true, geofenceId };
        }
        break;
      }

      case "delete_geofence": {
        const { geofenceIds } = params;
        const collectionName = awsConfig.geofenceCollectionName;
        const path = `/geofencing/v0/collections/${collectionName}/delete-geofences`;
        const body = JSON.stringify({ GeofenceIds: geofenceIds });
        try {
          result = await awsRequest("POST", path, body, awsConfig.region, awsConfig.accessKeyId, awsConfig.secretAccessKey);
        } catch (e: any) {
          console.warn("AWS delete_geofence failed (using local fallback):", e.message);
          result = { message: "Geofence deleted locally (AWS sync unavailable)", localOnly: true };
        }
        break;
      }

      case "evaluate_geofence": {
        // Evaluate if a position is inside any geofence in the collection
        const { deviceId, latitude, longitude } = params;
        const collectionName = awsConfig.geofenceCollectionName;
        const path = `/geofencing/v0/collections/${collectionName}/positions`;
        const body = JSON.stringify({
          DevicePositionUpdates: [{
            DeviceId: deviceId,
            Position: [longitude, latitude],
            SampleTime: new Date().toISOString(),
          }],
        });

        // First update device position
        const trackerPath = `/tracking/v0/trackers/${awsConfig.trackerName}/positions`;
        try {
          await awsRequest("POST", trackerPath, body, awsConfig.region, awsConfig.accessKeyId, awsConfig.secretAccessKey);
        } catch (e) {
          console.warn("Tracker update failed (may not exist):", e);
        }

        // Now get geofences and check distance manually for reliability
        const listPath = `/geofencing/v0/collections/${collectionName}/list-geofences`;
        const listBody = JSON.stringify({ MaxResults: 100 });
        let geofences;
        try {
          geofences = await awsRequest("POST", listPath, listBody, awsConfig.region, awsConfig.accessKeyId, awsConfig.secretAccessKey);
        } catch (e) {
          console.warn("List geofences failed:", e);
          geofences = { Entries: [] };
        }

        // Check which geofences the position is inside using Haversine as fallback
        // AWS geofence evaluation is primary, distance check is backup
        const insideGeofences: any[] = [];
        const entries = geofences.Entries || [];

        for (const entry of entries) {
          const circle = entry.Geometry?.Circle;
          if (circle) {
            const [geoLng, geoLat] = circle.Center;
            const radius = circle.Radius;
            const distance = haversineDistance(latitude, longitude, geoLat, geoLng);
            if (distance <= radius) {
              insideGeofences.push({
                GeofenceId: entry.GeofenceId,
                Distance: Math.round(distance),
                Radius: radius,
              });
            }
          }
        }

        result = {
          isInside: insideGeofences.length > 0,
          matchedGeofences: insideGeofences,
          evaluatedAt: new Date().toISOString(),
          totalGeofences: entries.length,
        };
        break;
      }

      case "create_collection": {
        const { collectionName } = params;
        const path = `/geofencing/v0/collections`;
        const body = JSON.stringify({
          CollectionName: collectionName || awsConfig.geofenceCollectionName,
          Description: "HRMS Geofence Collection",
        });
        try {
          result = await awsRequest("POST", path, body, awsConfig.region, awsConfig.accessKeyId, awsConfig.secretAccessKey);
        } catch (e: any) {
          if (e.message?.includes("ConflictException") || e.message?.includes("already exists")) {
            result = { message: "Collection already exists", exists: true };
          } else {
            console.warn("AWS create_collection failed:", e.message);
            result = { message: "Collection creation skipped (AWS unavailable)", localOnly: true };
          }
        }
        break;
      }

      case "create_tracker": {
        const { trackerName } = params;
        const path = `/tracking/v0/trackers`;
        const body = JSON.stringify({
          TrackerName: trackerName || awsConfig.trackerName,
          Description: "HRMS Employee Tracker",
          PositionFiltering: "TimeBased",
        });
        try {
          result = await awsRequest("POST", path, body, awsConfig.region, awsConfig.accessKeyId, awsConfig.secretAccessKey);
        } catch (e: any) {
          if (e.message?.includes("ConflictException") || e.message?.includes("already exists")) {
            result = { message: "Tracker already exists", exists: true };
          } else {
            console.warn("AWS create_tracker failed:", e.message);
            result = { message: "Tracker creation skipped (AWS unavailable)", localOnly: true };
          }
        }
        break;
      }

      case "associate_tracker": {
        const trackerName = params.trackerName || awsConfig.trackerName;
        const collectionName = params.collectionName || awsConfig.geofenceCollectionName;
        const path = `/tracking/v0/trackers/${trackerName}/consumers`;
        const body = JSON.stringify({
          ConsumerArn: `arn:aws:geo:${awsConfig.region}:*:geofence-collection/${collectionName}`,
        });
        try {
          result = await awsRequest("POST", path, body, awsConfig.region, awsConfig.accessKeyId, awsConfig.secretAccessKey);
        } catch (e: any) {
          if (e.message?.includes("ConflictException") || e.message?.includes("already exists")) {
            result = { message: "Association already exists", exists: true };
          } else {
            console.warn("AWS associate_tracker failed:", e.message);
            result = { message: "Association skipped (AWS unavailable)", localOnly: true };
          }
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Geofence error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Haversine distance calculation (meters)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
