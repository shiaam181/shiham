import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, Users, FileText, Plus, Loader2, Calculator, TrendingUp, IndianRupee } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  overtime_hours: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  status: string;
  processed_at: string | null;
  profile?: { full_name: string; email: string };
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
  const [saving, setSaving] = useState(false);

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

  // Payroll form
  const [payrollMonth, setPayrollMonth] = useState(String(new Date().getMonth() + 1));
  const [payrollYear, setPayrollYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [salaryRes, payrollRes, empRes] = await Promise.all([
      supabase.from('salary_structures').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('payroll_runs').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(50),
      supabase.from('profiles').select('user_id, full_name, email, department').eq('is_active', true),
    ]);

    if (empRes.data) setEmployees(empRes.data);

    // Map profile data to salary structures
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

    // Deactivate existing salary for this employee
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
  };

  const runPayroll = async () => {
    setSaving(true);
    const month = parseInt(payrollMonth);
    const year = parseInt(payrollYear);

    // Get all active salary structures
    const { data: salaries } = await supabase.from('salary_structures').select('*').eq('is_active', true);

    if (!salaries || salaries.length === 0) {
      toast({ title: 'No salary structures', description: 'Set up salary structures first', variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Get attendance data for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data: attendance } = await supabase.from('attendance').select('user_id, status, overtime_minutes')
      .gte('date', startDate).lt('date', endDate);

    const payrollEntries = salaries.map(salary => {
      const userAttendance = attendance?.filter(a => a.user_id === salary.user_id) || [];
      const presentDays = userAttendance.filter(a => a.status === 'present').length;
      const leaveDays = userAttendance.filter(a => a.status === 'leave').length;
      const totalOvertimeMin = userAttendance.reduce((sum, a) => sum + (a.overtime_minutes || 0), 0);

      const grossSalary = Number(salary.basic_salary) + Number(salary.hra) + Number(salary.da) + Number(salary.special_allowance) + Number(salary.other_allowances);
      const totalDeductions = Number(salary.pf_deduction) + Number(salary.tax_deduction) + Number(salary.other_deductions);
      const netSalary = grossSalary - totalDeductions;

      return {
        month,
        year,
        user_id: salary.user_id,
        working_days: presentDays + leaveDays,
        present_days: presentDays,
        leave_days: leaveDays,
        overtime_hours: Math.round((totalOvertimeMin / 60) * 100) / 100,
        gross_salary: grossSalary,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        status: 'draft',
      };
    });

    // Delete existing draft payroll for same month/year
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
      toast({ title: 'Approved', description: 'Payroll entry approved' });
      fetchData();
    }
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
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Monthly Gross</p>
              <p className="text-sm font-bold">{formatCurrency(totalGross)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Net Payable</p>
              <p className="text-sm font-bold">{formatCurrency(totalNet)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">On Payroll</p>
              <p className="text-sm font-bold">{salaryStructures.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Payroll Runs</p>
              <p className="text-sm font-bold">{payrollRuns.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="salary">Salary Structures</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Runs</TabsTrigger>
        </TabsList>

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
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">HRA</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">DA</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryStructures.map((s) => {
                    const gross = Number(s.basic_salary) + Number(s.hra) + Number(s.da) + Number(s.special_allowance) + Number(s.other_allowances);
                    const ded = Number(s.pf_deduction) + Number(s.tax_deduction) + Number(s.other_deductions);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{s.profile?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{s.profile?.department || ''}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(Number(s.basic_salary))}</TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(Number(s.hra))}</TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(Number(s.da))}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(gross)}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-emerald-600">{formatCurrency(gross - ded)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Monthly Payroll</h3>
            <Button size="sm" onClick={() => setShowPayrollDialog(true)}>
              <Calculator className="w-4 h-4 mr-1" /> Run Payroll
            </Button>
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
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Present</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.profile?.full_name || 'Unknown'}</TableCell>
                      <TableCell className="text-sm">{MONTHS[p.month - 1]} {p.year}</TableCell>
                      <TableCell className="text-right text-sm hidden sm:table-cell">{p.present_days}/{p.working_days}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-emerald-600">{formatCurrency(Number(p.net_salary))}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.status === 'draft' && (
                          <Button size="sm" variant="outline" onClick={() => approvePayroll(p.id)}>
                            Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Salary Dialog */}
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

      {/* Run Payroll Dialog */}
      <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Monthly Payroll</DialogTitle>
            <DialogDescription>Generate payroll based on attendance and salary structures</DialogDescription>
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
    </div>
  );
}
