import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Clock, 
  Plus, 
  Edit2, 
  Trash2,
  Users,
  Star
} from 'lucide-react';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  is_default: boolean;
}

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  department: string | null;
  shift_id: string | null;
}

export default function ShiftManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const fromDeveloper = location.state?.from === 'developer';
  
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '18:00',
    grace_period_minutes: 15,
    is_default: false,
  });

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time');

      if (error) throw error;
      setShifts(data || []);
    } catch (error: any) {
      console.error('Error fetching shifts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load shifts',
        variant: 'destructive',
      });
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, department, shift_id')
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchEmployees();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingShift) {
        const { error } = await supabase
          .from('shifts')
          .update({
            name: formData.name,
            start_time: formData.start_time,
            end_time: formData.end_time,
            grace_period_minutes: formData.grace_period_minutes,
            is_default: formData.is_default,
          })
          .eq('id', editingShift.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Shift updated successfully' });
      } else {
        const { error } = await supabase.from('shifts').insert({
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          grace_period_minutes: formData.grace_period_minutes,
          is_default: formData.is_default,
        });

        if (error) throw error;
        toast({ title: 'Success', description: 'Shift created successfully' });
      }

      setShowDialog(false);
      setEditingShift(null);
      resetForm();
      fetchShifts();
    } catch (error: any) {
      console.error('Error saving shift:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save shift',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;

    try {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Shift deleted successfully' });
      fetchShifts();
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete shift',
        variant: 'destructive',
      });
    }
  };

  const handleAssignShift = async (shiftId: string | null) => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ shift_id: shiftId })
        .eq('id', selectedEmployee.id);

      if (error) throw error;
      
      toast({ title: 'Success', description: 'Shift assigned successfully' });
      setShowAssignDialog(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error assigning shift:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign shift',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      start_time: '09:00',
      end_time: '18:00',
      grace_period_minutes: 15,
      is_default: false,
    });
  };

  const openEditDialog = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      grace_period_minutes: shift.grace_period_minutes,
      is_default: shift.is_default,
    });
    setShowDialog(true);
  };

  const openAssignDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowAssignDialog(true);
  };

  const getShiftName = (shiftId: string | null) => {
    if (!shiftId) return 'No Shift';
    const shift = shifts.find(s => s.id === shiftId);
    return shift?.name || 'Unknown';
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(fromDeveloper ? '/developer' : '/admin')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display font-bold text-sm sm:text-lg truncate">Shift Management</h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Create and assign shifts</p>
                </div>
              </div>
            </div>
            
            <Button size="sm" onClick={() => { resetForm(); setEditingShift(null); setShowDialog(true); }} className="shrink-0">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Shift</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Shifts Table */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Shifts
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Manage company shift timings</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Shift Name</TableHead>
                  <TableHead className="text-xs sm:text-sm">Start</TableHead>
                  <TableHead className="text-xs sm:text-sm">End</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Grace</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Default</TableHead>
                  <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                      No shifts created yet
                    </TableCell>
                  </TableRow>
                ) : (
                  shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">{shift.name}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{formatTime(shift.start_time)}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{formatTime(shift.end_time)}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{shift.grace_period_minutes}m</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {shift.is_default && (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7 sm:w-8 sm:h-8" onClick={() => openEditDialog(shift)}>
                            <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 sm:w-8 sm:h-8" onClick={() => handleDelete(shift.id)}>
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* Employee Shift Assignment */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Employee Shift Assignments
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Assign shifts to employees</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Department</TableHead>
                  <TableHead className="text-xs sm:text-sm">Shift</TableHead>
                  <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{employee.full_name}</TableCell>
                    <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{employee.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={employee.shift_id ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                        {getShiftName(employee.shift_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => openAssignDialog(employee)}>
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Shift Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Add New Shift'}</DialogTitle>
            <DialogDescription>
              {editingShift ? 'Update shift details' : 'Create a new shift with timings'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Shift Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Morning Shift"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="grace_period">Grace Period (minutes)</Label>
              <Input
                id="grace_period"
                type="number"
                min="0"
                max="60"
                value={formData.grace_period_minutes}
                onChange={(e) => setFormData({ ...formData, grace_period_minutes: parseInt(e.target.value) })}
                required
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded border-border"
              />
              <Label htmlFor="is_default" className="cursor-pointer">Set as default shift</Label>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingShift ? 'Update Shift' : 'Create Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Shift Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Shift</DialogTitle>
            <DialogDescription>
              Assign a shift to {selectedEmployee?.full_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Select
              value={selectedEmployee?.shift_id || 'none'}
              onValueChange={(value) => handleAssignShift(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Shift</SelectItem>
                {shifts.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
