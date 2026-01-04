import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useFaceVerificationSetting } from "@/hooks/useFaceVerificationSetting";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import FaceSetup from "./pages/FaceSetup";
import ResetPassword from "./pages/ResetPassword";
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
import CsvImport from "./pages/CsvImport";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requireFaceSetup = true }: { children: React.ReactNode; requireFaceSetup?: boolean }) => {
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
  // Now check for face_embedding instead of face_reference_url
  const hasFaceData = profile?.face_embedding && profile.face_embedding.length > 0;
  if (requireFaceSetup && faceVerificationRequired && profile && !hasFaceData && !isDeveloper) {
    return <Navigate to="/face-setup" replace />;
  }

  return children;
};

const FaceSetupRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isUpdate = new URLSearchParams(location.search).get('update') === 'true';

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

  // If face verification is disabled, redirect to dashboard (unless explicitly updating)
  if (!faceVerificationRequired && !isUpdate) {
    return <Navigate to="/dashboard" replace />;
  }

  // Allow updating face even if already registered
  const hasFaceData = profile?.face_embedding && profile.face_embedding.length > 0;
  if (!isUpdate && (hasFaceData || isDeveloper)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
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
  const hasFaceData = profile?.face_embedding && profile.face_embedding.length > 0;
  if (faceVerificationRequired && profile && !hasFaceData && !isDeveloper) {
    return <Navigate to="/face-setup" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const DeveloperRoute = ({ children }: { children: React.ReactNode }) => {
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

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
      <Route path="/admin/import" element={<DeveloperRoute><CsvImport /></DeveloperRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
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
