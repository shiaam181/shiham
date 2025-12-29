import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useFaceVerificationSetting } from "@/hooks/useFaceVerificationSetting";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import FaceSetup from "./pages/FaceSetup";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import HolidayManagement from "./pages/HolidayManagement";
import EmployeeManagement from "./pages/EmployeeManagement";
import Reports from "./pages/Reports";
import ShiftManagement from "./pages/ShiftManagement";
import LeaveManagement from "./pages/LeaveManagement";
import ProfileSettings from "./pages/ProfileSettings";
import WeekOffManagement from "./pages/WeekOffManagement";
import CompanySettings from "./pages/CompanySettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requireFaceSetup = true }: { children: React.ReactNode; requireFaceSetup?: boolean }) {
  const { user, profile, isDeveloper, isLoading } = useAuth();
  const { isRequired: faceVerificationRequired, isLoading: settingLoading } = useFaceVerificationSetting();

  if (isLoading || settingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Developers bypass face setup, also skip if face verification is disabled
  if (requireFaceSetup && faceVerificationRequired && profile && !profile.face_reference_url && !isDeveloper) {
    return <Navigate to="/face-setup" replace />;
  }

  return <>{children}</>;
}

function FaceSetupRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isDeveloper, isLoading } = useAuth();
  const { isRequired: faceVerificationRequired, isLoading: settingLoading } = useFaceVerificationSetting();

  if (isLoading || settingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If face verification is disabled, redirect to dashboard
  if (!faceVerificationRequired) {
    return <Navigate to="/dashboard" replace />;
  }

  // If already has face reference or is developer, redirect to dashboard
  if (profile?.face_reference_url || isDeveloper) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isDeveloper, isLoading } = useAuth();
  const { isRequired: faceVerificationRequired, isLoading: settingLoading } = useFaceVerificationSetting();

  if (isLoading || settingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check face setup first (developers bypass, also skip if disabled)
  if (faceVerificationRequired && profile && !profile.face_reference_url && !isDeveloper) {
    return <Navigate to="/face-setup" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function DeveloperRoute({ children }: { children: React.ReactNode }) {
  const { user, isDeveloper, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Developers bypass face setup - no check needed

  if (!isDeveloper) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/face-setup" element={<FaceSetupRoute><FaceSetup /></FaceSetupRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/holidays" element={<AdminRoute><HolidayManagement /></AdminRoute>} />
      <Route path="/admin/employees" element={<AdminRoute><EmployeeManagement /></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><Reports /></AdminRoute>} />
      <Route path="/admin/shifts" element={<AdminRoute><ShiftManagement /></AdminRoute>} />
      <Route path="/admin/leaves" element={<AdminRoute><LeaveManagement /></AdminRoute>} />
      <Route path="/admin/weekoffs" element={<AdminRoute><WeekOffManagement /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><CompanySettings /></AdminRoute>} />
      <Route path="/developer" element={<DeveloperRoute><DeveloperDashboard /></DeveloperRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
