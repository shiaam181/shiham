import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export default function PWAUpdatePrompt() {
  const { hasDeferredUpdate, hasBeenNotified, markDeferredAsNotified } = usePWAUpdate();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasDeferredUpdate && !hasBeenNotified) {
      toast({
        title: 'New update available',
        description: 'Go to Updates to install the latest version.',
        action: (
          <button
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
            onClick={() => navigate('/updates')}
          >
            View Updates
          </button>
        ),
      });

      markDeferredAsNotified();
    }
  }, [hasDeferredUpdate, hasBeenNotified, markDeferredAsNotified, toast, navigate]);

  return null;
}

