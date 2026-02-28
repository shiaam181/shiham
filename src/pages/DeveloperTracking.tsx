import AppLayout from '@/components/AppLayout';
import { LiveTrackingSettings } from '@/components/LiveTrackingSettings';
import { LiveLocationMap } from '@/components/LiveLocationMap';

export default function DeveloperTracking() {
  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 space-y-6">
        <LiveTrackingSettings />
        <LiveLocationMap isDeveloper={true} />
      </main>
    </AppLayout>
  );
}
