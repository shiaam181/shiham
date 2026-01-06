import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { 
  Download, 
  Smartphone, 
  CheckCircle2, 
  Share, 
  PlusSquare,
  ArrowLeft,
  Wifi,
  Bell,
  Zap
} from 'lucide-react';

export default function Install() {
  const navigate = useNavigate();
  const { isInstallable, isInstalled, promptInstall, showIOSInstructions } = usePWAInstall();

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* App Icon */}
        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg">
          <img src="/pwa-192x192.png" alt="AttendanceHub" className="w-20 h-20 rounded-xl" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display">Install AttendanceHub</h1>
          <p className="text-muted-foreground max-w-md">
            Add AttendanceHub to your home screen for quick access and a native app experience
          </p>
        </div>

        {/* Already Installed */}
        {isInstalled && (
          <Card className="w-full max-w-md border-success/50 bg-success/5">
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
              <div>
                <h2 className="text-xl font-semibold text-success">Already Installed!</h2>
                <p className="text-muted-foreground mt-1">
                  AttendanceHub is installed on your device. Open it from your home screen.
                </p>
              </div>
              <Button onClick={() => navigate('/')} className="w-full">
                Open App
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Android/Desktop Install Button */}
        {isInstallable && !isInstalled && (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Download className="w-5 h-5" />
                Ready to Install
              </CardTitle>
              <CardDescription>
                Click the button below to install the app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleInstall} size="lg" className="w-full">
                <Smartphone className="w-5 h-5 mr-2" />
                Install App
              </Button>
            </CardContent>
          </Card>
        )}

        {/* iOS Instructions */}
        {showIOSInstructions && !isInstalled && (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Install on iPhone/iPad</CardTitle>
              <CardDescription>
                Follow these steps to add to your home screen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium">Tap the Share button</p>
                  <p className="text-sm text-muted-foreground">
                    Look for the <Share className="w-4 h-4 inline mx-1" /> icon at the bottom of Safari
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium">Add to Home Screen</p>
                  <p className="text-sm text-muted-foreground">
                    Scroll down and tap <PlusSquare className="w-4 h-4 inline mx-1" /> "Add to Home Screen"
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium">Confirm Installation</p>
                  <p className="text-sm text-muted-foreground">
                    Tap "Add" in the top right corner
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not installable fallback */}
        {!isInstallable && !isInstalled && !showIOSInstructions && (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Install from Browser Menu</CardTitle>
              <CardDescription>
                Use your browser's menu to install this app
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Look for "Install app", "Add to Home Screen", or similar option in your browser menu.
              </p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Continue to App
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <div className="w-full max-w-md space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground text-center">App Features</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card border">
              <Wifi className="w-5 h-5 text-primary" />
              <span className="text-xs text-center">Works Offline</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card border">
              <Bell className="w-5 h-5 text-primary" />
              <span className="text-xs text-center">Push Alerts</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card border">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-xs text-center">Fast & Native</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
