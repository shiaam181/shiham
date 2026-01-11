import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Home, Bug } from "lucide-react";
import { InviteDebugPanel } from "@/components/InviteDebugPanel";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDebug, setShowDebug] = useState(false);
  const [extractedCode, setExtractedCode] = useState<string | null>(null);

  useEffect(() => {
    // Try to recover invite codes from various malformed URL patterns
    const tryRecoverInvite = (): string | null => {
      const fullUrl = location.pathname + location.search + location.hash;
      
      // Decode the full path
      let decoded = fullUrl;
      try {
        decoded = decodeURIComponent(fullUrl);
      } catch {
        // keep original
      }

      // Pattern 1: /auth%3Finvite%3DXXXX or /auth?invite=XXXX in pathname
      if (decoded.includes("invite=") || decoded.includes("invite%3D")) {
        const match = decoded.match(/invite[=%3D]+([A-Za-z0-9_-]{6,64})/i);
        if (match?.[1]) return match[1];
      }

      // Pattern 2: /invite/XXXX but 404'd (shouldn't happen but check)
      const inviteMatch = decoded.match(/\/invite\/([A-Za-z0-9_-]{6,64})/i);
      if (inviteMatch?.[1]) return inviteMatch[1];

      // Pattern 3: Some apps add weird suffixes
      const codeMatch = decoded.match(/[?&](?:invite|code)=([A-Za-z0-9_-]{6,64})/i);
      if (codeMatch?.[1]) return codeMatch[1];

      return null;
    };

    const code = tryRecoverInvite();
    if (code) {
      setExtractedCode(code);
      // Auto-redirect to invite page
      navigate(`/invite/${encodeURIComponent(code)}`, { replace: true });
      return;
    }

    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname, location.search, location.hash, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Page Not Found</CardTitle>
            <CardDescription>
              The page you're looking for doesn't exist or has been moved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              <strong>Path:</strong> {location.pathname}
            </div>
            
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate("/")} className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Return to Home
              </Button>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Go to Login
              </Button>
            </div>

            <div className="text-center pt-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-muted-foreground"
              >
                <Bug className="w-3 h-3 mr-1" />
                {showDebug ? "Hide" : "Show"} Debug Info
              </Button>
            </div>
          </CardContent>
        </Card>

        {showDebug && (
          <InviteDebugPanel 
            inviteCode={extractedCode} 
            showQRCode={false}
            onClose={() => setShowDebug(false)}
          />
        )}
      </div>
    </div>
  );
};

export default NotFound;
