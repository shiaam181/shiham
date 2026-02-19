import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useFaceVerificationSetting } from "@/hooks/useFaceVerificationSetting";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { hasFaceEmbedding } from "@/lib/faceEmbedding";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import Index from "./pages/Index";
// Invite flow removed - employees now search for company during signup
import Auth from "./pages/Auth";
import FaceSetup from "./pages/FaceSetup";
import ResetPassword from "./pages/ResetPassword";
import PhoneVerification from "./pages/PhoneVerification";
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
import Install from "./pages/Install";
import Updates from "./pages/Updates";
import CompanyManagement from "./pages/CompanyManagement";
import OwnerDashboard from "./pages/OwnerDashboard";
import PendingApproval from "./pages/PendingApproval";
import EmployeeAttendance from "./pages/EmployeeAttendance";
import NotFound from "./pages/NotFound";
import PayrollTeamDashboard from "./pages/PayrollTeamDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import UpdateNotification from "./components/UpdateNotification";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requireFaceSetup = true }: { children: React.ReactNode; requireFaceSetup?: boolean }) => {
  const location = useLocation();
  const { user, profile, isDeveloper, isLoading } = useAuth();
  const { isRequired: faceVerificationRequired, isLoading: settingLoading } = useFaceVerificationSetting();
  const { settings, isLoading: settingsLoading } = useSystemSettings();

  if (isLoading || settingLoading || settingsLoading) {
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

  // Block pending employees until owner approves
  if (!isDeveloper && profile && profile.is_active === false) {
    // Allow the pending page itself to render
    if (location.pathname !== "/pending-approval") {
      return <Navigate to="/pending-approval" replace />;
    }
  }

  // Check if app-only mode is enabled and user needs to install PWA
  // Skip for developers and if already on install page
  if (settings.appOnlyModeEnabled && !isDeveloper) {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;
    if (!isPWA) {
      return <Navigate to="/install" replace />;
    }
  }

  // Check phone verification for OAuth users (if OAuth + phone verification is enabled)
  // Skip when testing mode is active
  if (!settings.testingModeEnabled && settings.oauthPhoneVerificationEnabled && profile && !profile.phone_verified && !isDeveloper) {
    return <Navigate to="/phone-verify" replace />;
  }

  // Developers bypass face setup, also skip if face verification is disabled
  // face_embedding can be an object (Face++) or an array (legacy)
  const hasFaceData = hasFaceEmbedding(profile?.face_embedding ?? null);
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
  const hasFaceData = hasFaceEmbedding(profile?.face_embedding ?? null);
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
  const hasFaceData = hasFaceEmbedding(profile?.face_embedding ?? null);
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

const PhoneVerifyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isDeveloper, isLoading } = useAuth();
  const { settings, isLoading: settingsLoading } = useSystemSettings();

  if (isLoading || settingsLoading) {
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

  // If testing mode is on, or OAuth + phone verification is disabled or already verified, go to dashboard
  if (settings.testingModeEnabled || !settings.oauthPhoneVerificationEnabled || profile?.phone_verified || isDeveloper) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        {/* Invite links removed - employees now search for company during signup */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/install" element={<Install />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/phone-verify" element={<PhoneVerifyRoute><PhoneVerification /></PhoneVerifyRoute>} />
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
        <Route path="/admin/attendance/:id" element={<AdminRoute><EmployeeAttendance /></AdminRoute>} />
        <Route path="/developer" element={<DeveloperRoute><DeveloperDashboard /></DeveloperRoute>} />
        <Route path="/developer/companies" element={<DeveloperRoute><CompanyManagement /></DeveloperRoute>} />
        <Route path="/owner" element={<ProtectedRoute><OwnerDashboard /></ProtectedRoute>} />
        <Route path="/admin/import" element={<DeveloperRoute><CsvImport /></DeveloperRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/updates" element={<ProtectedRoute><Updates /></ProtectedRoute>} />
        <Route path="/payroll" element={<ProtectedRoute><PayrollTeamDashboard /></ProtectedRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
      <UpdateNotification />
    </>
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
