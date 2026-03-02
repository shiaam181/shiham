import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Users, Plus, Loader2, IndianRupee, Eye, Search, History, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import AppLayout from '@/components/AppLayout';

interface SalaryStructure {
  id: string;
  user_id: string;
  basic_salary: number;
  hra: number;
  da: number;
  special_allowance: number;
  other_allowances: number;
  pf_deduction: number;
  tax_deduction: number;
  other_deductions: number;
  effective_from: string;
  is_active: boolean;
  profile?: { full_name: string; email: string; department: string | null };
}

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function Compensation() {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [allStructures, setAllStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string; email: string; department: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<SalaryStructure | null>(null);
  const [historyUser, setHistoryUser] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [form, setForm] = useState({
    basic_salary: '', hra: '', da: '', special_allowance: '', other_allowances: '',
    pf_deduction: '', tax_deduction: '', other_deductions: '', effective_from: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [salaryRes, allSalaryRes, empRes] = await Promise.all([
      supabase.from('salary_structures').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('salary_structures').select('*').order('effective_from', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name, email, department').eq('is_active', true),
    ]);
    if (empRes.data) setEmployees(empRes.data);
    const mapProfile = (s: any) => ({ ...s, profile: empRes.data?.find(e => e.user_id === s.user_id) });
    if (salaryRes.data) setStructures(salaryRes.data.map(mapProfile));
    if (allSalaryRes.data) setAllStructures(allSalaryRes.data.map(mapProfile));
    setLoading(false);
  };

  const employeesWithoutSalary = employees.filter(e => !structures.find(s => s.user_id === e.user_id));

  const openAdd = (userId?: string) => {
    setSelectedEmployee(userId || '');
    setForm({ basic_salary: '', hra: '', da: '', special_allowance: '', other_allowances: '', pf_deduction: '', tax_deduction: '', other_deductions: '', effective_from: new Date().toISOString().split('T')[0] });
    setShowDialog(true);
  };

  const openRevision = (s: SalaryStructure) => {
    setSelectedEmployee(s.user_id);
    setForm({
      basic_salary: String(s.basic_salary), hra: String(s.hra), da: String(s.da),
      special_allowance: String(s.special_allowance), other_allowances: String(s.other_allowances),
      pf_deduction: String(s.pf_deduction), tax_deduction: String(s.tax_deduction),
      other_deductions: String(s.other_deductions), effective_from: new Date().toISOString().split('T')[0],
    });
    setShowDialog(true);
  };

  const saveSalary = async () => {
    if (!selectedEmployee || !form.basic_salary) {
      toast({ title: 'Error', description: 'Select employee and enter basic salary', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Deactivate old structure
    await supabase.from('salary_structures').update({ is_active: false }).eq('user_id', selectedEmployee).eq('is_active', true);

    const payload = {
      user_id: selectedEmployee,
      basic_salary: parseFloat(form.basic_salary) || 0,
      hra: parseFloat(form.hra) || 0,
      da: parseFloat(form.da) || 0,
      special_allowance: parseFloat(form.special_allowance) || 0,
      other_allowances: parseFloat(form.other_allowances) || 0,
      pf_deduction: parseFloat(form.pf_deduction) || 0,
      tax_deduction: parseFloat(form.tax_deduction) || 0,
      other_deductions: parseFloat(form.other_deductions) || 0,
      effective_from: form.effective_from,
      is_active: true,
    };

    const { error } = await supabase.from('salary_structures').insert(payload);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Salary structure saved successfully' });
      logAction({ action: 'settings_updated', table_name: 'salary_structures', record_id: selectedEmployee, new_value: payload as any });
      setShowDialog(false);
      fetchData();
    }
    setSaving(false);
  };

  const openHistory = (userId: string) => {
    setHistoryUser(userId);
    setShowHistoryDialog(true);
  };

  const historyRecords = historyUser ? allStructures.filter(s => s.user_id === historyUser) : [];

  const filtered = structures.filter(s =>
    !search || s.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.profile?.department?.toLowerCase().includes(search.toLowerCase())
  );

  const totalGross = structures.reduce((sum, s) => sum + Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances), 0);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Compensation
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Employee salary structures & revision history</p>
          </div>
          <Button size="sm" onClick={() => openAdd()} className="self-start sm:self-auto">
            <Plus className="w-4 h-4 mr-1" /> Add Salary
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">On Payroll</p>
            <p className="text-xl font-bold">{structures.length}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-success">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Gross</p>
            <p className="text-xl font-bold">{formatCurrency(totalGross)}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-warning">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">No Salary Set</p>
            <p className="text-xl font-bold">{employeesWithoutSalary.length}</p>
          </Card>
        </div>

        {/* Warning: employees without salary */}
        {employeesWithoutSalary.length > 0 && (
          <Card className="border-warning/50 bg-warning/5 p-4">
            <p className="text-sm font-medium text-warning">⚠ {employeesWithoutSalary.length} employee(s) without salary structure:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {employeesWithoutSalary.slice(0, 5).map(e => (
                <Button key={e.user_id} size="sm" variant="outline" className="text-xs" onClick={() => openAdd(e.user_id)}>
                  <Plus className="w-3 h-3 mr-1" /> {e.full_name}
                </Button>
              ))}
              {employeesWithoutSalary.length > 5 && (
                <Badge variant="secondary">+{employeesWithoutSalary.length - 5} more</Badge>
              )}
            </div>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right hidden sm:table-cell">HRA</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No salary structures</TableCell></TableRow>
              ) : filtered.map(s => {
                const gross = Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances);
                const ded = Number(s.pf_deduction) + Number(s.tax_deduction) + Number(s.other_deductions);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{s.profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{s.profile?.department || '-'}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(s.basic_salary))}</TableCell>
                    <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(Number(s.hra))}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(gross)}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-success">{formatCurrency(gross - ded)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.effective_from}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedDetail(s); setShowDetailDialog(true); }}><Eye className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openRevision(s)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openHistory(s.user_id)}><History className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Add/Revise Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {structures.find(s => s.user_id === selectedEmployee) ? 'Apply Salary Revision' : 'Add Salary Structure'}
            </DialogTitle>
            <DialogDescription>
              {structures.find(s => s.user_id === selectedEmployee)
                ? 'Previous structure will be deactivated. A new revision takes effect from the specified date.'
                : 'Set up compensation for the selected employee.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={!!structures.find(s => s.user_id === selectedEmployee)}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {[...employees].map(e => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.full_name} ({e.department || 'No dept'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Basic Salary', 'basic_salary'], ['HRA', 'hra'], ['DA', 'da'],
                ['Special Allowance', 'special_allowance'], ['Other Allowances', 'other_allowances'],
                ['PF Deduction', 'pf_deduction'], ['Tax Deduction', 'tax_deduction'], ['Other Deductions', 'other_deductions'],
              ].map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder="0" />
                </div>
              ))}
            </div>
            {form.basic_salary && (
              <Card className="p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span>Gross</span>
                  <span className="font-bold">{formatCurrency(
                    (parseFloat(form.basic_salary) || 0) + (parseFloat(form.hra) || 0) + (parseFloat(form.da) || 0) +
                    (parseFloat(form.special_allowance) || 0) + (parseFloat(form.other_allowances) || 0)
                  )}</span>
                </div>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveSalary} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salary Details — {selectedDetail?.profile?.full_name}</DialogTitle></DialogHeader>
          {selectedDetail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Basic', selectedDetail.basic_salary], ['HRA', selectedDetail.hra], ['DA', selectedDetail.da],
                  ['Special Allowance', selectedDetail.special_allowance], ['Other Allowances', selectedDetail.other_allowances],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between p-2 rounded bg-muted/50"><span className="text-muted-foreground">{l as string}</span><span className="font-medium">{formatCurrency(Number(v))}</span></div>
                ))}
              </div>
              <hr />
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['PF', selectedDetail.pf_deduction], ['Tax', selectedDetail.tax_deduction], ['Other Ded.', selectedDetail.other_deductions],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between p-2 rounded bg-destructive/5"><span className="text-muted-foreground">{l as string}</span><span className="font-medium text-destructive">{formatCurrency(Number(v))}</span></div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Salary Revision History</DialogTitle></DialogHeader>
          <div className="rounded-md border overflow-x-auto max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective From</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRecords.map(r => {
                  const gross = Number(r.basic_salary) + Number(r.hra) + Number(r.da) + Number(r.special_allowance) + Number(r.other_allowances);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.effective_from}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(Number(r.basic_salary))}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(gross)}</TableCell>
                      <TableCell><Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Active' : 'Superseded'}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
