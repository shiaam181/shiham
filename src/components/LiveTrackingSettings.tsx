import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MapPin, 
  Globe, 
  Key, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  Building2,
  ExternalLink,
  XCircle,
  PlayCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
  live_tracking_enabled: boolean;
}

export function LiveTrackingSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  
  // Map service status
  const [awsConfigured, setAwsConfigured] = useState(false);
  const [awsStatus, setAwsStatus] = useState<{
    hasAccessKey: boolean;
    hasSecretKey: boolean;
    hasRegion: boolean;
    hasMapName: boolean;
    region: string;
    mapName: string;
  } | null>(null);
  const [testingAws, setTestingAws] = useState(false);
  const [awsTestResult, setAwsTestResult] = useState<'success' | 'error' | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
    checkAwsConfig();
  }, []);

  const checkAwsConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('test-aws-location', {
        body: { action: 'get' }
      });
      
      if (!error && data) {
        setAwsConfigured(data.configured || false);
        setAwsStatus({
          hasAccessKey: data.hasAccessKey || false,
          hasSecretKey: data.hasSecretKey || false,
          hasRegion: data.hasRegion || false,
          hasMapName: data.hasMapName || false,
          region: data.region || 'Not set',
          mapName: data.mapName || 'Not set',
        });
      }
    } catch (err) {
      console.error('Error checking AWS Location config:', err);
    }
  };

  const testAwsLocation = async () => {
    setTestingAws(true);
    setAwsTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-aws-location', {
        body: { action: 'test' }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setAwsTestResult('success');
        toast({
          title: 'Map Service Test Passed',
          description: data.message || 'Credentials are valid and map exists',
        });
      } else {
        throw new Error(data?.error || 'Test failed');
      }
    } catch (error: any) {
      setAwsTestResult('error');
      toast({
        title: 'Map Service Test Failed',
        description: error.message || 'Failed to verify credentials',
        variant: 'destructive',
      });
    } finally {
      setTestingAws(false);
    }
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      // Get global setting
      const { data: globalSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'live_tracking_enabled')
        .maybeSingle();

      setGlobalEnabled((globalSetting?.value as { enabled?: boolean })?.enabled ?? false);

      // Get all companies with their tracking status
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, live_tracking_enabled')
        .order('name');

      setCompanies(companiesData || []);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGlobalTracking = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'live_tracking_enabled',
          value: { enabled },
        }, { onConflict: 'key' });

      if (error) throw error;

      setGlobalEnabled(enabled);
      toast({
        title: enabled ? 'Live Tracking Enabled' : 'Live Tracking Disabled',
        description: enabled 
          ? 'Companies can now enable live location tracking for their employees.'
          : 'Live location tracking has been disabled globally.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update setting',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Live Location Tracking</CardTitle>
          </div>
          <CardDescription>
            Enable or disable live location tracking globally across all companies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                globalEnabled ? 'bg-green-500/20' : 'bg-muted'
              }`}>
                <MapPin className={`w-5 h-5 ${globalEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="global-toggle" className="text-sm font-medium cursor-pointer">
                  Global Live Tracking
                </Label>
                <p className="text-xs text-muted-foreground">
                  {globalEnabled 
                    ? 'Company owners can enable tracking for their employees'
                    : 'Live tracking is disabled for all companies'}
                </p>
              </div>
            </div>
            <Switch
              id="global-toggle"
              checked={globalEnabled}
              onCheckedChange={toggleGlobalTracking}
              disabled={isSaving}
            />
          </div>

          {globalEnabled && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700 dark:text-green-300">
                Live tracking is enabled. Company owners can now enable tracking for their employees.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Companies Status - Toggleable */}
      {globalEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Company Tracking Status</CardTitle>
            </div>
            <CardDescription>
              Enable or disable live tracking for each company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No companies found
                </p>
              ) : (
                companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{company.name}</span>
                    </div>
                    <Switch
                      checked={company.live_tracking_enabled}
                      onCheckedChange={(enabled) => toggleCompanyTracking(company.id, enabled)}
                      disabled={isSaving}
                    />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map Service Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Map Service</CardTitle>
          </div>
          <CardDescription>
            Required for map rendering in live tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configuration Status */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Access Key</span>
              </div>
              <Badge variant={awsStatus?.hasAccessKey ? 'default' : 'outline'}>
                {awsStatus?.hasAccessKey ? 'Configured' : 'Not Set'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Secret Key</span>
              </div>
              <Badge variant={awsStatus?.hasSecretKey ? 'default' : 'outline'}>
                {awsStatus?.hasSecretKey ? 'Configured' : 'Not Set'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Region</span>
              </div>
              <Badge variant={awsStatus?.hasRegion ? 'default' : 'outline'}>
                {awsStatus?.region || 'Not Set'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Map Name</span>
              </div>
              <Badge variant={awsStatus?.hasMapName ? 'default' : 'outline'}>
                {awsStatus?.mapName || 'Not Set'}
              </Badge>
            </div>
          </div>

          {/* Overall Status */}
          {awsConfigured ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-primary">
                All map service secrets are configured. Use the test button to verify connectivity.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                Some map secrets are missing. Map rendering will not work until all secrets are configured.
              </p>
            </div>
          )}

          {/* Test Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Test connection to map service
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testAwsLocation}
              disabled={testingAws || !awsConfigured}
            >
              {testingAws ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : awsTestResult === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
              ) : awsTestResult === 'error' ? (
                <XCircle className="w-4 h-4 mr-2 text-destructive" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AWS Setup Guide */}
      <Collapsible open={showGuide} onOpenChange={setShowGuide}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Setup Guide</CardTitle>
                </div>
                {showGuide ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CollapsibleTrigger>
            <CardDescription>
              How to configure credentials for map rendering
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t pt-4">
              <div className="space-y-4 text-sm">
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">1</span>
                    Create an AWS Account
                  </h4>
                  <p className="text-muted-foreground pl-8">
                    If you don't have one, create an AWS account at{' '}
                    <a href="https://aws.amazon.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                      aws.amazon.com <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">2</span>
                    Create a Location Service Map
                  </h4>
                  <ol className="text-muted-foreground pl-8 space-y-2 list-decimal list-inside">
                    <li>Go to AWS Console → Amazon Location Service</li>
                    <li>Click "Create map"</li>
                    <li>Choose a name (e.g., "attendance-tracker-map")</li>
                    <li>Select a map style (e.g., "Esri Light Gray Canvas")</li>
                    <li>Click "Create map"</li>
                  </ol>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">3</span>
                    Create IAM Credentials
                  </h4>
                  <ol className="text-muted-foreground pl-8 space-y-2 list-decimal list-inside">
                    <li>Go to AWS Console → IAM → Users</li>
                    <li>Create a new user with programmatic access</li>
                    <li>Attach policy: AmazonLocationReadOnlyAccess</li>
                    <li>Save the Access Key ID and Secret Access Key</li>
                  </ol>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">4</span>
                    Configure Secrets
                  </h4>
                  <p className="text-muted-foreground pl-8">
                    Add the following secrets to your Cloud environment:
                  </p>
                  <ul className="text-muted-foreground pl-8 space-y-1 list-disc list-inside">
                    <li><code className="text-xs bg-muted px-1 rounded">AWS_ACCESS_KEY_ID</code></li>
                    <li><code className="text-xs bg-muted px-1 rounded">AWS_SECRET_ACCESS_KEY</code></li>
                    <li><code className="text-xs bg-muted px-1 rounded">AWS_REGION</code> (e.g., ap-south-1)</li>
                    <li><code className="text-xs bg-muted px-1 rounded">AWS_LOCATION_MAP_NAME</code></li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    Free Tier Limits
                  </h4>
                  <ul className="text-amber-600 dark:text-amber-400 pl-6 space-y-1 list-disc list-inside text-xs">
                    <li>1,000 tiles/month for maps (free)</li>
                    <li>10,000 geocoding requests/month (free)</li>
                    <li>If you exceed limits, charges apply ($0.04/1,000 tiles)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
