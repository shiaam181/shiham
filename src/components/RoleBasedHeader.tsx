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

export default function RoleBasedHeader({
  currentView
}: RoleBasedHeaderProps) {
  const {
    profile,
    role,
    isDeveloper,
    isAdmin,
    isOwner,
    signOut
  } = useAuth();
  const navigate = useNavigate();

  const getHeaderStyles = () => {
    switch (currentView) {
      case 'developer':
        return 'bg-gradient-to-r from-purple-900 to-purple-800 text-white';
      case 'owner':
        return 'bg-gradient-to-r from-emerald-900 to-emerald-800 text-white';
      case 'admin':
        return 'bg-card text-foreground';
      default:
        return 'bg-card text-foreground';
    }
  };

  const getIcon = () => {
    switch (currentView) {
      case 'developer':
        return <Code className="w-5 h-5" />;
      case 'owner':
        return <Building2 className="w-5 h-5" />;
      case 'admin':
        return <Shield className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case 'developer':
        return {
          main: 'Developer Panel',
          sub: 'Full System Access'
        };
      case 'owner':
        return {
          main: 'Owner Dashboard',
          sub: 'Company Management'
        };
      case 'admin':
        return {
          main: 'Admin Dashboard',
          sub: 'AttendanceHub Management'
        };
      default:
        return {
          main: 'Employee Dashboard',
          sub: 'AttendanceHub'
        };
    }
  };

  const getCurrentViewLabel = () => {
    switch (currentView) {
      case 'developer':
        return 'Developer';
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      default:
        return 'Employee';
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'developer':
        return 'Developer';
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Administrator';
      default:
        return 'Employee';
    }
  };

  const getButtonStyles = () => {
    if (currentView === 'developer' || currentView === 'owner') {
      return 'text-white hover:bg-white/10';
    }
    return 'text-foreground hover:bg-accent';
  };

  const title = getTitle();
  const isDark = currentView === 'developer' || currentView === 'owner';

  return (
    <header className={`sticky top-0 z-50 border-b border-border/50 ${getHeaderStyles()}`}>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/20 text-white' : 'bg-primary text-primary-foreground'}`}>
              {getIcon()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-lg truncate">{title.main}</h1>
              <p className={`text-[10px] sm:text-xs truncate ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
                {title.sub}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Role Switcher Dropdown - only show if user has multiple roles */}
            {(isDeveloper || isAdmin || isOwner) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`px-2 sm:px-3 gap-1 ${getButtonStyles()}`}
                  >
                    {getIcon()}
                    <span className="hidden sm:inline">{getCurrentViewLabel()}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Switch View</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isDeveloper && (
                    <DropdownMenuItem 
                      onClick={() => navigate('/developer')}
                      className={currentView === 'developer' ? 'bg-muted' : ''}
                    >
                      <Code className="w-4 h-4 mr-2 text-purple-500" />
                      Developer Panel
                    </DropdownMenuItem>
                  )}
                  {isOwner && !isDeveloper && (
                    <DropdownMenuItem 
                      onClick={() => navigate('/owner')}
                      className={currentView === 'owner' ? 'bg-muted' : ''}
                    >
                      <Building2 className="w-4 h-4 mr-2 text-emerald-500" />
                      Owner Dashboard
                    </DropdownMenuItem>
                  )}
                  {(isAdmin || isDeveloper) && (
                    <DropdownMenuItem 
                      onClick={() => navigate('/admin')}
                      className={currentView === 'admin' ? 'bg-muted' : ''}
                    >
                      <Shield className="w-4 h-4 mr-2 text-primary" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => navigate('/dashboard')}
                    className={currentView === 'employee' ? 'bg-muted' : ''}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Employee View
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Settings button */}
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className={`px-2 sm:px-3 ${getButtonStyles()}`}>
              <Settings className="w-4 h-4" />
            </Button>
            
            <NotificationBell />
            
            <div className="hidden sm:flex items-center gap-2 ml-2">
              <div className="">
                {role === 'developer' ? <UserCheck className="w-5 h-5" /> : role === 'owner' ? <Building2 className="w-5 h-5" /> : role === 'admin' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-medium">{profile?.full_name}</p>
                <p className={`text-xs ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {getRoleLabel()}
                </p>
              </div>
            </div>
            
            <Button variant="ghost" size="icon" onClick={signOut} className={`w-8 h-8 sm:w-9 sm:h-9 ${getButtonStyles()}`}>
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}