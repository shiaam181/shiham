import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { EmployeeLocation } from '@/hooks/useLiveLocations';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface EmployeeMapViewProps {
  locations: EmployeeLocation[];
  isLoading: boolean;
  onEmployeeClick: (employee: EmployeeLocation) => void;
}

// Generate a consistent color for each employee based on their name
function getEmployeeColor(name: string): string {
  const colors = [
    '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
    '#0891b2', '#c026d3', '#ca8a04', '#4f46e5', '#059669',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Get initials from full name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Get location freshness color
function getStatusColor(recordedAt: string): string {
  const minutesAgo = (Date.now() - new Date(recordedAt).getTime()) / 1000 / 60;
  if (minutesAgo <= 5) return '#22c55e';
  if (minutesAgo <= 30) return '#eab308';
  return '#9ca3af';
}

// Create a DOM element for custom marker
function createMarkerElement(employee: EmployeeLocation): HTMLDivElement {
  const color = getEmployeeColor(employee.full_name);
  const initials = getInitials(employee.full_name);
  const statusColor = getStatusColor(employee.recorded_at);

  const el = document.createElement('div');
  el.className = 'employee-map-marker';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div style="position:relative;width:44px;height:52px;">
      <div style="
        width:40px;height:40px;border-radius:50%;
        background:${color};
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:700;font-size:14px;
        font-family:system-ui,-apple-system,sans-serif;
        position:relative;z-index:2;
      ">${initials}</div>
      <div style="
        width:12px;height:12px;border-radius:50%;
        background:${statusColor};
        border:2px solid white;
        position:absolute;bottom:10px;right:-2px;z-index:3;
      "></div>
      <div style="
        width:0;height:0;
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-top:10px solid white;
        position:absolute;bottom:-6px;left:50%;
        transform:translateX(-50%);z-index:1;
      "></div>
      <div style="
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:8px solid ${color};
        position:absolute;bottom:-3px;left:50%;
        transform:translateX(-50%);z-index:1;
      "></div>
    </div>
  `;
  return el;
}

export function EmployeeMapView({ locations, isLoading, onEmployeeClick }: EmployeeMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);

  const defaultCenter: [number, number] = useMemo(() => {
    if (locations.length > 0) {
      const avgLng = locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length;
      const avgLat = locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length;
      return [avgLng, avgLat]; // MapLibre uses [lng, lat]
    }
    return [78.9629, 20.5937]; // India center [lng, lat]
  }, [locations]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        setIsMapLoading(true);
        setMapError(null);

        console.log('Fetching AWS map style...');

        // Fetch the style from our proxy edge function
        const { data, error } = await supabase.functions.invoke('map-proxy', {
          body: { action: 'get-style' },
        });

        if (cancelled) return;

        if (error) {
          console.error('Error fetching map style:', error);
          setMapError('Failed to load AWS map. Check your AWS credentials.');
          setIsMapLoading(false);
          return;
        }

        if (!data || data.error) {
          console.error('Map style error:', data?.error);
          setMapError(data?.error || 'Failed to fetch map style');
          setIsMapLoading(false);
          return;
        }

        console.log('Map style fetched, initializing MapLibre...');

        // Get the Supabase anon key for tile requests
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: data, // The style object from edge function
          center: defaultCenter,
          zoom: 10,
          transformRequest: (url: string) => {
            // Add auth headers for requests to our edge function
            if (url.includes('map-proxy')) {
              return {
                url,
                headers: {
                  'apikey': supabaseKey,
                },
              };
            }
            return { url };
          },
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          console.log('MapLibre map loaded successfully');
          if (!cancelled) {
            setIsMapLoading(false);
          }
        });

        map.on('error', (e) => {
          console.error('MapLibre error:', e);
        });

        mapRef.current = map;
      } catch (err: any) {
        console.error('Map init error:', err);
        if (!cancelled) {
          setMapError(err.message || 'Failed to initialize map');
          setIsMapLoading(false);
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (locations.length === 0) return;

    // Add new markers
    locations.forEach((location) => {
      const el = createMarkerElement(location);
      el.addEventListener('click', () => onEmployeeClick(location));

      const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
        <div style="text-align:center;min-width:140px;padding:4px;">
          <p style="font-weight:600;font-size:14px;margin:0 0 4px 0;">${location.full_name}</p>
          <p style="font-size:12px;color:#6b7280;margin:0 0 4px 0;">
            ${location.department || 'No dept'} • ${location.position || 'No position'}
          </p>
          <p style="font-size:11px;color:#9ca3af;margin:0;">
            ${formatDistanceToNow(new Date(location.recorded_at), { addSuffix: true })}
          </p>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (locations.length === 1) {
      map.flyTo({
        center: [locations[0].longitude, locations[0].latitude],
        zoom: 15,
        duration: 1000,
      });
    } else {
      const bounds = new maplibregl.LngLatBounds();
      locations.forEach(loc => bounds.extend([loc.longitude, loc.latitude]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
    }
  }, [locations, onEmployeeClick]);

  if (isLoading && locations.length === 0 && !mapRef.current) {
    return (
      <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden bg-muted flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
        <p className="text-sm font-medium text-destructive">{mapError}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Ensure AWS Location Service credentials and map name are configured correctly.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden border">
      {isMapLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading AWS map...</p>
          </div>
        </div>
      )}
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      {!isMapLoading && locations.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60">
          <Users className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No active locations to display</p>
        </div>
      )}
    </div>
  );
}
