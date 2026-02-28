

# Complete App Audit — Everything Built So Far

## 1. Authentication & User Management
- **Email + password sign-up/sign-in** (`Auth.tsx`)
- **Google OAuth sign-in** (with redirect to phone verify)
- **Phone OTP verification** (`PhoneVerification.tsx`, edge functions: `send-otp`, `verify-otp`, `phone-login`)
- **Email OTP verification** (edge functions: `send-email-otp`, `verify-email-otp`, `email-login`)
- **Password reset** (`ResetPassword.tsx`)
- **Profile settings** (`ProfileSettings.tsx`) — name, phone, avatar, bank details
- **Pending approval flow** (`PendingApproval.tsx`) — new employees wait for owner approval
- **Employee approval** (edge function: `approve-employee`)

## 2. RBAC (Role-Based Access Control)
- **6 roles**: `developer`, `owner`, `admin`, `hr`, `manager`, `payroll_team`, `employee`
- **Role stored in `user_roles` table** with RLS enforcement
- **Role management UI** (`RoleManagement.tsx`) — assign/change roles
- **Route guards**: `ProtectedRoute`, `AdminRoute`, `DeveloperRoute`, `PhoneVerifyRoute`, `FaceSetupRoute`
- **Role-based sidebar navigation** (`AppSidebar.tsx`) — sections for Employee, Manager, HR, Admin, Developer, Payroll

## 3. Multi-Tenancy (Company Management)
- **Companies table** with tenant isolation via `company_id` on profiles
- **Company creation & management** (`CompanyManagement.tsx`, `CompanyDetail.tsx`)
- **Company search & join during signup** (`CompanySearchSelect.tsx`)
- **Invite codes** with usage tracking (edge functions: `get-company-by-invite`, `track-invite-usage`)
- **Company settings** (`CompanySettings.tsx`) — branding, statutory fields (PAN/TAN/GST/PF/ESI reg numbers)
- **Company brand theming** — dynamic CSS variables from `brand_color`

## 4. Attendance Module
- **Punch in/out** with GPS coordinates (`EmployeeDashboard.tsx`)
- **Face verification** on punch (`CameraCapture.tsx`, `faceRecognition.ts`, `faceVerificationService.ts`)
- **Liveness detection** (`livenessDetection.ts`)
- **Face setup / registration** (`FaceSetup.tsx`, edge functions: `register-face`, `verify-face`)
- **Challenge-based attendance verification** (edge functions: `generate-challenge`, `verify-attendance`)
- **Attendance calendar view** (`AttendanceCalendar.tsx`)
- **My Attendance page** (`MyAttendance.tsx`) — history, regularization requests
- **Attendance edit dialog** (`AttendanceEditDialog.tsx`) — admin corrections
- **Employee attendance detail** (`EmployeeAttendance.tsx`)
- **Attendance photo viewer** (`AttendancePhotoViewer.tsx`, `PhotoThumbnail.tsx`)
- **Overtime tracking** (`OvertimeChart.tsx`, `overtime.ts`)
- **Regularization requests table** — employee submits, manager/HR approves
- **Attendance PDF export** (`EmployeeAttendancePDF.tsx`)
- **Missing punch check** (edge function: `check-punch-missing`)
- **Location display** (`LocationDisplay.tsx`, `useReverseGeocode.ts`)

## 5. Live Location Tracking
- **Real-time employee GPS tracking** (`LiveLocationMap.tsx`, `LiveTrackingSettings.tsx`)
- **Employee location list & map view** (`live-location/` components)
- **Edge functions**: `update-live-location`, `get-live-locations`, `map-proxy`, `test-aws-location`
- **Employee consent management** (`employee_consent` table)
- **Custom hooks**: `useLiveLocations.ts`, `useLiveTracking.ts`

## 6. Leave Management
- **Leave request form** (`LeaveRequestForm.tsx`) — apply for CL/SL/EL
- **Leave management page** (`LeaveManagement.tsx`) — admin view, approve/reject
- **Leave notifications** (`LeaveNotifications.tsx`)
- **Leave balances table** — per user, per year, per type
- **Leave policies page** (`LeavePolicies.tsx`) — configure quotas, accrual, carry-forward
- **Leave balance display** on Employee Dashboard

## 7. Shift & Schedule Management
- **Shift templates** (`ShiftManagement.tsx`) — start/end time, grace period
- **Week-off management** (`WeekOffManagement.tsx`) — global and per-employee
- **Holiday management** (`HolidayManagement.tsx`) — company holidays

## 8. Payroll Module (Indian Style)
- **Salary structures** (`salary_structures` table) — Basic, HRA, DA, allowances, deductions
- **Compensation & payroll processing** (`CompensationPayroll.tsx`)
- **Payroll run** — computes payable days, pro-rates earnings, calculates PF/ESI/PT/TDS
- **Salary slip PDF** (`SalarySlipPDF.tsx`) — with statutory breakdown
- **Payroll lock** — prevent post-approval tampering
- **Bank transfer CSV export**
- **Payroll Team Dashboard** (`PayrollTeamDashboard.tsx`)
- **My Payslips** section on Employee Dashboard

