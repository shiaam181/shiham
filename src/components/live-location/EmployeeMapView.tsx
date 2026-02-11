import { useEffect, useRef, useMemo, useState } from 'react';
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

// Distance threshold in degrees (~100m) for clustering nearby markers
const CLUSTER_THRESHOLD = 0.001;

interface Cluster {
  employees: EmployeeLocation[];
  centerLat: number;
  centerLng: number;
}

// Group nearby locations into clusters
function clusterLocations(locations: EmployeeLocation[]): Cluster[] {
  const used = new Set<number>();
  const clusters: Cluster[] = [];

  for (let i = 0; i < locations.length; i++) {
    if (used.has(i)) continue;
    const group: EmployeeLocation[] = [locations[i]];
    used.add(i);

    for (let j = i + 1; j < locations.length; j++) {
      if (used.has(j)) continue;
      const dLat = Math.abs(locations[i].latitude - locations[j].latitude);
      const dLng = Math.abs(locations[i].longitude - locations[j].longitude);
      if (dLat < CLUSTER_THRESHOLD && dLng < CLUSTER_THRESHOLD) {
        group.push(locations[j]);
        used.add(j);
      }
    }

    const centerLat = group.reduce((s, e) => s + e.latitude, 0) / group.length;
    const centerLng = group.reduce((s, e) => s + e.longitude, 0) / group.length;
    clusters.push({ employees: group, centerLat, centerLng });
  }

  return clusters;
}

