import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Wallet, Download, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import SalarySlipPDF from '@/components/SalarySlipPDF';
import AppLayout from '@/components/AppLayout';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatCurrency = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function MyPayslips() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('Company');
  const [showSlip, setShowSlip] = useState(false);
  const [slipData, setSlipData] = useState<any>(null);

  useEffect(() => {
    if (user) fetchPayslips();
  }, [user]);

  const [brandColor, setBrandColor] = useState<string | null>(null);

  const fetchPayslips = async () => {
    setLoading(true);
    // Fetch payroll + actual company name from companies table via profile
    const companyId = profile?.company_id;
    const [payrollRes, companyRes] = await Promise.all([
      supabase.from('payroll_runs').select('*')
        .eq('user_id', user!.id)
        .in('status', ['approved', 'processed'])
        .order('year', { ascending: false })
        .order('month', { ascending: false }),
      companyId
        ? supabase.from('companies').select('name, brand_color').eq('id', companyId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (companyRes.data) {
      setCompanyName(companyRes.data.name);
      setBrandColor(companyRes.data.brand_color);
    }
    setPayslips(payrollRes.data || []);
    setLoading(false);
  };

  const openSlip = (p: any) => {
    setSlipData({
      employeeName: profile?.full_name || 'Employee', department: profile?.department,
      email: profile?.email || '', month: p.month, year: p.year,
      workingDays: p.working_days, presentDays: p.present_days, leaveDays: p.leave_days, lopDays: p.lop_days || 0,
      overtimeHours: p.overtime_hours, basicSalary: Number(p.basic_salary), hra: Number(p.hra), da: 0,
      specialAllowance: Number(p.special_allowance), otherAllowances: Number(p.other_allowances),
      pfEmployee: Number(p.pf_employee), pfEmployer: Number(p.pf_employer),
      esiEmployee: Number(p.esi_employee), esiEmployer: Number(p.esi_employer),
      professionalTax: Number(p.professional_tax), tds: Number(p.tds),
      otherDeductions: Number(p.other_deductions_detail?.other) || 0,
      grossSalary: Number(p.gross_salary), totalDeductions: Number(p.total_deductions), netSalary: Number(p.net_salary),
      status: p.status, companyName, brandColor,
    });
    setShowSlip(true);
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> My Payslips
          </h1>
          <p className="text-sm text-muted-foreground">View and download your salary slips</p>
        </div>

        {payslips.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No payslips available yet</p>
            <p className="text-xs text-muted-foreground mt-1">Payslips appear here after your payroll is processed</p>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Working Days</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Present</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{MONTHS[p.month - 1]} {p.year}</TableCell>
                    <TableCell className="text-right text-sm hidden sm:table-cell">{p.working_days}</TableCell>
                    <TableCell className="text-right text-sm hidden sm:table-cell">{p.present_days}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(p.gross_salary))}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{formatCurrency(Number(p.total_deductions))}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-success">{formatCurrency(Number(p.net_salary))}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openSlip(p)}>
                        <Download className="w-3 h-3 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <SalarySlipPDF data={slipData} open={showSlip} onOpenChange={setShowSlip} />
    </AppLayout>
  );
}
