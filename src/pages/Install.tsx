import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { 
  Download, 
  Smartphone, 
  CheckCircle2, 
  Share, 
  PlusSquare,
  ArrowRight,
  Wifi,
  Bell,
  Zap,
  Clock,
  Shield,
  Camera,
  MapPin,
  Apple,
  Chrome
} from 'lucide-react';

export default function Install() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isInstallable, isInstalled, promptInstall, showIOSInstructions, isIOS } = usePWAInstall();

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      navigate('/dashboard');
    }
  };

  const handleSkip = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const handleContinue = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
          Skip for now
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* App Icon */}
        <div className="relative">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/30">
            <Clock className="w-14 h-14 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-success flex items-center justify-center shadow-lg">
            <Download className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold font-display">Get the App</h1>
          <p className="text-muted-foreground max-w-sm">
            Install AttendanceHub on your device for the best experience with offline access and instant notifications
          </p>
        </div>

        {/* Already Installed */}
        {isInstalled && (
          <Card className="w-full max-w-md border-success/50 bg-success/5">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-success">App Installed!</h2>
                <p className="text-muted-foreground mt-1">
                  AttendanceHub is installed. Open it from your home screen for the best experience.
                </p>
              </div>
              <Button onClick={handleContinue} size="lg" className="w-full">
                Continue to App
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Android/Desktop Install Button */}
        {isInstallable && !isInstalled && (
          <Card className="w-full max-w-md border-primary/30">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Chrome className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Install with One Tap</CardTitle>
              <CardDescription>
                Add to your home screen instantly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleInstall} size="lg" variant="hero" className="w-full">
                <Download className="w-5 h-5 mr-2" />
                Install AttendanceHub
              </Button>
              <Button variant="outline" onClick={handleSkip} className="w-full">
                Continue in Browser
              </Button>
            </CardContent>
          </Card>
        )}

        {/* iOS Instructions */}
        {showIOSInstructions && !isInstalled && (
          <Card className="w-full max-w-md border-primary/30">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Apple className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Install on {isIOS ? 'iPhone/iPad' : 'Your Device'}</CardTitle>
              <CardDescription>
                Follow these simple steps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Find the <Share className="w-4 h-4 inline mx-1 text-primary" /> icon at the bottom of Safari
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Add to Home Screen</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Scroll down and tap <PlusSquare className="w-4 h-4 inline mx-1 text-primary" /> "Add to Home Screen"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Tap "Add"</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Confirm by tapping Add in the top right
                    </p>
                  </div>
                </div>
              </div>

              <Button variant="outline" onClick={handleSkip} className="w-full mt-4">
                Continue in Browser
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Not installable fallback (Desktop browser without install support) */}
        {!isInstallable && !isInstalled && !showIOSInstructions && (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-6 h-6 text-muted-foreground" />
              </div>
              <CardTitle>Add to Home Screen</CardTitle>
              <CardDescription>
                Install this app from your browser
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Open Browser Menu</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click the menu icon (⋮ or ⋯) in your browser
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Install App</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Look for "Install app" or "Add to Home Screen"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Confirm Installation</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tap "Install" or "Add" to complete
                    </p>
                  </div>
                </div>
              </div>

              <Button variant="outline" onClick={handleSkip} className="w-full mt-4">
                Continue in Browser
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        {!isInstalled && (
          <div className="w-full max-w-md space-y-4">
            <h3 className="text-sm font-medium text-center text-muted-foreground">Why install the app?</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wifi className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Works Offline</p>
                  <p className="text-xs text-muted-foreground">No internet needed</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Notifications</p>
                  <p className="text-xs text-muted-foreground">Stay updated</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Fast & Smooth</p>
                  <p className="text-xs text-muted-foreground">Native experience</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Camera Access</p>
                  <p className="text-xs text-muted-foreground">Face verification</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center">
        <p className="text-xs text-muted-foreground">
          AttendanceHub • Professional Attendance Management
        </p>
      </footer>
    </div>
  );
}