import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyFeatures } from '@/hooks/useCompanyFeatures';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Home, Users, Calendar, FileText, Settings, ClipboardList, Wallet, Bell,
  Building2, Shield, BarChart3, MapPin, Briefcase, Search, UserCheck,
  CalendarDays, ScrollText, Globe, Award, Megaphone,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  keywords: string[];
  roles?: string[];
}

const allNavItems: NavItem[] = [
  { label: 'Employee Dashboard', path: '/employee-home', icon: Home, keywords: ['home', 'dashboard'] },
  { label: 'My Attendance', path: '/my-attendance', icon: ClipboardList, keywords: ['attendance', 'check in', 'punch'] },
  { label: 'My Leaves', path: '/my-leaves', icon: CalendarDays, keywords: ['leave', 'time off', 'vacation'] },
  { label: 'My Payslips', path: '/my-payslips', icon: Wallet, keywords: ['salary', 'payslip', 'pay'] },
  { label: 'Announcements', path: '/announcements', icon: Megaphone, keywords: ['news', 'announcements'] },
  { label: 'Notifications', path: '/notification-center', icon: Bell, keywords: ['notifications', 'alerts'] },
  { label: 'Profile Settings', path: '/profile', icon: Settings, keywords: ['profile', 'settings', 'account'] },
  { label: 'Employee Directory', path: '/directory', icon: Users, keywords: ['directory', 'people', 'staff'] },
  // Admin
  { label: 'Admin Dashboard', path: '/admin', icon: Shield, keywords: ['admin', 'dashboard'], roles: ['admin', 'developer'] },
  { label: 'Employee Management', path: '/employees', icon: UserCheck, keywords: ['employees', 'manage'], roles: ['admin', 'developer'] },
  { label: 'Leave Management', path: '/leave-management', icon: Calendar, keywords: ['leave', 'approve'], roles: ['admin', 'developer'] },
  { label: 'Reports', path: '/reports', icon: BarChart3, keywords: ['reports', 'analytics'], roles: ['admin', 'developer'] },
  { label: 'Holiday Management', path: '/holidays', icon: CalendarDays, keywords: ['holidays'], roles: ['admin', 'developer'] },
  { label: 'Shift Management', path: '/shifts', icon: ScrollText, keywords: ['shifts', 'schedule'], roles: ['admin', 'developer'] },
  { label: 'Payroll', path: '/compensation', icon: Wallet, keywords: ['payroll', 'salary'], roles: ['admin', 'developer'] },
  { label: 'Company Settings', path: '/company-settings', icon: Building2, keywords: ['company', 'settings'], roles: ['admin', 'developer'] },
  { label: 'Geofence Locations', path: '/geofence-locations', icon: MapPin, keywords: ['geofence', 'location'], roles: ['admin', 'developer'] },
  { label: 'Audit Trail', path: '/audit-trail', icon: FileText, keywords: ['audit', 'logs'], roles: ['admin', 'developer'] },
  // Developer
  { label: 'Developer Dashboard', path: '/developer', icon: Globe, keywords: ['developer', 'dev'], roles: ['developer'] },
  { label: 'Company Management', path: '/company-management', icon: Building2, keywords: ['companies'], roles: ['developer'] },
  { label: 'Role Management', path: '/developer/roles', icon: Shield, keywords: ['roles'], roles: ['developer'] },
  // Manager
  { label: 'My Team', path: '/manager/team', icon: Users, keywords: ['team'], roles: ['manager', 'admin', 'developer'] },
  { label: 'Approvals', path: '/manager/approvals', icon: UserCheck, keywords: ['approvals', 'pending'], roles: ['manager', 'admin', 'developer'] },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role, isDeveloper } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const filteredItems = useMemo(() => {
    return allNavItems.filter(item => {
      if (!item.roles) return true;
      if (isDeveloper) return true;
      return item.roles.includes(role || '');
    });
  }, [role, isDeveloper]);

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {filteredItems.map(item => (
            <CommandItem
              key={item.path}
              value={`${item.label} ${item.keywords.join(' ')}`}
              onSelect={() => handleSelect(item.path)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
