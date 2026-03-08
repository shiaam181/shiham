import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/page-header';
import {
  UserCheck, Calendar, Clock, CheckCircle2, XCircle, Loader2,
  FileText, MessageSquare, History, ChevronDown, ChevronUp,
} from 'lucide-react';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
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
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  employee_name?: string;
}

function ApprovalCard({
  title,
  subtitle,
  detail,
  extraInfo,
  status,
  onApprove,
  onReject,
  processing,
  id,
}: {
  title: string;
  subtitle: string;
  detail?: string | null;
  extraInfo?: string | null;
  status: string;
  onApprove?: (id: string, notes: string) => void;
  onReject?: (id: string, notes: string) => void;
  processing: string | null;
  id: string;
}) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const isPending = status === 'pending';

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{title}</p>
            {!isPending && (
              <Badge variant={status === 'approved' ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                {status}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          {detail && <p className="text-xs mt-1 text-muted-foreground">{detail}</p>}
          {extraInfo && <p className="text-xs text-muted-foreground">{extraInfo}</p>}
        </div>
        {isPending && (
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onClick={() => onReject?.(id, notes)} disabled={!!processing}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
            <Button size="sm" onClick={() => onApprove?.(id, notes)} disabled={!!processing}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </Button>
          </div>
        )}
      </div>

      {isPending && (
        <div className="mt-2">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Add note
            {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showNotes && (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note for the employee..."
              className="mt-2 text-xs h-16"
            />
          )}
        </div>
      )}
    </Card>
  );
}

export default function ManagerApprovals() {
  const { user, isAdmin, isDeveloper } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [regs, setRegs] = useState<RegRequest[]>([]);
  const [historyLeaves, setHistoryLeaves] = useState<LeaveRequest[]>([]);
  const [historyRegs, setHistoryRegs] = useState<RegRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: teamMembers } = await supabase.from('profiles')
      .select('user_id, full_name').eq('manager_id', user.id);

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

    const [leaveRes, regRes, histLeaveRes, histRegRes] = await Promise.all([
      supabase.from('leave_requests').select('*')
        .in('user_id', allMemberIds).eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('regularization_requests').select('*')
        .in('user_id', allMemberIds).eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('*')
        .in('user_id', allMemberIds).neq('status', 'pending')
        .order('reviewed_at', { ascending: false }).limit(50),
      supabase.from('regularization_requests').select('*')
        .in('user_id', allMemberIds).neq('status', 'pending')
        .order('reviewed_at', { ascending: false }).limit(50),
    ]);

    const mapName = (items: any[]) => items.map(i => ({ ...i, employee_name: nameMap.get(i.user_id) || 'Unknown' }));

    setLeaves(mapName(leaveRes.data || []));
    setRegs(mapName(regRes.data || []));
    setHistoryLeaves(mapName(histLeaveRes.data || []));
    setHistoryRegs(mapName(histRegRes.data || []));
    setLoading(false);
  }, [user, isAdmin, isDeveloper]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createNotification = async (userId: string, title: string, message: string) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type: 'leave',
    });
  };

  const handleLeave = async (id: string, action: 'approved' | 'rejected', notes: string) => {
    setProcessing(id);
    const leave = leaves.find(l => l.id === id);
    const { error } = await supabase.from('leave_requests').update({
      status: action,
      admin_notes: notes || null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: action === 'approved' ? 'Leave Approved' : 'Leave Rejected' });
      if (leave) {
        await createNotification(
          leave.user_id,
          `Leave ${action === 'approved' ? 'Approved' : 'Rejected'}`,
          `Your ${leave.leave_type} leave (${format(new Date(leave.start_date), 'dd MMM')} - ${format(new Date(leave.end_date), 'dd MMM')}) has been ${action}.${notes ? ` Note: ${notes}` : ''}`
        );
      }
      fetchData();
    }
    setProcessing(null);
  };

  const handleReg = async (id: string, action: 'approved' | 'rejected', notes: string) => {
    setProcessing(id);
    const reg = regs.find(r => r.id === id);
    const { error } = await supabase.from('regularization_requests').update({
      status: action,
      admin_notes: notes || null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: action === 'approved' ? 'Correction Approved' : 'Correction Rejected' });
      if (reg) {
        await createNotification(
          reg.user_id,
          `Attendance Correction ${action === 'approved' ? 'Approved' : 'Rejected'}`,
          `Your correction request for ${format(new Date(reg.attendance_date), 'dd MMM yyyy')} has been ${action}.${notes ? ` Note: ${notes}` : ''}`
        );
      }
      fetchData();
    }
    setProcessing(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const pendingCount = leaves.length + regs.length;

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <PageHeader
          title="Approvals"
          description="Approve or reject team requests"
          icon={<UserCheck className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase">Total Pending</p>
            <p className="text-xl font-bold">{pendingCount}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-warning">
            <p className="text-[10px] text-muted-foreground uppercase">Leaves</p>
            <p className="text-xl font-bold">{leaves.length}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-info">
            <p className="text-[10px] text-muted-foreground uppercase">Corrections</p>
            <p className="text-xl font-bold">{regs.length}</p>
          </Card>
        </div>

        <Tabs defaultValue="leaves">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="leaves">Leaves ({leaves.length})</TabsTrigger>
            <TabsTrigger value="regularization">Corrections ({regs.length})</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> History
            </TabsTrigger>
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
                  <ApprovalCard
                    key={l.id}
                    id={l.id}
                    title={l.employee_name || 'Unknown'}
                    subtitle={`${l.leave_type} · ${format(new Date(l.start_date), 'dd MMM')} - ${format(new Date(l.end_date), 'dd MMM yyyy')}`}
                    detail={l.reason}
                    status={l.status}
                    processing={processing}
                    onApprove={(id, notes) => handleLeave(id, 'approved', notes)}
                    onReject={(id, notes) => handleLeave(id, 'rejected', notes)}
                  />
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
                  <ApprovalCard
                    key={r.id}
                    id={r.id}
                    title={r.employee_name || 'Unknown'}
                    subtitle={`Date: ${format(new Date(r.attendance_date), 'dd MMM yyyy')}`}
                    detail={r.reason}
                    extraInfo={r.requested_check_in ? `In: ${r.requested_check_in} | Out: ${r.requested_check_out || '-'}` : undefined}
                    status={r.status}
                    processing={processing}
                    onApprove={(id, notes) => handleReg(id, 'approved', notes)}
                    onReject={(id, notes) => handleReg(id, 'rejected', notes)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {historyLeaves.length === 0 && historyRegs.length === 0 ? (
              <Card className="p-8 text-center">
                <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No approval history yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {historyLeaves.map(l => (
                  <ApprovalCard
                    key={l.id}
                    id={l.id}
                    title={l.employee_name || 'Unknown'}
                    subtitle={`${l.leave_type} · ${format(new Date(l.start_date), 'dd MMM')} - ${format(new Date(l.end_date), 'dd MMM yyyy')}`}
                    detail={l.admin_notes ? `Note: ${l.admin_notes}` : l.reason}
                    status={l.status}
                    processing={processing}
                  />
                ))}
                {historyRegs.map(r => (
                  <ApprovalCard
                    key={r.id}
                    id={r.id}
                    title={r.employee_name || 'Unknown'}
                    subtitle={`Correction: ${format(new Date(r.attendance_date), 'dd MMM yyyy')}`}
                    detail={r.admin_notes ? `Note: ${r.admin_notes}` : r.reason}
                    status={r.status}
                    processing={processing}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </AppLayout>
  );
}
