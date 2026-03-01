import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Calculator, Loader2, Download, Lock, CheckCircle2, AlertTriangle, FileText, CreditCard, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import SalarySlipPDF from '@/components/SalarySlipPDF';
import AppLayout from '@/components/AppLayout';

interface PayrollEntry {
  id: string;
  month: number;
  year: number;
  user_id: string;
  working_days: number;
  present_days: number;
  leave_days: number;
  lop_days: number;
  overtime_hours: number;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  other_allowances: number;
  gross_salary: number;
  pf_employee: number;
  pf_employer: number;
  esi_employee: number;
  esi_employer: number;
  professional_tax: number;
  tds: number;
  other_deductions_detail: any;
  total_deductions: number;
  net_salary: number;
  status: string;
  locked: boolean;
  locked_at: string | null;
  processed_at: string | null;
  profile?: { full_name: string; email: string; department: string | null; bank_name?: string | null; bank_account_number?: string | null; bank_ifsc?: string | null };
  warnings?: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatCurrency = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function PayrollRun() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const [payrollRuns, setPayrollRuns] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('Company');
  const [companyBrandColor, setCompanyBrandColor] = useState<string | null>(null);
  // Run wizard
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [runMonth, setRunMonth] = useState(String(new Date().getMonth() + 1));
  const [runYear, setRunYear] = useState(String(new Date().getFullYear()));
  const [previewEntries, setPreviewEntries] = useState<PayrollEntry[]>([]);
  const [runWarnings, setRunWarnings] = useState<string[]>([]);

  // Confirm dialogs
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [lockTargetId, setLockTargetId] = useState<string | null>(null);

  // Salary slip
  const [showSalarySlip, setShowSalarySlip] = useState(false);
  const [salarySlipData, setSalarySlipData] = useState<any>(null);

  useEffect(() => { fetchPayroll(); }, []);

  const fetchPayroll = async () => {
    setLoading(true);
    const [payrollRes, empRes, companyRes, brandRes] = await Promise.all([
      supabase.from('payroll_runs').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(200),
      supabase.from('profiles').select('user_id, full_name, email, department, bank_name, bank_account_number, bank_ifsc').eq('is_active', true),
      supabase.from('company_settings').select('company_name').limit(1).maybeSingle(),
      supabase.from('companies').select('brand_color').limit(1).maybeSingle(),
    ]);
    if (companyRes.data) setCompanyName(companyRes.data.company_name);
    if (brandRes.data) setCompanyBrandColor(brandRes.data.brand_color);
    if (payrollRes.data && empRes.data) {
      setPayrollRuns(payrollRes.data.map(p => ({
        ...p,
        profile: empRes.data.find(e => e.user_id === p.user_id),
      })) as any);
    }
    setLoading(false);
  };

  // === PAYROLL RUN WIZARD ===
  const startWizard = () => {
    setWizardStep(1);
    setPreviewEntries([]);
    setRunWarnings([]);
    setShowRunDialog(true);
  };

