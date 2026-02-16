import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export default function PWAUpdatePrompt() {
  const { needRefresh, update, dismiss } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center space-y-2 mb-6">
            <h3 className="font-display font-bold text-xl">New Update Available!</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A new version of AttendanceHub is ready. Update now to get the latest features and improvements.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={dismiss}>
              Later
            </Button>
            <Button className="flex-1 gap-2" onClick={update}>
              <RefreshCw className="w-4 h-4" />
              Update Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
