import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Clock, XCircle, Building2, RefreshCw, LogOut } from "lucide-react";

type RegistrationStatus = "pending" | "declined" | "approved";

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>("pending");
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!isLoading && profile?.is_active) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, user, profile?.is_active, navigate]);

  // Fetch registration status and company name
  useEffect(() => {
    const fetchStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("registration_status, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching status:", error);
        return;
      }

      if (data) {
        const status = (data as any).registration_status as RegistrationStatus;
        setRegistrationStatus(status || "pending");

        // Fetch company name if has company_id
        if (data.company_id) {
          const { data: companyData } = await supabase
            .from("companies")
            .select("name")
            .eq("id", data.company_id)
            .maybeSingle();
          
          if (companyData) {
            setCompanyName(companyData.name);
          }
        }
      }
    };

    fetchStatus();
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
      // Re-fetch status
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("registration_status, is_active")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (data) {
          const status = (data as any).registration_status as RegistrationStatus;
          setRegistrationStatus(status || "pending");
          
          if (data.is_active) {
            navigate("/dashboard", { replace: true });
          }
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReRegister = async () => {
    // Clear company assignment and reset status so user can try another company
    if (user) {
      await supabase
        .from("profiles")
        .update({ 
          company_id: null, 
          registration_status: "pending",
          is_active: false 
        })
        .eq("user_id", user.id);
    }
    // Navigate to auth to select new company
    navigate("/auth?mode=select-company", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isPending = registrationStatus === "pending";
  const isDeclined = registrationStatus === "declined";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isPending && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-warning" />
              </div>
              <CardTitle>Waiting for Approval</CardTitle>
              <CardDescription>
                Your registration request is pending approval.
              </CardDescription>
            </>
          )}

          {isDeclined && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle>Registration Declined</CardTitle>
              <CardDescription>
                Unfortunately, your registration request was declined.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Company info */}
          {companyName && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{companyName}</p>
                <p className="text-xs text-muted-foreground">Requested company</p>
              </div>
              <Badge variant={isPending ? "secondary" : "destructive"}>
                {isPending ? "Pending" : "Declined"}
              </Badge>
            </div>
          )}

          {isPending && (
            <div className="text-sm text-muted-foreground text-center space-y-2">
              <p>
                The company administrator needs to approve your registration before you can access the app.
              </p>
              <p className="text-xs">
                You will be notified once your request is reviewed.
              </p>
            </div>
          )}

          {isDeclined && (
            <div className="text-sm text-muted-foreground text-center space-y-2">
              <p>
                You can try registering with a different company, or contact the company administrator for more information.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {isPending && (
              <Button 
                className="w-full" 
                onClick={handleRefresh} 
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? "Checking..." : "Check Approval Status"}
              </Button>
            )}

            {isDeclined && (
              <Button 
                className="w-full" 
                onClick={handleReRegister}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Select a Different Company
              </Button>
            )}

            <Button
              className="w-full"
              variant="outline"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}