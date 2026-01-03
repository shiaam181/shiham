import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { 
  LogOut, 
  User, 
  Shield, 
  Code 
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
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              currentView === 'developer' ? 'bg-white/20' : 'bg-sidebar-primary text-sidebar-primary-foreground'
            }`}>
              {getIcon()}
            </div>
            <div>
              <h1 className="font-display font-bold text-lg">{title.main}</h1>
              <p className={`text-xs ${currentView === 'developer' ? 'text-white/70' : 'text-sidebar-foreground/70'}`}>
                {title.sub}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Developer View - only visible to developers */}
            {isDeveloper && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/developer')}
                className={getActiveButtonStyles(currentView === 'developer')}
              >
                <Code className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Developer</span>
              </Button>
            )}
            
            {/* Admin View - visible to admins and developers */}
            {(isAdmin || isDeveloper) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/admin')}
                className={getActiveButtonStyles(currentView === 'admin')}
              >
                <Shield className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            
            {/* Employee View - visible to everyone */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/dashboard')}
              className={getActiveButtonStyles(currentView === 'employee')}
            >
              <User className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Employee</span>
            </Button>
            
            <NotificationBell />
            
            <div className="flex items-center gap-2 ml-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                currentView === 'developer' ? 'bg-white/20' : 'bg-sidebar-accent'
              }`}>
                {role === 'developer' ? <Code className="w-5 h-5" /> : 
                 role === 'admin' ? <Shield className="w-5 h-5" /> : 
                 <User className="w-5 h-5" />}
              </div>
              <div className="hidden sm:block">
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
              className={getButtonStyles()}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
