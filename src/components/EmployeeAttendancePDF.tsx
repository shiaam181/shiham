import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  status: string;
  notes: string | null;
  overtime_minutes: number | null;
}

export default function EmployeeAttendancePDF() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(false);

  const exportToPDF = async () => {
    if (!user || !profile) return;

    setIsLoading(true);
    try {
      const monthDate = parseISO(`${selectedMonth}-01`);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // Fetch attendance records for the selected month
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      // Fetch company settings
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      // Calculate stats
      const records: AttendanceRecord[] = attendanceData || [];
      const presentDays = records.filter(r => r.status === 'present').length;
      const absentDays = records.filter(r => r.status === 'absent').length;
      const leaveDays = records.filter(r => r.status === 'leave').length;
      const totalOvertimeMinutes = records.reduce((acc, r) => acc + (r.overtime_minutes || 0), 0);

      const reportDate = format(new Date(), 'MMMM d, yyyy h:mm a');
      const reportPeriod = format(monthDate, 'MMMM yyyy');
      const companyName = companySettings?.company_name || 'AttendanceHub';
      const tagline = companySettings?.tagline || 'Employee Attendance Management System';

      // Generate PDF HTML
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: 'Error',
          description: 'Please allow popups to download PDF',
          variant: 'destructive',
        });
        return;
      }

      const formatTime = (timestamp: string | null) => {
        if (!timestamp) return '-';
        return format(new Date(timestamp), 'hh:mm a');
      };

      const formatLocation = (lat: number | null, lng: number | null) => {
        if (lat === null || lng === null) return '-';
        return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color: #1a56db; text-decoration: none;">${lat.toFixed(4)}, ${lng.toFixed(4)} 📍</a>`;
      };

      const formatDuration = (minutes: number | null) => {
        if (!minutes || minutes <= 0) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      };

      const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
          present: 'background: #d1fae5; color: #059669;',
          absent: 'background: #fee2e2; color: #dc2626;',
          leave: 'background: #dbeafe; color: #2563eb;',
          holiday: 'background: #fef3c7; color: #d97706;',
        };
        return `<span style="padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; ${styles[status] || ''}">${status.toUpperCase()}</span>`;
      };

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Attendance Report - ${profile.full_name} - ${reportPeriod}</title>
            <style>
              * { box-sizing: border-box; }
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a2e; line-height: 1.5; font-size: 12px; }
              
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a56db; padding-bottom: 20px; margin-bottom: 25px; }
              .company-info { }
              .company-name { font-size: 24px; font-weight: bold; color: #1a56db; margin: 0; }
              .company-tagline { font-size: 11px; color: #666; margin: 5px 0 0 0; }
              .report-meta { text-align: right; font-size: 11px; color: #666; }
              .report-title { font-size: 13px; font-weight: bold; color: #1a1a2e; margin-bottom: 5px; }
              
              .employee-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
              .info-item { }
              .info-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
              .info-value { font-size: 14px; font-weight: 600; color: #1a1a2e; }
              
              .summary-section { margin-bottom: 25px; }
              .summary-title { font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1a1a2e; }
              .summary-grid { display: flex; gap: 15px; }
              .summary-card { flex: 1; background: linear-gradient(135deg, #f8fafc 0%, #e8eef4 100%); padding: 15px; border-radius: 8px; text-align: center; }
              .summary-value { font-size: 22px; font-weight: bold; }
              .summary-label { font-size: 10px; color: #666; text-transform: uppercase; }
              .summary-value.success { color: #059669; }
              .summary-value.warning { color: #d97706; }
              .summary-value.danger { color: #dc2626; }
              .summary-value.info { color: #2563eb; }
              
              table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
              th { background: #1a56db; color: white; padding: 10px 8px; text-align: left; font-weight: 600; }
              td { border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
              tr:nth-child(even) { background: #f8fafc; }
              .text-center { text-align: center; }
              
              .footer { margin-top: 50px; page-break-inside: avoid; }
              .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
              .signature-box { width: 180px; text-align: center; }
              .signature-line { border-top: 2px solid #1a1a2e; padding-top: 8px; margin-top: 50px; }
              .signature-name { font-weight: 600; font-size: 11px; }
              .signature-title { font-size: 9px; color: #666; }
              
              .footer-note { text-align: center; font-size: 9px; color: #999; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
              
              @media print {
                body { padding: 15px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-info">
                <h1 class="company-name">${companyName}</h1>
                <p class="company-tagline">${tagline}</p>
              </div>
              <div class="report-meta">
                <div class="report-title">EMPLOYEE ATTENDANCE REPORT</div>
                <div>Generated: ${reportDate}</div>
                <div>Report ID: ATT-${format(new Date(), 'yyyyMMddHHmm')}</div>
              </div>
            </div>
            
            <div class="employee-info">
              <div class="info-item">
                <div class="info-label">Employee Name</div>
                <div class="info-value">${profile.full_name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Department</div>
                <div class="info-value">${profile.department || '-'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Position</div>
                <div class="info-value">${profile.position || '-'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Report Period</div>
                <div class="info-value">${reportPeriod}</div>
              </div>
            </div>
            
            <div class="summary-section">
              <div class="summary-title">Monthly Summary</div>
              <div class="summary-grid">
                <div class="summary-card">
                  <div class="summary-value success">${presentDays}</div>
                  <div class="summary-label">Present Days</div>
                </div>
                <div class="summary-card">
                  <div class="summary-value danger">${absentDays}</div>
                  <div class="summary-label">Absent Days</div>
                </div>
                <div class="summary-card">
                  <div class="summary-value info">${leaveDays}</div>
                  <div class="summary-label">Leave Days</div>
                </div>
                <div class="summary-card">
                  <div class="summary-value warning">${formatDuration(totalOvertimeMinutes)}</div>
                  <div class="summary-label">Total Overtime</div>
                </div>
              </div>
            </div>
            
            <div class="summary-title">Detailed Attendance Records</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th class="text-center">Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Check In Location</th>
                  <th>Check Out Location</th>
                  <th class="text-center">Overtime</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${records.length > 0 ? records.map(r => `
                  <tr>
                    <td><strong>${format(parseISO(r.date), 'dd MMM yyyy')}</strong></td>
                    <td>${format(parseISO(r.date), 'EEEE')}</td>
                    <td class="text-center">${getStatusBadge(r.status)}</td>
                    <td>${formatTime(r.check_in_time)}</td>
                    <td>${formatTime(r.check_out_time)}</td>
                    <td style="font-size: 10px;">${formatLocation(r.check_in_latitude, r.check_in_longitude)}</td>
                    <td style="font-size: 10px;">${formatLocation(r.check_out_latitude, r.check_out_longitude)}</td>
                    <td class="text-center">${formatDuration(r.overtime_minutes)}</td>
                    <td style="font-size: 10px;">${r.notes || '-'}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="9" class="text-center" style="padding: 30px; color: #666;">No attendance records found for this period</td>
                  </tr>
                `}
              </tbody>
            </table>
            
            <div class="footer">
              <div class="signature-section">
                <div class="signature-box">
                  <div class="signature-line">
                    <div class="signature-name">Employee Signature</div>
                    <div class="signature-title">${profile.full_name}</div>
                  </div>
                </div>
                <div class="signature-box">
                  <div class="signature-line">
                    <div class="signature-name">Verified By</div>
                    <div class="signature-title">HR Department</div>
                  </div>
                </div>
                <div class="signature-box">
                  <div class="signature-line">
                    <div class="signature-name">Approved By</div>
                    <div class="signature-title">Manager</div>
                  </div>
                </div>
              </div>
              
              <div class="footer-note">
                This is a computer-generated attendance report from ${companyName}. 
                For any discrepancies, please contact the HR department.
              </div>
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();

      toast({ title: 'Success', description: 'Attendance report PDF generated' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF report',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate month options for the last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button 
        onClick={exportToPDF} 
        disabled={isLoading}
        variant="outline"
        className="gap-2"
      >
        <FileText className="w-4 h-4" />
        {isLoading ? 'Generating...' : 'Download PDF'}
      </Button>
    </div>
  );
}
