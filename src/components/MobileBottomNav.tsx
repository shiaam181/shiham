import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Home, 
  Calendar, 
  User, 
  Shield,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Calendar, label: 'Calendar', path: '/dashboard', adminOnly: false },
  { icon: User, label: 'Profile', path: '/profile' },
];

const adminNavItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/admin' },
  { icon: FileText, label: 'Reports', path: '/admin/reports' },
  { icon: Calendar, label: 'Leaves', path: '/admin/leaves' },
  { icon: User, label: 'Employees', path: '/admin/employees' },
];

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  
  const isAdminRoute = location.pathname.startsWith('/admin');
  const items = isAdminRoute ? adminNavItems : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 sm:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path + item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
        
        {/* Admin/Employee toggle for non-admin routes */}
        {!isAdminRoute && isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </button>
        )}
        
        {/* Employee view toggle for admin routes */}
        {isAdminRoute && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">My View</span>
          </button>
        )}
      </div>
    </nav>
  );
}
