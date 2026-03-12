import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Star, FileText, Clock, CheckCircle2, Send } from 'lucide-react';
import { format } from 'date-fns';

const RATING_LABELS = ['', 'Needs Improvement', 'Below Expectations', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'];

export default function PerformanceReviews() {
  const { user, profile, isAdmin, isHR, isDeveloper, isManager } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isHR || isDeveloper || isManager;
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [employeeComment, setEmployeeComment] = useState('');

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['performance-reviews', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['review-cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('review_cycles').select('*').order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: teamProfiles = [] } = useQuery({
    queryKey: ['team-profiles-for-review', user?.id],
    queryFn: async () => {
      if (!canManage || !profile?.company_id) return [];
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, department, designation').eq('company_id', profile.company_id).eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!user && canManage,
  });

  const acknowledgeReview = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.from('performance_reviews').update({
        employee_comments: employeeComment || null,
        acknowledged_at: new Date().toISOString(),
        status: 'acknowledged',
      }).eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      setSelectedReview(null);
      setEmployeeComment('');
      toast.success('Review acknowledged');
    },
  });

  // Create review dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ user_id: '', cycle_id: '', rating: '3', strengths: '', improvements: '', comments: '' });

  const createReview = useMutation({
    mutationFn: async () => {
      if (!user || !profile?.company_id) throw new Error('Missing context');
      const { error } = await supabase.from('performance_reviews').insert({
        user_id: reviewForm.user_id,
        reviewer_id: user.id,
        company_id: profile.company_id,
        review_cycle_id: reviewForm.cycle_id || null,
        overall_rating: Number(reviewForm.rating),
        strengths: reviewForm.strengths || null,
        improvements: reviewForm.improvements || null,
        manager_comments: reviewForm.comments || null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      setCreateOpen(false);
      setReviewForm({ user_id: '', cycle_id: '', rating: '3', strengths: '', improvements: '', comments: '' });
      toast.success('Review submitted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const myReviews = reviews.filter(r => r.user_id === user?.id);
  const givenReviews = reviews.filter(r => r.reviewer_id === user?.id);

  const RatingStars = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
      <span className="text-sm ml-2 text-muted-foreground">{RATING_LABELS[rating] || ''}</span>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <PageHeader title="Performance Reviews" description="View and manage performance evaluations" actions={
          canManage ? <Button onClick={() => setCreateOpen(true)}><Send className="w-4 h-4 mr-2" />Write Review</Button> : undefined
        } />
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{myReviews.length}</p><p className="text-sm text-muted-foreground">My Reviews</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Star className="w-8 h-8 text-yellow-500" /><div><p className="text-2xl font-bold">{myReviews.length > 0 ? (myReviews.reduce((s, r) => s + (r.overall_rating || 0), 0) / myReviews.length).toFixed(1) : '-'}</p><p className="text-sm text-muted-foreground">Avg Rating</p></div></div></CardContent></Card>
          {canManage && <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Send className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{givenReviews.length}</p><p className="text-sm text-muted-foreground">Reviews Given</p></div></div></CardContent></Card>}
        </div>

        {/* My Reviews */}
        <Card>
          <CardHeader><CardTitle className="text-lg">My Reviews</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
            ) : myReviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {myReviews.map(review => (
                  <div key={review.id} className="p-4 border rounded-lg hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => { setSelectedReview(review); setEmployeeComment(review.employee_comments || ''); }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <RatingStars rating={review.overall_rating || 0} />
                        <p className="text-sm text-muted-foreground mt-1">
                          {review.submitted_at ? format(new Date(review.submitted_at), 'MMM d, yyyy') : 'Pending'}
                        </p>
                      </div>
                      <Badge variant={review.status === 'acknowledged' ? 'default' : 'secondary'}>
                        {review.status === 'acknowledged' ? <><CheckCircle2 className="w-3 h-3 mr-1" />Acknowledged</> : <><Clock className="w-3 h-3 mr-1" />{review.status}</>}
                      </Badge>
                    </div>
                    {review.strengths && <p className="text-sm mt-2"><span className="font-medium">Strengths: </span>{review.strengths}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Detail Dialog */}
        <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Review Details</DialogTitle></DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                <RatingStars rating={selectedReview.overall_rating || 0} />
                {selectedReview.strengths && <div><Label className="text-xs text-muted-foreground">Strengths</Label><p className="text-sm">{selectedReview.strengths}</p></div>}
                {selectedReview.improvements && <div><Label className="text-xs text-muted-foreground">Areas for Improvement</Label><p className="text-sm">{selectedReview.improvements}</p></div>}
                {selectedReview.manager_comments && <div><Label className="text-xs text-muted-foreground">Manager Comments</Label><p className="text-sm">{selectedReview.manager_comments}</p></div>}
                {selectedReview.status !== 'acknowledged' && selectedReview.user_id === user?.id && (
                  <div className="space-y-2 border-t pt-4">
                    <Label>Your Response (Optional)</Label>
                    <Textarea value={employeeComment} onChange={e => setEmployeeComment(e.target.value)} placeholder="Add your comments..." />
                    <Button className="w-full" onClick={() => acknowledgeReview.mutate(selectedReview.id)} disabled={acknowledgeReview.isPending}>
                      Acknowledge Review
                    </Button>
                  </div>
                )}
                {selectedReview.employee_comments && <div><Label className="text-xs text-muted-foreground">Employee Response</Label><p className="text-sm">{selectedReview.employee_comments}</p></div>}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Review Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Write Performance Review</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Employee</Label>
                <Select value={reviewForm.user_id} onValueChange={v => setReviewForm(p => ({ ...p, user_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {teamProfiles.filter(p => p.user_id !== user?.id).map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name} {p.designation ? `• ${p.designation}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {cycles.length > 0 && (
                <div>
                  <Label>Review Cycle (Optional)</Label>
                  <Select value={reviewForm.cycle_id} onValueChange={v => setReviewForm(p => ({ ...p, cycle_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                    <SelectContent>
                      {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Overall Rating</Label>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} type="button" onClick={() => setReviewForm(p => ({ ...p, rating: String(i) }))} className="p-1">
                      <Star className={`w-6 h-6 transition-colors ${i <= Number(reviewForm.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-300'}`} />
                    </button>
                  ))}
                  <span className="text-sm ml-2 text-muted-foreground">{RATING_LABELS[Number(reviewForm.rating)]}</span>
                </div>
              </div>
              <div><Label>Strengths</Label><Textarea value={reviewForm.strengths} onChange={e => setReviewForm(p => ({ ...p, strengths: e.target.value }))} placeholder="What does this employee do well?" /></div>
              <div><Label>Areas for Improvement</Label><Textarea value={reviewForm.improvements} onChange={e => setReviewForm(p => ({ ...p, improvements: e.target.value }))} placeholder="Where can they improve?" /></div>
              <div><Label>Additional Comments</Label><Textarea value={reviewForm.comments} onChange={e => setReviewForm(p => ({ ...p, comments: e.target.value }))} /></div>
              <Button className="w-full" onClick={() => createReview.mutate()} disabled={!reviewForm.user_id || createReview.isPending}>
                {createReview.isPending ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
