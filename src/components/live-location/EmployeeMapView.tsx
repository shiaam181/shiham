import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { EmployeeLocation } from '@/hooks/useLiveLocations';
import { MapPin, Loader2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import 'leaflet/dist/leaflet.css';

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

// Get location freshness
function getStatusColor(recordedAt: string): string {
  const minutesAgo = (Date.now() - new Date(recordedAt).getTime()) / 1000 / 60;
  if (minutesAgo <= 5) return '#22c55e';
  if (minutesAgo <= 30) return '#eab308';
  return '#9ca3af';
}

// Create custom avatar marker icon
function createAvatarIcon(employee: EmployeeLocation): L.DivIcon {
  const color = getEmployeeColor(employee.full_name);
  const initials = getInitials(employee.full_name);
  const statusColor = getStatusColor(employee.recorded_at);

  return L.divIcon({
    className: 'custom-employee-marker',
    html: `
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
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -52],
  });
}

// Component to auto-fit map bounds when locations change
function MapBoundsUpdater({ locations }: { locations: EmployeeLocation[] }) {
  const map = useMap();
  const prevLocationsRef = useRef<string>('');

  useEffect(() => {
    if (locations.length === 0) return;

    const locKey = locations.map(l => `${l.user_id}:${l.latitude}:${l.longitude}`).join('|');
    if (locKey === prevLocationsRef.current) return;
    prevLocationsRef.current = locKey;

    const bounds = L.latLngBounds(
      locations.map(loc => [loc.latitude, loc.longitude] as [number, number])
    );

    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 15, { animate: true });
    } else {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
    }
  }, [locations, map]);

  return null;
}

export function EmployeeMapView({ locations, isLoading, onEmployeeClick }: EmployeeMapViewProps) {
  // Default center (India)
  const defaultCenter: [number, number] = useMemo(() => {
    if (locations.length > 0) {
      const avgLat = locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length;
      const avgLng = locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length;
      return [avgLat, avgLng];
    }
    return [20.5937, 78.9629]; // India center
  }, [locations]);

  if (isLoading && locations.length === 0) {
    return (
      <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden bg-muted flex flex-col items-center justify-center">
        <Users className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No active locations to display</p>
        <p className="text-xs text-muted-foreground mt-1">
          Employees need to enable tracking consent
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden border">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBoundsUpdater locations={locations} />
        {locations.map((location) => (
          <Marker
            key={location.user_id}
            position={[location.latitude, location.longitude]}
            icon={createAvatarIcon(location)}
            eventHandlers={{
              click: () => onEmployeeClick(location),
            }}
          >
            <Popup>
              <div className="text-center min-w-[140px]">
                <p className="font-semibold text-sm">{location.full_name}</p>
                <p className="text-xs text-gray-500">
                  {location.department || 'No dept'} • {location.position || 'No position'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(location.recorded_at), { addSuffix: true })}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
