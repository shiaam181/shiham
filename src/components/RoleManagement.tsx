import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Shield, User, Code, Save, AlertTriangle, Building, UserCog, Users } from 'lucide-react';

interface UserWithRole {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: 'admin' | 'employee' | 'developer' | 'owner' | 'hr' | 'manager';
  is_active: boolean;
}

export default function RoleManagement() {
  const { user: currentUser, isDeveloper } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, department, is_active')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Map roles to users
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (userRole?.role as UserWithRole['role']) || 'employee',
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isDeveloper) {
      fetchUsers();
    }
  }, [isDeveloper]);

  const handleRoleChange = (user: UserWithRole, role: string) => {
    setSelectedUser(user);
    setNewRole(role);
    setShowConfirmDialog(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    setIsSaving(true);
    try {
      // Update the role
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as any })
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${selectedUser.full_name}'s role updated to ${newRole}`,
      });

      setShowConfirmDialog(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'developer':
        return (
          <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">
            <Code className="w-3 h-3 mr-1" />
            Developer
          </Badge>
        );
      case 'admin':
        return (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <Shield className="w-3 h-3 mr-1" />
            Admin
          </Badge>
        );
      case 'owner':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
            <Building className="w-3 h-3 mr-1" />
            Owner
          </Badge>
        );
      case 'hr':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
            <UserCog className="w-3 h-3 mr-1" />
            HR
          </Badge>
        );
      case 'manager':
        return (
          <Badge className="bg-teal-500/20 text-teal-500 border-teal-500/30">
            <Users className="w-3 h-3 mr-1" />
            Manager
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <User className="w-3 h-3 mr-1" />
            Employee
          </Badge>
        );
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isDeveloper) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <p>You don't have permission to access role management.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Role Management
          </CardTitle>
          <CardDescription>
            Assign admin or developer roles to users. Only developers can access this panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Change Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            {user.role === 'developer' ? (
                              <Code className="w-4 h-4 text-purple-500" />
                            ) : user.role === 'admin' ? (
                              <Shield className="w-4 h-4 text-blue-500" />
                            ) : (
                              <User className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.department || '-'}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="hr">HR</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                          </SelectContent>
                        </Select>
                        {user.user_id === currentUser?.id && (
                          <span className="text-xs text-purple-500 mt-1 block">
                            (You)
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirm Role Change
            </DialogTitle>
            <DialogDescription>
              You are about to change {selectedUser?.full_name}'s role from{' '}
              <strong>{selectedUser?.role}</strong> to <strong>{newRole}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-warning-soft rounded-lg border border-warning/20">
            <p className="text-sm text-warning">
              {newRole === 'developer' && (
                <>
                  <strong>Warning:</strong> Developer role grants full access to all settings,
                  configurations, and the ability to manage other users' roles.
                </>
              )}
              {newRole === 'admin' && (
                <>
                  <strong>Note:</strong> Admin role grants access to the admin panel for
                  managing employees, attendance, leaves, and reports.
                </>
              )}
              {newRole === 'owner' && (
                <>
                  <strong>Note:</strong> Owner role grants management access for their assigned company,
                  including employee approvals and attendance oversight.
                </>
              )}
              {newRole === 'hr' && (
                <>
                  <strong>Note:</strong> HR role grants company-wide access to employee management,
                  payroll structures, and leave administration.
                </>
              )}
              {newRole === 'manager' && (
                <>
                  <strong>Note:</strong> Manager role grants team-level oversight for employees
                  assigned under this manager, including attendance and leave approvals.
                </>
              )}
              {newRole === 'employee' && (
                <>
                  <strong>Note:</strong> Employee role only allows access to the employee
                  dashboard for personal attendance and leave requests.
                </>
              )}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRoleChange} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Confirm Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
