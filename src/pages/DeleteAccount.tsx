import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmation !== "DELETE") return;
    setDeleting(true);
    // In production, this would call a backend function to delete user data
    toast({
      title: "Account Deletion Requested",
      description: "Your account deletion request has been submitted. Your data will be removed within 30 days.",
    });
    setTimeout(() => {
      signOut();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-3xl font-bold mb-2">Delete Account</h1>
        <p className="text-muted-foreground mb-8">Permanently remove your account and all associated data.</p>

        <Card className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>This action cannot be undone.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <p>Deleting your account will:</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Remove all your personal information</li>
                <li>Delete your attendance records</li>
                <li>Remove your face verification data</li>
                <li>Cancel any pending leave requests</li>
                <li>Remove you from your organization</li>
              </ul>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="confirm">Type <strong>DELETE</strong> to confirm</Label>
              <Input
                id="confirm"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Type DELETE"
              />
            </div>

            <Button
              variant="destructive"
              className="w-full"
              disabled={confirmation !== "DELETE" || deleting}
              onClick={handleDelete}
            >
              {deleting ? "Processing..." : "Permanently Delete Account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
