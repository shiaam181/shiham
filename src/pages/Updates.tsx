import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Check, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import AppLayout from '@/components/AppLayout';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

interface AppUpdate {
  id: string;
  version: string;
  title: string;
  description: string | null;
  is_critical: boolean;
  created_at: string;
}

export default function Updates() {
  const { user } = useAuth();
  const { hasDeferredUpdate, deferredAt, update: applyUpdate } = usePWAUpdate();
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUpdates();
    }
  }, [user]);

  const fetchUpdates = async () => {
    if (!user) return;

    try {
      const { data: updatesData, error: updatesError } = await supabase
        .from('app_updates')
        .select('*')
        .order('created_at', { ascending: false });

      if (updatesError) throw updatesError;

      const { data: seenUpdates, error: seenError } = await supabase
        .from('user_seen_updates')
        .select('update_id')
        .eq('user_id', user.id);

      if (seenError) throw seenError;

      setUpdates(updatesData || []);
      setSeenIds(new Set((seenUpdates || []).map(s => s.update_id)));

      // Mark all as seen
      const unseenIds = (updatesData || [])
        .filter(u => !(seenUpdates || []).find(s => s.update_id === u.id))
        .map(u => u.id);

      if (unseenIds.length > 0 && user) {
        await Promise.all(
          unseenIds.map(updateId =>
            supabase.from('user_seen_updates').insert({
              user_id: user.id,
              update_id: updateId
            })
          )
        );
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading updates...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-display font-bold">App Updates</h1>
          <p className="text-sm text-muted-foreground">See what's new — full history of all releases</p>
        </div>

        {/* Summary */}
        {updates.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{updates.length} update{updates.length !== 1 ? 's' : ''} total</span>
            <span>•</span>
            <span>Latest: v{updates[0].version}</span>
            <span>•</span>
            <span>{format(new Date(updates[0].created_at), 'MMM d, yyyy')}</span>
          </div>
        )}

        {/* Updates Timeline */}
        <div className="space-y-4">
          {hasDeferredUpdate && (
            <Card className="relative overflow-hidden ring-2 ring-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">New app version ready</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {deferredAt
                          ? `Detected ${format(new Date(deferredAt), 'MMM d, yyyy • h:mm a')}`
                          : 'A new version is ready to install'}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={applyUpdate} className="gap-2 shrink-0">
                    <RefreshCw className="w-4 h-4" />
                    Update Now
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Update is available and waiting for your action.
                </p>
              </CardContent>
            </Card>
          )}

          {updates.length === 0 ? (
            !hasDeferredUpdate ? (
              <Card className="p-8 text-center">
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No updates yet</h3>
                <p className="text-sm text-muted-foreground">
                  When new features are released, they'll appear here.
                </p>
              </Card>
            ) : null
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-8 bottom-4 w-px bg-border" />

              <div className="space-y-4">
                {updates.map((update, index) => {
                  const wasSeen = seenIds.has(update.id);
                  const dateObj = new Date(update.created_at);

                  return (
                    <div key={update.id} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className="relative z-10 shrink-0 mt-4">
                        <div className={`w-[10px] h-[10px] rounded-full border-2 ${
                          update.is_critical
                            ? 'border-warning bg-warning'
                            : !wasSeen
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/40 bg-muted'
                        }`} style={{ marginLeft: '15px' }} />
                      </div>

                      <Card className={`flex-1 relative overflow-hidden ${!wasSeen ? 'ring-2 ring-primary/20' : ''}`}>
                        {update.is_critical && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-warning" />
                        )}
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {update.is_critical ? (
                                <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                                  <AlertTriangle className="w-4 h-4 text-warning" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Sparkles className="w-4 h-4 text-primary" />
                                </div>
                              )}
                              <div>
                                <CardTitle className="text-base">{update.title}</CardTitle>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>v{update.version}</span>
                                  <span>•</span>
                                  <span>{format(dateObj, 'MMM d, yyyy')}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(dateObj, 'h:mm a')}
                                  </span>
                                  <span>•</span>
                                  <span>{formatDistanceToNow(dateObj, { addSuffix: true })}</span>
                                </div>
                              </div>
                            </div>
                            {wasSeen && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Check className="w-3 h-3" />
                                Seen
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        {update.description && (
                          <CardContent className="pt-2">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {update.description}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
