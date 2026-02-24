import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Home,
  ClipboardList,
  User,
  Calendar,
  Users,
  FileText,
  Clock,
  Settings,
  Shield,
  Code,
  Building2,
  ChevronDown,
  MapPin,
  Wallet,
  MessageSquare,
  BarChart3,
  CalendarOff,
  LogOut,
  X,
  BookOpen,
  Scale,
  Receipt,
  UserCheck,
  Briefcase,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  action?: string;
  children?: NavItem[];
}

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, role, isAdmin, isDeveloper, isOwner, isHR, isManager, isPayrollTeam, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNav = (path?: string) => {
    if (path) {
      navigate(path);
      if (isMobile) setOpenMobile(false);
    }
  };

  // Employee items - visible to all
  const employeeItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    {
      icon: ClipboardList, label: 'Attendance', children: [
        { icon: ClipboardList, label: 'My Attendance', path: '/my-attendance' },
      ]
    },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  // HR items - visible to HR role
  const hrItems: NavItem[] = [
    { icon: Users, label: 'Employee Management', path: '/admin/employees' },
    { icon: Calendar, label: 'Leave Management', path: '/admin/leaves' },
    {
      icon: Wallet, label: 'Payroll', children: [
        { icon: Wallet, label: 'Compensation', path: '/payroll' },
        { icon: Scale, label: 'Statutory Compliance', path: '/compliance' },
        { icon: Receipt, label: 'Leave Policies', path: '/leave-policies' },
      ]
    },
    {
      icon: Clock, label: 'Scheduling', children: [
        { icon: Clock, label: 'Shifts', path: '/admin/shifts' },
        { icon: CalendarOff, label: 'Week Offs', path: '/admin/weekoffs' },
        { icon: Calendar, label: 'Holidays', path: '/admin/holidays' },
      ]
    },
    { icon: FileText, label: 'Reports', path: '/admin/reports' },
  ];

  // Manager items
  const managerItems: NavItem[] = [
    { icon: Users, label: 'My Team', path: '/manager/team' },
    { icon: UserCheck, label: 'Approvals', path: '/manager/approvals' },
  ];

  // Admin items - visible to admins and above
  const adminItems: NavItem[] = [
    { icon: Home, label: 'Admin Dashboard', path: '/admin' },
    {
      icon: ClipboardList, label: 'Attendance & Reports', children: [
        { icon: FileText, label: 'Reports', path: '/admin/reports' },
      ]
    },
    { icon: Users, label: 'Employee Management', path: '/admin/employees' },
    { icon: Calendar, label: 'Leave Management', path: '/admin/leaves' },
    {
      icon: Wallet, label: 'Payroll & Compliance', children: [
        { icon: Wallet, label: 'Compensation', path: '/payroll' },
        { icon: Scale, label: 'Statutory Compliance', path: '/compliance' },
        { icon: Receipt, label: 'Leave Policies', path: '/leave-policies' },
      ]
    },
    {
      icon: Clock, label: 'Scheduling', children: [
        { icon: Clock, label: 'Shift Management', path: '/admin/shifts' },
        { icon: CalendarOff, label: 'Week Offs', path: '/admin/weekoffs' },
        { icon: Calendar, label: 'Holidays', path: '/admin/holidays' },
      ]
    },
    { icon: Settings, label: 'Company Settings', path: '/admin/settings' },
    { icon: BookOpen, label: 'Setup Guide', path: '/setup-guide' },
  ];

  // Developer items - visible to developers only
  const developerItems: NavItem[] = [
    { icon: Code, label: 'Developer Panel', path: '/developer' },
    { icon: Building2, label: 'Company Management', path: '/developer/companies' },
    {
      icon: Shield, label: 'Administration', children: [
        { icon: Home, label: 'Admin Dashboard', path: '/admin' },
        { icon: Users, label: 'Employees', path: '/admin/employees' },
        { icon: Calendar, label: 'Leaves', path: '/admin/leaves' },
        { icon: FileText, label: 'Reports', path: '/admin/reports' },
      ]
    },
    {
      icon: Wallet, label: 'Payroll & Compliance', children: [
        { icon: Wallet, label: 'Compensation', path: '/payroll' },
        { icon: Scale, label: 'Statutory Compliance', path: '/compliance' },
        { icon: Receipt, label: 'Leave Policies', path: '/leave-policies' },
      ]
    },
    {
      icon: Settings, label: 'Configuration', children: [
        { icon: Clock, label: 'Shifts', path: '/admin/shifts' },
        { icon: CalendarOff, label: 'Week Offs', path: '/admin/weekoffs' },
        { icon: Calendar, label: 'Holidays', path: '/admin/holidays' },
        { icon: Settings, label: 'Company Settings', path: '/admin/settings' },
      ]
    },
    { icon: MapPin, label: 'Live Tracking', path: '/developer' },
    { icon: BookOpen, label: 'Setup Guide', path: '/setup-guide' },
  ];

  // Payroll team items
  const payrollItems: NavItem[] = [
    { icon: Wallet, label: 'Payroll Processing', path: '/payroll' },
  ];

  const isActive = (path?: string) => path ? location.pathname === path : false;

  const renderNavItem = (item: NavItem, depth = 0) => {
    if (item.children) {
      return <CollapsibleNavItem key={item.label} item={item} depth={depth} />;
    }

    return (
      <SidebarMenuItem key={item.label + item.path}>
        <SidebarMenuButton
          isActive={isActive(item.path)}
          onClick={() => handleNav(item.path)}
          tooltip={item.label}
          className={cn(
            "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            isActive(item.path) && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
            depth > 0 && "pl-8 text-[13px]"
          )}
        >
          <item.icon className="w-4 h-4" />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const CollapsibleNavItem = ({ item, depth }: { item: NavItem; depth: number }) => {
    const [isOpen, setIsOpen] = useState(
      item.children?.some(child => child.path && location.pathname === child.path) ?? false
    );

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full justify-between"
            >
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="ml-2 border-l border-sidebar-border pl-2 mt-1">
              {item.children?.map(child => renderNavItem(child, depth + 1))}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm text-sidebar-foreground">HRMS</h2>
              <p className="text-[10px] text-sidebar-foreground/50">Workforce Platform</p>
            </div>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setOpenMobile(false)}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Employee Section - always visible */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
            Employee
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employeeItems.map(item => renderNavItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Manager Section */}
        {(isManager && !isAdmin && !isDeveloper) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
              Manager
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managerItems.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* HR Section */}
        {(role === 'hr') && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
              HR
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {hrItems.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Payroll Team Section */}
        {(role === 'payroll_team') && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
              Payroll
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {payrollItems.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin Section - visible to admin, owner, developer */}
        {(isAdmin || isOwner) && !isDeveloper && role !== 'hr' && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Developer Section - visible to developers only */}
        {isDeveloper && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
              Developer
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {developerItems.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-sidebar-foreground/70" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name}</p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{role || 'employee'}</p>
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-sidebar-foreground/50 hover:text-sidebar-foreground shrink-0" onClick={signOut}>
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
