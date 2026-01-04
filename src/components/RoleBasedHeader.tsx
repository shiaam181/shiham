import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { 
  LogOut, 
  User, 
  Shield, 
  Code,
  Settings
} from 'lucide-react';

interface RoleBasedHeaderProps {
  currentView: 'employee' | 'admin' | 'developer';
}

export default function RoleBasedHeader({ currentView }: RoleBasedHeaderProps) {
  const { profile, role, isDeveloper, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const getHeaderStyles = () => {
    switch (currentView) {
      case 'developer':
        return 'bg-gradient-to-r from-purple-900 to-purple-800 text-white';
      case 'admin':
        return 'bg-sidebar text-sidebar-foreground';
      default:
        return 'bg-sidebar text-sidebar-foreground';
    }
  };

  const getIcon = () => {
    switch (currentView) {
      case 'developer':
        return <Code className="w-5 h-5" />;
      case 'admin':
        return <Shield className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case 'developer':
        return { main: 'Developer Panel', sub: 'Full System Access' };
      case 'admin':
        return { main: 'Admin Dashboard', sub: 'AttendanceHub Management' };
      default:
        return { main: 'Employee Dashboard', sub: 'AttendanceHub' };
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'developer':
        return 'Developer';
      case 'admin':
        return 'Administrator';
      default:
        return 'Employee';
    }
  };

  const getButtonStyles = () => {
    if (currentView === 'developer') {
      return 'text-white hover:bg-white/10';
    }
    return 'text-sidebar-foreground hover:bg-sidebar-accent';
  };

  const getActiveButtonStyles = (isActive: boolean) => {
    if (!isActive) return getButtonStyles();
    if (currentView === 'developer') {
      return 'text-white bg-white/20 hover:bg-white/25';
    }
    return 'text-sidebar-foreground bg-sidebar-accent';
  };

  const title = getTitle();

  return (
    <header className={`sticky top-0 z-50 border-b border-border/50 ${getHeaderStyles()}`}>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
              currentView === 'developer' ? 'bg-white/20' : 'bg-sidebar-primary text-sidebar-primary-foreground'
            }`}>
              {getIcon()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-lg truncate">{title.main}</h1>
              <p className={`text-[10px] sm:text-xs truncate ${currentView === 'developer' ? 'text-white/70' : 'text-sidebar-foreground/70'}`}>
                {title.sub}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Developer View - only visible to developers */}
            {isDeveloper && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/developer')}
                className={`px-2 sm:px-3 ${getActiveButtonStyles(currentView === 'developer')}`}
              >
                <Code className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Developer</span>
              </Button>
            )}
            
            {/* Admin View - visible to admins and developers */}
            {(isAdmin || isDeveloper) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/admin')}
                className={`px-2 sm:px-3 ${getActiveButtonStyles(currentView === 'admin')}`}
              >
                <Shield className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            
            {/* Employee View - visible to everyone */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/dashboard')}
              className={`px-2 sm:px-3 ${getActiveButtonStyles(currentView === 'employee')}`}
            >
              <User className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Employee</span>
            </Button>

            {/* Settings button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/profile')}
              className={`px-2 sm:px-3 ${getButtonStyles()}`}
            >
              <Settings className="w-4 h-4" />
            </Button>
            
            <NotificationBell />
            
            <div className="hidden sm:flex items-center gap-2 ml-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                currentView === 'developer' ? 'bg-white/20' : 'bg-sidebar-accent'
              }`}>
                {role === 'developer' ? <Code className="w-5 h-5" /> : 
                 role === 'admin' ? <Shield className="w-5 h-5" /> : 
                 <User className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-medium">{profile?.full_name}</p>
                <p className={`text-xs ${currentView === 'developer' ? 'text-white/70' : 'text-sidebar-foreground/70'}`}>
                  {getRoleLabel()}
                </p>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={signOut}
              className={`w-8 h-8 sm:w-9 sm:h-9 ${getButtonStyles()}`}
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
