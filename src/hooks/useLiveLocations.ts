import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { parseEdgeFunctionErrorMessage } from '@/lib/edgeFunctionError';

export interface EmployeeLocation {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  company_id: string;
  company_name?: string;
}

// Parse edge function errors to user-friendly messages
function getReadableError(err: any): string {
  // Try to parse the error using the existing utility
  const parsed = parseEdgeFunctionErrorMessage(
    err?.context ?? err?.message ?? err
  );
  
  if (typeof parsed === 'object' && parsed !== null) {
    const errorObj = parsed as { error?: string; code?: string };
    if (errorObj.error) {
      // Map known error codes to user-friendly messages
      switch (errorObj.code) {
        case 'ACCESS_DENIED':
          return 'You do not have permission to view live locations';
        case 'NO_COMPANY':
          return 'Your account is not associated with a company';
        case 'INVALID_TOKEN':
          return 'Your session has expired. Please sign in again';
        default:
          return errorObj.error;
      }
    }
  }
  
  // Fallback for generic errors
  const errMessage = err?.message || String(err);
  if (errMessage.includes('non-2xx status code')) {
    return 'Unable to load locations. Please try again';
  }
  
  return errMessage;
}

export function useLiveLocations(companyId?: string, refreshInterval = 30000) {
  const { user } = useAuth();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!user) return;

    try {
      const params: Record<string, string> = {};
      if (companyId) {
        params.company_id = companyId;
      }

      const { data, error } = await supabase.functions.invoke('get-live-locations', {
        body: params,
      });

      if (error) throw error;

      if (data?.success) {
        setLocations(data.locations || []);
        setError(null);
        setLastFetch(new Date());
      } else {
        throw new Error(data?.error || 'Failed to fetch locations');
      }
    } catch (err: any) {
      console.error('Error fetching live locations:', err);
      setError(getReadableError(err));
    } finally {
      setIsLoading(false);
    }
  }, [user, companyId]);

  useEffect(() => {
    fetchLocations();

    // Set up auto-refresh
    const intervalId = setInterval(fetchLocations, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchLocations, refreshInterval]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('live-locations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'employee_live_locations',
          ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
        },
        () => {
          // Refetch when new locations are added
          fetchLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, companyId, fetchLocations]);

  return {
    locations,
    isLoading,
    error,
    lastFetch,
    refetch: fetchLocations,
  };
}
