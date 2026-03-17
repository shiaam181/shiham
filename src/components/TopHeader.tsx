import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { LogOut, Settings, Code, Shield, User, ChevronDown, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopHeaderProps {
  currentView: 'employee' | 'admin' | 'developer' | 'owner';
}

export default function TopHeader({ currentView }: TopHeaderProps) {
  const { profile, role, isDeveloper, isAdmin, isOwner, signOut } = useAuth();
  const navigate = useNavigate();

  const getTitle = () => {
    switch (currentView) {
      case 'developer':
        return 'Developer Panel';
      case 'owner':
        return 'Owner Dashboard';
      case 'admin':
        return 'Admin Dashboard';
      default:
        return 'Zentrek';
    }
  };

  const getHeaderBg = () => {
    switch (currentView) {
      case 'developer':
        return 'bg-gradient-to-r from-purple-900 to-purple-800';
      default:
        return 'bg-card';
    }
  };

  return (
    <header className={`sticky top-0 z-50 border-b border-border/50 ${getHeaderBg()}`}>
      <div className="container mx-auto px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Logo/Title */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className={`font-display font-bold text-sm sm:text-lg truncate ${currentView === 'developer' ? 'text-white' : ''}`}>
              {getTitle()}
            </h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Role Switcher Dropdown */}
            {(isDeveloper || isAdmin || isOwner) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`px-2 sm:px-3 gap-1 ${currentView === 'developer' ? 'text-white hover:bg-white/10' : ''}`}
                  >
                    {currentView === 'developer' ? (
                      <Code className="w-4 h-4" />
                    ) : currentView === 'owner' ? (
                      <Building2 className="w-4 h-4" />
                    ) : currentView === 'admin' ? (
                      <Shield className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline capitalize">{currentView}</span>
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
            
            {/* Notification Bell */}
            <NotificationBell />
            
            {/* Profile Settings */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')} 
              className={`w-8 h-8 ${currentView === 'developer' ? 'text-white hover:bg-white/10' : ''}`}
            >
              <Settings className="w-4 h-4" />
            </Button>
            
            {/* Logout */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={signOut} 
              className={`w-8 h-8 ${currentView === 'developer' ? 'text-white hover:bg-white/10' : ''}`}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
