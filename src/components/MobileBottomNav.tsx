import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Home, 
  Calendar, 
  User, 
  Shield,
  FileText,
  Code,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const employeeNavItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: ClipboardList, label: 'Attendance', path: '/my-attendance' },
  { icon: User, label: 'Profile', path: '/profile' },
];

const adminNavItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/admin' },
  { icon: FileText, label: 'Reports', path: '/admin/reports' },
  { icon: Calendar, label: 'Leaves', path: '/admin/leaves' },
  { icon: User, label: 'Employees', path: '/admin/employees' },
];

const developerNavItems: NavItem[] = [
  { icon: Home, label: 'Overview', path: '/developer' },
  { icon: Shield, label: 'Roles', path: '/developer' },
  { icon: Calendar, label: 'Leaves', path: '/admin/leaves' },
  { icon: User, label: 'Employees', path: '/admin/employees' },
];

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isDeveloper } = useAuth();
  
  const isDeveloperRoute = location.pathname.startsWith('/developer');
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  let items = employeeNavItems;
  if (isDeveloperRoute) {
    items = developerNavItems;
  } else if (isAdminRoute) {
    items = adminNavItems;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border sm:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path + item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[72px] min-h-[48px] rounded-xl transition-all active:scale-95",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              {/* Active indicator pill */}
              {isActive && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />
              )}
              <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
              <span className={cn(
                "text-[10px] font-medium",
                isActive && "text-primary"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        {/* Developer panel toggle for non-developer routes */}
        {!isDeveloperRoute && isDeveloper && (
          <button
            onClick={() => navigate('/developer')}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[72px] min-h-[48px] rounded-xl transition-all active:scale-95 text-purple-500"
          >
            <Code className="w-5 h-5" />
            <span className="text-[10px] font-medium">Dev</span>
          </button>
        )}
        
        {/* Admin toggle for non-admin routes (only if not developer) */}
        {!isAdminRoute && !isDeveloperRoute && isAdmin && !isDeveloper && (
          <button
            onClick={() => navigate('/admin')}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[72px] min-h-[48px] rounded-xl transition-all active:scale-95 text-muted-foreground"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </button>
        )}
        
        {/* Employee view toggle for admin/developer routes */}
        {(isAdminRoute || isDeveloperRoute) && (
          <button
            onClick={() => navigate('/dashboard')}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[72px] min-h-[48px] rounded-xl transition-all active:scale-95 text-muted-foreground"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">My View</span>
          </button>
        )}
      </div>
    </nav>
  );
}