  const calculatePayroll = async () => {
    setSaving(true);
    const month = parseInt(runMonth);
    const year = parseInt(runYear);

    const [salaryRes, statutoryRes, ptSlabRes, attendanceRes, holidaysRes, weekOffsRes, profilesRes] = await Promise.all([
      supabase.from('salary_structures').select('*').eq('is_active', true),
      supabase.from('statutory_profiles').select('*'),
      supabase.from('professional_tax_slabs').select('*').eq('is_active', true),
      supabase.from('attendance').select('user_id, status, overtime_minutes')
        .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lt('date', month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`),
      supabase.from('holidays').select('date')
        .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lt('date', month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`),
      supabase.from('week_offs').select('day_of_week').eq('is_global', true),
      supabase.from('profiles').select('user_id, full_name, email, department, bank_name, bank_account_number, bank_ifsc').eq('is_active', true),
    ]);

    const salaries = salaryRes.data || [];
    const statutoryProfiles = statutoryRes.data || [];
    const ptSlabs = ptSlabRes.data || [];
    const attendance = attendanceRes.data || [];
    const holidayDates = new Set((holidaysRes.data || []).map(h => h.date));
    const weekOffDays = new Set((weekOffsRes.data || []).map(w => w.day_of_week));
    const profiles = profilesRes.data || [];
    const warnings: string[] = [];

    if (salaries.length === 0) {
      toast({ title: 'Error', description: 'No salary structures found. Set up compensation first.', variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Calculate working days
    const daysInMonth = new Date(year, month, 0).getDate();
    let totalWorkingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      if (!weekOffDays.has(dayOfWeek) && !holidayDates.has(dateStr)) totalWorkingDays++;
    }
    if (totalWorkingDays === 0) totalWorkingDays = daysInMonth;

    // Check for employees without salary
    const employeesWithSalary = new Set(salaries.map(s => s.user_id));
    profiles.forEach(p => {
      if (!employeesWithSalary.has(p.user_id)) {
        warnings.push(`${p.full_name}: No salary structure — excluded from payroll`);
      }
    });

    const calculatePT = (gross: number, state: string | null) => {
      if (!state) return 0;
      const stateSlabs = ptSlabs.filter(s => s.state === state);
      for (const slab of stateSlabs) {
        if (gross >= Number(slab.min_salary) && gross <= (slab.max_salary ? Number(slab.max_salary) : Infinity)) {
          return Number(slab.monthly_tax);
        }
      }
      return 0;
    };

    const entries: PayrollEntry[] = salaries.map(salary => {
      const profile = profiles.find(p => p.user_id === salary.user_id);
      const userAttendance = attendance.filter(a => a.user_id === salary.user_id);
      const presentDays = userAttendance.filter(a => a.status === 'present').length;
      const leaveDays = userAttendance.filter(a => a.status === 'leave').length;
      const lopDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);
      const totalOvertimeMin = userAttendance.reduce((sum, a) => sum + (a.overtime_minutes || 0), 0);

      const basicSalary = Number(salary.basic_salary);
      const hraAmt = Number(salary.hra);
      const specialAllowance = Number(salary.special_allowance);
      const otherAllowancesAmt = Number(salary.other_allowances);
      const fullGross = basicSalary + hraAmt + Number(salary.da) + specialAllowance + otherAllowancesAmt;

      const payableDays = presentDays + leaveDays;
      const ratio = totalWorkingDays > 0 ? payableDays / totalWorkingDays : 0;

      const proratedBasic = Math.round(basicSalary * ratio * 100) / 100;
      const proratedHRA = Math.round(hraAmt * ratio * 100) / 100;
      const proratedSpecial = Math.round(specialAllowance * ratio * 100) / 100;
      const proratedOther = Math.round(otherAllowancesAmt * ratio * 100) / 100;
      const grossSalary = Math.round(fullGross * ratio * 100) / 100;

      const statProfile = statutoryProfiles.find(sp => sp.user_id === salary.user_id);
      let pfEmployee = 0, pfEmployer = 0, esiEmployee = 0, esiEmployer = 0, professionalTax = 0;
      const entryWarnings: string[] = [];

      if (statProfile) {
        if (statProfile.pf_applicable) {
          const pfWage = Math.min(proratedBasic, Number(statProfile.pf_wage_ceiling || 15000));
          pfEmployee = Math.round(pfWage * Number(statProfile.pf_employee_rate || 12) / 100);
          pfEmployer = Math.round(pfWage * Number(statProfile.pf_employer_rate || 12) / 100);
          if (statProfile.pf_applicable && !statProfile.uan_number) {
            entryWarnings.push('UAN missing');
          }
        }
        if (statProfile.esi_applicable && grossSalary <= Number(statProfile.esi_wage_ceiling || 21000)) {
          esiEmployee = Math.round(grossSalary * Number(statProfile.esi_employee_rate || 0.75) / 100);
          esiEmployer = Math.round(grossSalary * Number(statProfile.esi_employer_rate || 3.25) / 100);
          if (!statProfile.esi_number) entryWarnings.push('ESI number missing');
        }
        if (statProfile.pt_applicable) {
          professionalTax = calculatePT(grossSalary, statProfile.pt_state);
        }
      } else {
        entryWarnings.push('No statutory profile');
      }

      if (!profile?.bank_account_number) entryWarnings.push('Bank details missing');
      if (lopDays > 0) entryWarnings.push(`${lopDays} LOP days`);

      const tds = Math.round(Number(salary.tax_deduction) * ratio * 100) / 100;
      const otherDed = Math.round(Number(salary.other_deductions) * ratio * 100) / 100;
      const totalDeductions = pfEmployee + esiEmployee + professionalTax + tds + otherDed;
      const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

      if (entryWarnings.length > 0) {
        warnings.push(`${profile?.full_name || 'Unknown'}: ${entryWarnings.join(', ')}`);
      }

      return {
        id: '', month, year, user_id: salary.user_id,
        working_days: totalWorkingDays, present_days: presentDays, leave_days: leaveDays,
        lop_days: lopDays, overtime_hours: Math.round((totalOvertimeMin / 60) * 100) / 100,
        basic_salary: proratedBasic, hra: proratedHRA, special_allowance: proratedSpecial,
        other_allowances: proratedOther, gross_salary: grossSalary,
        pf_employee: pfEmployee, pf_employer: pfEmployer,
        esi_employee: esiEmployee, esi_employer: esiEmployer,
        professional_tax: professionalTax, tds, other_deductions_detail: { other: otherDed },
        total_deductions: totalDeductions, net_salary: netSalary,
        status: 'draft', locked: false, locked_at: null, processed_at: null,
        profile, warnings: entryWarnings,
      };
    });

    setPreviewEntries(entries);
    setRunWarnings(warnings);
    setWizardStep(2);
    setSaving(false);
  };

  const savePayrollRun = async () => {
    setSaving(true);
    const month = parseInt(runMonth);
    const year = parseInt(runYear);

    // Delete existing drafts for this period
    await supabase.from('payroll_runs').delete().eq('month', month).eq('year', year).eq('status', 'draft');

    const payload = previewEntries.map(({ id, profile, warnings, ...rest }) => rest);
    const { error } = await supabase.from('payroll_runs').insert(payload);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Payroll Generated', description: `Draft payroll for ${MONTHS[month - 1]} ${year} — ${payload.length} employees` });
      logAction({ action: 'settings_updated', table_name: 'payroll_runs', record_id: `${month}-${year}`, new_value: { month, year, count: payload.length } as any });
      setShowRunDialog(false);
      fetchPayroll();
    }
    setSaving(false);
  };

