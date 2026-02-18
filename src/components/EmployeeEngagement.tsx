import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Megaphone, MessageSquare, Award, Plus, Loader2, Trash2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface Feedback {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  message: string;
  is_anonymous: boolean;
  status: string;
  admin_response: string | null;
  created_at: string;
  profile?: { full_name: string };
}

interface EmployeeAward {
  id: string;
  user_id: string;
  award_title: string;
  description: string | null;
  award_date: string;
  created_at: string;
  profile?: { full_name: string };
}

export default function EmployeeEngagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [awards, setAwards] = useState<EmployeeAward[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Announcement form
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState('normal');

  // Award form
  const [showAwardDialog, setShowAwardDialog] = useState(false);
  const [awardEmployee, setAwardEmployee] = useState('');
  const [awardTitle, setAwardTitle] = useState('');
  const [awardDescription, setAwardDescription] = useState('');

  // Feedback response
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [annRes, fbRes, awdRes, empRes] = await Promise.all([
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_feedback').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('employee_awards').select('*').order('award_date', { ascending: false }).limit(50),
      supabase.from('profiles').select('user_id, full_name').eq('is_active', true),
    ]);

    if (annRes.data) setAnnouncements(annRes.data as any);
    if (empRes.data) {
      setEmployees(empRes.data);
      if (fbRes.data) {
        setFeedbacks(fbRes.data.map(f => ({
          ...f,
          profile: empRes.data.find(e => e.user_id === f.user_id),
        })) as any);
      }
      if (awdRes.data) {
        setAwards(awdRes.data.map(a => ({
          ...a,
          profile: empRes.data.find(e => e.user_id === a.user_id),
        })) as any);
      }
    }
    setLoading(false);
  };

  const createAnnouncement = async () => {
    if (!annTitle || !annContent) {
      toast({ title: 'Error', description: 'Title and content required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('announcements').insert({
      title: annTitle,
      content: annContent,
      priority: annPriority,
      created_by: user?.id || '',
    });
    if (error) {
      toast({ title: 'Error', description: 'Failed to create announcement', variant: 'destructive' });
    } else {
      toast({ title: 'Published', description: 'Announcement published successfully' });
      setShowAnnouncementDialog(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnPriority('normal');
      fetchData();
    }
    setSaving(false);
  };

  const toggleAnnouncement = async (id: string, active: boolean) => {
    await supabase.from('announcements').update({ is_active: active }).eq('id', id);
    fetchData();
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    fetchData();
  };

  const giveAward = async () => {
    if (!awardEmployee || !awardTitle) {
      toast({ title: 'Error', description: 'Select employee and enter award title', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('employee_awards').insert({
      user_id: awardEmployee,
      award_title: awardTitle,
      description: awardDescription || null,
      awarded_by: user?.id || '',
    });
    if (error) {
      toast({ title: 'Error', description: 'Failed to give award', variant: 'destructive' });
    } else {
      toast({ title: 'Award Given! 🏆', description: `Award given successfully` });
      setShowAwardDialog(false);
      setAwardEmployee('');
      setAwardTitle('');
      setAwardDescription('');
      fetchData();
    }
    setSaving(false);
  };

  const respondToFeedback = async (feedbackId: string) => {
    if (!responseText) return;
    setSaving(true);
    const { error } = await supabase.from('employee_feedback').update({
      admin_response: responseText,
      responded_by: user?.id || '',
      responded_at: new Date().toISOString(),
      status: 'resolved',
    }).eq('id', feedbackId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to respond', variant: 'destructive' });
    } else {
      toast({ title: 'Response Sent', description: 'Feedback response saved' });
      setRespondingTo(null);
      setResponseText('');
      fetchData();
    }
    setSaving(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'important': return 'default';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Announcements</p>
              <p className="text-sm font-bold">{announcements.filter(a => a.is_active).length} active</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Open Feedback</p>
              <p className="text-sm font-bold">{feedbacks.filter(f => f.status === 'open').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Award className="w-4 h-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Awards Given</p>
              <p className="text-sm font-bold">{awards.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="awards">Awards</TabsTrigger>
        </TabsList>

        {/* Announcements Tab */}
        <TabsContent value="announcements" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Company Announcements</h3>
            <Button size="sm" onClick={() => setShowAnnouncementDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          </div>

          {announcements.length === 0 ? (
            <Card className="p-8 text-center">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No announcements yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <Card key={ann.id} className={`p-4 ${!ann.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{ann.title}</h4>
                        <Badge variant={getPriorityColor(ann.priority) as any} className="text-[10px]">
                          {ann.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{ann.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(ann.created_at), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={ann.is_active} onCheckedChange={(v) => toggleAnnouncement(ann.id, v)} />
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => deleteAnnouncement(ann.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          <h3 className="font-semibold">Employee Feedback</h3>
          {feedbacks.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No feedback received yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {feedbacks.map(fb => (
                <Card key={fb.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-medium text-sm">{fb.subject}</h4>
                      <p className="text-[10px] text-muted-foreground">
                        {fb.is_anonymous ? 'Anonymous' : fb.profile?.full_name || 'Unknown'} • {fb.category} • {format(new Date(fb.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <Badge variant={fb.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                      {fb.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{fb.message}</p>
                  
                  {fb.admin_response && (
                    <div className="bg-muted rounded-lg p-2 mt-2">
                      <p className="text-xs font-medium">Admin Response:</p>
                      <p className="text-sm">{fb.admin_response}</p>
                    </div>
                  )}

                  {fb.status === 'open' && (
                    respondingTo === fb.id ? (
                      <div className="mt-2 flex gap-2">
                        <Input 
                          placeholder="Type your response..." 
                          value={responseText} 
                          onChange={e => setResponseText(e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" onClick={() => respondToFeedback(fb.id)} disabled={saving}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setRespondingTo(fb.id)}>
                        Respond
                      </Button>
                    )
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Awards Tab */}
        <TabsContent value="awards" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Employee Awards & Recognition</h3>
            <Button size="sm" onClick={() => setShowAwardDialog(true)}>
              <Award className="w-4 h-4 mr-1" /> Give Award
            </Button>
          </div>

          {awards.length === 0 ? (
            <Card className="p-8 text-center">
              <Award className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No awards given yet</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {awards.map(award => (
                <Card key={award.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{award.award_title}</p>
                      <p className="text-xs text-muted-foreground">{award.profile?.full_name || 'Unknown'}</p>
                      {award.description && <p className="text-xs text-muted-foreground mt-1">{award.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(award.award_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>Publish an announcement for all employees</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title" />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement..." rows={4} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={annPriority} onValueChange={setAnnPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>Cancel</Button>
            <Button onClick={createAnnouncement} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Give Award Dialog */}
      <Dialog open={showAwardDialog} onOpenChange={setShowAwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give Award 🏆</DialogTitle>
            <DialogDescription>Recognize an employee's achievement</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employee</Label>
              <Select value={awardEmployee} onValueChange={setAwardEmployee}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Award Title</Label>
              <Input value={awardTitle} onChange={e => setAwardTitle(e.target.value)} placeholder="e.g. Employee of the Month" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={awardDescription} onChange={e => setAwardDescription(e.target.value)} placeholder="Why this award?" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAwardDialog(false)}>Cancel</Button>
            <Button onClick={giveAward} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Give Award
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
