import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { UserCheck, Calendar, Clock, CheckCircle2, XCircle, Loader2, FileText, MessageSquare } from 'lucide-react';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  employee_name?: string;
}

interface RegRequest {
  id: string;
  user_id: string;
  attendance_date: string;
  reason: string;
  status: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  created_at: string;
  employee_name?: string;
}

export default function ManagerApprovals() {
  const { user, isAdmin, isDeveloper } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [regs, setRegs] = useState<RegRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get team members (employees whose manager_id is this user)
    const { data: teamMembers } = await supabase.from('profiles')
      .select('user_id, full_name').eq('manager_id', user.id);
    
    // If admin/developer, also get all pending
    let allMemberIds = (teamMembers || []).map(m => m.user_id);
    const nameMap = new Map((teamMembers || []).map(m => [m.user_id, m.full_name]));

    if (isAdmin || isDeveloper) {
      const { data: allProfiles } = await supabase.from('profiles').select('user_id, full_name').eq('is_active', true);
      if (allProfiles) {
        allMemberIds = allProfiles.map(p => p.user_id);
        allProfiles.forEach(p => nameMap.set(p.user_id, p.full_name));
      }
    }

    if (allMemberIds.length === 0) {
      setLoading(false);
      return;
    }

    const [leaveRes, regRes] = await Promise.all([
      supabase.from('leave_requests').select('*')
        .in('user_id', allMemberIds).eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('regularization_requests').select('*')
        .in('user_id', allMemberIds).eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    setLeaves((leaveRes.data || []).map(l => ({ ...l, employee_name: nameMap.get(l.user_id) || 'Unknown' })));
    setRegs((regRes.data || []).map(r => ({ ...r, employee_name: nameMap.get(r.user_id) || 'Unknown' })));
    setLoading(false);
  }, [user, isAdmin, isDeveloper]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLeave = async (id: string, action: 'approved' | 'rejected') => {
    setProcessing(id);
    const { error } = await supabase.from('leave_requests').update({
      status: action,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: action === 'approved' ? 'Approved' : 'Rejected' }); fetchData(); }
    setProcessing(null);
  };

  const handleReg = async (id: string, action: 'approved' | 'rejected') => {
    setProcessing(id);
    const { error } = await supabase.from('regularization_requests').update({
      status: action,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: action === 'approved' ? 'Approved' : 'Rejected' }); fetchData(); }
    setProcessing(null);
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary" /> Approvals
          </h1>
          <p className="text-sm text-muted-foreground">Approve or reject team requests</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-l-4 border-l-warning">
            <p className="text-[10px] text-muted-foreground uppercase">Pending Leaves</p>
            <p className="text-xl font-bold">{leaves.length}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-info">
            <p className="text-[10px] text-muted-foreground uppercase">Pending Corrections</p>
            <p className="text-xl font-bold">{regs.length}</p>
          </Card>
        </div>

        <Tabs defaultValue="leaves">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leaves">Leave Requests ({leaves.length})</TabsTrigger>
            <TabsTrigger value="regularization">Corrections ({regs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="leaves" className="mt-4">
            {leaves.length === 0 ? (
              <Card className="p-8 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No pending leave requests</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {leaves.map(l => (
                  <Card key={l.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{l.employee_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {l.leave_type} · {format(new Date(l.start_date), 'dd MMM')} - {format(new Date(l.end_date), 'dd MMM yyyy')}
                        </p>
                        {l.reason && <p className="text-xs mt-1 text-muted-foreground">{l.reason}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => handleLeave(l.id, 'rejected')} disabled={!!processing}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => handleLeave(l.id, 'approved')} disabled={!!processing}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="regularization" className="mt-4">
            {regs.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No pending correction requests</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {regs.map(r => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{r.employee_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Date: {format(new Date(r.attendance_date), 'dd MMM yyyy')}
                        </p>
                        <p className="text-xs mt-1">{r.reason}</p>
                        {r.requested_check_in && <p className="text-xs text-muted-foreground">In: {r.requested_check_in} | Out: {r.requested_check_out || '-'}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => handleReg(r.id, 'rejected')} disabled={!!processing}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => handleReg(r.id, 'approved')} disabled={!!processing}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </AppLayout>
  );
}
