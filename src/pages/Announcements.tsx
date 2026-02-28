import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Megaphone, Search, Paperclip, Clock, AlertTriangle, Info, Download } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import AppLayout from '@/components/AppLayout';

interface Announcement {
  id: string;
  scope: string;
  title: string;
  body: string;
  priority: string;
  category: string;
  status: string;
  attachments_json: any[];
  created_at: string;
  expires_at: string | null;
  created_by: string;
  author_name?: string;
  is_read?: boolean;
}

const priorityConfig: Record<string, { color: string; icon: React.ElementType }> = {
  URGENT: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
  IMPORTANT: { color: 'bg-warning/10 text-warning border-warning/20', icon: Info },
  NORMAL: { color: 'bg-muted text-muted-foreground', icon: Info },
};

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('status', 'PUBLISHED')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch read status
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      const readSet = new Set(reads?.map(r => r.announcement_id) || []);

      // Fetch author names
      const authorIds = [...new Set((data || []).map(a => a.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', authorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      setAnnouncements((data || []).map(a => ({
        ...a,
        attachments_json: a.attachments_json as any[] || [],
        author_name: profileMap.get(a.created_by) || 'System',
        is_read: readSet.has(a.id),
      })));
    } catch (e) {
      console.error('Error fetching announcements:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const markAsRead = async (ann: Announcement) => {
    if (!user || ann.is_read) return;
    await supabase.from('announcement_reads').upsert({
      announcement_id: ann.id,
      user_id: user.id,
    }, { onConflict: 'announcement_id,user_id' });
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_read: true } : a));
  };

  const openDetail = (ann: Announcement) => {
    setSelectedAnn(ann);
    markAsRead(ann);
  };

  const filtered = announcements.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.body.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'ALL' && a.category !== categoryFilter) return false;
    if (priorityFilter !== 'ALL' && a.priority !== priorityFilter) return false;
    return true;
  });

  const unreadCount = announcements.filter(a => !a.is_read).length;

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" /> Announcements
            </h1>
            <p className="text-sm text-muted-foreground">
              Company & platform announcements
              {unreadCount > 0 && <Badge className="ml-2" variant="destructive">{unreadCount} unread</Badge>}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {['GENERAL', 'HR', 'PAYROLL', 'COMPLIANCE', 'SYSTEM'].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priority</SelectItem>
              {['NORMAL', 'IMPORTANT', 'URGENT'].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No announcements found</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(ann => {
              const pc = priorityConfig[ann.priority] || priorityConfig.NORMAL;
              return (
                <Card
                  key={ann.id}
                  className={`cursor-pointer hover:bg-muted/30 transition-colors ${!ann.is_read ? 'border-l-4 border-l-primary' : ''}`}
                  onClick={() => openDetail(ann)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-sm">{ann.title}</h3>
                          <Badge variant="outline" className={`text-[10px] ${pc.color}`}>{ann.priority}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{ann.category}</Badge>
                          {ann.scope === 'GLOBAL' && <Badge className="text-[10px] bg-primary/10 text-primary">Global</Badge>}
                          {ann.attachments_json?.length > 0 && (
                            <Paperclip className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{ann.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{ann.author_name}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(ann.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      {!ann.is_read && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAnn} onOpenChange={(o) => !o && setSelectedAnn(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedAnn && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedAnn.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={priorityConfig[selectedAnn.priority]?.color}>{selectedAnn.priority}</Badge>
                  <Badge variant="secondary">{selectedAnn.category}</Badge>
                  {selectedAnn.scope === 'GLOBAL' && <Badge className="bg-primary/10 text-primary">Global</Badge>}
                </div>
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                  {selectedAnn.body}
                </div>
                {selectedAnn.attachments_json?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                    {selectedAnn.attachments_json.map((att: any, i: number) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded bg-muted hover:bg-muted/80 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span className="truncate">{att.name || `Attachment ${i + 1}`}</span>
                      </a>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <p>By {selectedAnn.author_name} • {format(new Date(selectedAnn.created_at), 'PPpp')}</p>
                  {selectedAnn.expires_at && (
                    <p className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> Expires {format(new Date(selectedAnn.expires_at), 'PPp')}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
