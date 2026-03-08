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

  if (isDeveloper) return <Navigate to="/developer" replace />;
  if (role === 'payroll_team') return <Navigate to="/payroll" replace />;
  if (isAdmin && role !== 'employee' && role !== 'manager') return <Navigate to="/admin" replace />;
  
  // Employees and managers land on the employee dashboard
  return <Navigate to="/employee-home" replace />;
}