## 9. Statutory Compliance (India)
- **Statutory profiles** (`statutory_profiles` table) — PF/ESI/PT config per employee (UAN, PF number, ESI number)
- **Professional Tax slabs** (`professional_tax_slabs` table) — pre-populated for 7 states
- **Statutory compliance page** (`StatutoryCompliance.tsx`) — manage employee PF/ESI/PT
- **Compliance reports** (`ComplianceReports.tsx`) — PF/ESI/PT monthly summaries + CSV export
- **Company statutory fields** — PAN, TAN, GST, PF/ESI registration numbers

## 10. Dashboards
- **Employee Dashboard** (`EmployeeDashboard.tsx`) — punch status, leave balances, payslips
- **Admin Dashboard** (`AdminDashboard.tsx`) — headcount, attendance overview
- **Owner Dashboard** (`OwnerDashboard.tsx`) — company overview, role management, pending employees
- **Developer Dashboard** (`DeveloperDashboard.tsx`) — system settings, platform controls
- **Payroll Team Dashboard** (`PayrollTeamDashboard.tsx`)
- **Manager Team view** (`ManagerTeam.tsx`) — team attendance
- **Manager Approvals** (`ManagerApprovals.tsx`) — leaves & regularizations

## 11. Reports & Analytics
- **Reports page** (`Reports.tsx`) — attendance reports
- **Data export/import** (`DataExportImport.tsx`)
- **CSV import** (`CsvImport.tsx`)
- **Employee attendance list** (`EmployeeAttendanceList.tsx`)

## 12. Employee Engagement
- **Employee feedback** (`employee_feedback` table)
- **Employee awards** (`employee_awards` table)
- **Employee engagement component** (`EmployeeEngagement.tsx`)

## 13. Notifications
- **Notification bell** (`NotificationBell.tsx`)
- **Notifications page** (`Notifications.tsx`)
- **Browser notifications** (`browserNotifications.ts`)
- **Notification preferences** (`notification_prefs` table, `notificationPrefs.ts`)
- **App updates** (`Updates.tsx`, `UpdateNotification.tsx`, `app_updates` table)

## 14. PWA & Mobile
- **PWA install prompt** (`PWAInstallPrompt.tsx`, `usePWAInstall.ts`)
- **PWA update prompt** (`PWAUpdatePrompt.tsx`, `usePWAUpdate.ts`)
- **App-only mode** (force PWA install via `Install.tsx`)
- **Capacitor config** for native Android/iOS builds
- **Mobile bottom nav** (`MobileBottomNav.tsx`) — legacy, mostly replaced by sidebar
- **Mobile responsive sidebar** with offcanvas

## 15. UI Framework
- **Sidebar layout** (`AppLayout.tsx`, `AppSidebar.tsx`) — role-based navigation
- **Top header** (`TopHeader.tsx`, `RoleBasedHeader.tsx`) — legacy headers
- **shadcn/ui components** — 40+ UI components (dialog, table, form, toast, etc.)
- **Tailwind CSS** with custom theme (CSS variables for branding)

## 16. Security & Auditing
- **Audit logs** (`audit_logs` table, `useAuditLog.ts`)
- **RLS policies** on all tables — tenant isolation, role-based access
- **OTP rate limiting** (`otp_rate_limits` table)
- **Helper functions**: `is_admin()`, `is_developer()`, `is_owner()`, `is_hr()`, `is_manager()`, `is_payroll_team()`, `has_role()`, `get_user_company_id()`
- **Face verification toggle** (`useFaceVerificationSetting.ts`)
- **System settings** (`system_settings` table, `useSystemSettings.ts`)

## 17. Onboarding & Setup
- **Setup Guide** (`SetupGuide.tsx`) — step-by-step configuration checklist
- **Pending employees list** (`PendingEmployeesList.tsx`)
- **Employee detail dialog** (`EmployeeDetailDialog.tsx`)

## 18. Legal Pages
- **Privacy Policy** (`PrivacyPolicy.tsx`)
- **Terms of Service** (`TermsOfService.tsx`)

## 19. Edge Functions (22 total)
`approve-employee`, `check-phone-exists`, `check-punch-missing`, `clear-test-data`, `delete-employee`, `email-login`, `generate-challenge`, `get-company-by-invite`, `get-live-locations`, `map-proxy`, `phone-login`, `register-face`, `send-email-otp`, `send-otp`, `test-aws-location`, `track-invite-usage`, `update-aws-credentials`, `update-live-location`, `verify-attendance`, `verify-email-otp`, `verify-face`, `verify-otp`

## 20. Database (51 migrations, 20+ tables)
`profiles`, `companies`, `companies_public`, `user_roles`, `attendance`, `attendance_challenges`, `face_reference_images`, `shifts`, `leave_requests`, `leave_balances`, `leave_policies`, `salary_structures`, `payroll_runs`, `statutory_profiles`, `professional_tax_slabs`, `regularization_requests`, `week_offs`, `company_settings`, `system_settings`, `audit_logs`, `notification_prefs`, `app_updates`, `user_seen_updates`, `employee_feedback`, `employee_awards`, `employee_consent`, `employee_live_locations`, `invite_usage_history`, `otp_rate_limits`

## 21. Landing Page
- **Marketing landing page** (`Index.tsx`) — with toggle via system settings

---

**Total: 36 pages, 38 components, 22 edge functions, 29 database tables, 51 migrations, 10 custom hooks, 10 utility libraries.**

