import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!isLoading && profile?.is_active) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, user, profile?.is_active, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Waiting for approval</CardTitle>
          <CardDescription>
            Your account was created, but your company owner must approve you before you can use the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Checking…" : "Check approval status"}
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate("/auth", { replace: true });
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
