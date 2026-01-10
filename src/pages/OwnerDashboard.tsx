import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Copy, Users, Link2, Crown, Loader2, MoreHorizontal, Shield, User } from 'lucide-react';
import RoleBasedHeader from '@/components/RoleBasedHeader';
import MobileBottomNav from '@/components/MobileBottomNav';

interface CompanyEmployee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  role?: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  is_active: boolean;
}

export default function OwnerDashboard() {
  const { user, profile, isOwner, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<CompanyEmployee | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('employee');

  useEffect(() => {
    if (!authLoading && !isOwner) {
      navigate('/dashboard');
      return;
    }
    if (profile?.company_id) {
      fetchCompany(profile.company_id);
      fetchEmployees(profile.company_id);
    } else {
      setIsLoading(false);
    }
  }, [authLoading, isOwner, profile?.company_id, navigate]);

  const fetchCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      setCompany(data);
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchEmployees = async (companyId: string) => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, department, position, is_active')
        .eq('company_id', companyId);

      if (profilesError) throw profilesError;

      // Get roles for all users
      const userIds = (profiles || []).map(p => p.user_id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      const rolesMap = new Map((roles || []).map(r => [r.user_id, r.role]));

      const employeesWithRoles = (profiles || []).map(p => ({
        ...p,
        role: rolesMap.get(p.user_id) || 'employee'
      }));

      setEmployees(employeesWithRoles);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!company) return;
    const link = `${window.location.origin}/invite/${encodeURIComponent(company.invite_code)}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard. Share it with your employees.'
    });
  };

  const openRoleDialog = (employee: CompanyEmployee) => {
    if (employee.user_id === user?.id) {
      toast({
        title: 'Cannot change own role',
        description: 'You cannot change your own role.',
        variant: 'destructive'
      });
      return;
    }
    setSelectedEmployee(employee);
    setSelectedRole(employee.role || 'employee');
    setShowRoleDialog(true);
  };

  const updateEmployeeRole = async () => {
    if (!selectedEmployee) return;

    // Validate that selectedRole is a valid role
    const validRoles = ['employee', 'admin'] as const;
    type ValidRole = typeof validRoles[number];
    
    if (!validRoles.includes(selectedRole as ValidRole)) {
      toast({
        title: 'Invalid Role',
        description: 'Please select a valid role.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedEmployee.user_id)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from('user_roles')
          .update({ role: selectedRole as 'admin' | 'employee' })
          .eq('user_id', selectedEmployee.user_id);
      } else {
        await supabase
          .from('user_roles')
          .insert({ user_id: selectedEmployee.user_id, role: selectedRole as 'admin' | 'employee' });
      }

      toast({
        title: 'Role Updated',
        description: `${selectedEmployee.full_name}'s role has been updated to ${selectedRole}.`
      });

      setShowRoleDialog(false);
      setSelectedEmployee(null);
      if (profile?.company_id) {
        fetchEmployees(profile.company_id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive'
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3" />;
      case 'admin':
        return <Shield className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

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

  if (!company) {
    return (
      <div className="min-h-screen bg-background pb-20 sm:pb-6">
        <RoleBasedHeader currentView="owner" />
        <main className="container mx-auto px-4 py-6">
          <Card className="text-center p-8">
            <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Company Assigned</h2>
            <p className="text-muted-foreground">
              You don't have a company assigned yet. Please contact the system administrator.
            </p>
          </Card>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-6">
      <RoleBasedHeader currentView="owner" />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{company.name}</CardTitle>
                  <CardDescription>/{company.slug}</CardDescription>
                </div>
              </div>
              <Badge variant={company.is_active ? 'default' : 'secondary'}>
                {company.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Employee Invite Link</label>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm flex-1 overflow-hidden">
                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <code className="text-xs truncate">
                      {window.location.origin}/invite/{company.invite_code}
                    </code>
                  </div>
                  <Button onClick={copyInviteLink} variant="outline" size="sm">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this link with employees to let them register under your company.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Company Employees ({employees.length})
            </CardTitle>
            <CardDescription>
              Manage your company's employees and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No employees registered yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Share the invite link above to add employees.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {emp.department || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(emp.role || 'employee')} className="gap-1">
                          {getRoleIcon(emp.role || 'employee')}
                          {emp.role || 'employee'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={emp.is_active ? 'outline' : 'secondary'}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {emp.user_id !== user?.id && emp.role !== 'owner' && emp.role !== 'developer' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openRoleDialog(emp)}>
                                <Shield className="w-4 h-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Employee Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedEmployee?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Employee
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Admin
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Admin users can view reports, manage leaves, and edit employee information within your company.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={updateEmployeeRole}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileBottomNav />
    </div>
  );
}
