import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Calendar, 
  Plus, 
  Trash2,
  Globe,
  User
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface WeekOff {
  id: string;
  day_of_week: number;
  user_id: string | null;
  is_global: boolean;
}

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  department: string | null;
}

export default function WeekOffManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [weekOffs, setWeekOffs] = useState<WeekOff[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [employeeDays, setEmployeeDays] = useState<number[]>([]);

  const fetchData = async () => {
    try {
      const [weekOffsRes, employeesRes] = await Promise.all([
        supabase.from('week_offs').select('*').order('day_of_week'),
        supabase.from('profiles').select('id, user_id, full_name, department').eq('is_active', true).order('full_name'),
      ]);

      if (weekOffsRes.error) throw weekOffsRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setWeekOffs(weekOffsRes.data || []);
      setEmployees(employeesRes.data || []);

      // Set global week offs for the form
      const globalDays = (weekOffsRes.data || [])
        .filter(w => w.is_global)
        .map(w => w.day_of_week);
      setSelectedDays(globalDays);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load week off data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveGlobalWeekOffs = async () => {
    try {
      // Delete existing global week offs
      await supabase.from('week_offs').delete().eq('is_global', true);

      // Insert new global week offs
      if (selectedDays.length > 0) {
        const inserts = selectedDays.map(day => ({
          day_of_week: day,
          is_global: true,
          user_id: null,
        }));

        const { error } = await supabase.from('week_offs').insert(inserts);
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Global week offs updated',
      });

      setShowDialog(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving week offs:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save week offs',
        variant: 'destructive',
      });
    }
  };

  const handleOpenEmployeeDialog = (userId: string) => {
    setSelectedEmployee(userId);
    const empWeekOffs = weekOffs
      .filter(w => w.user_id === userId)
      .map(w => w.day_of_week);
    setEmployeeDays(empWeekOffs);
    setShowEmployeeDialog(true);
  };

  const handleSaveEmployeeWeekOffs = async () => {
    try {
      // Delete existing employee week offs
      await supabase.from('week_offs').delete().eq('user_id', selectedEmployee);

      // Insert new employee week offs
      if (employeeDays.length > 0) {
        const inserts = employeeDays.map(day => ({
          day_of_week: day,
          is_global: false,
          user_id: selectedEmployee,
        }));

        const { error } = await supabase.from('week_offs').insert(inserts);
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Employee week offs updated',
      });

      setShowEmployeeDialog(false);
      setSelectedEmployee('');
      setEmployeeDays([]);
      fetchData();
    } catch (error: any) {
      console.error('Error saving employee week offs:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save week offs',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEmployeeWeekOff = async (id: string) => {
    try {
      const { error } = await supabase.from('week_offs').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Week off removed',
      });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting week off:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove week off',
        variant: 'destructive',
      });
    }
  };

  const getDayName = (day: number) => {
    return DAYS_OF_WEEK.find(d => d.value === day)?.label || 'Unknown';
  };

  const getEmployeeName = (userId: string | null) => {
    if (!userId) return 'Global';
    return employees.find(e => e.user_id === userId)?.full_name || 'Unknown';
  };

  const globalWeekOffs = weekOffs.filter(w => w.is_global);
  const employeeWeekOffs = weekOffs.filter(w => !w.is_global);

  // Group employee week offs by user
  const employeeWeekOffsByUser: Record<string, WeekOff[]> = {};
  employeeWeekOffs.forEach(w => {
    if (w.user_id) {
      if (!employeeWeekOffsByUser[w.user_id]) {
        employeeWeekOffsByUser[w.user_id] = [];
      }
      employeeWeekOffsByUser[w.user_id].push(w);
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-lg">Weekly Off Management</h1>
                  <p className="text-xs text-muted-foreground">Configure global and employee-specific week offs</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Global Week Offs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Global Weekly Offs
              </CardTitle>
              <CardDescription>These days apply to all employees</CardDescription>
            </div>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </CardHeader>
          <CardContent>
            {globalWeekOffs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No global week offs configured. Click "Configure" to set up weekly off days.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {globalWeekOffs
                  .sort((a, b) => a.day_of_week - b.day_of_week)
                  .map((weekOff) => (
                    <Badge key={weekOff.id} variant="week-off" className="text-sm py-2 px-4">
                      {getDayName(weekOff.day_of_week)}
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee-Specific Week Offs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Employee-Specific Week Offs
            </CardTitle>
            <CardDescription>Override global week offs for specific employees</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Custom Week Offs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const empWeekOffs = employeeWeekOffsByUser[employee.user_id] || [];
                  
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>
                        {empWeekOffs.length === 0 ? (
                          <span className="text-muted-foreground">Using global settings</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {empWeekOffs
                              .sort((a, b) => a.day_of_week - b.day_of_week)
                              .map((w) => (
                                <Badge key={w.id} variant="secondary" className="text-xs">
                                  {getDayName(w.day_of_week)}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEmployeeDialog(employee.user_id)}
                        >
                          Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Global Week Offs Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Global Week Offs</DialogTitle>
            <DialogDescription>
              Select the days that should be weekly offs for all employees
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-3 py-4">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`global-day-${day.value}`}
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedDays([...selectedDays, day.value]);
                    } else {
                      setSelectedDays(selectedDays.filter(d => d !== day.value));
                    }
                  }}
                />
                <Label htmlFor={`global-day-${day.value}`} className="cursor-pointer">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGlobalWeekOffs}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Week Offs Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Employee Week Offs</DialogTitle>
            <DialogDescription>
              {employees.find(e => e.user_id === selectedEmployee)?.full_name} - Select custom week off days
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Leave unchecked to use global settings. Check days to override with custom week offs.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`emp-day-${day.value}`}
                    checked={employeeDays.includes(day.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setEmployeeDays([...employeeDays, day.value]);
                      } else {
                        setEmployeeDays(employeeDays.filter(d => d !== day.value));
                      }
                    }}
                  />
                  <Label htmlFor={`emp-day-${day.value}`} className="cursor-pointer">
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEmployeeWeekOffs}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
