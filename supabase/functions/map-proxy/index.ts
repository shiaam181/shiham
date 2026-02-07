import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AWS Signature V4 helpers
async function sha256(message: string | Uint8Array): Promise<ArrayBuffer> {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  return await crypto.subtle.digest('SHA-256', data);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const keyData = key instanceof ArrayBuffer ? new Uint8Array(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

async function signAwsRequest(
  method: string,
  url: string,
  region: string,
  accessKey: string,
  secretKey: string,
  body: string = ''
): Promise<Record<string, string>> {
  const urlObj = new URL(url);
  const host = urlObj.host;
  const path = urlObj.pathname;
  
  // Sort query parameters
  const sortedParams = [...urlObj.searchParams.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const service = 'geo';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = toHex(await sha256(body));

  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';

  const canonicalRequest = [
    method,
    path,
    sortedParams,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toHex(await sha256(canonicalRequest))
  ].join('\n');

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authHeader,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    'Host': host,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const region = Deno.env.get('AWS_REGION') || 'ap-south-1';
    const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const mapName = Deno.env.get('AWS_LOCATION_MAP_NAME');

    if (!accessKey || !secretKey) {
      console.error('AWS credentials not configured');
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!mapName) {
      console.error('AWS_LOCATION_MAP_NAME not configured');
      return new Response(JSON.stringify({ error: 'Map name not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Handle tile requests (GET)
    if (action === 'tile') {
      const z = url.searchParams.get('z');
      const x = url.searchParams.get('x');
      const y = url.searchParams.get('y');

      if (!z || !x || !y) {
        return new Response(JSON.stringify({ error: 'Missing z, x, y parameters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tileUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/tiles/${z}/${x}/${y}`;
      console.log(`Fetching tile: z=${z}, x=${x}, y=${y}`);

      const headers = await signAwsRequest('GET', tileUrl, region, accessKey, secretKey);
      const tileResponse = await fetch(tileUrl, { headers });

      if (!tileResponse.ok) {
        const errText = await tileResponse.text();
        console.error(`Tile fetch failed [${tileResponse.status}]: ${errText}`);
        return new Response(errText, {
          status: tileResponse.status,
          headers: corsHeaders,
        });
      }

      const tileData = await tileResponse.arrayBuffer();
      const contentType = tileResponse.headers.get('content-type') || 'application/vnd.mapbox-vector-tile';

      return new Response(tileData, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Handle style descriptor requests (GET or POST)
    if (action === 'style' || req.method === 'POST') {
      const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor`;
      console.log(`Fetching style descriptor for map: ${mapName}`);

      const headers = await signAwsRequest('GET', styleUrl, region, accessKey, secretKey);
      const styleResponse = await fetch(styleUrl, { headers });

      if (!styleResponse.ok) {
        const errText = await styleResponse.text();
        console.error(`Style fetch failed [${styleResponse.status}]: ${errText}`);
        return new Response(JSON.stringify({ error: `Failed to fetch map style: ${errText}` }), {
          status: styleResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const styleJson = await styleResponse.json();

      // Build the correct public URL for the edge function
      // The internal URL may not match the public-facing URL
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || url.origin;
      const functionBaseUrl = `${supabaseUrl}/functions/v1/map-proxy`;

      // Rewrite tile source URLs to use our proxy
      if (styleJson.sources) {
        for (const sourceKey of Object.keys(styleJson.sources)) {
          const source = styleJson.sources[sourceKey];
          if (source.tiles && Array.isArray(source.tiles)) {
            source.tiles = source.tiles.map(() =>
              `${functionBaseUrl}?action=tile&z={z}&x={x}&y={y}`
            );
          }
          // Also handle url property
          if (source.url && typeof source.url === 'string' && source.url.includes('amazonaws.com')) {
            // Fetch the TileJSON from this URL and inline it
            try {
              const tileJsonUrl = source.url;
              const tileJsonHeaders = await signAwsRequest('GET', tileJsonUrl, region, accessKey, secretKey);
              const tileJsonResponse = await fetch(tileJsonUrl, { headers: tileJsonHeaders });
              if (tileJsonResponse.ok) {
                const tileJson = await tileJsonResponse.json();
                if (tileJson.tiles) {
                  source.tiles = tileJson.tiles.map(() =>
                    `${functionBaseUrl}?action=tile&z={z}&x={x}&y={y}`
                  );
                }
                delete source.url;
              }
            } catch (e) {
              console.error('Failed to fetch TileJSON:', e);
            }
          }
        }
      }

      // Rewrite sprite and glyphs URLs if they point to AWS
      if (styleJson.sprite && styleJson.sprite.includes('amazonaws.com')) {
        // Proxy sprite through our function
        styleJson._originalSprite = styleJson.sprite;
        styleJson.sprite = `${functionBaseUrl}?action=sprite`;
      }
      if (styleJson.glyphs && styleJson.glyphs.includes('amazonaws.com')) {
        styleJson._originalGlyphs = styleJson.glyphs;
        styleJson.glyphs = `${functionBaseUrl}?action=glyphs&fontstack={fontstack}&range={range}`;
      }

      console.log('Style descriptor fetched and rewritten successfully');
      return new Response(JSON.stringify(styleJson), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle sprite requests
    if (action === 'sprite') {
      const spriteFormat = url.searchParams.get('format') || '';
      // Fetch original sprite URL - we need to get the style first to know the URL
      const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor`;
      const styleHeaders = await signAwsRequest('GET', styleUrl, region, accessKey, secretKey);
      const styleResponse = await fetch(styleUrl, { headers: styleHeaders });
      const styleJson = await styleResponse.json();
      
      if (styleJson.sprite) {
        const spriteUrl = styleJson.sprite + spriteFormat;
        console.log(`Fetching sprite: ${spriteUrl}`);
        const spriteHeaders = await signAwsRequest('GET', spriteUrl, region, accessKey, secretKey);
        const spriteResponse = await fetch(spriteUrl, { headers: spriteHeaders });
        
        if (spriteResponse.ok) {
          const data = await spriteResponse.arrayBuffer();
          const contentType = spriteResponse.headers.get('content-type') || 'application/json';
          return new Response(data, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
          });
        }
      }
      
      return new Response('Sprite not found', { status: 404, headers: corsHeaders });
    }

    // Handle glyphs requests
    if (action === 'glyphs') {
      const fontstack = url.searchParams.get('fontstack') || '';
      const range = url.searchParams.get('range') || '';
      
      const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor`;
      const styleHeaders = await signAwsRequest('GET', styleUrl, region, accessKey, secretKey);
      const styleResponse = await fetch(styleUrl, { headers: styleHeaders });
      const styleJson = await styleResponse.json();
      
      if (styleJson.glyphs) {
        const glyphUrl = styleJson.glyphs
          .replace('{fontstack}', encodeURIComponent(fontstack))
          .replace('{range}', range);
        console.log(`Fetching glyphs: ${glyphUrl}`);
        const glyphHeaders = await signAwsRequest('GET', glyphUrl, region, accessKey, secretKey);
        const glyphResponse = await fetch(glyphUrl, { headers: glyphHeaders });
        
        if (glyphResponse.ok) {
          const data = await glyphResponse.arrayBuffer();
          const contentType = glyphResponse.headers.get('content-type') || 'application/x-protobuf';
          return new Response(data, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
          });
        }
      }
      
      return new Response('Glyphs not found', { status: 404, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use ?action=style, tile, sprite, or glyphs' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Map proxy error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
