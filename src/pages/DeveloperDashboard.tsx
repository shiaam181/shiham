import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import {
  Code,
  Database,
  Key,
  Bell,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';

export default function DeveloperDashboard() {
  const { isDeveloper, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading developer dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isDeveloper) {
    navigate('/dashboard');
    return null;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Developer Panel</h1>
          <p className="text-muted-foreground text-sm">System overview and quick status</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <Card className="p-3 sm:p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                <Code className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Access Level</p>
                <p className="text-sm sm:text-xl font-display font-bold truncate">Developer</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Database</p>
                <p className="text-sm sm:text-xl font-display font-bold truncate">Connected</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">API Status</p>
                <p className="text-sm sm:text-xl font-display font-bold truncate">Active</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Notifications</p>
                <p className="text-sm sm:text-xl font-display font-bold truncate">Enabled</p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </AppLayout>
  );
}
