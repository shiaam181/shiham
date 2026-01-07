import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Sparkles, ArrowRight } from 'lucide-react';

interface AppUpdate {
  id: string;
  version: string;
  title: string;
  description: string | null;
  is_critical: boolean;
  created_at: string;
}

export default function UpdateNotification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unseenUpdates, setUnseenUpdates] = useState<AppUpdate[]>([]);
  const [currentUpdate, setCurrentUpdate] = useState<AppUpdate | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnseenUpdates();
    }
  }, [user]);

  const fetchUnseenUpdates = async () => {
    if (!user) return;

    try {
      // Get all updates
      const { data: updates, error: updatesError } = await supabase
        .from('app_updates')
        .select('*')
        .order('created_at', { ascending: false });

      if (updatesError) throw updatesError;

      // Get seen updates for this user
      const { data: seenUpdates, error: seenError } = await supabase
        .from('user_seen_updates')
        .select('update_id')
        .eq('user_id', user.id);

      if (seenError) throw seenError;

      const seenIds = new Set((seenUpdates || []).map(s => s.update_id));
      const unseen = (updates || []).filter(u => !seenIds.has(u.id));

      setUnseenUpdates(unseen);
      if (unseen.length > 0) {
        setCurrentUpdate(unseen[0]);
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
    }
  };

  const markAsSeen = async (updateId: string) => {
    if (!user) return;

    try {
      await supabase.from('user_seen_updates').insert({
        user_id: user.id,
        update_id: updateId
      });
    } catch (error) {
      console.error('Error marking update as seen:', error);
    }
  };

  const handleDismiss = async () => {
    if (currentUpdate) {
      await markAsSeen(currentUpdate.id);
      
      // Show next update or close
      const remaining = unseenUpdates.filter(u => u.id !== currentUpdate.id);
      setUnseenUpdates(remaining);
      
      if (remaining.length > 0) {
        setCurrentUpdate(remaining[0]);
      } else {
        setCurrentUpdate(null);
        setIsDismissed(true);
      }
    }
  };

  const handleViewAll = () => {
    // Mark current as seen and navigate
    if (currentUpdate) {
      markAsSeen(currentUpdate.id);
    }
    navigate('/notifications?tab=updates');
    setIsDismissed(true);
  };

  if (!currentUpdate || isDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">New Update!</h3>
                <p className="text-xs text-muted-foreground">Version {currentUpdate.version}</p>
              </div>
            </div>
            {!currentUpdate.is_critical && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 -mr-2 -mt-2"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="space-y-3 mb-6">
            <h4 className="font-semibold">{currentUpdate.title}</h4>
            {currentUpdate.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentUpdate.description}
              </p>
            )}
          </div>

          {/* Badge for unseen count */}
          {unseenUpdates.length > 1 && (
            <p className="text-xs text-muted-foreground mb-4">
              +{unseenUpdates.length - 1} more update{unseenUpdates.length > 2 ? 's' : ''}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!currentUpdate.is_critical && (
              <Button variant="outline" className="flex-1" onClick={handleDismiss}>
                Got it
              </Button>
            )}
            <Button className="flex-1 gap-2" onClick={handleViewAll}>
              View All Updates
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
