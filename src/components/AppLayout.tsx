import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import NotificationBell from '@/components/NotificationBell';
import MobileBottomNav from '@/components/MobileBottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import HRAssistantChat from '@/components/HRAssistantChat';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Command } from 'lucide-react';
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
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/50 bg-card/95 backdrop-blur-xl px-3 sm:px-4 h-14" role="banner" aria-label="Top navigation">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div
              className="hidden sm:flex items-center gap-2 relative cursor-pointer"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            >
              <Search className="w-4 h-4 absolute left-2.5 text-muted-foreground" />
              <div className="h-8 w-48 lg:w-64 pl-8 pr-10 bg-muted/50 border-0 rounded-md flex items-center">
                <span className="text-sm text-muted-foreground">Search...</span>
              </div>
              <kbd className="absolute right-2 pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
        <main id="main-content" className="flex-1 pb-mobile-nav overflow-x-hidden" role="main">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </SidebarInset>
      
      {/* AI HR Assistant */}
      <HRAssistantChat />
    </SidebarProvider>
  );
}
