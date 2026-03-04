import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');

    let region = Deno.env.get('AWS_REGION') || 'ap-south-1';
    let mapName = Deno.env.get('AWS_LOCATION_MAP_NAME') || '';
    let placeIndexName = Deno.env.get('AWS_LOCATION_PLACE_INDEX') || 'hrms-place-index';

    // Allow Developer Settings to override non-secret AWS Location config
    // without requiring secret updates for map/index/region changes.
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: cfgRow } = await adminClient
          .from('system_settings')
          .select('value')
          .eq('key', 'aws_location_config')
          .maybeSingle();

        const config = (cfgRow?.value as {
          region?: string;
          mapName?: string;
          placeIndexName?: string;
        } | null) ?? null;

        if (typeof config?.region === 'string' && config.region.trim()) {
          region = config.region.trim();
        }
        if (typeof config?.mapName === 'string' && config.mapName.trim()) {
          mapName = config.mapName.trim();
        }
        if (typeof config?.placeIndexName === 'string' && config.placeIndexName.trim()) {
          placeIndexName = config.placeIndexName.trim();
        }
      }
    } catch (settingsError) {
      console.warn('Failed to load aws_location_config from system settings, using env fallback:', settingsError);
    }

    if (!accessKey || !secretKey) {
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const needsMapName = action === 'style' || action === 'tile' || action === 'proxy' || req.method === 'POST';
    const needsPlaceIndex = action === 'search' || action === 'reverse-geocode';

    if (needsMapName && !mapName) {
      return new Response(JSON.stringify({ error: 'Map name not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (needsPlaceIndex && !placeIndexName) {
      return new Response(JSON.stringify({ error: 'Place index not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // ── Place search (geocoding) ──
    if (action === 'search') {
      const query = url.searchParams.get('q');
      if (!query) {
        return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const candidateIndexes = Array.from(
        new Set(
          [
            placeIndexName,
            Deno.env.get('AWS_LOCATION_PLACE_INDEX') || '',
            'HRMSPlaceIndex',
            'HRMS-place-index',
          ].map((v) => v.trim()).filter(Boolean)
        )
      );

      // Build signed POST request body once
      const body = JSON.stringify({
        Text: query,
        MaxResults: 5,
        Language: 'en',
      });

      let lastErrorText = 'Unknown place search error';
      let lastStatus = 500;

      for (const currentPlaceIndex of candidateIndexes) {
        const searchHost = `places.geo.${region}.amazonaws.com`;
        const searchPath = `/places/v0/indexes/${currentPlaceIndex}/search/text`;
        const searchUrl = `https://${searchHost}${searchPath}`;

        const nowD = new Date();
        const amzDateS = nowD.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStampS = amzDateS.slice(0, 8);
        const serviceS = 'geo';
        const credScopeS = `${dateStampS}/${region}/${serviceS}/aws4_request`;
        const payloadHashS = toHex(await sha256(body));
        const canonHeadersS = `content-type:application/json\nhost:${searchHost}\nx-amz-date:${amzDateS}\n`;
        const signedHeadersS = 'content-type;host;x-amz-date';
        const canonReqS = ['POST', searchPath, '', canonHeadersS, signedHeadersS, payloadHashS].join('\n');
        const strToSignS = ['AWS4-HMAC-SHA256', amzDateS, credScopeS, toHex(await sha256(canonReqS))].join('\n');
        const sigKeyS = await getSignatureKey(secretKey, dateStampS, region, serviceS);
        const sigS = toHex(await hmacSha256(sigKeyS, strToSignS));
        const authS = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScopeS}, SignedHeaders=${signedHeadersS}, Signature=${sigS}`;

        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': authS,
            'x-amz-date': amzDateS,
            'Content-Type': 'application/json',
            'Host': searchHost,
          },
          body,
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const results = (searchData.Results || []).map((r: any) => ({
            label: r.Place?.Label || '',
            lat: r.Place?.Geometry?.Point?.[1] || 0,
            lng: r.Place?.Geometry?.Point?.[0] || 0,
            address: r.Place?.Label || '',
            municipality: r.Place?.Municipality || '',
            region: r.Place?.Region || '',
            country: r.Place?.Country || '',
          }));

          return new Response(JSON.stringify({ results, placeIndexUsed: currentPlaceIndex }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const errText = await searchResponse.text();
        lastErrorText = errText;
        lastStatus = searchResponse.status;

        // Only fallback to next index on not-found index errors.
        if (searchResponse.status !== 404 || !errText.includes('Place index not found')) {
          console.error(`Place search failed [${searchResponse.status}] for index '${currentPlaceIndex}': ${errText}`);
          return new Response(JSON.stringify({ error: 'Place search failed', details: errText }), {
            status: searchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      console.error(`Place search failed [${lastStatus}] across candidate indexes: ${candidateIndexes.join(', ')}. Last error: ${lastErrorText}`);
      return new Response(JSON.stringify({ results: [], warning: 'No valid place index found for search' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Reverse geocode ──
    if (action === 'reverse-geocode') {
      const lat = url.searchParams.get('lat');
      const lng = url.searchParams.get('lng');
      if (!lat || !lng) {
        return new Response(JSON.stringify({ error: 'Missing lat/lng' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const revHost = `places.geo.${region}.amazonaws.com`;
      const revPath = `/places/v0/indexes/${placeIndexName}/search/position`;
      const revUrl = `https://${revHost}${revPath}`;
      const revBody = JSON.stringify({
        Position: [parseFloat(lng), parseFloat(lat)],
        MaxResults: 1,
        Language: 'en',
      });

      const nowR = new Date();
      const amzDateR = nowR.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStampR = amzDateR.slice(0, 8);
      const credScopeR = `${dateStampR}/${region}/geo/aws4_request`;
      const payloadHashR = toHex(await sha256(revBody));
      const canonHeadersR = `content-type:application/json\nhost:${revHost}\nx-amz-date:${amzDateR}\n`;
      const signedHeadersR = 'content-type;host;x-amz-date';
      const canonReqR = ['POST', revPath, '', canonHeadersR, signedHeadersR, payloadHashR].join('\n');
      const strToSignR = ['AWS4-HMAC-SHA256', amzDateR, credScopeR, toHex(await sha256(canonReqR))].join('\n');
      const sigKeyR = await getSignatureKey(secretKey, dateStampR, region, 'geo');
      const sigR = toHex(await hmacSha256(sigKeyR, strToSignR));
      const authR = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScopeR}, SignedHeaders=${signedHeadersR}, Signature=${sigR}`;

      const revResponse = await fetch(revUrl, {
        method: 'POST',
        headers: {
          'Authorization': authR,
          'x-amz-date': amzDateR,
          'Content-Type': 'application/json',
          'Host': revHost,
        },
        body: revBody,
      });

      if (!revResponse.ok) {
        const errText = await revResponse.text();
        return new Response(JSON.stringify({ error: 'Reverse geocode failed', details: errText }), {
          status: revResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const revData = await revResponse.json();
      const place = revData.Results?.[0]?.Place;
      return new Response(JSON.stringify({
        label: place?.Label || '',
        address: place?.Label || '',
        municipality: place?.Municipality || '',
        region: place?.Region || '',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
