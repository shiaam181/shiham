import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, AlertTriangle, Loader2, ArrowRight, QrCode, Bug } from "lucide-react";
import { InviteDebugPanel } from "@/components/InviteDebugPanel";

interface CompanyInfo {
  id: string;
  name: string;
  logoUrl?: string;
  brandColor?: string;
  tagline?: string;
}

interface InviteInfo {
  remainingUses: number | null;
  expiresAt: string | null;
}

type InviteState = 
  | { status: "loading" }
  | { status: "valid"; company: CompanyInfo; inviteInfo?: InviteInfo }
  | { status: "error"; reason: string; details?: string };

export default function Invite() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<InviteState>({ status: "loading" });
  const [showDebug, setShowDebug] = useState(false);

  // Extract invite code robustly from various formats
  const extractInviteCode = (): string | null => {
    // Primary: from route param
    if (code) {
      const extracted = code.trim().match(/[A-Za-z0-9_-]{6,64}/)?.[0];
      if (extracted) return extracted;
    }

    // Fallback: check if pathname contains encoded invite
    try {
      const decodedPath = decodeURIComponent(location.pathname);
      const match = decodedPath.match(/invite[/=]([A-Za-z0-9_-]{6,64})/i);
      if (match?.[1]) return match[1];
    } catch {
      // ignore decode errors
    }

    // Fallback: check search params
    const searchParams = new URLSearchParams(location.search);
    const inviteParam = searchParams.get("invite") || searchParams.get("code");
    if (inviteParam) {
      const extracted = inviteParam.trim().match(/[A-Za-z0-9_-]{6,64}/)?.[0];
      if (extracted) return extracted;
    }

    return null;
  };

  const inviteCode = extractInviteCode();

  useEffect(() => {
    const validateInvite = async () => {
      if (!inviteCode) {
        setState({ 
          status: "error", 
          reason: "No invite code found",
          details: "The invite link appears to be incomplete or malformed."
        });
        return;
      }

      try {
        const response = await supabase.functions.invoke("get-company-by-invite", {
          body: { inviteCode },
        });

        // Normalize response
        let data = response.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            // keep as-is
          }
        }

        // Check for errors
        if (response.error) {
          setState({ 
            status: "error", 
            reason: response.error.message || "Failed to verify invite",
            details: "The backend service returned an error."
          });
          return;
        }

        if (data?.error) {
          // Map error messages to user-friendly text
          let reason = data.error;
          let details: string | undefined;

          if (data.error.includes("expired")) {
            reason = "This invite link has expired";
            details = "Please ask your employer for a new invite link.";
          } else if (data.error.includes("usage limit") || data.error.includes("reached")) {
            reason = "This invite link has reached its usage limit";
            details = "The maximum number of people have already used this link.";
          } else if (data.error.includes("inactive") || data.error.includes("Invalid")) {
            reason = "This invite link is no longer active";
            details = "The company may have deactivated this link.";
          }

          setState({ status: "error", reason, details });
          return;
        }

        // Success
        if (data?.company?.id && data?.company?.name) {
          setState({ 
            status: "valid", 
            company: {
              id: data.company.id,
              name: data.company.name,
              logoUrl: data.company.logoUrl,
              brandColor: data.company.brandColor,
              tagline: data.company.tagline,
            },
            inviteInfo: data.inviteInfo 
          });
        } else {
          setState({ 
            status: "error", 
            reason: "Invalid invite link",
            details: "The invite code could not be validated." 
          });
        }
      } catch (err: any) {
        setState({ 
          status: "error", 
          reason: "Connection error",
          details: err.message || "Please check your internet connection and try again."
        });
      }
    };

    validateInvite();
  }, [inviteCode]);

  const proceedToSignup = () => {
    if (!inviteCode) return;
    navigate(`/auth?invite=${encodeURIComponent(inviteCode)}`, { replace: true });
  };

  // Loading state
  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground">Verifying invite link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (state.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle>Invalid Invite Link</CardTitle>
              <CardDescription>{state.reason}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.details && (
                <p className="text-sm text-muted-foreground text-center">{state.details}</p>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/auth")} variant="default">
                  Go to Login
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowDebug(!showDebug)}
                  className="text-xs"
                >
                  <Bug className="w-3 h-3 mr-1" />
                  {showDebug ? "Hide" : "Show"} Debug Info
                </Button>
              </div>
            </CardContent>
          </Card>

          {showDebug && (
            <InviteDebugPanel 
              inviteCode={inviteCode} 
              showQRCode={false}
              onClose={() => setShowDebug(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // Valid invite - show welcome page with company branding
  const brandColor = state.company.brandColor || '#0284c7';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="overflow-hidden">
          {/* Branded header */}
          <div 
            className="h-3 w-full" 
            style={{ backgroundColor: brandColor }}
          />
          
          <CardHeader className="text-center pt-6">
            {/* Company logo or branded icon */}
            {state.company.logoUrl ? (
              <div className="mx-auto w-20 h-20 rounded-xl overflow-hidden mb-4 border shadow-sm">
                <img 
                  src={state.company.logoUrl} 
                  alt={`${state.company.name} logo`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to icon if logo fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `
                      <div class="w-full h-full flex items-center justify-center" style="background-color: ${brandColor}10">
                        <svg class="w-10 h-10" style="color: ${brandColor}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    `;
                  }}
                />
              </div>
            ) : (
              <div 
                className="mx-auto w-20 h-20 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${brandColor}15` }}
              >
                <Building2 className="w-10 h-10" style={{ color: brandColor }} />
              </div>
            )}
            
            <CardTitle className="text-2xl">You're Invited!</CardTitle>
            <CardDescription className="text-base">
              Join <span className="font-semibold" style={{ color: brandColor }}>{state.company.name}</span>
              {state.company.tagline && (
                <span className="block text-sm mt-1">{state.company.tagline}</span>
              )}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Company info card */}
            <div 
              className="flex items-center gap-3 p-4 rounded-lg border"
              style={{ backgroundColor: `${brandColor}08`, borderColor: `${brandColor}20` }}
            >
              {state.company.logoUrl ? (
                <img 
                  src={state.company.logoUrl} 
                  alt="" 
                  className="w-12 h-12 rounded-lg object-cover border"
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}15` }}
                >
                  <Building2 className="w-6 h-6" style={{ color: brandColor }} />
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold">{state.company.name}</p>
                <p className="text-sm text-muted-foreground">Company</p>
              </div>
              <Badge 
                variant="secondary"
                className="gap-1"
                style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
              >
                <Users className="w-3 h-3" />
                Invited
              </Badge>
            </div>

            {/* Invite info */}
            {state.inviteInfo && (
              <div className="text-xs text-muted-foreground space-y-1">
                {state.inviteInfo.remainingUses !== null && (
                  <p>• {state.inviteInfo.remainingUses} uses remaining</p>
                )}
                {state.inviteInfo.expiresAt && (
                  <p>• Expires: {new Date(state.inviteInfo.expiresAt).toLocaleDateString()}</p>
                )}
              </div>
            )}

            {/* CTA Button with brand color */}
            <Button 
              onClick={proceedToSignup} 
              className="w-full text-white" 
              size="lg"
              style={{ backgroundColor: brandColor }}
            >
              Continue to Sign Up
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <button 
                onClick={() => navigate("/auth")} 
                className="underline hover:no-underline"
                style={{ color: brandColor }}
              >
                Sign in instead
              </button>
            </p>
          </CardContent>
        </Card>

        {/* Debug toggle for troubleshooting */}
        <div className="text-center">
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

        {showDebug && (
          <InviteDebugPanel 
            inviteCode={inviteCode} 
            showQRCode={true}
            onClose={() => setShowDebug(false)}
          />
        )}
      </div>
    </div>
  );
}
