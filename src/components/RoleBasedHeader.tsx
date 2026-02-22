import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { LogOut, User, Shield, Code, Settings, UserCheck, ChevronDown, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RoleBasedHeaderProps {
  currentView: 'employee' | 'admin' | 'developer' | 'owner';
}

export default function RoleBasedHeader({ currentView }: RoleBasedHeaderProps) {
  const { profile, role, isDeveloper, isAdmin, isOwner, signOut } = useAuth();
  const navigate = useNavigate();

  const getHeaderStyles = () => {
    switch (currentView) {
      case 'developer':
        return 'header-gradient-developer text-white';
      case 'owner':
        return 'header-gradient-owner text-white';
      case 'admin':
        return 'header-gradient text-white';
      default:
        return 'header-gradient text-white';
    }
  };

  const getIcon = () => {
    switch (currentView) {
      case 'developer': return <Code className="w-4 h-4" />;
      case 'owner': return <Building2 className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case 'developer': return { main: 'Developer Panel', sub: 'Full System Access' };
      case 'owner': return { main: 'Owner Dashboard', sub: 'Company Management' };
      case 'admin': return { main: 'Admin Dashboard', sub: 'Team Management' };
      default: return { main: 'Dashboard', sub: 'AttendanceHub' };
    }
  };

  const getCurrentViewLabel = () => {
    switch (currentView) {
      case 'developer': return 'Developer';
      case 'owner': return 'Owner';
      case 'admin': return 'Admin';
      default: return 'Employee';
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'developer': return 'Developer';
      case 'owner': return 'Owner';
      case 'admin': return 'Administrator';
      default: return 'Employee';
    }
  };

  const title = getTitle();

  return (
    <header className={`sticky top-0 z-50 ${getHeaderStyles()}`}>
      {/* Subtle top accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10">
              {getIcon()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-base truncate tracking-tight">{title.main}</h1>
              <p className="text-[10px] sm:text-xs truncate text-white/60">{title.sub}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Role Switcher */}
            {(isDeveloper || isAdmin || isOwner) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-2 sm:px-2.5 gap-1 text-white hover:bg-white/10 h-8">
                    {getIcon()}
                    <span className="hidden sm:inline text-xs">{getCurrentViewLabel()}</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Switch View</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isDeveloper && (
                    <DropdownMenuItem onClick={() => navigate('/developer')} className={currentView === 'developer' ? 'bg-accent' : ''}>
                      <Code className="w-4 h-4 mr-2 text-purple-500" />
                      Developer Panel
                    </DropdownMenuItem>
                  )}
                  {isOwner && !isDeveloper && (
                    <DropdownMenuItem onClick={() => navigate('/owner')} className={currentView === 'owner' ? 'bg-accent' : ''}>
                      <Building2 className="w-4 h-4 mr-2 text-emerald-500" />
                      Owner Dashboard
                    </DropdownMenuItem>
                  )}
                  {(isAdmin || isDeveloper) && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className={currentView === 'admin' ? 'bg-accent' : ''}>
                      <Shield className="w-4 h-4 mr-2 text-primary" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} className={currentView === 'employee' ? 'bg-accent' : ''}>
                    <User className="w-4 h-4 mr-2" />
                    Employee View
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="px-2 text-white hover:bg-white/10 h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
            
            <NotificationBell />
            
            {/* Desktop user info */}
            <div className="hidden sm:flex items-center gap-2 ml-1.5 pl-2 border-l border-white/15">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                {role === 'developer' ? <UserCheck className="w-4 h-4" /> : role === 'owner' ? <Building2 className="w-4 h-4" /> : role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs font-medium leading-tight">{profile?.full_name}</p>
                <p className="text-[10px] text-white/50">{getRoleLabel()}</p>
              </div>
            </div>
            
            <Button variant="ghost" size="icon" onClick={signOut} className="w-8 h-8 text-white hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
