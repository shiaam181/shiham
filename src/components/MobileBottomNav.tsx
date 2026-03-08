import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Calendar, User, Shield, FileText, Code, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const employeeNavItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/employee-home' },
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
  { icon: Shield, label: 'Roles', path: '/developer/roles' },
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
  if (isDeveloperRoute) items = developerNavItems;
  else if (isAdminRoute) items = adminNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/60 sm:hidden safe-area-bottom shadow-[0_-4px_20px_-4px_hsl(0_0%_0%/0.08)]">
      <div className="flex items-center justify-around h-[60px] px-0.5">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path + item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-0 flex-1 min-h-[48px] rounded-xl transition-all duration-200 active:scale-95",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-primary rounded-full" />
              )}
              <div className={cn(
                "transition-all duration-200",
                isActive && "scale-110"
              )}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] transition-all truncate max-w-full",
                isActive ? "font-semibold text-primary" : "font-medium"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        {!isDeveloperRoute && isDeveloper && (
          <button
            onClick={() => navigate('/developer')}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-0 flex-1 min-h-[48px] rounded-xl transition-all active:scale-95 text-purple-500"
          >
            <Code className="w-5 h-5" />
            <span className="text-[10px] font-medium">Dev</span>
          </button>
        )}
        
        {!isAdminRoute && !isDeveloperRoute && isAdmin && !isDeveloper && (
          <button
            onClick={() => navigate('/admin')}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-0 flex-1 min-h-[48px] rounded-xl transition-all active:scale-95 text-muted-foreground"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </button>
        )}
        
        {(isAdminRoute || isDeveloperRoute) && (
          <button
            onClick={() => navigate('/dashboard')}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-0 flex-1 min-h-[48px] rounded-xl transition-all active:scale-95 text-muted-foreground"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">My View</span>
          </button>
        )}
      </div>
    </nav>
  );
}
