import { useState, useCallback } from 'react';

interface AddressResult {
  formatted: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

export function useReverseGeocode() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAddress = useCallback(async (lat: number, lng: number): Promise<AddressResult | null> => {
    if (lat === 0 && lng === 0) {
      return null; // GPS disabled
    }

    setIsLoading(true);
    setError(null);

    try {
      // Using OpenStreetMap's Nominatim API (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'AttendanceHub App'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const address = data.address || {};
      
      // Build a readable address string
      const parts: string[] = [];
      
      // Street/Road
      if (address.road || address.street) {
        parts.push(address.road || address.street);
      }
      if (address.house_number) {
        parts[0] = `${address.house_number}, ${parts[0] || ''}`;
      }
      
      // Neighborhood/Suburb
      if (address.suburb || address.neighbourhood || address.hamlet) {
        parts.push(address.suburb || address.neighbourhood || address.hamlet);
      }
      
      // City
      if (address.city || address.town || address.village || address.municipality) {
        parts.push(address.city || address.town || address.village || address.municipality);
      }
      
      // State/Region
      if (address.state || address.region) {
        parts.push(address.state || address.region);
      }

      return {
        formatted: parts.length > 0 ? parts.join(', ') : data.display_name || 'Unknown location',
        street: address.road || address.street,
        city: address.city || address.town || address.village,
        state: address.state || address.region,
        country: address.country,
        postcode: address.postcode
      };
    } catch (err: any) {
      setError(err.message || 'Failed to get address');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getAddress, isLoading, error };
}
