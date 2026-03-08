import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Loader2, Database, AlertTriangle, CheckCircle2, FileSpreadsheet, Table2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DataExportImportProps {
  companyId?: string;
  companyName?: string;
}

interface ExportData {
  exportedAt: string;
  version: '1.0';
  scope: 'global' | 'company';
  companyId?: string;
  data: {
    profiles: any[];
    attendance: any[];
    leave_requests: any[];
    holidays: any[];
    shifts: any[];
    week_offs: any[];
    companies: any[];
    company_settings: any[];
    user_roles: any[];
    system_settings: any[];
  };
}

const CSV_EXPORT_TABLES = [
  { name: 'profiles', label: 'Employees', icon: '👤' },
  { name: 'attendance', label: 'Attendance', icon: '📋' },
  { name: 'leave_requests', label: 'Leave Requests', icon: '🏖️' },
  { name: 'holidays', label: 'Holidays', icon: '🎉' },
  { name: 'shifts', label: 'Shifts', icon: '⏰' },
  { name: 'salary_structures', label: 'Salary Structures', icon: '💰' },
  { name: 'payroll_runs', label: 'Payroll Runs', icon: '📊' },
  { name: 'leave_balances', label: 'Leave Balances', icon: '📅' },
] as const;

type ExportTableName = typeof CSV_EXPORT_TABLES[number]['name'];

