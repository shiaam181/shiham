import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Users,
  UserX,
  UserCheck,
  Search,
  Phone,
  Briefcase,
  Building,
  Eye
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import EmployeeDetailDialog from '@/components/EmployeeDetailDialog';

interface Employee {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export default function EmployeeManagement() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const fromDeveloper = location.state?.from === 'developer';
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employees',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchEmployees();
  }, [authLoading, isAdmin, navigate, fetchEmployees]);

  const handleOpenDetail = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailOpen(true);
  };

  const handleToggleActive = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;
      toast({ 
        title: 'Success', 
        description: `Employee ${employee.is_active ? 'deactivated' : 'activated'} successfully` 
      });
      fetchEmployees();
    } catch (error: any) {
      console.error('Error toggling employee status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update employee status',
        variant: 'destructive',
      });
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(fromDeveloper ? '/developer' : '/admin')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display font-bold text-sm sm:text-lg truncate">Employee Management</h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Manage employee profiles & attendance</p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">{employees.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success-soft flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">{employees.filter(e => e.is_active).length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-destructive-soft flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">{employees.filter(e => !e.is_active).length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Inactive</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-info-soft flex items-center justify-center shrink-0">
                <Building className="w-4 h-4 sm:w-5 sm:h-5 text-info" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">
                  {new Set(employees.map(e => e.department).filter(Boolean)).size}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Departments</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">All Employees</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Click on an employee to view details and attendance history
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Department</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Position</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Contact</TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                        No employees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <TableRow 
                        key={employee.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${!employee.is_active ? 'opacity-60' : ''}`}
                        onClick={() => handleOpenDetail(employee)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="font-semibold text-primary text-xs sm:text-sm">
                                {employee.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{employee.full_name}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-none">{employee.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                            {employee.department || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                            {employee.position || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {employee.phone ? (
                            <div className="flex items-center gap-2 text-xs sm:text-sm">
                              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                              {employee.phone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.is_active ? 'present' : 'absent'} className="text-[10px] sm:text-xs">
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 sm:w-8 sm:h-8"
                              onClick={() => handleOpenDetail(employee)}
                              title="View Details"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-7 h-7 sm:w-8 sm:h-8">
                                  {employee.is_active ? (
                                    <UserX className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                                  ) : (
                                    <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 text-success" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-base sm:text-lg">
                                    {employee.is_active ? 'Deactivate' : 'Activate'} Employee
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs sm:text-sm">
                                    {employee.is_active
                                      ? `Are you sure you want to deactivate ${employee.full_name}? They will no longer be able to mark attendance.`
                                      : `Are you sure you want to activate ${employee.full_name}? They will be able to mark attendance again.`
                                    }
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleToggleActive(employee)}>
                                    {employee.is_active ? 'Deactivate' : 'Activate'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        {/* Employee Detail Dialog */}
        <EmployeeDetailDialog
          employee={selectedEmployee}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onUpdate={fetchEmployees}
        />
      </main>
    </div>
  );
}
