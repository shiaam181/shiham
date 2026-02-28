import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Eye,
  Pencil,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Mail,
  Loader2,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import EmployeeDetailDialog from '@/components/EmployeeDetailDialog';
import AppLayout from '@/components/AppLayout';

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
  company_id: string | null;
  company?: {
    id: string;
    name: string;
  } | null;
}

interface Company {
  id: string;
  name: string;
  employees: Employee[];
}

const departments = [
  'Engineering',
  'Design',
  'Marketing',
  'Sales',
  'Human Resources',
  'Finance',
  'Operations',
  'Customer Support',
  'Other'
];

export default function EmployeeManagement() {
  const { user, profile, isAdmin, isDeveloper, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const fromDeveloper = location.state?.from === 'developer';
  const isOwner = profile?.company_id != null; // Owner if they have a company
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ department: '', position: '' });
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Check if current user is owner of a company
  useEffect(() => {
    const checkOwnerStatus = async () => {
      if (!user) return;
      
      try {
        // Check if user has owner role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .maybeSingle();
        
        if (roleData) {
          // Get user's company
          const { data: profileData } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('user_id', user.id)
            .single();
          
          if (profileData?.company_id) {
            setUserCompanyId(profileData.company_id);
          }
        }
      } catch (error) {
        console.error('Error checking owner status:', error);
      }
    };
    
    checkOwnerStatus();
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          company:companies(id, name)
        `)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
      
      // Auto-expand all companies initially
      const companyIds = new Set(data?.map(e => e.company_id || 'unassigned').filter(Boolean));
      setExpandedCompanies(companyIds as Set<string>);
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
    if (!authLoading && !isAdmin && !isDeveloper && !userCompanyId) {
      // Wait a bit for userCompanyId to be set
      const timer = setTimeout(() => {
        if (!isAdmin && !isDeveloper && !userCompanyId) {
          navigate('/dashboard');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    fetchEmployees();
  }, [authLoading, isAdmin, isDeveloper, userCompanyId, navigate, fetchEmployees]);

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

  const handleStartEdit = (employee: Employee) => {
    setEditingEmployee(employee.id);
    setEditFormData({
      department: employee.department || '',
      position: employee.position || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setEditFormData({ department: '', position: '' });
  };

  const handleSaveEdit = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          department: editFormData.department || null,
          position: editFormData.position || null,
        })
        .eq('id', employee.id);

      if (error) throw error;
      
      toast({ title: 'Success', description: 'Employee updated successfully' });
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update employee',
        variant: 'destructive',
      });
    }
  };

  // Check if user can edit an employee (owner/admin of same company, or developer)
  const canEditEmployee = (employee: Employee): boolean => {
    if (isDeveloper) return true;
    if (isAdmin) return true;
    if (userCompanyId && employee.company_id === userCompanyId) return true;
    return false;
  };

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  // Filter and group employees by company
  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.company?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by company
  const groupedByCompany: Company[] = [];
  const companyMap = new Map<string, Company>();
  
  filteredEmployees.forEach(emp => {
    const companyId = emp.company_id || 'unassigned';
    const companyName = emp.company?.name || 'Unassigned';
    
    if (!companyMap.has(companyId)) {
      companyMap.set(companyId, {
        id: companyId,
        name: companyName,
        employees: [],
      });
    }
    companyMap.get(companyId)!.employees.push(emp);
  });

  // Sort companies: user's company first, then alphabetically
  Array.from(companyMap.values())
    .sort((a, b) => {
      if (userCompanyId && a.id === userCompanyId) return -1;
      if (userCompanyId && b.id === userCompanyId) return 1;
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      return a.name.localeCompare(b.name);
    })
    .forEach(company => groupedByCompany.push(company));

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
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-6">
        {/* Page Header */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-lg truncate">Employee Management</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Manage employee profiles & attendance</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search employees or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
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
                  {groupedByCompany.filter(c => c.id !== 'unassigned').length}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Companies</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Employees grouped by company */}
        <div className="space-y-4">
          {groupedByCompany.map((company) => (
            <Card key={company.id}>
              <Collapsible 
                open={expandedCompanies.has(company.id)}
                onOpenChange={() => toggleCompany(company.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3 sm:pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                            {company.name}
                            {userCompanyId === company.id && (
                              <Badge variant="secondary" className="text-xs">Your Company</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            {company.employees.length} employee{company.employees.length !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                      </div>
                      {expandedCompanies.has(company.id) ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="px-3 sm:px-6 pt-0">
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                            <TableHead className="text-xs sm:text-sm">Department</TableHead>
                            <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Position</TableHead>
                            <TableHead className="text-xs sm:text-sm hidden md:table-cell">Contact</TableHead>
                            <TableHead className="text-xs sm:text-sm">Status</TableHead>
                            <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {company.employees.map((employee) => (
                            <TableRow 
                              key={employee.id} 
                              className={`${!employee.is_active ? 'opacity-60' : ''}`}
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
                              <TableCell>
                                {editingEmployee === employee.id ? (
                                  <Select
                                    value={editFormData.department}
                                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, department: value }))}
                                  >
                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                      <SelectValue placeholder="Select dept" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {departments.map((dept) => (
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                                    <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                                    {employee.department || '-'}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {editingEmployee === employee.id ? (
                                  <Input
                                    value={editFormData.position}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, position: e.target.value }))}
                                    placeholder="Position"
                                    className="w-[140px] h-8 text-xs"
                                  />
                                ) : (
                                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                                    <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                                    {employee.position || '-'}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
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
                                <div className="flex items-center justify-end gap-1">
                                  {editingEmployee === employee.id ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-7 h-7 sm:w-8 sm:h-8 text-success"
                                        onClick={() => handleSaveEdit(employee)}
                                        title="Save"
                                      >
                                        <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-7 h-7 sm:w-8 sm:h-8"
                                        onClick={handleCancelEdit}
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      {canEditEmployee(employee) && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="w-7 h-7 sm:w-8 sm:h-8"
                                          onClick={() => handleStartEdit(employee)}
                                          title="Edit Dept/Position"
                                        >
                                          <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-7 h-7 sm:w-8 sm:h-8"
                                        onClick={() => handleOpenDetail(employee)}
                                        title="View Details"
                                      >
                                        <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                      </Button>
                                      {(isAdmin || isDeveloper) && (
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
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}

          {groupedByCompany.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No employees found</p>
            </Card>
          )}
        </div>

        {/* Employee Detail Dialog */}
        <EmployeeDetailDialog
          employee={selectedEmployee}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onUpdate={fetchEmployees}
        />
      </main>
    </AppLayout>
  );
}