function arrayToCsv(data: Record<string, any>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DataExportImport({ companyId, companyName }: DataExportImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<ExportData | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [csvExportTable, setCsvExportTable] = useState<ExportTableName | ''>('');
  const [csvExporting, setCsvExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    try {
      const exportData: ExportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        scope: companyId ? 'company' : 'global',
        companyId,
        data: {
          profiles: [], attendance: [], leave_requests: [], holidays: [],
          shifts: [], week_offs: [], companies: [], company_settings: [],
          user_roles: [], system_settings: [],
        },
      };

      setProgress(10);

      if (companyId) {
        const [profiles, companies] = await Promise.all([
          supabase.from('profiles').select('*').eq('company_id', companyId),
          supabase.from('companies').select('*').eq('id', companyId),
        ]);
        exportData.data.profiles = profiles.data || [];
        exportData.data.companies = companies.data || [];
        setProgress(40);

        const userIds = exportData.data.profiles.map(p => p.user_id);
        if (userIds.length > 0) {
          const [attendance, leaves, roles, weekOffs] = await Promise.all([
            supabase.from('attendance').select('*').in('user_id', userIds),
            supabase.from('leave_requests').select('*').in('user_id', userIds),
            supabase.from('user_roles').select('*').in('user_id', userIds),
            supabase.from('week_offs').select('*').or(`is_global.eq.true,user_id.in.(${userIds.join(',')})`),
          ]);
          exportData.data.attendance = attendance.data || [];
          exportData.data.leave_requests = leaves.data || [];
          exportData.data.user_roles = roles.data || [];
          exportData.data.week_offs = weekOffs.data || [];
        }
        setProgress(70);

        const [holidays, shifts, companySettings] = await Promise.all([
          supabase.from('holidays').select('*'),
          supabase.from('shifts').select('*'),
          supabase.from('company_settings').select('*'),
        ]);
        exportData.data.holidays = holidays.data || [];
        exportData.data.shifts = shifts.data || [];
        exportData.data.company_settings = companySettings.data || [];
      } else {
        const [profiles, attendance, leaves, holidays, shifts, weekOffs, companies, companySettings, roles, settings] =
          await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('attendance').select('*'),
            supabase.from('leave_requests').select('*'),
            supabase.from('holidays').select('*'),
            supabase.from('shifts').select('*'),
            supabase.from('week_offs').select('*'),
            supabase.from('companies').select('*'),
            supabase.from('company_settings').select('*'),
            supabase.from('user_roles').select('*'),
            supabase.from('system_settings').select('*'),
          ]);
        exportData.data.profiles = profiles.data || [];
        exportData.data.attendance = attendance.data || [];
        exportData.data.leave_requests = leaves.data || [];
        exportData.data.holidays = holidays.data || [];
        exportData.data.shifts = shifts.data || [];
        exportData.data.week_offs = weekOffs.data || [];
        exportData.data.companies = companies.data || [];
        exportData.data.company_settings = companySettings.data || [];
        exportData.data.user_roles = roles.data || [];
        exportData.data.system_settings = settings.data || [];
      }

      setProgress(90);

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = companyId
        ? `backup-${companyName || 'company'}-${dateStr}.json`
        : `backup-all-data-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      const totalRecords = Object.values(exportData.data).reduce((sum, arr) => sum + arr.length, 0);
      toast({ title: 'Export Complete', description: `Exported ${totalRecords} records successfully` });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({ title: 'Export Failed', description: error.message || 'Failed to export data', variant: 'destructive' });
    } finally {
      setExporting(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleCsvExport = async () => {
    if (!csvExportTable) return;
    setCsvExporting(true);
    setProgress(0);
    try {
      setProgress(20);
      let query;
      if (companyId && ['profiles', 'salary_structures', 'payroll_runs', 'leave_balances'].includes(csvExportTable)) {
        if (csvExportTable === 'profiles') {
          query = supabase.from('profiles').select('*').eq('company_id', companyId);
        } else {
          // For other tables, get user_ids from profiles first
          const { data: companyProfiles } = await supabase.from('profiles').select('user_id').eq('company_id', companyId);
          const userIds = companyProfiles?.map(p => p.user_id) || [];
          if (userIds.length === 0) {
            toast({ title: 'No Data', description: 'No employees found for this company' });
            return;
          }
          query = supabase.from(csvExportTable as any).select('*').in('user_id', userIds);
        }
      } else if (companyId && csvExportTable === 'attendance') {
        const { data: companyProfiles } = await supabase.from('profiles').select('user_id').eq('company_id', companyId);
        const userIds = companyProfiles?.map(p => p.user_id) || [];
        query = supabase.from('attendance').select('*').in('user_id', userIds);
      } else if (companyId && csvExportTable === 'leave_requests') {
        const { data: companyProfiles } = await supabase.from('profiles').select('user_id').eq('company_id', companyId);
        const userIds = companyProfiles?.map(p => p.user_id) || [];
        query = supabase.from('leave_requests').select('*').in('user_id', userIds);
      } else {
        query = supabase.from(csvExportTable as any).select('*');
      }

      setProgress(50);
      const { data, error } = await query;
      if (error) throw error;

      setProgress(80);
      if (!data || data.length === 0) {
        toast({ title: 'No Data', description: `No records found in ${csvExportTable}` });
        return;
      }

      const csv = arrayToCsv(data);
      const dateStr = new Date().toISOString().slice(0, 10);
      const prefix = companyId ? (companyName || 'company') : 'all';
      downloadFile(csv, `${prefix}-${csvExportTable}-${dateStr}.csv`, 'text/csv');

      setProgress(100);
      toast({ title: 'CSV Export Complete', description: `Exported ${data.length} records from ${csvExportTable}` });
    } catch (error: any) {
      toast({ title: 'CSV Export Failed', description: error.message, variant: 'destructive' });
    } finally {
      setCsvExporting(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as ExportData;
        if (!data.version || !data.data) throw new Error('Invalid backup file format');
        setPendingImportData(data);
        setImportConfirmOpen(true);
      } catch (err: any) {
        toast({ title: 'Invalid File', description: err.message || 'Could not parse backup file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!pendingImportData) return;
    setImportConfirmOpen(false);
    setImporting(true);
    setImportResult(null);
    setProgress(0);

    const d = pendingImportData.data;
    let imported = 0;
    let errors: string[] = [];
    const steps = 10;
    let step = 0;

    const tick = () => { step++; setProgress(Math.round((step / steps) * 100)); };

    try {
      if (d.companies?.length) {
        const { error } = await supabase.from('companies').upsert(d.companies, { onConflict: 'id' });
        if (error) errors.push(`Companies: ${error.message}`); else imported += d.companies.length;
      }
      tick();

      if (d.shifts?.length) {
        const { error } = await supabase.from('shifts').upsert(d.shifts, { onConflict: 'id' });
        if (error) errors.push(`Shifts: ${error.message}`); else imported += d.shifts.length;
      }
      tick();

      if (d.company_settings?.length) {
        const { error } = await supabase.from('company_settings').upsert(d.company_settings, { onConflict: 'id' });
        if (error) errors.push(`Company Settings: ${error.message}`); else imported += d.company_settings.length;
      }
      tick();

      if (d.profiles?.length) {
        const { error } = await supabase.from('profiles').upsert(d.profiles, { onConflict: 'id' });
        if (error) errors.push(`Profiles: ${error.message}`); else imported += d.profiles.length;
      }
      tick();

      if (d.user_roles?.length) {
        const { error } = await supabase.from('user_roles').upsert(d.user_roles, { onConflict: 'id' });
        if (error) errors.push(`Roles: ${error.message}`); else imported += d.user_roles.length;
      }
      tick();

      if (d.holidays?.length) {
        const { error } = await supabase.from('holidays').upsert(d.holidays, { onConflict: 'id' });
        if (error) errors.push(`Holidays: ${error.message}`); else imported += d.holidays.length;
      }
      tick();

      if (d.week_offs?.length) {
        const { error } = await supabase.from('week_offs').upsert(d.week_offs, { onConflict: 'id' });
        if (error) errors.push(`Week Offs: ${error.message}`); else imported += d.week_offs.length;
      }
      tick();

      if (d.attendance?.length) {
        for (let i = 0; i < d.attendance.length; i += 500) {
          const batch = d.attendance.slice(i, i + 500);
          const { error } = await supabase.from('attendance').upsert(batch, { onConflict: 'id' });
          if (error) { errors.push(`Attendance batch ${i}: ${error.message}`); break; }
          imported += batch.length;
        }
      }
      tick();

      if (d.leave_requests?.length) {
        const { error } = await supabase.from('leave_requests').upsert(d.leave_requests, { onConflict: 'id' });
        if (error) errors.push(`Leave Requests: ${error.message}`); else imported += d.leave_requests.length;
      }
      tick();

      if (d.system_settings?.length) {
        const { error } = await supabase.from('system_settings').upsert(d.system_settings, { onConflict: 'key' });
        if (error) errors.push(`System Settings: ${error.message}`); else imported += d.system_settings.length;
      }
      tick();

      if (errors.length > 0) {
        setImportResult(`Imported ${imported} records with ${errors.length} errors: ${errors.join('; ')}`);
        toast({ title: 'Import Partial', description: `${imported} records imported, ${errors.length} errors`, variant: 'destructive' });
      } else {
        setImportResult(`Successfully imported ${imported} records`);
        toast({ title: 'Import Complete', description: `${imported} records imported successfully` });
      }
    } catch (error: any) {
      toast({ title: 'Import Failed', description: error.message || 'Failed to import data', variant: 'destructive' });
    } finally {
      setImporting(false);
      setPendingImportData(null);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const scope = companyId ? `${companyName || 'this company'}` : 'all companies';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Backup & Export
          </CardTitle>
          <CardDescription>
            Export data for <strong>{scope}</strong> as JSON backup or CSV for individual tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(exporting || importing || csvExporting) && progress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{exporting ? 'Exporting...' : importing ? 'Importing...' : 'Exporting CSV...'}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Tabs defaultValue="backup" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="backup" className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                Full Backup
              </TabsTrigger>
              <TabsTrigger value="csv" className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV Export
              </TabsTrigger>
            </TabsList>

            <TabsContent value="backup" className="space-y-4 mt-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
                  <span>
                    Your data is <strong>automatically safe</strong> across app updates. Use this only for
                    offline backups or data migration.
                  </span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleExport} disabled={exporting} className="flex-1">
                  {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  {exporting ? 'Exporting...' : 'Export JSON Backup'}
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex-1">
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {importing ? 'Importing...' : 'Restore from Backup'}
                </Button>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
              </div>
            </TabsContent>

            <TabsContent value="csv" className="space-y-4 mt-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <Table2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  <span>
                    Export individual tables as CSV files for use in Excel, Google Sheets, or other tools.
                  </span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={csvExportTable} onValueChange={(v) => setCsvExportTable(v as ExportTableName)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a table to export..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CSV_EXPORT_TABLES.map(t => (
                      <SelectItem key={t.name} value={t.name}>
                        <span className="flex items-center gap-2">
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleCsvExport} disabled={csvExporting || !csvExportTable}>
                  {csvExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                  {csvExporting ? 'Exporting...' : 'Export CSV'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CSV_EXPORT_TABLES.map(t => (
                  <Badge
                    key={t.name}
                    variant={csvExportTable === t.name ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setCsvExportTable(t.name)}
                  >
                    {t.icon} {t.label}
                  </Badge>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {importResult && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span>{importResult}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Import Backup Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Restoring backup from{' '}
                <strong>{pendingImportData?.exportedAt ? new Date(pendingImportData.exportedAt).toLocaleString() : 'unknown'}</strong>.
              </p>
              <p>
                Scope: <strong>{pendingImportData?.scope === 'company' ? 'Single Company' : 'All Companies (Global)'}</strong>
              </p>
              <p className="text-destructive font-medium">
                Existing records with matching IDs will be overwritten.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>
              <Upload className="w-4 h-4 mr-2" />
              Confirm Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
