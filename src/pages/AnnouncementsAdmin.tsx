import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
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
import { Megaphone, Plus, Loader2, Eye, Pencil, Archive, Trash2, Users, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';

interface Announcement {
  id: string;
  scope: string;
  company_id: string | null;
  title: string;
  body: string;
  priority: string;
  category: string;
  target_audience: string;
  target_roles: string[] | null;
  target_departments: string[] | null;
  status: string;
  attachments_json: any[];
  publish_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export default function AnnouncementsAdmin() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState('PUBLISHED');

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [category, setCategory] = useState('GENERAL');
  const [targetAudience, setTargetAudience] = useState('ALL');
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Stats
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});

  const fetchAnnouncements = useCallback(async () => {
    if (!user || !profile?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('scope', 'TENANT')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements((data || []).map(a => ({ ...a, attachments_json: a.attachments_json as any[] || [] })));

      // Fetch read counts
      if (data && data.length > 0) {
        const annIds = data.map(a => a.id);
        const { data: reads } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .in('announcement_id', annIds);

        const counts: Record<string, number> = {};
        reads?.forEach(r => { counts[r.announcement_id] = (counts[r.announcement_id] || 0) + 1; });
        setReadCounts(counts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.company_id]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const resetForm = () => {
    setTitle(''); setBody(''); setPriority('NORMAL'); setCategory('GENERAL');
    setTargetAudience('ALL'); setPublishAt(''); setExpiresAt('');
    setEditingId(null);
  };

  const openComposer = (ann?: Announcement) => {
    if (ann) {
      setEditingId(ann.id);
      setTitle(ann.title);
      setBody(ann.body);
      setPriority(ann.priority);
      setCategory(ann.category);
      setTargetAudience(ann.target_audience);
      setPublishAt(ann.publish_at || '');
      setExpiresAt(ann.expires_at || '');
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
        scope: 'TENANT' as const,
        company_id: profile?.company_id,
        title: title.trim(),
        body: body.trim(),
        priority,
        category,
        target_audience: targetAudience,
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

        // If publishing now, create notifications for target users
        if (publishNow && inserted) {
          await createNotificationsForAnnouncement(inserted);
        }
      }

      toast({ title: 'Saved', description: publishNow ? 'Announcement published' : 'Announcement saved' });
      setShowComposer(false);
      resetForm();
      fetchAnnouncements();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const createNotificationsForAnnouncement = async (ann: any) => {
    try {
      // Get target employees
      let query = supabase.from('profiles').select('user_id').eq('is_active', true);
      if (profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }
      const { data: employees } = await query;
      if (!employees || employees.length === 0) return;

      const notifications = employees.map(emp => ({
        company_id: profile?.company_id,
        user_id: emp.user_id,
        type: 'ANNOUNCEMENT',
        title: ann.title,
        message: ann.body.substring(0, 200),
        link_url: '/announcements',
        reference_id: ann.id,
      }));

      // Insert in batches of 100
      for (let i = 0; i < notifications.length; i += 100) {
        await supabase.from('notifications').insert(notifications.slice(i, i + 100));
      }
    } catch (e) {
      console.error('Error creating notifications:', e);
    }
  };

  const publishDraft = async (ann: Announcement) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').update({ status: 'PUBLISHED' }).eq('id', ann.id);
      if (error) throw error;
      await createNotificationsForAnnouncement(ann);
      toast({ title: 'Published' });
      fetchAnnouncements();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const archiveAnnouncement = async (id: string) => {
    await supabase.from('announcements').update({ status: 'ARCHIVED' }).eq('id', id);
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    fetchAnnouncements();
  };

  const filteredAnns = announcements.filter(a => a.status === tab);

  const statusCounts = {
    DRAFT: announcements.filter(a => a.status === 'DRAFT').length,
    PUBLISHED: announcements.filter(a => a.status === 'PUBLISHED').length,
    SCHEDULED: announcements.filter(a => a.status === 'SCHEDULED').length,
    ARCHIVED: announcements.filter(a => a.status === 'ARCHIVED').length,
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" /> Announcements Admin
            </h1>
            <p className="text-sm text-muted-foreground">Create and manage company announcements</p>
          </div>
          <Button size="sm" onClick={() => openComposer()}>
            <Plus className="w-4 h-4 mr-1" /> New Announcement
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Card key={status} className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{status}</p>
              <p className="text-xl font-bold">{count}</p>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="PUBLISHED">Published</TabsTrigger>
            <TabsTrigger value="DRAFT">Drafts</TabsTrigger>
            <TabsTrigger value="SCHEDULED">Scheduled</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archived</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {filteredAnns.length === 0 ? (
              <Card className="p-12 text-center">
                <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground">No {tab.toLowerCase()} announcements</p>
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
                    {filteredAnns.map(ann => (
                      <TableRow key={ann.id}>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[200px]">{ann.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{ann.body.substring(0, 60)}...</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ann.priority === 'URGENT' ? 'destructive' : ann.priority === 'IMPORTANT' ? 'default' : 'secondary'} className="text-[10px]">
                            {ann.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{ann.category}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs">
                            <BarChart3 className="w-3 h-3" />
                            {readCounts[ann.id] || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(ann.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {ann.status === 'DRAFT' && (
                              <Button size="sm" variant="ghost" onClick={() => publishDraft(ann)} title="Publish">
                                <Megaphone className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openComposer(ann)} title="Edit">
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {ann.status === 'PUBLISHED' && (
                              <Button size="sm" variant="ghost" onClick={() => archiveAnnouncement(ann.id)} title="Archive">
                                <Archive className="w-3 h-3" />
                              </Button>
                            )}
                            {(ann.status === 'DRAFT' || ann.status === 'ARCHIVED') && (
                              <Button size="sm" variant="ghost" onClick={() => deleteAnnouncement(ann.id)} title="Delete">
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
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

      {/* Composer Dialog */}
      <Dialog open={showComposer} onOpenChange={(o) => { if (!o) { setShowComposer(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
            <DialogDescription>Compose a company announcement for your employees.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your announcement..." rows={5} />
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
                    {['GENERAL', 'HR', 'PAYROLL', 'COMPLIANCE', 'SYSTEM'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Employees</SelectItem>
                  <SelectItem value="ROLE_BASED">Role-Based</SelectItem>
                  <SelectItem value="DEPARTMENT">Department</SelectItem>
                </SelectContent>
              </Select>
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
