import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Target, TrendingUp, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Target }> = {
  not_started: { label: 'Not Started', color: 'bg-muted text-muted-foreground', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: TrendingUp },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  at_risk: { label: 'At Risk', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
};

export default function PerformanceGoals() {
  const { user, profile, isAdmin, isHR, isDeveloper } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'individual', target_value: '', unit: '', due_date: '' });
  const canManage = isAdmin || isHR || isDeveloper;

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['performance-goals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_goals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createGoal = useMutation({
    mutationFn: async () => {
      if (!user || !profile?.company_id) throw new Error('Missing context');
      const { error } = await supabase.from('performance_goals').insert({
        user_id: user.id,
        company_id: profile.company_id,
        title: form.title,
        description: form.description || null,
        category: form.category,
        target_value: form.target_value ? Number(form.target_value) : null,
        unit: form.unit || null,
        due_date: form.due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-goals'] });
      setDialogOpen(false);
      setForm({ title: '', description: '', category: 'individual', target_value: '', unit: '', due_date: '' });
      toast.success('Goal created successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ id, current_value, status }: { id: string; current_value: number; status: string }) => {
      const { error } = await supabase.from('performance_goals').update({
        current_value,
        status,
        ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-goals'] });
      toast.success('Progress updated');
    },
  });

  const myGoals = goals.filter(g => g.user_id === user?.id);
  const completedCount = myGoals.filter(g => g.status === 'completed').length;
  const avgProgress = myGoals.length > 0
    ? Math.round(myGoals.reduce((sum, g) => sum + (g.target_value ? ((g.current_value || 0) / g.target_value) * 100 : 0), 0) / myGoals.length)
    : 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <PageHeader title="My Goals" description="Track your performance goals and objectives" actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Goal</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Improve customer satisfaction" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe your goal..." /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Target Value</Label><Input type="number" value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))} placeholder="e.g. 100" /></div>
                  <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. %, tasks, score" /></div>
                </div>
                <Button className="w-full" onClick={() => createGoal.mutate()} disabled={!form.title || createGoal.isPending}>
                  {createGoal.isPending ? 'Creating...' : 'Create Goal'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        } />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Target className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{myGoals.length}</p><p className="text-sm text-muted-foreground">Total Goals</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">{completedCount}</p><p className="text-sm text-muted-foreground">Completed</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{avgProgress}%</p><p className="text-sm text-muted-foreground">Avg Progress</p></div></div></CardContent></Card>
        </div>

        {/* Goals List */}
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
        ) : myGoals.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Target className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No goals yet. Create your first goal to get started!</p></CardContent></Card>
        ) : (
          <div className="space-y-4">
            {myGoals.map(goal => {
              const progress = goal.target_value ? Math.min(100, Math.round(((goal.current_value || 0) / goal.target_value) * 100)) : 0;
              const cfg = STATUS_CONFIG[goal.status] || STATUS_CONFIG.not_started;
              const Icon = cfg.icon;
              return (
                <Card key={goal.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base">{goal.title}</h3>
                          <Badge variant="outline" className={cfg.color}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                          <Badge variant="secondary">{goal.category}</Badge>
                        </div>
                        {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
                        {goal.target_value && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{goal.current_value || 0} / {goal.target_value} {goal.unit || ''}</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}
                        {goal.due_date && <p className="text-xs text-muted-foreground">Due: {format(new Date(goal.due_date), 'MMM d, yyyy')}</p>}
                      </div>
                      {goal.status !== 'completed' && goal.target_value && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            className="w-20 h-8 text-sm"
                            placeholder="Value"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = Number((e.target as HTMLInputElement).value);
                                const newStatus = val >= goal.target_value! ? 'completed' : 'in_progress';
                                updateProgress.mutate({ id: goal.id, current_value: val, status: newStatus });
                              }
                            }}
                          />
                          <Button size="sm" variant="outline" onClick={() => updateProgress.mutate({ id: goal.id, current_value: goal.target_value!, status: 'completed' })}>
                            Done
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
