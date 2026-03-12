import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Smart router that redirects users to their role-appropriate dashboard.
 * Employee → /dashboard (EmployeeDashboard)
 * Admin/Owner/HR → /admin
 * Developer → /developer
 * Manager → /dashboard (employee view, they use sidebar for manager features)
 */
export default function DashboardRouter() {
  const { role, isDeveloper, isAdmin, isPayrollTeam } = useAuth();

  // All roles land on the employee home screen
  return <Navigate to="/employee-home" replace />;
  return <Navigate to="/employee-home" replace />;
}
