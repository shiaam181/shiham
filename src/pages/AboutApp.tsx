import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Clock, Shield, MapPin, Camera, Smartphone, Globe } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

export default function AboutApp() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* App Identity */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Zentrek</h1>
          <p className="text-muted-foreground mt-1">Employee Attendance Management</p>
          <p className="text-xs text-muted-foreground mt-2">Version 1.0.0</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { icon: Clock, label: "Real-time Tracking" },
            { icon: Shield, label: "Face Verification" },
            { icon: MapPin, label: "GPS Location" },
            { icon: Camera, label: "Photo Capture" },
            { icon: Smartphone, label: "Mobile-First" },
            { icon: Globe, label: "Multi-Tenant" },
          ].map((f, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <f.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{f.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Links */}
        <div className="space-y-2">
          <Link to="/privacy" className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4 text-sm font-medium">Privacy Policy</CardContent>
            </Card>
          </Link>
          <Link to="/terms" className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4 text-sm font-medium">Terms of Service</CardContent>
            </Card>
          </Link>
          <Link to="/contact-support" className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4 text-sm font-medium">Contact Support</CardContent>
            </Card>
          </Link>
          <Link to="/delete-account" className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4 text-sm text-destructive font-medium">Delete Account</CardContent>
            </Card>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 Zentrek. All rights reserved.
        </p>
      </div>
    </div>
  );
}
