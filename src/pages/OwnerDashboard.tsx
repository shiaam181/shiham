import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Users, Crown, Loader2, MoreHorizontal, Shield, User, ChevronDown, Scan, AlertTriangle, MapPin } from 'lucide-react';
import { PendingEmployeesList } from '@/components/PendingEmployeesList';
import RoleBasedHeader from '@/components/RoleBasedHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import { LiveLocationMap } from '@/components/LiveLocationMap';

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
  face_verification_disabled: boolean;
  live_tracking_enabled?: boolean;
  tracking_interval_seconds?: number;
}

export default function OwnerDashboard() {
  const { user, profile, isOwner, isDeveloper, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // For developers: list of all companies to choose from
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<CompanyEmployee | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('employee');

  // Fetch all companies for developers
  useEffect(() => {
    const fetchAllCompanies = async () => {
      if (!isDeveloper) return;
      
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, invite_code, is_active, face_verification_disabled')
        .order('name');
      
      if (!error && data) {
        setAllCompanies(data);
        // Auto-select first company if none selected
        if (data.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(data[0].id);
        }
      }
    };

    if (!authLoading && isDeveloper) {
      fetchAllCompanies();
    }
  }, [authLoading, isDeveloper]);

  useEffect(() => {
    if (!authLoading && !isOwner && !isDeveloper) {
      navigate('/dashboard');
      return;
    }

    // Determine which company to load
    let companyIdToLoad: string | null = null;

    if (isDeveloper) {
      // Developer can select any company
      companyIdToLoad = selectedCompanyId;
    } else if (profile?.company_id) {
      // Owner sees their assigned company
      companyIdToLoad = profile.company_id;
    }

    if (companyIdToLoad) {
      fetchCompany(companyIdToLoad);
      fetchEmployees(companyIdToLoad);
    } else {
      setIsLoading(false);
    }
  }, [authLoading, isOwner, isDeveloper, profile?.company_id, selectedCompanyId, navigate]);

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

  const refreshEmployees = () => {
    const companyId = isDeveloper ? selectedCompanyId : profile?.company_id;
    if (companyId) {
      fetchEmployees(companyId);
    }
  };

  const toggleFaceVerification = async () => {
    if (!company) return;
    
    const newValue = !company.face_verification_disabled;
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ face_verification_disabled: newValue })
        .eq('id', company.id);

      if (error) throw error;

      setCompany({ ...company, face_verification_disabled: newValue });
      
      toast({
        title: newValue ? 'Face Verification Disabled' : 'Face Verification Enabled',
        description: newValue 
          ? 'Employees can now check in without face verification.'
          : 'Face verification is now required for attendance.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update setting',
        variant: 'destructive',
      });
    }
  };

  const toggleLiveTracking = async () => {
    if (!company) return;
    
    const newValue = !company.live_tracking_enabled;
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ live_tracking_enabled: newValue })
        .eq('id', company.id);

      if (error) throw error;

      setCompany({ ...company, live_tracking_enabled: newValue });
      
      toast({
        title: newValue ? 'Live Tracking Enabled' : 'Live Tracking Disabled',
        description: newValue 
          ? 'Employees who consent can now share their live location.'
          : 'Live location tracking has been disabled for your company.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update setting',
        variant: 'destructive',
      });
    }
  };

  const updateTrackingInterval = async (seconds: number) => {
    if (!company) return;
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ tracking_interval_seconds: seconds })
        .eq('id', company.id);

      if (error) throw error;

      setCompany({ ...company, tracking_interval_seconds: seconds });
      
      toast({
        title: 'Interval Updated',
        description: `Location updates will be sent every ${seconds} seconds.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update interval',
        variant: 'destructive',
      });
    }
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

    // All valid app roles
    const allValidRoles = ['employee', 'admin', 'owner', 'developer'] as const;
    
    // Check if selected role is valid
    if (!allValidRoles.includes(selectedRole as typeof allValidRoles[number])) {
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
          .update({ role: selectedRole as 'admin' | 'employee' | 'owner' | 'developer' })
          .eq('user_id', selectedEmployee.user_id);
      } else {
        await supabase
          .from('user_roles')
          .insert({ user_id: selectedEmployee.user_id, role: selectedRole as 'admin' | 'employee' | 'owner' | 'developer' });
      }

      toast({
        title: 'Role Updated',
        description: `${selectedEmployee.full_name}'s role has been updated to ${selectedRole}.`
      });

      setShowRoleDialog(false);
      setSelectedEmployee(null);
      refreshEmployees();
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

  // For developers with no companies yet
  if (isDeveloper && allCompanies.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20 sm:pb-6">
        <RoleBasedHeader currentView="owner" />
        <main className="container mx-auto px-4 py-6">
          <Card className="text-center p-8">
            <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Companies Created</h2>
            <p className="text-muted-foreground mb-4">
              Create your first company from the Developer Dashboard.
            </p>
            <Button onClick={() => navigate('/developer/companies')}>
              Go to Company Management
            </Button>
          </Card>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  // For non-developers with no company assigned
  if (!isDeveloper && !company) {
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
        {/* Developer Company Selector */}
        {isDeveloper && allCompanies.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Developer Access
              </CardTitle>
              <CardDescription>
                As a developer, you can manage any company
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select 
                value={selectedCompanyId || ''} 
                onValueChange={(value) => setSelectedCompanyId(value)}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Select a company to manage" />
                </SelectTrigger>
                <SelectContent>
                  {allCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {c.name}
                        {!c.is_active && (
                          <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Company Info */}
        {company && (
          <>
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
                <p className="text-sm text-muted-foreground">
                  Employees can register by searching for your company name on the signup page. You'll need to approve each registration request.
                </p>
              </CardContent>
            </Card>

            {/* Company Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="w-5 h-5 text-primary" />
                  Company Settings
                </CardTitle>
                <CardDescription>
                  Configure attendance and security settings for your company
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      company.face_verification_disabled ? 'bg-warning/20' : 'bg-success/20'
                    }`}>
                      <Scan className={`w-5 h-5 ${
                        company.face_verification_disabled ? 'text-warning' : 'text-success'
                      }`} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="face-toggle" className="text-sm font-medium cursor-pointer">
                        Face Verification
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {company.face_verification_disabled 
                          ? 'Disabled - employees can check in without face verification'
                          : 'Enabled - employees must verify their face during attendance'
                        }
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="face-toggle"
                    checked={!company.face_verification_disabled}
                    onCheckedChange={toggleFaceVerification}
                  />
                </div>

                {company.face_verification_disabled && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-soft border border-warning/30">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">
                      Face verification is disabled for troubleshooting. Remember to re-enable it for security.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Location Tracking Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Live Location Tracking
                </CardTitle>
                <CardDescription>
                  Enable live location tracking for your employees during work hours
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      company.live_tracking_enabled ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <MapPin className={`w-5 h-5 ${
                        company.live_tracking_enabled ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="live-tracking-toggle" className="text-sm font-medium cursor-pointer">
                        Live Tracking
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {company.live_tracking_enabled 
                          ? 'Employees with consent can share their location'
                          : 'Location tracking is disabled for your company'
                        }
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="live-tracking-toggle"
                    checked={company.live_tracking_enabled || false}
                    onCheckedChange={toggleLiveTracking}
                  />
                </div>

                {company.live_tracking_enabled && (
                  <>
                    <div className="flex items-center gap-4 p-4 rounded-lg border">
                      <Label className="text-sm whitespace-nowrap">Update Interval:</Label>
                      <Select 
                        value={String(company.tracking_interval_seconds || 60)}
                        onValueChange={(v) => updateTrackingInterval(Number(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 seconds</SelectItem>
                          <SelectItem value="60">1 minute</SelectItem>
                          <SelectItem value="120">2 minutes</SelectItem>
                          <SelectItem value="300">5 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Privacy:</strong> Employees must explicitly consent to location tracking. 
                        They can start/stop tracking at any time from their dashboard.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Live Location Map */}
            {company.live_tracking_enabled && (
              <LiveLocationMap companyId={company.id} isDeveloper={isDeveloper} />
            )}

            {/* Pending Employee Approvals */}
            <PendingEmployeesList companyId={company.id} onUpdate={refreshEmployees} />

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
                    <p className="text-muted-foreground">No approved employees yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Employees can register by searching for your company name during sign up.
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
                            {emp.user_id !== user?.id && (isDeveloper || (emp.role !== 'owner' && emp.role !== 'developer')) && (
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
          </>
        )}
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
                {isDeveloper && (
                  <SelectItem value="owner">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      Owner
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {isDeveloper 
                ? 'As a developer, you can assign any role including Owner.'
                : 'Admin users can view reports, manage leaves, and edit employee information within your company.'}
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
