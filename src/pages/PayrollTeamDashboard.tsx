import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { IndianRupee, Users, CheckCircle2, Clock, Loader2, FileText, LogOut, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import RoleBasedHeader from '@/components/RoleBasedHeader';
import MobileBottomNav from '@/components/MobileBottomNav';

interface PayrollEntry {
  id: string;
  month: number;
  year: number;
  user_id: string;
  working_days: number;
  present_days: number;
  leave_days: number;
  overtime_hours: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  status: string;
  processed_at: string | null;
  profile?: { full_name: string; email: string; department: string | null };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PayrollTeamDashboard() {
  const { profile, isPayrollTeam, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [payrollRuns, setPayrollRuns] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [processNotes, setProcessNotes] = useState('');

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    setLoading(true);
    const [payrollRes, empRes] = await Promise.all([
      supabase.from('payroll_runs').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name, email, department'),
    ]);

    if (payrollRes.data && empRes.data) {
      const mapped = payrollRes.data.map(p => ({
        ...p,
        profile: empRes.data.find(e => e.user_id === p.user_id),
      }));
      setPayrollRuns(mapped as any);
    }
    setLoading(false);
  };

  const markAsProcessed = async () => {
    if (!selectedEntry) return;
    setProcessingId(selectedEntry.id);
    
    const { error } = await supabase.from('payroll_runs').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    }).eq('id', selectedEntry.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to process', variant: 'destructive' });
    } else {
      toast({ title: 'Processed', description: `Payroll for ${selectedEntry.profile?.full_name} marked as processed` });
      setShowProcessDialog(false);
      setProcessNotes('');
      fetchPayroll();
    }
    setProcessingId(null);
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const approvedEntries = payrollRuns.filter(p => p.status === 'approved');
  const processedEntries = payrollRuns.filter(p => p.status === 'processed');
  const totalPending = approvedEntries.reduce((sum, p) => sum + Number(p.net_salary), 0);
  const totalProcessed = processedEntries.reduce((sum, p) => sum + Number(p.net_salary), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <RoleBasedHeader currentView="employee" />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Payroll Processing</h1>
            <p className="text-sm text-muted-foreground">Review and process approved payroll entries</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-3 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
                <p className="text-lg font-bold">{approvedEntries.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Processed</p>
                <p className="text-lg font-bold">{processedEntries.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending Amount</p>
                <p className="text-sm font-bold">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Processed</p>
                <p className="text-sm font-bold">{formatCurrency(totalProcessed)}</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">
              Approved ({approvedEntries.length})
            </TabsTrigger>
            <TabsTrigger value="processed">
              Processed ({processedEntries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {approvedEntries.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No pending payroll to process</p>
              </Card>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Gross</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedEntries.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{p.profile?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{p.profile?.department || ''}</p>
                        </TableCell>
                        <TableCell className="text-sm">{MONTHS[p.month - 1]} {p.year}</TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(Number(p.gross_salary))}</TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell text-destructive">{formatCurrency(Number(p.total_deductions))}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-600">{formatCurrency(Number(p.net_salary))}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => { setSelectedEntry(p); setShowProcessDialog(true); }}>
                            <CreditCard className="w-3 h-3 mr-1" /> Process
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="processed" className="mt-4">
            {processedEntries.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No processed payroll entries yet</p>
              </Card>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead>Processed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedEntries.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-sm">{p.profile?.full_name || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{MONTHS[p.month - 1]} {p.year}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-600">{formatCurrency(Number(p.net_salary))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.processed_at ? new Date(p.processed_at).toLocaleDateString() : '-'}
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

      {/* Process Confirmation Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payroll</DialogTitle>
            <DialogDescription>
              Confirm payment processing for {selectedEntry?.profile?.full_name} — {selectedEntry ? `${MONTHS[selectedEntry.month - 1]} ${selectedEntry.year}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gross Salary</span>
                <span className="font-medium">{selectedEntry ? formatCurrency(Number(selectedEntry.gross_salary)) : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Deductions</span>
                <span className="font-medium text-destructive">{selectedEntry ? formatCurrency(Number(selectedEntry.total_deductions)) : ''}</span>
              </div>
              <hr />
              <div className="flex justify-between text-sm font-semibold">
                <span>Net Pay</span>
                <span className="text-emerald-600">{selectedEntry ? formatCurrency(Number(selectedEntry.net_salary)) : ''}</span>
              </div>
            </div>
            <Textarea
              placeholder="Processing notes (optional)"
              value={processNotes}
              onChange={(e) => setProcessNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>Cancel</Button>
            <Button onClick={markAsProcessed} disabled={!!processingId}>
              {processingId && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Mark as Processed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileBottomNav />
      <div className="h-16 sm:hidden" />
    </div>
  );
}
