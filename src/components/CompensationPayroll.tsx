import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Users, FileText, Plus, Loader2, Calculator, TrendingUp, IndianRupee, Eye, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import SalarySlipPDF from '@/components/SalarySlipPDF';

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

interface PayrollRun {
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
}

interface AttendanceSummary {
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  overtimeMinutes: number;
  totalWorkingDays: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CompensationPayroll() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('salary');
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string; email: string; department: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [showPayrollDialog, setShowPayrollDialog] = useState(false);
  const [showSalaryDetailDialog, setShowSalaryDetailDialog] = useState(false);
  const [selectedSalaryDetail, setSelectedSalaryDetail] = useState<SalaryStructure | null>(null);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('Company');
  const [showSalarySlip, setShowSalarySlip] = useState(false);
  const [salarySlipData, setSalarySlipData] = useState<any>(null);

  // Salary form
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [hra, setHra] = useState('');
  const [da, setDa] = useState('');
  const [specialAllowance, setSpecialAllowance] = useState('');
  const [otherAllowances, setOtherAllowances] = useState('');
  const [pfDeduction, setPfDeduction] = useState('');
  const [taxDeduction, setTaxDeduction] = useState('');
  const [otherDeductions, setOtherDeductions] = useState('');

  // Auto attendance detection
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Payroll form
  const [payrollMonth, setPayrollMonth] = useState(String(new Date().getMonth() + 1));
  const [payrollYear, setPayrollYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-detect attendance when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      fetchAttendanceSummary(selectedEmployee);
    } else {
      setAttendanceSummary(null);
    }
  }, [selectedEmployee]);

  const fetchAttendanceSummary = async (userId: string) => {
    setLoadingAttendance(true);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data } = await supabase.from('attendance').select('status, overtime_minutes')
      .eq('user_id', userId).gte('date', startDate).lt('date', endDate);

    if (data) {
      setAttendanceSummary({
        presentDays: data.filter(a => a.status === 'present').length,
        leaveDays: data.filter(a => a.status === 'leave').length,
        absentDays: data.filter(a => a.status === 'absent').length,
        overtimeMinutes: data.reduce((sum, a) => sum + (a.overtime_minutes || 0), 0),
        totalWorkingDays: data.length,
      });
    }
    setLoadingAttendance(false);
  };

  const fetchData = async () => {
    setLoading(true);
    const [salaryRes, payrollRes, empRes, companyRes] = await Promise.all([
      supabase.from('salary_structures').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('payroll_runs').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(50),
      supabase.from('profiles').select('user_id, full_name, email, department, bank_name, bank_account_number, bank_ifsc').eq('is_active', true),
      supabase.from('company_settings').select('company_name').limit(1).maybeSingle(),
    ]);

    if (companyRes.data) setCompanyName(companyRes.data.company_name);

    if (empRes.data) setEmployees(empRes.data);

    if (salaryRes.data && empRes.data) {
      const mapped = salaryRes.data.map(s => ({
        ...s,
        profile: empRes.data.find(e => e.user_id === s.user_id),
      }));
      setSalaryStructures(mapped as any);
    }

    if (payrollRes.data && empRes.data) {
      const mapped = payrollRes.data.map(p => ({
        ...p,
        profile: empRes.data.find(e => e.user_id === p.user_id),
      }));
      setPayrollRuns(mapped as any);
    }

    setLoading(false);
  };

  const saveSalaryStructure = async () => {
    if (!selectedEmployee || !basicSalary) {
      toast({ title: 'Error', description: 'Select employee and enter basic salary', variant: 'destructive' });
      return;
    }
    setSaving(true);

    await supabase.from('salary_structures').update({ is_active: false }).eq('user_id', selectedEmployee);

    const { error } = await supabase.from('salary_structures').insert({
      user_id: selectedEmployee,
      basic_salary: parseFloat(basicSalary) || 0,
      hra: parseFloat(hra) || 0,
      da: parseFloat(da) || 0,
      special_allowance: parseFloat(specialAllowance) || 0,
      other_allowances: parseFloat(otherAllowances) || 0,
      pf_deduction: parseFloat(pfDeduction) || 0,
      tax_deduction: parseFloat(taxDeduction) || 0,
      other_deductions: parseFloat(otherDeductions) || 0,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to save salary structure', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Salary structure saved' });
      setShowSalaryDialog(false);
      resetSalaryForm();
      fetchData();
    }
    setSaving(false);
  };

  const resetSalaryForm = () => {
    setSelectedEmployee('');
    setBasicSalary('');
    setHra('');
    setDa('');
    setSpecialAllowance('');
    setOtherAllowances('');
    setPfDeduction('');
    setTaxDeduction('');
    setOtherDeductions('');
    setAttendanceSummary(null);
  };

  const runPayroll = async () => {
    setSaving(true);
    const month = parseInt(payrollMonth);
    const year = parseInt(payrollYear);

    // Fetch salaries, statutory profiles, and PT slabs in parallel
    const [salaryRes, statutoryRes, ptSlabRes] = await Promise.all([
      supabase.from('salary_structures').select('*').eq('is_active', true),
      supabase.from('statutory_profiles').select('*'),
      supabase.from('professional_tax_slabs').select('*').eq('is_active', true),
    ]);

    const salaries = salaryRes.data;
    const statutoryProfiles = statutoryRes.data || [];
    const ptSlabs = ptSlabRes.data || [];

    if (!salaries || salaries.length === 0) {
      toast({ title: 'No salary structures', description: 'Set up salary structures first', variant: 'destructive' });
      setSaving(false);
      return;
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Fetch attendance, holidays, and week-offs in parallel for accurate pro-rating
    const [attendanceRes, holidaysRes, weekOffsRes] = await Promise.all([
      supabase.from('attendance').select('user_id, status, overtime_minutes')
        .gte('date', startDate).lt('date', endDate),
      supabase.from('holidays').select('date')
        .gte('date', startDate).lt('date', endDate),
      supabase.from('week_offs').select('day_of_week')
        .eq('is_global', true),
    ]);

    const attendance = attendanceRes.data || [];
    const holidayDates = new Set((holidaysRes.data || []).map(h => h.date));
    const weekOffDays = new Set((weekOffsRes.data || []).map(w => w.day_of_week));

    // Calculate total working days in the month (exclude weekoffs & holidays)
    const daysInMonth = new Date(year, month, 0).getDate();
    let totalWorkingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      if (!weekOffDays.has(dayOfWeek) && !holidayDates.has(dateStr)) {
        totalWorkingDays++;
      }
    }
    if (totalWorkingDays === 0) totalWorkingDays = daysInMonth;

    // Helper: calculate PT from slabs
    const calculatePT = (grossMonthly: number, state: string | null): number => {
      if (!state) return 0;
      const stateSlabs = ptSlabs.filter(s => s.state === state);
      for (const slab of stateSlabs) {
        const min = Number(slab.min_salary);
        const max = slab.max_salary ? Number(slab.max_salary) : Infinity;
        if (grossMonthly >= min && grossMonthly <= max) {
          return Number(slab.monthly_tax);
        }
      }
      return 0;
    };

    const payrollEntries = salaries.map(salary => {
      const userAttendance = attendance.filter(a => a.user_id === salary.user_id);
      const presentDays = userAttendance.filter(a => a.status === 'present').length;
      const leaveDays = userAttendance.filter(a => a.status === 'leave').length;
      const totalOvertimeMin = userAttendance.reduce((sum, a) => sum + (a.overtime_minutes || 0), 0);
      const lopDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);

      // Full month CTC components
      const basicSalary = Number(salary.basic_salary);
      const hraAmt = Number(salary.hra);
      const specialAllowance = Number(salary.special_allowance);
      const otherAllowancesAmt = Number(salary.other_allowances);
      const fullGross = basicSalary + hraAmt + Number(salary.da) + specialAllowance + otherAllowancesAmt;

      // Pro-rate: payable days = present + paid leave days
      const payableDays = presentDays + leaveDays;
      const proRateRatio = totalWorkingDays > 0 ? payableDays / totalWorkingDays : 0;

      const proratedBasic = Math.round(basicSalary * proRateRatio * 100) / 100;
      const proratedHRA = Math.round(hraAmt * proRateRatio * 100) / 100;
      const proratedSpecial = Math.round(specialAllowance * proRateRatio * 100) / 100;
      const proratedOther = Math.round(otherAllowancesAmt * proRateRatio * 100) / 100;
      const grossSalary = Math.round(fullGross * proRateRatio * 100) / 100;

      // Statutory deductions from statutory_profiles
      const statProfile = statutoryProfiles.find(sp => sp.user_id === salary.user_id);
      let pfEmployee = 0, pfEmployer = 0, esiEmployee = 0, esiEmployer = 0, professionalTax = 0;

      if (statProfile) {
        // PF calculation
        if (statProfile.pf_applicable) {
          const pfWage = Math.min(proratedBasic, Number(statProfile.pf_wage_ceiling || 15000));
          pfEmployee = Math.round(pfWage * Number(statProfile.pf_employee_rate || 12) / 100);
          pfEmployer = Math.round(pfWage * Number(statProfile.pf_employer_rate || 12) / 100);
        }
        // ESI calculation
        if (statProfile.esi_applicable && grossSalary <= Number(statProfile.esi_wage_ceiling || 21000)) {
          esiEmployee = Math.round(grossSalary * Number(statProfile.esi_employee_rate || 0.75) / 100);
          esiEmployer = Math.round(grossSalary * Number(statProfile.esi_employer_rate || 3.25) / 100);
        }
        // PT calculation
        if (statProfile.pt_applicable) {
          professionalTax = calculatePT(grossSalary, statProfile.pt_state);
        }
      }

      // TDS placeholder from salary structure
      const tds = Math.round(Number(salary.tax_deduction) * proRateRatio * 100) / 100;
      const otherDeductions = Math.round(Number(salary.other_deductions) * proRateRatio * 100) / 100;

      const totalDeductions = pfEmployee + esiEmployee + professionalTax + tds + otherDeductions;
      const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

      return {
        month, year,
        user_id: salary.user_id,
        working_days: totalWorkingDays,
        present_days: presentDays,
        leave_days: leaveDays,
        lop_days: lopDays,
        overtime_hours: Math.round((totalOvertimeMin / 60) * 100) / 100,
        basic_salary: proratedBasic,
        hra: proratedHRA,
        special_allowance: proratedSpecial,
        other_allowances: proratedOther,
        gross_salary: grossSalary,
        pf_employee: pfEmployee,
        pf_employer: pfEmployer,
        esi_employee: esiEmployee,
        esi_employer: esiEmployer,
        professional_tax: professionalTax,
        tds,
        other_deductions_detail: { other: otherDeductions },
        total_deductions: totalDeductions,
        net_salary: netSalary,
        status: 'draft',
      };
    });

    await supabase.from('payroll_runs').delete().eq('month', month).eq('year', year).eq('status', 'draft');

    const { error } = await supabase.from('payroll_runs').insert(payrollEntries);

    if (error) {
      toast({ title: 'Error', description: 'Failed to run payroll', variant: 'destructive' });
    } else {
      toast({ title: 'Payroll Generated', description: `Draft payroll for ${MONTHS[month - 1]} ${year} created for ${payrollEntries.length} employees` });
      setShowPayrollDialog(false);
      fetchData();
    }
    setSaving(false);
  };

  const approvePayroll = async (id: string) => {
    const { error } = await supabase.from('payroll_runs').update({
      status: 'approved',
      processed_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to approve', variant: 'destructive' });
    } else {
      toast({ title: 'Approved', description: 'Payroll approved and sent to Payroll Team' });
      fetchData();
    }
  };

  const openSalarySlip = (p: PayrollRun) => {
    setSalarySlipData({
      employeeName: p.profile?.full_name || 'Unknown',
      department: p.profile?.department,
      email: p.profile?.email || '',
      month: p.month,
      year: p.year,
      workingDays: p.working_days,
      presentDays: p.present_days,
      leaveDays: p.leave_days,
      lopDays: p.lop_days || 0,
      overtimeHours: p.overtime_hours,
      basicSalary: Number(p.basic_salary) || 0,
      hra: Number(p.hra) || 0,
      da: 0,
      specialAllowance: Number(p.special_allowance) || 0,
      otherAllowances: Number(p.other_allowances) || 0,
      pfEmployee: Number(p.pf_employee) || 0,
      pfEmployer: Number(p.pf_employer) || 0,
      esiEmployee: Number(p.esi_employee) || 0,
      esiEmployer: Number(p.esi_employer) || 0,
      professionalTax: Number(p.professional_tax) || 0,
      tds: Number(p.tds) || 0,
      otherDeductions: Number(p.other_deductions_detail?.other) || 0,
      grossSalary: Number(p.gross_salary),
      totalDeductions: Number(p.total_deductions),
      netSalary: Number(p.net_salary),
      status: p.status,
      companyName,
    });
    setShowSalarySlip(true);
  };

  const lockPayroll = async (id: string) => {
    const { error } = await supabase.from('payroll_runs').update({
      locked: true,
      locked_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to lock payroll', variant: 'destructive' });
    } else {
      toast({ title: 'Locked', description: 'Payroll run locked — no further edits allowed' });
      fetchData();
    }
  };

  const exportBankCSV = (month: number, year: number) => {
    const monthRuns = payrollRuns.filter(p => p.month === month && p.year === year && (p.status === 'approved' || p.status === 'processed'));
    if (monthRuns.length === 0) {
      toast({ title: 'No data', description: 'No approved payroll runs for this period', variant: 'destructive' });
      return;
    }
    let csv = 'Employee Name,Bank Name,Account Number,IFSC Code,Net Salary\n';
    monthRuns.forEach(p => {
      csv += `"${p.profile?.full_name || 'Unknown'}","${p.profile?.bank_name || ''}","${p.profile?.bank_account_number || ''}","${p.profile?.bank_ifsc || ''}",${Number(p.net_salary)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank_transfer_${MONTHS[month - 1]}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const totalGross = salaryStructures.reduce((sum, s) => sum + Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances), 0);
  const totalNet = salaryStructures.reduce((sum, s) => sum + Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances) - Number(s.pf_deduction) - Number(s.tax_deduction) - Number(s.other_deductions), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards - Professional blue theme */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-[hsl(210,80%,50%)] bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(210,80%,50%)]/10 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-[hsl(210,80%,50%)]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Gross</p>
              <p className="text-base font-bold">{formatCurrency(totalGross)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-[hsl(150,60%,40%)] bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(150,60%,40%)]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[hsl(150,60%,40%)]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Payable</p>
              <p className="text-base font-bold">{formatCurrency(totalNet)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-[hsl(260,60%,55%)] bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(260,60%,55%)]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[hsl(260,60%,55%)]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">On Payroll</p>
              <p className="text-base font-bold">{salaryStructures.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-[hsl(30,80%,55%)] bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(30,80%,55%)]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[hsl(30,80%,55%)]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Payroll Runs</p>
              <p className="text-base font-bold">{payrollRuns.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="salary">Salary Structures</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Runs</TabsTrigger>
          <TabsTrigger value="statement">Salary Statement</TabsTrigger>
        </TabsList>

        {/* Salary Structures Tab */}
        <TabsContent value="salary" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Employee Salary Structures</h3>
            <Button size="sm" onClick={() => setShowSalaryDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Salary
            </Button>
          </div>

          {salaryStructures.length === 0 ? (
            <Card className="p-8 text-center">
              <IndianRupee className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No salary structures configured yet</p>
              <Button size="sm" className="mt-3" onClick={() => setShowSalaryDialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add First Salary Structure
              </Button>
            </Card>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[hsl(210,80%,50%)]/5">
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">HRA</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">DA</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryStructures.map((s) => {
                    const gross = Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances);
                    const ded = Number(s.pf_deduction) + Number(s.tax_deduction) + Number(s.other_deductions);
                    return (
                      <TableRow key={s.id} className="hover:bg-muted/30">
                        <TableCell>
                          <p className="font-medium text-sm">{s.profile?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{s.profile?.department || ''}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(Number(s.basic_salary))}</TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(Number(s.hra))}</TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(Number(s.da))}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(gross)}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-[hsl(150,60%,40%)]">{formatCurrency(gross - ded)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedSalaryDetail(s); setShowSalaryDetailDialog(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Payroll Runs Tab */}
        <TabsContent value="payroll" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-semibold">Monthly Payroll</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportBankCSV(parseInt(payrollMonth), parseInt(payrollYear))}>
                <Download className="w-4 h-4 mr-1" /> Bank CSV
              </Button>
              <Button size="sm" onClick={() => setShowPayrollDialog(true)}>
                <Calculator className="w-4 h-4 mr-1" /> Run Payroll
              </Button>
            </div>
          </div>

          {payrollRuns.length === 0 ? (
            <Card className="p-8 text-center">
              <Calculator className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No payroll runs yet</p>
              <Button size="sm" className="mt-3" onClick={() => setShowPayrollDialog(true)}>
                <Calculator className="w-4 h-4 mr-1" /> Run First Payroll
              </Button>
            </Card>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[hsl(210,80%,50%)]/5">
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Present</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">OT (hrs)</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell>
                        <p className="font-medium text-sm">{p.profile?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{p.profile?.department || ''}</p>
                      </TableCell>
                      <TableCell className="text-sm">{MONTHS[p.month - 1]} {p.year}</TableCell>
                      <TableCell className="text-right text-sm hidden sm:table-cell">{p.present_days}/{p.working_days}</TableCell>
                      <TableCell className="text-right text-sm hidden sm:table-cell">{p.overtime_hours}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-[hsl(150,60%,40%)]">{formatCurrency(Number(p.net_salary))}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'approved' ? 'default' : p.status === 'processed' ? 'outline' : 'secondary'}
                          className={`text-xs ${p.status === 'approved' ? 'bg-[hsl(210,80%,50%)] text-white' : p.status === 'processed' ? 'border-[hsl(150,60%,40%)] text-[hsl(150,60%,40%)]' : ''}`}>
                          {p.status}
                        </Badge>
                      </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {p.status === 'draft' && (
                              <Button size="sm" variant="outline" onClick={() => approvePayroll(p.id)} className="text-xs">
                                Approve
                              </Button>
                            )}
                            {(p.status === 'approved' || p.status === 'processed') && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => openSalarySlip(p)} className="text-xs">
                                  <Download className="w-3 h-3 mr-1" /> Slip
                                </Button>
                                {!p.locked && (
                                  <Button size="sm" variant="outline" onClick={() => lockPayroll(p.id)} className="text-xs text-destructive border-destructive/30">
                                    Lock
                                  </Button>
                                )}
                              </>
                            )}
                            {p.locked && (
                              <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">🔒 Locked</Badge>
                            )}
                          </div>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Salary Statement Tab - Inspired by reference */}
        <TabsContent value="statement" className="space-y-4">
          <Card>
            <CardHeader className="bg-[hsl(210,80%,50%)]/5 rounded-t-lg border-b">
              <CardTitle className="text-lg">Salary Statement</CardTitle>
              <CardDescription>Monthly salary breakdown for all employees</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {salaryStructures.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No salary structures to display
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[hsl(210,80%,50%)]/5">
                        <TableHead className="font-semibold">Component</TableHead>
                        {salaryStructures.map(s => (
                          <TableHead key={s.id} className="text-right font-semibold min-w-[120px]">
                            {s.profile?.full_name || 'Unknown'}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Earnings Section */}
                      <TableRow className="bg-[hsl(150,60%,40%)]/5">
                        <TableCell colSpan={salaryStructures.length + 1} className="font-semibold text-[hsl(150,60%,40%)]">Earnings</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Basic Salary</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.basic_salary))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">House Rent Allowance</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.hra))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Dearness Allowance</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.da))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Special Allowance</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.special_allowance))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Other Allowances</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.other_allowances))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow className="font-semibold border-t-2">
                        <TableCell>Gross Earnings</TableCell>
                        {salaryStructures.map(s => {
                          const gross = Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances);
                          return <TableCell key={s.id} className="text-right">{formatCurrency(gross)}</TableCell>;
                        })}
                      </TableRow>

                      {/* Deductions Section */}
                      <TableRow className="bg-destructive/5">
                        <TableCell colSpan={salaryStructures.length + 1} className="font-semibold text-destructive">Deductions</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">PF</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.pf_deduction))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Income Tax</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.tax_deduction))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Others</TableCell>
                        {salaryStructures.map(s => (
                          <TableCell key={s.id} className="text-right text-sm">{formatCurrency(Number(s.other_deductions))}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow className="font-semibold border-t-2">
                        <TableCell>Total Deductions</TableCell>
                        {salaryStructures.map(s => {
                          const ded = Number(s.pf_deduction) + Number(s.tax_deduction) + Number(s.other_deductions);
                          return <TableCell key={s.id} className="text-right text-destructive">{formatCurrency(ded)}</TableCell>;
                        })}
                      </TableRow>

                      {/* Net Pay */}
                      <TableRow className="bg-[hsl(210,80%,50%)]/5 font-bold text-base">
                        <TableCell>Net Pay</TableCell>
                        {salaryStructures.map(s => {
                          const gross = Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances);
                          const ded = Number(s.pf_deduction) + Number(s.tax_deduction) + Number(s.other_deductions);
                          return <TableCell key={s.id} className="text-right text-[hsl(150,60%,40%)]">{formatCurrency(gross - ded)}</TableCell>;
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Salary Dialog - with attendance auto-detection */}
      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Salary Structure</DialogTitle>
            <DialogDescription>Configure salary components for an employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-detected attendance summary */}
            {selectedEmployee && (
              <div className="p-3 rounded-lg bg-[hsl(210,80%,50%)]/5 border border-[hsl(210,80%,50%)]/20">
                <p className="text-xs font-semibold text-[hsl(210,80%,50%)] mb-2">Current Month Attendance</p>
                {loadingAttendance ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : attendanceSummary ? (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-[hsl(150,60%,40%)]">{attendanceSummary.presentDays}</p>
                      <p className="text-[9px] text-muted-foreground">Present</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-500">{attendanceSummary.leaveDays}</p>
                      <p className="text-[9px] text-muted-foreground">Leave</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-destructive">{attendanceSummary.absentDays}</p>
                      <p className="text-[9px] text-muted-foreground">Absent</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[hsl(260,60%,55%)]">{Math.round(attendanceSummary.overtimeMinutes / 60)}h</p>
                      <p className="text-[9px] text-muted-foreground">Overtime</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No attendance data this month</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Basic Salary (₹)</Label>
                <Input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>HRA (₹)</Label>
                <Input type="number" value={hra} onChange={e => setHra(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>DA (₹)</Label>
                <Input type="number" value={da} onChange={e => setDa(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Special Allowance (₹)</Label>
                <Input type="number" value={specialAllowance} onChange={e => setSpecialAllowance(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Other Allowances (₹)</Label>
                <Input type="number" value={otherAllowances} onChange={e => setOtherAllowances(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>PF Deduction (₹)</Label>
                <Input type="number" value={pfDeduction} onChange={e => setPfDeduction(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Tax Deduction (₹)</Label>
                <Input type="number" value={taxDeduction} onChange={e => setTaxDeduction(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Other Deductions (₹)</Label>
                <Input type="number" value={otherDeductions} onChange={e => setOtherDeductions(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalaryDialog(false)}>Cancel</Button>
            <Button onClick={saveSalaryStructure} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Detail Dialog */}
      <Dialog open={showSalaryDetailDialog} onOpenChange={setShowSalaryDetailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedSalaryDetail?.profile?.full_name || 'Salary Details'}</DialogTitle>
            <DialogDescription>{selectedSalaryDetail?.profile?.department || 'Employee'}</DialogDescription>
          </DialogHeader>
          {selectedSalaryDetail && (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[hsl(150,60%,40%)] uppercase tracking-wider">Earnings</p>
                {[
                  ['Basic Salary', selectedSalaryDetail.basic_salary],
                  ['HRA', selectedSalaryDetail.hra],
                  ['DA', selectedSalaryDetail.da],
                  ['Special Allowance', selectedSalaryDetail.special_allowance],
                  ['Other Allowances', selectedSalaryDetail.other_allowances],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label as string}</span>
                    <span>{formatCurrency(Number(val))}</span>
                  </div>
                ))}
              </div>
              <hr />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Deductions</p>
                {[
                  ['PF', selectedSalaryDetail.pf_deduction],
                  ['Tax', selectedSalaryDetail.tax_deduction],
                  ['Others', selectedSalaryDetail.other_deductions],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label as string}</span>
                    <span className="text-destructive">{formatCurrency(Number(val))}</span>
                  </div>
                ))}
              </div>
              <hr />
              <div className="flex justify-between font-semibold">
                <span>Net Pay</span>
                <span className="text-[hsl(150,60%,40%)]">
                  {formatCurrency(
                    Number(selectedSalaryDetail.basic_salary) + Number(selectedSalaryDetail.hra) + Number(selectedSalaryDetail.da) + Number(selectedSalaryDetail.special_allowance) + Number(selectedSalaryDetail.other_allowances) -
                    Number(selectedSalaryDetail.pf_deduction) - Number(selectedSalaryDetail.tax_deduction) - Number(selectedSalaryDetail.other_deductions)
                  )}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Run Payroll Dialog */}
      <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Monthly Payroll</DialogTitle>
            <DialogDescription>Generate payroll based on attendance and salary structures. Approved payroll will be sent to Payroll Team for processing.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Month</Label>
              <Select value={payrollMonth} onValueChange={setPayrollMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={payrollYear} onChange={e => setPayrollYear(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayrollDialog(false)}>Cancel</Button>
            <Button onClick={runPayroll} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Generate Payroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalarySlipPDF data={salarySlipData} open={showSalarySlip} onOpenChange={setShowSalarySlip} />
    </div>
  );
}
