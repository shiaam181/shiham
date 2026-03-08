import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import NotificationBell from '@/components/NotificationBell';
import MobileBottomNav from '@/components/MobileBottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { profile } = useAuth();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/50 bg-card/95 backdrop-blur-xl px-3 sm:px-4 h-14">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="hidden sm:flex items-center gap-2 relative">
              <Search className="w-4 h-4 absolute left-2.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="h-8 w-48 lg:w-64 pl-8 bg-muted/50 border-0 text-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/50">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {profile?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                {profile?.full_name}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 pb-mobile-nav overflow-x-hidden">
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
