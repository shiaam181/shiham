import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Employee {
  user_id: string;
  full_name: string;
  department: string | null;
  employee_code: string | null;
}

interface BulkAttendanceCorrectionProps {
  onComplete?: () => void;
}

export default function BulkAttendanceCorrection({ onComplete }: BulkAttendanceCorrectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState('present');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, department, employee_code')
        .eq('is_active', true)
        .order('full_name');
      setEmployees(data || []);
    };
    fetch();
  }, []);

  const filtered = employees.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return e.full_name.toLowerCase().includes(s) || e.department?.toLowerCase().includes(s) || e.employee_code?.toLowerCase().includes(s);
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.user_id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast({ title: 'No employees selected', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const records = Array.from(selected).map(userId => ({
        user_id: userId,
        date,
        status,
        notes: notes || null,
        admin_notes: `Bulk correction by admin on ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
        modified_by: user?.id || null,
      }));

      // Upsert - if attendance exists for that date, update; otherwise insert
      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'user_id,date' });

      if (error) throw error;

      toast({
        title: 'Bulk Update Complete',
        description: `Updated attendance for ${selected.size} employee${selected.size > 1 ? 's' : ''} on ${format(new Date(date), 'dd MMM yyyy')}`,
      });
      setSelected(new Set());
      setNotes('');
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-primary" />
          Bulk Attendance Correction
        </CardTitle>
        <CardDescription className="text-xs">Mark attendance for multiple employees at once</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="sm:w-44" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="leave">Leave</SelectItem>
              <SelectItem value="half_day">Half Day</SelectItem>
              <SelectItem value="week_off">Week Off</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Admin notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="flex-1" />
        </div>

        {/* Employee list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs h-8 text-xs"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={toggleAll}>
                {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Badge variant="secondary" className="text-[10px]">{selected.size} selected</Badge>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
            {filtered.map(emp => (
              <label
                key={emp.user_id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(emp.user_id)}
                  onCheckedChange={() => toggle(emp.user_id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{emp.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[emp.department, emp.employee_code].filter(Boolean).join(' · ') || 'No department'}
                  </p>
                </div>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No employees found</p>
            )}
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={loading || selected.size === 0} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Apply to {selected.size} Employee{selected.size !== 1 ? 's' : ''}
        </Button>
      </CardContent>
    </Card>
  );
}
