import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, UserMinus, Search, Loader2, User, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EmployeeProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  designation: string | null;
  manager_id: string | null;
  is_active: boolean;
  company_id: string | null;
}

interface ManagerWithTeam {
  profile: EmployeeProfile;
  team: EmployeeProfile[];
}

export default function TeamManagement() {
  const { user, isAdmin, isDeveloper, isHR } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [managers, setManagers] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all active profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, department, designation, manager_id, is_active, company_id')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      // Fetch manager role user_ids
      const { data: managerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');

      const managerUserIds = new Set((managerRoles || []).map(r => r.user_id));

      const allProfiles = profiles || [];
      const managerProfiles = allProfiles.filter(p => managerUserIds.has(p.user_id));

      setEmployees(allProfiles);
      setManagers(managerProfiles);

      // Auto-expand all managers
      setExpandedManagers(new Set(managerProfiles.map(m => m.user_id)));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build manager → team mapping
  const managerTeams: ManagerWithTeam[] = managers.map(m => ({
    profile: m,
    team: employees.filter(e => e.manager_id === m.user_id && e.user_id !== m.user_id),
  }));

  const unassignedEmployees = employees.filter(
    e => !e.manager_id && !managers.some(m => m.user_id === e.user_id)
  );

  const filteredUnassigned = unassignedEmployees.filter(e =>
    e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssignToManager = async () => {
    if (!selectedManager || selectedEmployees.size === 0) return;
    setSaving(true);
    try {
      const updates = Array.from(selectedEmployees).map(userId =>
        supabase.from('profiles').update({ manager_id: selectedManager }).eq('user_id', userId)
      );
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(errors[0].error!.message);

      toast({ title: 'Team Updated', description: `${selectedEmployees.size} employee(s) assigned successfully` });
      setAssignDialogOpen(false);
      setSelectedEmployees(new Set());
      setSelectedManager('');
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromTeam = async (employeeUserId: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ manager_id: null }).eq('user_id', employeeUserId);
      if (error) throw error;
      toast({ title: 'Removed', description: 'Employee removed from team' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleEmployee = (userId: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleManager = (managerId: string) => {
    setExpandedManagers(prev => {
      const next = new Set(prev);
      if (next.has(managerId)) next.delete(managerId);
      else next.add(managerId);
      return next;
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 max-w-5xl">
        <PageHeader
          title="Team Management"
          description="Assign employees to managers and organize teams"
          icon={<Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
          actions={
            <Button size="sm" onClick={() => setAssignDialogOpen(true)} disabled={managers.length === 0}>
              <UserPlus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Assign to Team</span>
              <span className="sm:hidden">Assign</span>
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Managers</p>
            <p className="text-xl font-bold tabular-nums">{managers.length}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-emerald-500">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned</p>
            <p className="text-xl font-bold tabular-nums">{employees.filter(e => e.manager_id).length}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-amber-500">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unassigned</p>
            <p className="text-xl font-bold tabular-nums">{unassignedEmployees.length}</p>
          </Card>
        </div>

        {/* Manager Teams */}
        {managers.length === 0 ? (
          <EmptyState
            icon={<Shield className="w-6 h-6 text-muted-foreground" />}
            title="No Managers Found"
            description="Assign the 'Manager' role to employees first via Role Management, then come back to build teams."
          />
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Manager Teams</h2>
            {managerTeams.map(({ profile: mgr, team }) => (
              <Card key={mgr.user_id} className="overflow-hidden">
                <Collapsible
                  open={expandedManagers.has(mgr.user_id)}
                  onOpenChange={() => toggleManager(mgr.user_id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">{mgr.full_name}</p>
                          <p className="text-xs text-muted-foreground">{mgr.department || 'No department'} · {mgr.designation || 'Manager'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{team.length} member{team.length !== 1 ? 's' : ''}</Badge>
                        {expandedManagers.has(mgr.user_id) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      {team.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No team members assigned yet
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs">Employee</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Department</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Designation</TableHead>
                              <TableHead className="text-xs text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {team.map(member => (
                              <TableRow key={member.user_id}>
                                <TableCell>
                                  <div>
                                    <p className="text-sm font-medium">{member.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm hidden sm:table-cell">{member.department || '-'}</TableCell>
                                <TableCell className="text-sm hidden sm:table-cell">{member.designation || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" onClick={() => handleRemoveFromTeam(member.user_id)} className="text-destructive hover:text-destructive h-7 text-xs">
                                    <UserMinus className="w-3.5 h-3.5 mr-1" />
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {/* Unassigned Employees */}
        {unassignedEmployees.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Unassigned Employees ({unassignedEmployees.length})</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search unassigned employees..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Department</TableHead>
                    <TableHead className="text-xs text-right">Quick Assign</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnassigned.slice(0, 20).map(emp => (
                    <TableRow key={emp.user_id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm hidden sm:table-cell">{emp.department || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Select onValueChange={(managerId) => {
                          supabase.from('profiles').update({ manager_id: managerId }).eq('user_id', emp.user_id)
                            .then(({ error }) => {
                              if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
                              else { toast({ title: 'Assigned' }); fetchData(); }
                            });
                        }}>
                          <SelectTrigger className="w-[140px] sm:w-[180px] h-8 text-xs">
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                          <SelectContent>
                            {managers.map(m => (
                              <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                                {m.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredUnassigned.length > 20 && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                  Showing 20 of {filteredUnassigned.length}. Use search to find specific employees.
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* Bulk Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Assign Employees to Manager
            </DialogTitle>
            <DialogDescription>
              Select a manager, then choose employees to add to their team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manager</label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name} ({m.department || 'No dept'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedManager && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Select Employees ({selectedEmployees.size} selected)
                </label>
                <div className="max-h-[300px] overflow-y-auto border rounded-lg divide-y">
                  {unassignedEmployees.map(emp => (
                    <label
                      key={emp.user_id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.has(emp.user_id)}
                        onChange={() => toggleEmployee(emp.user_id)}
                        className="rounded border-input"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.department || 'No department'}</p>
                      </div>
                    </label>
                  ))}
                  {unassignedEmployees.length === 0 && (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      All employees are already assigned to teams
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignToManager} disabled={saving || !selectedManager || selectedEmployees.size === 0}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Assign {selectedEmployees.size > 0 ? `(${selectedEmployees.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
