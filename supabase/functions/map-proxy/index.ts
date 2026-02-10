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
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return await hmacSha256(kService, 'aws4_request');
}

async function signAndFetch(method: string, targetUrl: string, region: string, accessKey: string, secretKey: string): Promise<Response> {
  const urlObj = new URL(targetUrl);
  const host = urlObj.host;
  // AWS SigV4 requires URI-encoding each path segment; already-encoded chars must be double-encoded
  const canonicalUri = urlObj.pathname
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  const sortedParams = [...urlObj.searchParams.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const service = 'geo';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = toHex(await sha256(''));
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';

  const canonicalRequest = [method, canonicalUri, sortedParams, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, toHex(await sha256(canonicalRequest))].join('\n');
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(urlObj.href, {
    method,
    headers: {
      'Authorization': authHeader,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Host': host,
    },
  });
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
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!mapName) {
      return new Response(JSON.stringify({ error: 'Map name not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ── Generic AWS proxy: signs and forwards any amazonaws.com URL ──
    if (action === 'proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl || !targetUrl.includes('amazonaws.com')) {
        return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const awsResponse = await signAndFetch('GET', targetUrl, region, accessKey, secretKey);
      if (!awsResponse.ok) {
        const errText = await awsResponse.text();
        console.error(`Proxy fetch failed [${awsResponse.status}]: ${errText}`);
        return new Response(errText, { status: awsResponse.status, headers: corsHeaders });
      }

      const data = await awsResponse.arrayBuffer();
      const contentType = awsResponse.headers.get('content-type') || 'application/octet-stream';
      return new Response(data, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // ── Tile requests ──
    if (action === 'tile') {
      const z = url.searchParams.get('z');
      const x = url.searchParams.get('x');
      const y = url.searchParams.get('y');
      if (!z || !x || !y) {
        return new Response(JSON.stringify({ error: 'Missing z, x, y parameters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tileUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/tiles/${z}/${x}/${y}`;
      const tileResponse = await signAndFetch('GET', tileUrl, region, accessKey, secretKey);
      if (!tileResponse.ok) {
        const errText = await tileResponse.text();
        console.error(`Tile fetch failed [${tileResponse.status}]: ${errText}`);
        return new Response(errText, { status: tileResponse.status, headers: corsHeaders });
      }

      const tileData = await tileResponse.arrayBuffer();
      const contentType = tileResponse.headers.get('content-type') || 'application/vnd.mapbox-vector-tile';
      return new Response(tileData, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // ── Style descriptor (POST from frontend or GET ?action=style) ──
    if (action === 'style' || req.method === 'POST') {
      const mapBaseUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}`;
      const styleUrl = `${mapBaseUrl}/style-descriptor`;

      const styleResponse = await signAndFetch('GET', styleUrl, region, accessKey, secretKey);
      if (!styleResponse.ok) {
        const errText = await styleResponse.text();
        console.error(`Style fetch failed [${styleResponse.status}]: ${errText}`);
        return new Response(JSON.stringify({ error: `Failed to fetch map style: ${errText}` }), {
          status: styleResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const styleJson = await styleResponse.json();
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
          if (source.url && typeof source.url === 'string' && source.url.includes('amazonaws.com')) {
            try {
              const tileJsonResponse = await signAndFetch('GET', source.url, region, accessKey, secretKey);
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

      // Keep original AWS sprite and glyph URLs — the frontend's transformRequest
      // will route them through our generic proxy endpoint
      // (Don't rewrite them here — MapLibre appends extensions like .json/.png to sprites)

      console.log('Style descriptor fetched and tile sources rewritten');
      return new Response(JSON.stringify(styleJson), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use ?action=style, tile, or proxy' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Map proxy error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