// Create a single employee marker
function createSingleMarkerElement(employee: EmployeeLocation): HTMLDivElement {
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

// Create a cluster marker showing multiple employees in a ring
function createClusterMarkerElement(employees: EmployeeLocation[]): HTMLDivElement {
  const count = employees.length;
  // Outer ring size scales with count
  const size = Math.min(64 + count * 4, 90);
  const innerCircleSize = 28;
  const radius = (size - innerCircleSize) / 2 - 2;

  const el = document.createElement('div');
  el.className = 'employee-map-cluster';
  el.style.cursor = 'pointer';
  el.style.position = 'relative';
  el.style.width = `${size}px`;
  el.style.height = `${size + 10}px`;

  // Build mini avatars arranged in a circle
  const avatars = employees.slice(0, 8).map((emp, i) => {
    const angle = (2 * Math.PI * i) / Math.min(count, 8) - Math.PI / 2;
    const x = size / 2 + radius * Math.cos(angle) - 12;
    const y = size / 2 + radius * Math.sin(angle) - 12;
    const color = getEmployeeColor(emp.full_name);
    const initials = getInitials(emp.full_name);
    return `<div style="
      position:absolute;left:${x}px;top:${y}px;
      width:24px;height:24px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.2);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:700;font-size:9px;
      font-family:system-ui,-apple-system,sans-serif;
      z-index:3;
    ">${initials}</div>`;
  }).join('');

  // Center count badge
  el.innerHTML = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${avatars}
      <div style="
        position:absolute;
        left:50%;top:50%;
        transform:translate(-50%,-50%);
        width:${innerCircleSize}px;height:${innerCircleSize}px;
        border-radius:50%;
        background:hsl(var(--primary));
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:800;font-size:12px;
        font-family:system-ui,-apple-system,sans-serif;
        z-index:4;
      ">${count}</div>
    </div>
    <div style="
      width:0;height:0;
      border-left:8px solid transparent;
      border-right:8px solid transparent;
      border-top:10px solid white;
      position:absolute;bottom:-2px;left:50%;
      transform:translateX(-50%);z-index:1;
    "></div>
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
      return [avgLng, avgLat];
    }
    return [78.9629, 20.5937];
  }, [locations]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    let loadTimeout: ReturnType<typeof setTimeout>;

    const initMap = async () => {
      try {
        setIsMapLoading(true);
        setMapError(null);

        const { data, error } = await supabase.functions.invoke('map-proxy', {
          body: { action: 'get-style' },
        });

        if (cancelled) return;

        if (error) {
          setMapError('Failed to load map. Please check map credentials in settings.');
          setIsMapLoading(false);
          return;
        }

        if (!data || data.error) {
          setMapError(data?.error || 'Failed to fetch map style');
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
          zoom: 10,
          transformRequest: (url: string) => {
            if (url.includes('amazonaws.com')) {
              return {
                url: `${proxyBase}?action=proxy&url=${encodeURIComponent(url)}`,
                headers: { 'apikey': supabaseKey },
              };
            }
            if (url.includes('map-proxy')) {
              return {
                url,
                headers: { 'apikey': supabaseKey },
              };
            }
            return { url };
          },
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          if (!cancelled) {
            clearTimeout(loadTimeout);
            setIsMapLoading(false);
          }
        });

        map.on('idle', () => {
          if (!cancelled && mapRef.current) {
            clearTimeout(loadTimeout);
            setIsMapLoading(false);
          }
        });

        map.on('error', () => {
          if (!cancelled) {
            clearTimeout(loadTimeout);
            setIsMapLoading(false);
          }
        });

        mapRef.current = map;

        loadTimeout = setTimeout(() => {
          if (!cancelled) {
            setIsMapLoading(false);
          }
        }, 15000);

      } catch (err: any) {
        if (!cancelled) {
          setMapError(err.message || 'Failed to initialize map');
          setIsMapLoading(false);
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when locations change — with clustering
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (locations.length === 0) return;

    const clusters = clusterLocations(locations);

    clusters.forEach((cluster) => {
      if (cluster.employees.length === 1) {
        // Single employee — normal marker
        const emp = cluster.employees[0];
        const el = createSingleMarkerElement(emp);
        el.addEventListener('click', () => onEmployeeClick(emp));

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
          <div style="text-align:center;min-width:140px;padding:4px;">
            <p style="font-weight:600;font-size:14px;margin:0 0 4px 0;">${emp.full_name}</p>
            <p style="font-size:12px;color:#6b7280;margin:0 0 4px 0;">
              ${emp.department || 'No dept'} • ${emp.position || 'No position'}
            </p>
            <p style="font-size:11px;color:#9ca3af;margin:0;">
              ${formatDistanceToNow(new Date(emp.recorded_at), { addSuffix: true })}
            </p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([emp.longitude, emp.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      } else {
        // Cluster — grouped marker
        const el = createClusterMarkerElement(cluster.employees);

        // Build popup listing all employees
        const listHtml = cluster.employees.map(emp => `
          <div style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;" data-emp-id="${emp.user_id}">
            <div style="
              width:20px;height:20px;border-radius:50%;
              background:${getEmployeeColor(emp.full_name)};
              display:flex;align-items:center;justify-content:center;
              color:white;font-size:8px;font-weight:700;flex-shrink:0;
            ">${getInitials(emp.full_name)}</div>
            <span style="font-size:12px;font-weight:500;">${emp.full_name}</span>
          </div>
        `).join('');

        const popup = new maplibregl.Popup({ offset: 30, closeButton: true }).setHTML(`
          <div style="min-width:160px;max-height:200px;overflow-y:auto;padding:4px;">
            <p style="font-weight:700;font-size:13px;margin:0 0 6px 0;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">
              ${cluster.employees.length} Employees
            </p>
            ${listHtml}
          </div>
        `);

        // After popup opens, attach click handlers to each employee row
        popup.on('open', () => {
          const popupEl = popup.getElement();
          if (popupEl) {
            cluster.employees.forEach(emp => {
              const row = popupEl.querySelector(`[data-emp-id="${emp.user_id}"]`);
              if (row) {
                (row as HTMLElement).addEventListener('click', () => {
                  popup.remove();
                  onEmployeeClick(emp);
                });
              }
            });
          }
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([cluster.centerLng, cluster.centerLat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      }
    });

    // Fit bounds
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

  return (
    <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden border touch-auto">
      {mapError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-medium text-destructive">{mapError}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Ensure map service credentials are configured correctly in settings.
          </p>
        </div>
      )}
      {(isMapLoading || (isLoading && locations.length === 0)) && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      <div ref={mapContainerRef} className="touch-auto" style={{ height: '100%', width: '100%' }} />
      {!isMapLoading && !mapError && locations.length === 0 && !isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 pointer-events-none">
          <Users className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No active locations to display</p>
        </div>
      )}
    </div>
  );
}
