import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Users, Calendar, Award, Trophy, Loader2, Eye, Star } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import PhotoThumbnail from '@/components/PhotoThumbnail';

interface TeamMember {
  user_id: string;
  full_name: string;
  department: string | null;
}

interface DailyUpdate {
  id: string;
  user_id: string;
  photo_url: string | null;
  description: string;
  update_date: string;
  created_at: string;
}

interface Topper {
  id: string;
  user_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  notes: string | null;
  created_at: string;
}

export default function TeamDailyUpdates() {
  const { user, profile, isManager, isHR, isAdmin, isOwner, isDeveloper } = useAuth();
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [toppers, setToppers] = useState<Topper[]>([]);
  const [loading, setLoading] = useState(true);

  // Topper selection dialog
  const [showTopperDialog, setShowTopperDialog] = useState(false);
  const [topperUserId, setTopperUserId] = useState('');
  const [topperType, setTopperType] = useState<'weekly' | 'monthly'>('weekly');
  const [topperNotes, setTopperNotes] = useState('');
  const [savingTopper, setSavingTopper] = useState(false);

  const isManagerView = isManager && !isHR && !isAdmin && !isOwner && !isDeveloper;

  const fetchTeam = useCallback(async () => {
    if (!user || !profile?.company_id) return;

    let query = supabase.from('profiles')
      .select('user_id, full_name, department')
      .eq('is_active', true);

    if (isManagerView) {
      // Manager sees their direct reports
      query = query.eq('manager_id', user.id);
    } else {
      // HR/Admin/Owner sees everyone in company, or managers if manager_daily_updates
      query = query.eq('company_id', profile.company_id);
    }

    const { data } = await query;
    setTeam((data || []).filter(m => m.user_id !== user.id));
  }, [user, profile?.company_id, isManagerView]);

  const fetchUpdates = useCallback(async () => {
    if (!user || !profile?.company_id) return;

    let query = supabase.from('daily_work_updates')
      .select('*')
      .order('update_date', { ascending: false })
      .limit(100);

    if (selectedMember !== 'all') {
      query = query.eq('user_id', selectedMember);
    }

    const { data } = await query;
    setUpdates((data as any[]) || []);
    setLoading(false);
  }, [user, profile?.company_id, selectedMember]);

  const fetchToppers = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase.from('weekly_toppers')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(20);
    setToppers((data as any[]) || []);
  }, [profile?.company_id]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);
  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);
  useEffect(() => { fetchToppers(); }, [fetchToppers]);

  const handleSelectTopper = async () => {
    if (!topperUserId || !profile?.company_id || !user) return;
    setSavingTopper(true);

    const now = new Date();
    const periodStart = topperType === 'weekly'
      ? format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(startOfMonth(now), 'yyyy-MM-dd');
    const periodEnd = topperType === 'weekly'
      ? format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(endOfMonth(now), 'yyyy-MM-dd');

    const { error } = await supabase.from('weekly_toppers').insert({
      company_id: profile.company_id,
      user_id: topperUserId,
      selected_by: user.id,
      period_type: topperType,
      period_start: periodStart,
      period_end: periodEnd,
      notes: topperNotes.trim() || null,
    } as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Topper Selected! 🏆', description: 'Recognition has been recorded' });
      setShowTopperDialog(false);
      setTopperUserId('');
      setTopperNotes('');
      fetchToppers();
    }
    setSavingTopper(false);
  };

  const getMemberName = (userId: string) =>
    team.find(t => t.user_id === userId)?.full_name || 'Unknown';

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl space-y-5">
        <PageHeader
          title="Team Daily Updates"
          description={isManagerView ? "View your team's daily work activity" : "View employee & manager daily activities"}
          icon={<Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
        />

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Filter by employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team Members</SelectItem>
              {team.map(m => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="gap-2" onClick={() => setShowTopperDialog(true)}>
            <Trophy className="w-4 h-4 text-amber-500" />
            Select Topper
          </Button>
        </div>

        {/* Current Toppers */}
        {toppers.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Recent Toppers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {toppers.slice(0, 4).map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Star className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{getMemberName(t.user_id)}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {t.period_type} · {format(new Date(t.period_start), 'dd MMM')} - {format(new Date(t.period_end), 'dd MMM')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Updates Feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Activity Feed</CardTitle>
            <CardDescription>{updates.length} update{updates.length !== 1 ? 's' : ''} found</CardDescription>
          </CardHeader>
          <CardContent>
            {updates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No updates yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {updates.map(u => (
                  <div key={u.id} className="flex gap-3 p-3 rounded-lg border bg-muted/20">
                    {u.photo_url && (
                      <PhotoThumbnail photoUrl={u.photo_url} alt="Work photo" size="md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium">{getMemberName(u.user_id)}</span>
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {format(new Date(u.update_date), 'dd MMM yyyy')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{u.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topper Selection Dialog */}
        <Dialog open={showTopperDialog} onOpenChange={setShowTopperDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Select Topper
              </DialogTitle>
              <DialogDescription>Recognize an outstanding team member</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={topperUserId} onValueChange={setTopperUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={topperType} onValueChange={v => setTopperType(v as 'weekly' | 'monthly')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly Topper</SelectItem>
                    <SelectItem value="monthly">Monthly Topper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={topperNotes}
                  onChange={e => setTopperNotes(e.target.value)}
                  placeholder="Why this employee stands out..."
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTopperDialog(false)}>Cancel</Button>
              <Button onClick={handleSelectTopper} disabled={!topperUserId || savingTopper}>
                {savingTopper ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trophy className="w-4 h-4 mr-2" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AppLayout>
  );
}
