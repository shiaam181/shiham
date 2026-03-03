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
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';

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
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <PageHeader
          title="Developer Panel"
          description="System overview and quick status"
          icon={<Code className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
        />

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Access Level"
            value="Developer"
            icon={<Code className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <StatCard
            label="Database"
            value="Connected"
            icon={<Database className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-success" />}
            iconBg="bg-success-soft"
          />
          <StatCard
            label="API Status"
            value="Active"
            icon={<Key className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-success" />}
            iconBg="bg-success-soft"
          />
          <StatCard
            label="Notifications"
            value="Enabled"
            icon={<Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-warning" />}
            iconBg="bg-warning-soft"
          />
        </div>
      </main>
    </AppLayout>
  );
}
