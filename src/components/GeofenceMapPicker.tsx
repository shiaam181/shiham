import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MapPin, Navigation, X } from 'lucide-react';

interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
  address: string;
  municipality?: string;
  region?: string;
}

interface GeofenceMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  radius: number;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
}

export default function GeofenceMapPicker({
  latitude,
  longitude,
  radius,
  onLocationChange,
}: GeofenceMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const circleLayerAdded = useRef(false);

  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const defaultCenter: [number, number] = [
    longitude ?? 78.9629,
    latitude ?? 20.5937,
  ];
  const defaultZoom = latitude ? 16 : 5;

  // Create/update marker and circle
  const updateMarkerAndCircle = useCallback(
    (lat: number, lng: number, map: maplibregl.Map) => {
      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width:40px;height:40px;border-radius:50%;
            background:hsl(var(--primary));
            border:3px solid white;
            box-shadow:0 2px 12px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            cursor:grab;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `;
        markerRef.current = new maplibregl.Marker({
          element: el,
          draggable: true,
        })
          .setLngLat([lng, lat])
          .addTo(map);

        markerRef.current.on('dragend', () => {
          const lngLat = markerRef.current!.getLngLat();
          onLocationChange(lngLat.lat, lngLat.lng);
          updateCircle(lngLat.lat, lngLat.lng, map);
          // Reverse geocode
          reverseGeocode(lngLat.lat, lngLat.lng);
        });
      }

      updateCircle(lat, lng, map);
    },
    [radius, onLocationChange]
  );

  // Draw radius circle as GeoJSON
  const updateCircle = useCallback(
    (lat: number, lng: number, map: maplibregl.Map) => {
      const circleGeoJSON = createCircleGeoJSON(lat, lng, radius);

      if (map.getSource('geofence-circle')) {
        (map.getSource('geofence-circle') as maplibregl.GeoJSONSource).setData(
          circleGeoJSON
        );
      } else {
        if (map.isStyleLoaded()) {
          addCircleLayer(map, circleGeoJSON);
        } else {
          map.on('load', () => addCircleLayer(map, circleGeoJSON));
        }
      }
    },
    [radius]
  );

  const addCircleLayer = (map: maplibregl.Map, data: GeoJSON.FeatureCollection) => {
    if (circleLayerAdded.current) return;
    circleLayerAdded.current = true;

    map.addSource('geofence-circle', {
      type: 'geojson',
      data,
    });

    map.addLayer({
      id: 'geofence-circle-fill',
      type: 'fill',
      source: 'geofence-circle',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.15,
      },
    });

    map.addLayer({
      id: 'geofence-circle-stroke',
      type: 'line',
      source: 'geofence-circle',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    });
  };

  // Reverse geocode a position
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/map-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
        { headers: { apikey: supabaseKey } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.label) {
          onLocationChange(lat, lng, data.label);
        }
      }
    } catch {
      // silently fail
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    const init = async () => {
      try {
        setIsMapLoading(true);
        setMapError(null);

        const { data, error } = await supabase.functions.invoke('map-proxy', {
          body: { action: 'get-style' },
        });

        if (cancelled) return;
        if (error || !data || data.error) {
          setMapError('Failed to load map');
          setIsMapLoading(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const proxyBase = `${supabaseUrl}/functions/v1/map-proxy`;

        const map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: data,
          center: defaultCenter,
          zoom: defaultZoom,
          transformRequest: (url: string) => {
            if (url.includes('amazonaws.com')) {
              return {
                url: `${proxyBase}?action=proxy&url=${encodeURIComponent(url)}`,
                headers: { apikey: supabaseKey },
              };
            }
            if (url.includes('map-proxy')) {
              return { url, headers: { apikey: supabaseKey } };
            }
            return { url };
          },
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Click to place marker
        map.on('click', (e) => {
          const { lat, lng } = e.lngLat;
          onLocationChange(lat, lng);
          updateMarkerAndCircle(lat, lng, map);
          reverseGeocode(lat, lng);
        });

        map.on('load', () => {
          if (!cancelled) {
            setIsMapLoading(false);
            // If we have initial coordinates, place marker
            if (latitude && longitude) {
              updateMarkerAndCircle(latitude, longitude, map);
            }
          }
        });

        map.on('idle', () => {
          if (!cancelled) setIsMapLoading(false);
        });

        mapRef.current = map;

        setTimeout(() => {
          if (!cancelled) setIsMapLoading(false);
        }, 12000);
      } catch (err: any) {
        if (!cancelled) {
          setMapError(err.message || 'Failed to initialize map');
          setIsMapLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      circleLayerAdded.current = false;
    };
  }, []);

  // Update circle when radius changes
  useEffect(() => {
    if (mapRef.current && latitude && longitude) {
      updateCircle(latitude, longitude, mapRef.current);
    }
  }, [radius, latitude, longitude, updateCircle]);

  // Search places
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/map-proxy?action=search&q=${encodeURIComponent(query)}`,
        { headers: { apikey: supabaseKey } }
      );

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        setShowResults(true);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const onSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleSearch(value), 400);
  };

  const selectPlace = (place: PlaceResult) => {
    onLocationChange(place.lat, place.lng, place.label);
    setSearchQuery(place.label);
    setShowResults(false);

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [place.lng, place.lat], zoom: 17, duration: 1200 });
      updateMarkerAndCircle(place.lat, place.lng, mapRef.current);
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onLocationChange(lat, lng);
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 17, duration: 1200 });
          updateMarkerAndCircle(lat, lng, mapRef.current);
        }
        reverseGeocode(lat, lng);
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground z-10" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Search for a place, address, or landmark..."
            className="pl-9 pr-20"
          />
          <div className="absolute right-1 flex items-center gap-1">
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowResults(false);
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCurrentLocation}
              title="Use current location"
            >
              <Navigation className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
            {searchResults.map((result, i) => (
              <button
                key={i}
                type="button"
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                onClick={() => selectPlace(result)}
              >
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{result.label}</p>
                  {result.municipality && (
                    <p className="text-xs text-muted-foreground truncate">
                      {result.municipality}
                      {result.region ? `, ${result.region}` : ''}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {isSearching && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg py-4 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Searching...</span>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative w-full h-[300px] sm:h-[350px] rounded-lg overflow-hidden border">
        {mapError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted p-6 text-center">
            <MapPin className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm font-medium text-destructive">{mapError}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Check AWS map credentials in settings
            </p>
          </div>
        )}
        {isMapLoading && !mapError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="touch-auto"
          style={{ height: '100%', width: '100%' }}
        />
        {!isMapLoading && !mapError && !latitude && (
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center border shadow-sm">
              <p className="text-xs text-muted-foreground">
                Click on the map or search to set location
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Coordinates display */}
      {latitude && longitude && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </span>
        </div>
      )}
    </div>
  );
}

// Generate a GeoJSON circle polygon
function createCircleGeoJSON(
  lat: number,
  lng: number,
  radiusMeters: number
): GeoJSON.FeatureCollection {
  const points = 64;
  const coords: [number, number][] = [];
  const earthRadius = 6371000;

  for (let i = 0; i <= points; i++) {
    const angle = (i * 360) / points;
    const radAngle = (angle * Math.PI) / 180;
    const dLat = (radiusMeters / earthRadius) * (180 / Math.PI);
    const dLng =
      dLat / Math.cos((lat * Math.PI) / 180);

    coords.push([
      lng + dLng * Math.cos(radAngle),
      lat + dLat * Math.sin(radAngle),
    ]);
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      },
    ],
  };
}
