import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Camera } from 'lucide-react';
import DailyWorkUpdates from '@/components/DailyWorkUpdates';

export default function MyDailyUpdates() {
  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl space-y-5">
        <PageHeader
          title="My Daily Updates"
          description="Post daily work photos and activity logs"
          icon={<Camera className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
        />
        <DailyWorkUpdates />
      </main>
    </AppLayout>
  );
}
