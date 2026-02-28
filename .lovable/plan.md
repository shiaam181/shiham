

## Plan: Migrate Developer Dashboard Tabs to Sidebar Navigation

### Problem
The Developer Dashboard uses an internal tab system (Overview, Roles, Tracking, Payroll, Engagement, Settings) with redundant navigation cards. This is inconsistent with the sidebar-based navigation used everywhere else.

### Solution
Break each tab into its own page, add them to the sidebar, and simplify the Developer Dashboard to a clean overview.

### Changes

**1. Create 4 new page files:**
- `src/pages/DeveloperRoles.tsx` — wraps `RoleManagement` component in `AppLayout`
- `src/pages/DeveloperTracking.tsx` — wraps `LiveTrackingSettings` + `LiveLocationMap` in `AppLayout`
- `src/pages/DeveloperEngagement.tsx` — wraps `EmployeeEngagement` in `AppLayout`
- `src/pages/DeveloperSettings.tsx` — contains the entire Settings tab content (email config, Twilio, face verification, map config, auth settings, danger zone, etc.) in `AppLayout`

**2. Simplify `src/pages/DeveloperDashboard.tsx`:**
- Remove all tabs and tab content
- Keep only the 4 status cards (Access Level, Database, API Status, Notifications) as a clean overview
- Remove all the settings state/logic (moves to DeveloperSettings)
- Remove redundant quick-action navigation cards

**3. Update `src/components/AppSidebar.tsx`:**
- Replace current developer sidebar items with:
  - Developer Panel → `/developer` (overview)
  - Role Management → `/developer/roles`
  - Live Tracking → `/developer/tracking`
  - Engagement → `/developer/engagement`
  - System Settings → `/developer/settings`
  - Company Management → `/developer/companies`
  - Plus existing admin/payroll/config sub-menus

**4. Update `src/App.tsx`:**
- Add routes: `/developer/roles`, `/developer/tracking`, `/developer/engagement`, `/developer/settings`
- All wrapped in `DeveloperRoute`

### File Summary
- **Create**: `DeveloperRoles.tsx`, `DeveloperTracking.tsx`, `DeveloperEngagement.tsx`, `DeveloperSettings.tsx`
- **Edit**: `DeveloperDashboard.tsx` (simplify to overview only), `AppSidebar.tsx` (update nav items), `App.tsx` (add routes)

