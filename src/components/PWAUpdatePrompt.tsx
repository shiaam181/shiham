import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export default function PWAUpdatePrompt() {
  const { hasDeferredUpdate } = usePWAUpdate();
  const { toast } = useToast();
  const navigate = useNavigate();
  const shownRef = useRef(false);

  useEffect(() => {
    if (hasDeferredUpdate && !shownRef.current) {
      shownRef.current = true;
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
    }
  }, [hasDeferredUpdate]);

  return null;
}
