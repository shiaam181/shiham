import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Shield, AlertTriangle, Loader2, Play, Pause } from 'lucide-react';
import { useLiveTracking } from '@/hooks/useLiveTracking';
import { format } from 'date-fns';

export function LiveTrackingConsent() {
  const {
    globalEnabled,
    companyEnabled,
    consented,
    isLoading,
    isTracking,
    canTrack,
    lastUpdate,
    error,
    updateConsent,
    startTracking,
    stopTracking,
  } = useLiveTracking();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading tracking settings...</span>
        </CardContent>
      </Card>
    );
  }

  // Don't show if tracking is globally disabled or company hasn't enabled it
  if (!globalEnabled || !companyEnabled) {
    // Show informative message instead of hiding completely
    return (
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg text-muted-foreground">Live Location Tracking</CardTitle>
          </div>
          <CardDescription>
            {!globalEnabled 
              ? 'Live tracking is currently disabled by your administrator'
              : 'Live tracking is not enabled for your company'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Live Location Tracking</CardTitle>
          </div>
          {isTracking && (
            <Badge variant="default" className="bg-green-500 animate-pulse">
              <MapPin className="w-3 h-3 mr-1" /> Live
            </Badge>
          )}
        </div>
        <CardDescription>
          Your company has enabled live location tracking during work hours
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consent Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              consented ? 'bg-primary/20' : 'bg-muted'
            }`}>
              <Shield className={`w-5 h-5 ${consented ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="consent-toggle" className="text-sm font-medium cursor-pointer">
                I consent to location tracking
              </Label>
              <p className="text-xs text-muted-foreground">
                Your location will only be shared during active tracking
              </p>
            </div>
          </div>
          <Switch
            id="consent-toggle"
            checked={consented}
            onCheckedChange={updateConsent}
          />
        </div>

        {/* Tracking Controls */}
        {consented && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isTracking ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopTracking}
                  className="gap-2"
                >
                  <Pause className="w-4 h-4" />
                  Stop Tracking
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={startTracking}
                  disabled={!canTrack}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Tracking
                </Button>
              )}
            </div>

            {/* Status Info */}
            {lastUpdate && (
              <p className="text-xs text-muted-foreground">
                Last update: {format(lastUpdate, 'hh:mm:ss a')}
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Privacy Notice */}
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Privacy:</strong> Your location is only tracked when you explicitly start tracking. 
            You can revoke consent at any time, and tracking will stop immediately.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
