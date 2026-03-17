import { lazy, Suspense } from "react";
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
import UpdateNotification from "@/components/UpdateNotification";
import DashboardRouter from "@/components/DashboardRouter";
import CommandPalette from "@/components/CommandPalette";

// Eager-loaded critical routes
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy-loaded pages
const FaceSetup = lazy(() => import("./pages/FaceSetup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ActivateAccount = lazy(() => import("./pages/ActivateAccount"));
const PhoneVerification = lazy(() => import("./pages/PhoneVerification"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DeveloperDashboard = lazy(() => import("./pages/DeveloperDashboard"));
const DeveloperPricing = lazy(() => import("./pages/DeveloperPricing"));
const Pricing = lazy(() => import("./pages/Pricing"));
const HolidayManagement = lazy(() => import("./pages/HolidayManagement"));
const EmployeeManagement = lazy(() => import("./pages/EmployeeManagement"));
const Reports = lazy(() => import("./pages/Reports"));
const ShiftManagement = lazy(() => import("./pages/ShiftManagement"));
const LeaveManagement = lazy(() => import("./pages/LeaveManagement"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const WeekOffManagement = lazy(() => import("./pages/WeekOffManagement"));
const CompanySettings = lazy(() => import("./pages/CompanySettings"));
const CsvImport = lazy(() => import("./pages/CsvImport"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Announcements = lazy(() => import("./pages/Announcements"));
const AnnouncementsAdmin = lazy(() => import("./pages/AnnouncementsAdmin"));
const GlobalBroadcast = lazy(() => import("./pages/GlobalBroadcast"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const Install = lazy(() => import("./pages/Install"));
const Updates = lazy(() => import("./pages/Updates"));
const CompanyManagement = lazy(() => import("./pages/CompanyManagement"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const EmployeeAttendance = lazy(() => import("./pages/EmployeeAttendance"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PayrollTeamDashboard = lazy(() => import("./pages/PayrollTeamDashboard"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const StatutoryCompliance = lazy(() => import("./pages/StatutoryCompliance"));
const LeavePolicies = lazy(() => import("./pages/LeavePolicies"));
const SetupGuide = lazy(() => import("./pages/SetupGuide"));
const MyAttendance = lazy(() => import("./pages/MyAttendance"));
const MyPayslips = lazy(() => import("./pages/MyPayslips"));
const MyLeaves = lazy(() => import("./pages/MyLeaves"));
const Compensation = lazy(() => import("./pages/Compensation"));
const PayrollRun = lazy(() => import("./pages/PayrollRun"));
const ManagerTeam = lazy(() => import("./pages/ManagerTeam"));
const MyDailyUpdates = lazy(() => import("./pages/MyDailyUpdates"));
const TeamDailyUpdates = lazy(() => import("./pages/TeamDailyUpdates"));
const ManagerApprovals = lazy(() => import("./pages/ManagerApprovals"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const ComplianceReports = lazy(() => import("./pages/ComplianceReports"));
const DeveloperRoles = lazy(() => import("./pages/DeveloperRoles"));
const DeveloperTracking = lazy(() => import("./pages/DeveloperTracking"));
const DeveloperEngagement = lazy(() => import("./pages/DeveloperEngagement"));
const DeveloperSettings = lazy(() => import("./pages/DeveloperSettings"));
const DeveloperEmailSettings = lazy(() => import("./pages/DeveloperEmailSettings"));
const DeveloperPayslipTemplates = lazy(() => import("./pages/DeveloperPayslipTemplates"));
const PayslipSettings = lazy(() => import("./pages/PayslipSettings"));
const GeofenceLocations = lazy(() => import("./pages/GeofenceLocations"));
const DocumentManagement = lazy(() => import("./pages/DocumentManagement"));
const EmployeeOnboarding = lazy(() => import("./pages/EmployeeOnboarding"));
const AuditTrail = lazy(() => import("./pages/AuditTrail"));
const EmployeeDirectory = lazy(() => import("./pages/EmployeeDirectory"));
const EmployeeTimeline = lazy(() => import("./pages/EmployeeTimeline"));
const PerformanceGoals = lazy(() => import("./pages/PerformanceGoals"));
const PerformanceReviews = lazy(() => import("./pages/PerformanceReviews"));
const KPITracking = lazy(() => import("./pages/KPITracking"));
const ContactSupport = lazy(() => import("./pages/ContactSupport"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const AboutApp = lazy(() => import("./pages/AboutApp"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 10 * 60 * 1000, // 10 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading page...</p>
      </div>
    </div>
  );
}

function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children, requireFaceSetup = true }: { children: React.ReactNode; requireFaceSetup?: boolean }) => {
  const location = useLocation();
  const { user, profile, isDeveloper, isLoading } = useAuth();
  const { isRequired: faceVerificationRequired, isLoading: settingLoading } = useFaceVerificationSetting();
  const { settings, isLoading: settingsLoading } = useSystemSettings();

  if (isLoading || settingLoading || settingsLoading) return <AuthLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  if (!isDeveloper && profile && profile.is_active === false) {
    if (location.pathname !== "/pending-approval") return <Navigate to="/pending-approval" replace />;
  }

  if (settings.appOnlyModeEnabled && !isDeveloper) {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (!isPWA) return <Navigate to="/install" replace />;
  }

  if (!settings.testingModeEnabled && settings.oauthPhoneVerificationEnabled && profile && !profile.phone_verified && !isDeveloper) {
    return <Navigate to="/phone-verify" replace />;
  }

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

  if (isLoading || settingLoading) return <AuthLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!faceVerificationRequired && !isUpdate) return <Navigate to="/dashboard" replace />;

  const hasFaceData = hasFaceEmbedding(profile?.face_embedding ?? null);
  if (!isUpdate && (hasFaceData || isDeveloper)) return <Navigate to="/dashboard" replace />;

  return children;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isAdmin, isDeveloper, isLoading } = useAuth();
  const { isRequired: faceVerificationRequired, isLoading: settingLoading } = useFaceVerificationSetting();

  if (isLoading || settingLoading) return <AuthLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  const hasFaceData = hasFaceEmbedding(profile?.face_embedding ?? null);
  if (faceVerificationRequired && profile && !hasFaceData && !isDeveloper) return <Navigate to="/face-setup" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
};

const DeveloperRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isDeveloper, isLoading } = useAuth();

  if (isLoading) return <AuthLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isDeveloper) return <Navigate to="/dashboard" replace />;

  return children;
};

const PhoneVerifyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isDeveloper, isLoading } = useAuth();
  const { settings, isLoading: settingsLoading } = useSystemSettings();

  if (isLoading || settingsLoading) return <AuthLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (settings.testingModeEnabled || !settings.oauthPhoneVerificationEnabled || profile?.phone_verified || isDeveloper) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/activate" element={<ActivateAccount />} />
          <Route path="/install" element={<Install />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/phone-verify" element={<PhoneVerifyRoute><PhoneVerification /></PhoneVerifyRoute>} />
          <Route path="/face-setup" element={<FaceSetupRoute><FaceSetup /></FaceSetupRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute requireFaceSetup={false}><EmployeeOnboarding /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
          <Route path="/employee-home" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
          <Route path="/my-timeline" element={<ProtectedRoute><EmployeeTimeline /></ProtectedRoute>} />
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
          <Route path="/developer/roles" element={<DeveloperRoute><DeveloperRoles /></DeveloperRoute>} />
          <Route path="/developer/tracking" element={<DeveloperRoute><DeveloperTracking /></DeveloperRoute>} />
          <Route path="/developer/engagement" element={<DeveloperRoute><DeveloperEngagement /></DeveloperRoute>} />
          <Route path="/developer/settings" element={<DeveloperRoute><DeveloperSettings /></DeveloperRoute>} />
          <Route path="/developer/email-settings" element={<DeveloperRoute><DeveloperEmailSettings /></DeveloperRoute>} />
          <Route path="/developer/companies" element={<DeveloperRoute><CompanyManagement /></DeveloperRoute>} />
          <Route path="/developer/companies/:id" element={<DeveloperRoute><CompanyDetail /></DeveloperRoute>} />
          <Route path="/developer/payslip-templates" element={<DeveloperRoute><DeveloperPayslipTemplates /></DeveloperRoute>} />
          <Route path="/developer/companies/:id/geofencing" element={<DeveloperRoute><GeofenceLocations /></DeveloperRoute>} />
          <Route path="/admin/geofencing" element={<AdminRoute><GeofenceLocations /></AdminRoute>} />
          <Route path="/admin/payslip-settings" element={<AdminRoute><PayslipSettings /></AdminRoute>} />
          <Route path="/admin/documents" element={<AdminRoute><DocumentManagement /></AdminRoute>} />
          <Route path="/owner" element={<ProtectedRoute><OwnerDashboard /></ProtectedRoute>} />
          <Route path="/admin/import" element={<DeveloperRoute><CsvImport /></DeveloperRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
          <Route path="/admin/announcements" element={<AdminRoute><AnnouncementsAdmin /></AdminRoute>} />
          <Route path="/developer/broadcast" element={<DeveloperRoute><GlobalBroadcast /></DeveloperRoute>} />
          <Route path="/leave-notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/updates" element={<ProtectedRoute><Updates /></ProtectedRoute>} />
          <Route path="/payroll" element={<ProtectedRoute><PayrollTeamDashboard /></ProtectedRoute>} />
          <Route path="/my-payslips" element={<ProtectedRoute><MyPayslips /></ProtectedRoute>} />
          <Route path="/admin/compensation" element={<AdminRoute><Compensation /></AdminRoute>} />
          <Route path="/admin/payroll-run" element={<AdminRoute><PayrollRun /></AdminRoute>} />
          <Route path="/compliance" element={<AdminRoute><StatutoryCompliance /></AdminRoute>} />
          <Route path="/leave-policies" element={<AdminRoute><LeavePolicies /></AdminRoute>} />
          <Route path="/setup-guide" element={<AdminRoute><SetupGuide /></AdminRoute>} />
          <Route path="/my-attendance" element={<ProtectedRoute><MyAttendance /></ProtectedRoute>} />
          <Route path="/my-leaves" element={<ProtectedRoute><MyLeaves /></ProtectedRoute>} />
          <Route path="/my-documents" element={<ProtectedRoute><DocumentManagement /></ProtectedRoute>} />
          <Route path="/my-daily-updates" element={<ProtectedRoute><MyDailyUpdates /></ProtectedRoute>} />
          <Route path="/manager/team" element={<ProtectedRoute><ManagerTeam /></ProtectedRoute>} />
          <Route path="/manager/approvals" element={<ProtectedRoute><ManagerApprovals /></ProtectedRoute>} />
          <Route path="/manager/team-updates" element={<ProtectedRoute><TeamDailyUpdates /></ProtectedRoute>} />
          <Route path="/admin/teams" element={<AdminRoute><TeamManagement /></AdminRoute>} />
          <Route path="/compliance-reports" element={<AdminRoute><ComplianceReports /></AdminRoute>} />
          <Route path="/admin/audit-trail" element={<AdminRoute><AuditTrail /></AdminRoute>} />
          <Route path="/directory" element={<ProtectedRoute><EmployeeDirectory /></ProtectedRoute>} />
          <Route path="/my-goals" element={<ProtectedRoute><PerformanceGoals /></ProtectedRoute>} />
          <Route path="/my-reviews" element={<ProtectedRoute><PerformanceReviews /></ProtectedRoute>} />
          <Route path="/admin/kpi-tracking" element={<AdminRoute><KPITracking /></AdminRoute>} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/developer/pricing" element={<DeveloperRoute><DeveloperPricing /></DeveloperRoute>} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <CommandPalette />
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
      <UpdateNotification />
    </>
  );
}

const App = () => {
  return (
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
};

export default App;
