import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, Plus, Loader2, Pencil, Archive, Trash2, BarChart3, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: string;
  category: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  publish_at: string | null;
}

export default function GlobalBroadcast() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState('PUBLISHED');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [category, setCategory] = useState('SYSTEM');
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const [readCounts, setReadCounts] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('scope', 'GLOBAL')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);

      if (data && data.length > 0) {
        const { data: reads } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .in('announcement_id', data.map(a => a.id));

        const counts: Record<string, number> = {};
        reads?.forEach(r => { counts[r.announcement_id] = (counts[r.announcement_id] || 0) + 1; });
        setReadCounts(counts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setTitle(''); setBody(''); setPriority('NORMAL'); setCategory('SYSTEM');
    setPublishAt(''); setExpiresAt(''); setEditingId(null);
  };

  const openComposer = (ann?: Announcement) => {
    if (ann) {
      setEditingId(ann.id);
      setTitle(ann.title); setBody(ann.body);
      setPriority(ann.priority); setCategory(ann.category);
      setPublishAt(ann.publish_at || ''); setExpiresAt(ann.expires_at || '');
    } else {
      resetForm();
    }
    setShowComposer(true);
  };

  const saveAnnouncement = async (publishNow = false) => {
    if (!title.trim() || !body.trim()) {
      toast({ title: 'Error', description: 'Title and body required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let status = 'DRAFT';
      if (publishNow) status = 'PUBLISHED';
      else if (publishAt) status = 'SCHEDULED';

      const payload = {
        scope: 'GLOBAL' as const,
        company_id: null,
        title: title.trim(),
        body: body.trim(),
        priority,
        category,
        target_audience: 'ALL',
        status,
        publish_at: publishAt || null,
        expires_at: expiresAt || null,
        created_by: user!.id,
      };

      if (editingId) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('announcements').insert(payload).select().single();
        if (error) throw error;

        if (publishNow && inserted) {
          // Create notifications for all users
          const { data: allUsers } = await supabase.from('profiles').select('user_id').eq('is_active', true);
          if (allUsers && allUsers.length > 0) {
            const notifications = allUsers.map(u => ({
              user_id: u.user_id,
              type: 'ANNOUNCEMENT',
              title: inserted.title,
              message: inserted.body.substring(0, 200),
              link_url: '/announcements',
              reference_id: inserted.id,
            }));
            for (let i = 0; i < notifications.length; i += 100) {
              await supabase.from('notifications').insert(notifications.slice(i, i + 100));
            }
          }
        }
      }

      toast({ title: 'Saved', description: publishNow ? 'Broadcast published globally' : 'Broadcast saved as draft' });
      setShowComposer(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async (ann: Announcement) => {
    const { error } = await supabase.from('announcements').update({ status: 'PUBLISHED' }).eq('id', ann.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    // Create notifications
    const { data: allUsers } = await supabase.from('profiles').select('user_id').eq('is_active', true);
    if (allUsers) {
      const notifications = allUsers.map(u => ({
        user_id: u.user_id,
        type: 'ANNOUNCEMENT',
        title: ann.title,
        message: ann.body.substring(0, 200),
        link_url: '/announcements',
        reference_id: ann.id,
      }));
      for (let i = 0; i < notifications.length; i += 100) {
        await supabase.from('notifications').insert(notifications.slice(i, i + 100));
      }
    }
    toast({ title: 'Published globally' });
    fetchData();
  };

  const archiveAnn = async (id: string) => {
    await supabase.from('announcements').update({ status: 'ARCHIVED' }).eq('id', id);
    fetchData();
  };

  const deleteAnn = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    fetchData();
  };

  const filtered = announcements.filter(a => a.status === tab);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="w-6 h-6 text-primary" /> Global Broadcast
            </h1>
            <p className="text-sm text-muted-foreground">Platform-wide announcements for all users across all companies</p>
          </div>
          <Button size="sm" onClick={() => openComposer()}>
            <Plus className="w-4 h-4 mr-1" /> New Broadcast
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="PUBLISHED">Published</TabsTrigger>
            <TabsTrigger value="DRAFT">Drafts</TabsTrigger>
            <TabsTrigger value="SCHEDULED">Scheduled</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archived</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {filtered.length === 0 ? (
              <Card className="p-12 text-center">
                <Radio className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground">No {tab.toLowerCase()} broadcasts</p>
              </Card>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Reads</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(ann => (
                      <TableRow key={ann.id}>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[250px]">{ann.title}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ann.priority === 'URGENT' ? 'destructive' : 'secondary'} className="text-[10px]">{ann.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{ann.category}</TableCell>
                        <TableCell className="text-center text-xs">
                          <div className="flex items-center justify-center gap-1">
                            <BarChart3 className="w-3 h-3" /> {readCounts[ann.id] || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(ann.created_at), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {ann.status === 'DRAFT' && (
                              <Button size="sm" variant="ghost" onClick={() => publishDraft(ann)}><Megaphone className="w-3 h-3" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openComposer(ann)}><Pencil className="w-3 h-3" /></Button>
                            {ann.status === 'PUBLISHED' && (
                              <Button size="sm" variant="ghost" onClick={() => archiveAnn(ann.id)}><Archive className="w-3 h-3" /></Button>
                            )}
                            {ann.status !== 'PUBLISHED' && (
                              <Button size="sm" variant="ghost" onClick={() => deleteAnn(ann.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Composer */}
      <Dialog open={showComposer} onOpenChange={(o) => { if (!o) { setShowComposer(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Broadcast' : 'New Global Broadcast'}</DialogTitle>
            <DialogDescription>This will be visible to ALL users across ALL companies.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Broadcast title" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your broadcast..." rows={5} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="IMPORTANT">Important</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['GENERAL', 'HR', 'SYSTEM', 'COMPLIANCE'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Schedule (optional)</Label>
                <Input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expires (optional)</Label>
                <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowComposer(false); resetForm(); }}>Cancel</Button>
            <Button variant="secondary" onClick={() => saveAnnouncement(false)} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Draft
            </Button>
            <Button onClick={() => saveAnnouncement(true)} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Publish Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
