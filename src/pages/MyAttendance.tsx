import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  Clock, CalendarDays, CheckCircle2, XCircle, AlertCircle, FileText,
  Loader2, Plus, Send,
} from 'lucide-react';
import AttendanceCalendar from '@/components/AttendanceCalendar';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  overtime_minutes: number | null;
  notes: string | null;
}

interface RegularizationRequest {
  id: string;
  attendance_date: string;
  reason: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function MyAttendance() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [regularizations, setRegularizations] = useState<RegularizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showRegDialog, setShowRegDialog] = useState(false);
  const [regForm, setRegForm] = useState({
    attendance_date: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
    requested_check_in: '',
    requested_check_out: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

    const [attRes, regRes] = await Promise.all([
      supabase.from('attendance').select('*')
        .eq('user_id', user.id).gte('date', start).lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('regularization_requests').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);

    setAttendance(attRes.data || []);
    setRegularizations(regRes.data || []);
    setLoading(false);
  }, [user, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submitRegularization = async () => {
    if (!user || !regForm.reason || !regForm.attendance_date) {
      toast({ title: 'Error', description: 'Fill required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('regularization_requests').insert({
      user_id: user.id,
      company_id: profile?.company_id || null,
      attendance_date: regForm.attendance_date,
      reason: regForm.reason,
      requested_check_in: regForm.requested_check_in || null,
      requested_check_out: regForm.requested_check_out || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Submitted', description: 'Regularization request sent for approval' });
      setShowRegDialog(false);
      setRegForm({ attendance_date: format(new Date(), 'yyyy-MM-dd'), reason: '', requested_check_in: '', requested_check_out: '' });
      fetchData();
    }
    setSubmitting(false);
  };

  const presentDays = attendance.filter(a => a.status === 'present').length;
  const leaveDays = attendance.filter(a => a.status === 'leave').length;
  const absentDays = attendance.filter(a => a.status === 'absent').length;
  const totalOT = attendance.reduce((s, a) => s + (a.overtime_minutes || 0), 0);

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-primary" /> My Attendance
            </h1>
            <p className="text-sm text-muted-foreground">View your attendance history and submit corrections</p>
          </div>
          <Button size="sm" onClick={() => setShowRegDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Request Correction
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase">Present</p>
            <p className="text-xl font-bold text-primary">{presentDays}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-destructive">
            <p className="text-[10px] text-muted-foreground uppercase">Absent</p>
            <p className="text-xl font-bold text-destructive">{absentDays}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-info">
            <p className="text-[10px] text-muted-foreground uppercase">Leave</p>
            <p className="text-xl font-bold">{leaveDays}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-warning">
            <p className="text-[10px] text-muted-foreground uppercase">Overtime</p>
            <p className="text-xl font-bold">{Math.round(totalOT / 60)}h {totalOT % 60}m</p>
          </Card>
        </div>

        <Tabs defaultValue="list">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList className="grid grid-cols-3 w-auto">
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="regularization">Corrections</TabsTrigger>
            </TabsList>
            <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-auto" />
          </div>

          <TabsContent value="list" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>OT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records</TableCell></TableRow>
                    ) : attendance.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm font-medium">{format(new Date(a.date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-sm">{a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm a') : '-'}</TableCell>
                        <TableCell className="text-sm">{a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'present' ? 'default' : a.status === 'absent' ? 'destructive' : 'secondary'} className="text-xs">
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{a.overtime_minutes ? `${Math.floor(a.overtime_minutes / 60)}h ${a.overtime_minutes % 60}m` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <AttendanceCalendar />
          </TabsContent>

          <TabsContent value="regularization" className="mt-4 space-y-3">
            {regularizations.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No correction requests yet</p>
              </Card>
            ) : regularizations.map(r => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{format(new Date(r.attendance_date), 'dd MMM yyyy')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
                    {r.admin_notes && <p className="text-xs text-info mt-1">Admin: {r.admin_notes}</p>}
                  </div>
                  <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {r.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showRegDialog} onOpenChange={setShowRegDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Attendance Correction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={regForm.attendance_date} onChange={e => setRegForm(f => ({ ...f, attendance_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea value={regForm.reason} onChange={e => setRegForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why do you need this correction?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Requested Check-in</Label>
                <Input type="time" value={regForm.requested_check_in} onChange={e => setRegForm(f => ({ ...f, requested_check_in: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Requested Check-out</Label>
                <Input type="time" value={regForm.requested_check_out} onChange={e => setRegForm(f => ({ ...f, requested_check_out: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegDialog(false)}>Cancel</Button>
            <Button onClick={submitRegularization} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Send className="w-4 h-4 mr-1" /> Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