  const approvePayroll = async (id: string) => {
    const { error } = await supabase.from('payroll_runs').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Approved' });
      logAction({ action: 'leave_approved', table_name: 'payroll_runs', record_id: id, new_value: { status: 'approved' } as any });
      fetchPayroll();
    }
  };

  const bulkApprove = async (month: number, year: number) => {
    const ids = payrollRuns.filter(p => p.month === month && p.year === year && p.status === 'draft').map(p => p.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('payroll_runs').update({ status: 'approved', processed_at: new Date().toISOString() }).in('id', ids);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Bulk Approved', description: `${ids.length} payroll entries approved` });
      fetchPayroll();
    }
  };

  const lockPayroll = async () => {
    if (!lockTargetId) return;
    const { error } = await supabase.from('payroll_runs').update({ locked: true, locked_at: new Date().toISOString() }).eq('id', lockTargetId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Locked', description: 'Payroll entry locked — no further edits' });
      logAction({ action: 'settings_updated', table_name: 'payroll_runs', record_id: lockTargetId, new_value: { locked: true } as any });
      fetchPayroll();
    }
    setShowLockConfirm(false);
    setLockTargetId(null);
  };

  const exportBankCSV = (month: number, year: number) => {
    const runs = payrollRuns.filter(p => p.month === month && p.year === year && ['approved', 'processed'].includes(p.status));
    if (runs.length === 0) { toast({ title: 'No data', variant: 'destructive' }); return; }
    const missing = runs.filter(p => !p.profile?.bank_account_number);
    if (missing.length > 0) {
      toast({ title: 'Warning', description: `${missing.length} employee(s) excluded — missing bank details`, variant: 'destructive' });
    }
    const valid = runs.filter(p => p.profile?.bank_account_number);
    let csv = 'Employee Name,Bank Name,Account Number,IFSC Code,Net Salary,Narration\n';
    valid.forEach(p => {
      csv += `"${p.profile?.full_name}","${p.profile?.bank_name || ''}","${p.profile?.bank_account_number}","${p.profile?.bank_ifsc || ''}",${Number(p.net_salary)},"Salary ${MONTHS[month - 1]} ${year}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bank_transfer_${MONTHS[month - 1]}_${year}.csv`;
    a.click();
  };

  const openSlip = (p: PayrollEntry) => {
    // Get company_id from the employee's profile
    const empProfile = p.profile as any;
    setSalarySlipData({
      employeeName: p.profile?.full_name || 'Unknown', department: p.profile?.department,
      email: p.profile?.email || '', month: p.month, year: p.year,
      workingDays: p.working_days, presentDays: p.present_days, leaveDays: p.leave_days, lopDays: p.lop_days || 0,
      overtimeHours: p.overtime_hours, basicSalary: Number(p.basic_salary), hra: Number(p.hra), da: 0,
      specialAllowance: Number(p.special_allowance), otherAllowances: Number(p.other_allowances),
      pfEmployee: Number(p.pf_employee), pfEmployer: Number(p.pf_employer),
      esiEmployee: Number(p.esi_employee), esiEmployer: Number(p.esi_employer),
      professionalTax: Number(p.professional_tax), tds: Number(p.tds),
      otherDeductions: Number(p.other_deductions_detail?.other) || 0,
      grossSalary: Number(p.gross_salary), totalDeductions: Number(p.total_deductions), netSalary: Number(p.net_salary),
      status: p.status, companyName, brandColor: companyBrandColor,
      companyId: empProfile?.company_id || null,
    });
    setShowSalarySlip(true);
  };

  // Group by period
  const periods = [...new Set(payrollRuns.map(p => `${p.year}-${p.month}`))].sort().reverse();

  const totalNet = payrollRuns.filter(p => p.status !== 'draft').reduce((s, p) => s + Number(p.net_salary), 0);
  const draftCount = payrollRuns.filter(p => p.status === 'draft').length;
  const approvedCount = payrollRuns.filter(p => p.status === 'approved').length;
  const processedCount = payrollRuns.filter(p => p.status === 'processed').length;

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Calculator className="w-6 h-6 text-primary" /> Payroll Run</h1>
            <p className="text-sm text-muted-foreground">Generate, review, approve and lock monthly payroll</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportBankCSV(parseInt(runMonth), parseInt(runYear))}>
              <Download className="w-4 h-4 mr-1" /> Bank CSV
            </Button>
            <Button size="sm" onClick={startWizard}>
              <Calculator className="w-4 h-4 mr-1" /> New Payroll Run
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 border-l-4 border-l-muted-foreground">
            <p className="text-[10px] text-muted-foreground uppercase">Drafts</p>
            <p className="text-lg font-bold">{draftCount}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase">Approved</p>
            <p className="text-lg font-bold">{approvedCount}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-success">
            <p className="text-[10px] text-muted-foreground uppercase">Processed</p>
            <p className="text-lg font-bold">{processedCount}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-warning">
            <p className="text-[10px] text-muted-foreground uppercase">Total Disbursed</p>
            <p className="text-sm font-bold">{formatCurrency(totalNet)}</p>
          </Card>
        </div>

        {/* Payroll by period */}
        {periods.length === 0 ? (
          <Card className="p-8 text-center">
            <Calculator className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No payroll runs yet. Click "New Payroll Run" to start.</p>
          </Card>
        ) : periods.map(period => {
          const [y, m] = period.split('-').map(Number);
          const runs = payrollRuns.filter(p => p.year === y && p.month === m);
          const periodDrafts = runs.filter(r => r.status === 'draft');
          return (
            <Card key={period}>
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{MONTHS[m - 1]} {y}</CardTitle>
                <div className="flex gap-2">
                  {periodDrafts.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => bulkApprove(m, y)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve All ({periodDrafts.length})
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => exportBankCSV(m, y)}>
                    <Download className="w-3 h-3 mr-1" /> Bank CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Present/WD</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">LOP</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Gross</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Deductions</TableHead>
                        <TableHead className="text-right">Net Pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{p.profile?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{p.profile?.department || ''}</p>
                            {!p.profile?.bank_account_number && <p className="text-[10px] text-warning">⚠ No bank details</p>}
                          </TableCell>
                          <TableCell className="text-right text-sm hidden sm:table-cell">{p.present_days}/{p.working_days}</TableCell>
                          <TableCell className="text-right text-sm hidden sm:table-cell">{p.lop_days > 0 ? <span className="text-destructive">{p.lop_days}</span> : '0'}</TableCell>
                          <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(Number(p.gross_salary))}</TableCell>
                          <TableCell className="text-right text-sm hidden sm:table-cell text-destructive">{formatCurrency(Number(p.total_deductions))}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-success">{formatCurrency(Number(p.net_salary))}</TableCell>
                          <TableCell>
                            <Badge variant={p.locked ? 'destructive' : p.status === 'approved' ? 'default' : p.status === 'processed' ? 'outline' : 'secondary'} className="text-xs">
                              {p.locked ? '🔒 Locked' : p.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {p.status === 'draft' && !p.locked && (
                                <Button size="sm" variant="outline" onClick={() => approvePayroll(p.id)} className="text-xs">Approve</Button>
                              )}
                              {['approved', 'processed'].includes(p.status) && (
                                <Button size="sm" variant="ghost" onClick={() => openSlip(p)} className="text-xs"><Eye className="w-3 h-3" /></Button>
                              )}
                              {['approved', 'processed'].includes(p.status) && !p.locked && (
                                <Button size="sm" variant="ghost" onClick={() => { setLockTargetId(p.id); setShowLockConfirm(true); }} className="text-xs text-destructive"><Lock className="w-3 h-3" /></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* Run Wizard Dialog */}
      <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payroll Run Wizard — Step {wizardStep}/2</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 ? 'Select period and freeze attendance snapshot' : 'Review calculated payroll before saving'}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Month</Label>
                  <Select value={runMonth} onValueChange={setRunMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Year</Label>
                  <Input type="number" value={runYear} onChange={e => setRunYear(e.target.value)} />
                </div>
              </div>
              <Card className="p-4 bg-muted/50">
                <p className="text-sm">This will:</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 mt-1 space-y-1">
                  <li>Snapshot attendance data for {MONTHS[parseInt(runMonth) - 1]} {runYear}</li>
                  <li>Calculate earnings based on active salary structures</li>
                  <li>Compute PF/ESI/PT from statutory profiles</li>
                  <li>Pro-rate salary for LOP days</li>
                </ul>
              </Card>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRunDialog(false)}>Cancel</Button>
                <Button onClick={calculatePayroll} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Freeze & Calculate
                </Button>
              </DialogFooter>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              {runWarnings.length > 0 && (
                <Card className="border-warning/50 bg-warning/5 p-4">
                  <p className="text-sm font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-warning" /> Warnings ({runWarnings.length})</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-5 mt-1 max-h-32 overflow-y-auto">
                    {runWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </Card>
              )}

              <div className="rounded-md border overflow-x-auto max-h-[40vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Present/WD</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewEntries.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{p.profile?.full_name || 'Unknown'}</TableCell>
                        <TableCell className="text-right text-sm">{p.present_days}/{p.working_days}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(Number(p.gross_salary))}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">{formatCurrency(Number(p.total_deductions))}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-success">{formatCurrency(Number(p.net_salary))}</TableCell>
                        <TableCell>
                          {p.warnings && p.warnings.length > 0 && (
                            <div className="text-[10px] text-warning">{p.warnings.join(', ')}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Card className="p-4 bg-primary/5">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Net Payroll</span>
                  <span className="text-primary">{formatCurrency(previewEntries.reduce((s, p) => s + Number(p.net_salary), 0))}</span>
                </div>
              </Card>

              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardStep(1)}>Back</Button>
                <Button onClick={savePayrollRun} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Save as Draft
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lock Confirm */}
      <Dialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Payroll Entry</DialogTitle>
            <DialogDescription>This action is irreversible. Locked entries cannot be edited or recalculated.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={lockPayroll}>
              <Lock className="w-4 h-4 mr-1" /> Lock Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalarySlipPDF data={salarySlipData} open={showSalarySlip} onOpenChange={setShowSalarySlip} />
    </AppLayout>
  );
}
