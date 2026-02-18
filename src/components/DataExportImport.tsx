import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Loader2, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  /** If set, only export/import data for this company */
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

export default function DataExportImport({ companyId, companyName }: DataExportImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<ExportData | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportData: ExportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        scope: companyId ? 'company' : 'global',
        companyId,
        data: {
          profiles: [],
          attendance: [],
          leave_requests: [],
          holidays: [],
          shifts: [],
          week_offs: [],
          companies: [],
          company_settings: [],
          user_roles: [],
          system_settings: [],
        },
      };

      if (companyId) {
        // Company-scoped export
        const [profiles, companies] = await Promise.all([
          supabase.from('profiles').select('*').eq('company_id', companyId),
          supabase.from('companies').select('*').eq('id', companyId),
        ]);
        exportData.data.profiles = profiles.data || [];
        exportData.data.companies = companies.data || [];

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

        const [holidays, shifts, companySettings] = await Promise.all([
          supabase.from('holidays').select('*'),
          supabase.from('shifts').select('*'),
          supabase.from('company_settings').select('*'),
        ]);
        exportData.data.holidays = holidays.data || [];
        exportData.data.shifts = shifts.data || [];
        exportData.data.company_settings = companySettings.data || [];
      } else {
        // Global export — all data
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

      // Download as JSON
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

      const totalRecords = Object.values(exportData.data).reduce((sum, arr) => sum + arr.length, 0);
      toast({
        title: 'Export Complete',
        description: `Exported ${totalRecords} records successfully`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export data',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as ExportData;
        if (!data.version || !data.data) {
          throw new Error('Invalid backup file format');
        }
        setPendingImportData(data);
        setImportConfirmOpen(true);
      } catch (err: any) {
        toast({
          title: 'Invalid File',
          description: err.message || 'Could not parse backup file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!pendingImportData) return;
    setImportConfirmOpen(false);
    setImporting(true);
    setImportResult(null);

    const d = pendingImportData.data;
    let imported = 0;
    let errors: string[] = [];

    try {
      // Import in dependency order: companies → shifts → profiles → roles → rest
      if (d.companies?.length) {
        const { error } = await supabase.from('companies').upsert(d.companies, { onConflict: 'id' });
        if (error) errors.push(`Companies: ${error.message}`);
        else imported += d.companies.length;
      }

      if (d.shifts?.length) {
        const { error } = await supabase.from('shifts').upsert(d.shifts, { onConflict: 'id' });
        if (error) errors.push(`Shifts: ${error.message}`);
        else imported += d.shifts.length;
      }

      if (d.company_settings?.length) {
        const { error } = await supabase.from('company_settings').upsert(d.company_settings, { onConflict: 'id' });
        if (error) errors.push(`Company Settings: ${error.message}`);
        else imported += d.company_settings.length;
      }

      if (d.profiles?.length) {
        const { error } = await supabase.from('profiles').upsert(d.profiles, { onConflict: 'id' });
        if (error) errors.push(`Profiles: ${error.message}`);
        else imported += d.profiles.length;
      }

      if (d.user_roles?.length) {
        const { error } = await supabase.from('user_roles').upsert(d.user_roles, { onConflict: 'id' });
        if (error) errors.push(`Roles: ${error.message}`);
        else imported += d.user_roles.length;
      }

      if (d.holidays?.length) {
        const { error } = await supabase.from('holidays').upsert(d.holidays, { onConflict: 'id' });
        if (error) errors.push(`Holidays: ${error.message}`);
        else imported += d.holidays.length;
      }

      if (d.week_offs?.length) {
        const { error } = await supabase.from('week_offs').upsert(d.week_offs, { onConflict: 'id' });
        if (error) errors.push(`Week Offs: ${error.message}`);
        else imported += d.week_offs.length;
      }

      if (d.attendance?.length) {
        // Import in batches of 500
        for (let i = 0; i < d.attendance.length; i += 500) {
          const batch = d.attendance.slice(i, i + 500);
          const { error } = await supabase.from('attendance').upsert(batch, { onConflict: 'id' });
          if (error) {
            errors.push(`Attendance batch ${i}: ${error.message}`);
            break;
          }
          imported += batch.length;
        }
      }

      if (d.leave_requests?.length) {
        const { error } = await supabase.from('leave_requests').upsert(d.leave_requests, { onConflict: 'id' });
        if (error) errors.push(`Leave Requests: ${error.message}`);
        else imported += d.leave_requests.length;
      }

      if (d.system_settings?.length) {
        const { error } = await supabase.from('system_settings').upsert(d.system_settings, { onConflict: 'key' });
        if (error) errors.push(`System Settings: ${error.message}`);
        else imported += d.system_settings.length;
      }

      if (errors.length > 0) {
        setImportResult(`Imported ${imported} records with ${errors.length} errors: ${errors.join('; ')}`);
        toast({
          title: 'Import Partial',
          description: `${imported} records imported, ${errors.length} errors occurred`,
          variant: 'destructive',
        });
      } else {
        setImportResult(`Successfully imported ${imported} records`);
        toast({
          title: 'Import Complete',
          description: `${imported} records imported successfully`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import data',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setPendingImportData(null);
    }
  };

  const scope = companyId ? `${companyName || 'this company'}` : 'all companies';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Backup & Restore
          </CardTitle>
          <CardDescription>
            Export data for <strong>{scope}</strong> as a backup, or import a previously exported backup file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
              <span>
                Your data is <strong>automatically safe</strong> across app updates. Use this only if you want
                an offline backup or need to migrate data between environments.
              </span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleExport} disabled={exporting} className="flex-1">
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {exporting ? 'Exporting...' : 'Export Data'}
            </Button>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex-1"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {importing ? 'Importing...' : 'Import Data'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {importResult && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
              <span>{importResult}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Confirmation */}
      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Import Backup Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will restore data from a backup file exported on{' '}
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
