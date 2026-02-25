import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { BarChart3, Download, Loader2, IndianRupee } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface PayrollSummary {
  user_id: string;
  employee_name: string;
  department: string | null;
  pf_employee: number;
  pf_employer: number;
  esi_employee: number;
  esi_employer: number;
  professional_tax: number;
  gross_salary: number;
}

export default function ComplianceReports() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<PayrollSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    const [payrollRes, profileRes] = await Promise.all([
      supabase.from('payroll_runs').select('user_id, pf_employee, pf_employer, esi_employee, esi_employer, professional_tax, gross_salary')
        .eq('month', month).eq('year', year).in('status', ['approved', 'processed']),
      supabase.from('profiles').select('user_id, full_name, department').eq('is_active', true),
    ]);

    const profiles = profileRes.data || [];
    const mapped = (payrollRes.data || []).map(p => ({
      ...p,
      employee_name: profiles.find(pr => pr.user_id === p.user_id)?.full_name || 'Unknown',
      department: profiles.find(pr => pr.user_id === p.user_id)?.department || null,
    }));
    setData(mapped as PayrollSummary[]);
    setLoading(false);
  };

  const totals = data.reduce((acc, d) => ({
    pf_employee: acc.pf_employee + Number(d.pf_employee || 0),
    pf_employer: acc.pf_employer + Number(d.pf_employer || 0),
    esi_employee: acc.esi_employee + Number(d.esi_employee || 0),
    esi_employer: acc.esi_employer + Number(d.esi_employer || 0),
    pt: acc.pt + Number(d.professional_tax || 0),
  }), { pf_employee: 0, pf_employer: 0, esi_employee: 0, esi_employer: 0, pt: 0 });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const exportCSV = (type: string) => {
    let csv = '';
    if (type === 'pf') {
      csv = 'Employee,Department,PF Employee,PF Employer,Total PF\n';
      data.filter(d => Number(d.pf_employee) > 0).forEach(d => {
        csv += `"${d.employee_name}","${d.department || ''}",${d.pf_employee},${d.pf_employer},${Number(d.pf_employee) + Number(d.pf_employer)}\n`;
      });
    } else if (type === 'esi') {
      csv = 'Employee,Department,ESI Employee,ESI Employer,Total ESI\n';
      data.filter(d => Number(d.esi_employee) > 0).forEach(d => {
        csv += `"${d.employee_name}","${d.department || ''}",${d.esi_employee},${d.esi_employer},${Number(d.esi_employee) + Number(d.esi_employer)}\n`;
      });
    } else {
      csv = 'Employee,Department,Professional Tax\n';
      data.filter(d => Number(d.professional_tax) > 0).forEach(d => {
        csv += `"${d.employee_name}","${d.department || ''}",${d.professional_tax}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_report_${MONTHS[month - 1]}_${year}.csv`;
    a.click();
  };

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> Compliance Reports
            </h1>
            <p className="text-sm text-muted-foreground">PF, ESI & PT contribution summaries</p>
          </div>
          <div className="flex gap-2">
            <select className="border rounded px-2 py-1 text-sm bg-background" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <Input type="number" className="w-20" value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-3 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase">PF (Employee)</p>
            <p className="text-lg font-bold">{fmt(totals.pf_employee)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-primary/60">
            <p className="text-[10px] text-muted-foreground uppercase">PF (Employer)</p>
            <p className="text-lg font-bold">{fmt(totals.pf_employer)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-success">
            <p className="text-[10px] text-muted-foreground uppercase">ESI (Employee)</p>
            <p className="text-lg font-bold">{fmt(totals.esi_employee)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-success/60">
            <p className="text-[10px] text-muted-foreground uppercase">ESI (Employer)</p>
            <p className="text-lg font-bold">{fmt(totals.esi_employer)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-warning">
            <p className="text-[10px] text-muted-foreground uppercase">Prof. Tax</p>
            <p className="text-lg font-bold">{fmt(totals.pt)}</p>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="pf">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pf">PF Report</TabsTrigger>
              <TabsTrigger value="esi">ESI Report</TabsTrigger>
              <TabsTrigger value="pt">PT Report</TabsTrigger>
            </TabsList>

            <TabsContent value="pf" className="mt-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => exportCSV('pf')}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">PF (Employee)</TableHead>
                      <TableHead className="text-right">PF (Employer)</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.filter(d => Number(d.pf_employee) > 0).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No PF data for this period</TableCell></TableRow>
                    ) : data.filter(d => Number(d.pf_employee) > 0).map(d => (
                      <TableRow key={d.user_id}>
                        <TableCell className="font-medium text-sm">{d.employee_name}</TableCell>
                        <TableCell className="text-sm">{d.department || '-'}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(Number(d.pf_employee))}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(Number(d.pf_employer))}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{fmt(Number(d.pf_employee) + Number(d.pf_employer))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="esi" className="mt-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => exportCSV('esi')}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">ESI (Employee)</TableHead>
                      <TableHead className="text-right">ESI (Employer)</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.filter(d => Number(d.esi_employee) > 0).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No ESI data for this period</TableCell></TableRow>
                    ) : data.filter(d => Number(d.esi_employee) > 0).map(d => (
                      <TableRow key={d.user_id}>
                        <TableCell className="font-medium text-sm">{d.employee_name}</TableCell>
                        <TableCell className="text-sm">{d.department || '-'}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(Number(d.esi_employee))}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(Number(d.esi_employer))}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{fmt(Number(d.esi_employee) + Number(d.esi_employer))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pt" className="mt-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => exportCSV('pt')}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Professional Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.filter(d => Number(d.professional_tax) > 0).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No PT data for this period</TableCell></TableRow>
                    ) : data.filter(d => Number(d.professional_tax) > 0).map(d => (
                      <TableRow key={d.user_id}>
                        <TableCell className="font-medium text-sm">{d.employee_name}</TableCell>
                        <TableCell className="text-sm">{d.department || '-'}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{fmt(Number(d.professional_tax))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </AppLayout>
  );
}
