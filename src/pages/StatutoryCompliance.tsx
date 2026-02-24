import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Scale, Users, Shield, IndianRupee, Plus, Loader2, Save, Search } from 'lucide-react';

interface StatutoryProfile {
  id: string;
  user_id: string;
  company_id: string | null;
  pf_applicable: boolean;
  uan_number: string | null;
  pf_number: string | null;
  pf_wage_ceiling: number;
  pf_employee_rate: number;
  pf_employer_rate: number;
  esi_applicable: boolean;
  esi_number: string | null;
  esi_employee_rate: number;
  esi_employer_rate: number;
  esi_wage_ceiling: number;
  pt_applicable: boolean;
  pt_state: string | null;
  profile?: { full_name: string; email: string; department: string | null };
}

interface PTSlab {
  id: string;
  state: string;
  min_salary: number;
  max_salary: number | null;
  monthly_tax: number;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Gujarat', 'Karnataka', 'Maharashtra',
  'Tamil Nadu', 'Telangana', 'West Bengal',
];

export default function StatutoryCompliance() {
  const { profile: authProfile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('employees');
  const [profiles, setProfiles] = useState<StatutoryProfile[]>([]);
  const [ptSlabs, setPtSlabs] = useState<PTSlab[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string; email: string; department: string | null; company_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StatutoryProfile | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [form, setForm] = useState({
    pf_applicable: true,
    uan_number: '',
    pf_number: '',
    pf_wage_ceiling: 15000,
    pf_employee_rate: 12,
    pf_employer_rate: 12,
    esi_applicable: false,
    esi_number: '',
    esi_employee_rate: 0.75,
    esi_employer_rate: 3.25,
    esi_wage_ceiling: 21000,
    pt_applicable: false,
    pt_state: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [statRes, empRes, ptRes] = await Promise.all([
      supabase.from('statutory_profiles').select('*'),
      supabase.from('profiles').select('user_id, full_name, email, department, company_id').eq('is_active', true),
      supabase.from('professional_tax_slabs').select('*').eq('is_active', true).order('state').order('min_salary'),
    ]);

    if (empRes.data) setEmployees(empRes.data);
    if (ptRes.data) setPtSlabs(ptRes.data as PTSlab[]);

    if (statRes.data && empRes.data) {
      const mapped = (statRes.data as any[]).map((s: any) => ({
        ...s,
        profile: empRes.data.find(e => e.user_id === s.user_id),
      }));
      setProfiles(mapped);
    }
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingProfile(null);
    setSelectedEmployee('');
    setForm({
      pf_applicable: true, uan_number: '', pf_number: '',
      pf_wage_ceiling: 15000, pf_employee_rate: 12, pf_employer_rate: 12,
      esi_applicable: false, esi_number: '', esi_employee_rate: 0.75,
      esi_employer_rate: 3.25, esi_wage_ceiling: 21000,
      pt_applicable: false, pt_state: '',
    });
    setShowDialog(true);
  };

  const openEditDialog = (sp: StatutoryProfile) => {
    setEditingProfile(sp);
    setSelectedEmployee(sp.user_id);
    setForm({
      pf_applicable: sp.pf_applicable,
      uan_number: sp.uan_number || '',
      pf_number: sp.pf_number || '',
      pf_wage_ceiling: Number(sp.pf_wage_ceiling),
      pf_employee_rate: Number(sp.pf_employee_rate),
      pf_employer_rate: Number(sp.pf_employer_rate),
      esi_applicable: sp.esi_applicable,
      esi_number: sp.esi_number || '',
      esi_employee_rate: Number(sp.esi_employee_rate),
      esi_employer_rate: Number(sp.esi_employer_rate),
      esi_wage_ceiling: Number(sp.esi_wage_ceiling),
      pt_applicable: sp.pt_applicable,
      pt_state: sp.pt_state || '',
    });
    setShowDialog(true);
  };

  const saveProfile = async () => {
    if (!editingProfile && !selectedEmployee) {
      toast({ title: 'Error', description: 'Select an employee', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const userId = editingProfile ? editingProfile.user_id : selectedEmployee;
    const emp = employees.find(e => e.user_id === userId);
    const payload = {
      user_id: userId,
      company_id: emp?.company_id || authProfile?.company_id || null,
      pf_applicable: form.pf_applicable,
      uan_number: form.uan_number || null,
      pf_number: form.pf_number || null,
      pf_wage_ceiling: form.pf_wage_ceiling,
      pf_employee_rate: form.pf_employee_rate,
      pf_employer_rate: form.pf_employer_rate,
      esi_applicable: form.esi_applicable,
      esi_number: form.esi_number || null,
      esi_employee_rate: form.esi_employee_rate,
      esi_employer_rate: form.esi_employer_rate,
      esi_wage_ceiling: form.esi_wage_ceiling,
      pt_applicable: form.pt_applicable,
      pt_state: form.pt_state || null,
    };

    let error;
    if (editingProfile) {
      ({ error } = await supabase.from('statutory_profiles').update(payload).eq('id', editingProfile.id));
    } else {
      ({ error } = await supabase.from('statutory_profiles').insert(payload));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Statutory profile updated' });
      setShowDialog(false);
      fetchData();
    }
    setSaving(false);
  };

  const filteredProfiles = profiles.filter(p =>
    !search || p.profile?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const employeesWithoutStatutory = employees.filter(
    e => !profiles.find(p => p.user_id === e.user_id)
  );

  const groupedSlabs = INDIAN_STATES.map(state => ({
    state,
    slabs: ptSlabs.filter(s => s.state === state),
  })).filter(g => g.slabs.length > 0);

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
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" />
              Statutory Compliance
            </h1>
            <p className="text-sm text-muted-foreground">PF, ESI & Professional Tax configuration</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PF Enrolled</p>
            <p className="text-xl font-bold">{profiles.filter(p => p.pf_applicable).length}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ESI Enrolled</p>
            <p className="text-xl font-bold">{profiles.filter(p => p.esi_applicable).length}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-amber-500">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PT Applicable</p>
            <p className="text-xl font-bold">{profiles.filter(p => p.pt_applicable).length}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-violet-500">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Not Configured</p>
            <p className="text-xl font-bold">{employeesWithoutStatutory.length}</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="employees">Employee Statutory</TabsTrigger>
            <TabsTrigger value="pt-slabs">PT Slabs</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Button size="sm" onClick={openAddDialog} disabled={employeesWithoutStatutory.length === 0}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>PF</TableHead>
                    <TableHead>ESI</TableHead>
                    <TableHead>PT</TableHead>
                    <TableHead>UAN</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No statutory profiles configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map(sp => (
                      <TableRow key={sp.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{sp.profile?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{sp.profile?.department || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sp.pf_applicable ? 'default' : 'secondary'} className="text-xs">
                            {sp.pf_applicable ? `${sp.pf_employee_rate}%` : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sp.esi_applicable ? 'default' : 'secondary'} className="text-xs">
                            {sp.esi_applicable ? `${sp.esi_employee_rate}%` : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sp.pt_applicable ? 'default' : 'secondary'} className="text-xs">
                            {sp.pt_applicable ? sp.pt_state : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{sp.uan_number || '-'}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(sp)}>Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="pt-slabs" className="space-y-4">
            {groupedSlabs.map(({ state, slabs }) => (
              <Card key={state}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{state}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Min Salary (₹)</TableHead>
                        <TableHead>Max Salary (₹)</TableHead>
                        <TableHead>Monthly Tax (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slabs.map(slab => (
                        <TableRow key={slab.id}>
                          <TableCell>₹{Number(slab.min_salary).toLocaleString('en-IN')}</TableCell>
                          <TableCell>{slab.max_salary ? `₹${Number(slab.max_salary).toLocaleString('en-IN')}` : 'No limit'}</TableCell>
                          <TableCell className="font-medium">₹{Number(slab.monthly_tax).toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit' : 'Add'} Statutory Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {!editingProfile && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employeesWithoutStatutory.map(e => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* PF Section */}
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Provident Fund (PF)</CardTitle>
                  <Switch checked={form.pf_applicable} onCheckedChange={v => setForm(f => ({ ...f, pf_applicable: v }))} />
                </div>
              </CardHeader>
              {form.pf_applicable && (
                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">UAN Number</Label>
                      <Input value={form.uan_number} onChange={e => setForm(f => ({ ...f, uan_number: e.target.value }))} placeholder="100XXXXXXXXX" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">PF Number</Label>
                      <Input value={form.pf_number} onChange={e => setForm(f => ({ ...f, pf_number: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Employee Rate (%)</Label>
                      <Input type="number" value={form.pf_employee_rate} onChange={e => setForm(f => ({ ...f, pf_employee_rate: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Wage Ceiling (₹)</Label>
                      <Input type="number" value={form.pf_wage_ceiling} onChange={e => setForm(f => ({ ...f, pf_wage_ceiling: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* ESI Section */}
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">ESI</CardTitle>
                  <Switch checked={form.esi_applicable} onCheckedChange={v => setForm(f => ({ ...f, esi_applicable: v }))} />
                </div>
              </CardHeader>
              {form.esi_applicable && (
                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">ESI Number</Label>
                      <Input value={form.esi_number} onChange={e => setForm(f => ({ ...f, esi_number: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Employee Rate (%)</Label>
                      <Input type="number" value={form.esi_employee_rate} onChange={e => setForm(f => ({ ...f, esi_employee_rate: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Employer Rate (%)</Label>
                      <Input type="number" value={form.esi_employer_rate} onChange={e => setForm(f => ({ ...f, esi_employer_rate: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Wage Ceiling (₹)</Label>
                      <Input type="number" value={form.esi_wage_ceiling} onChange={e => setForm(f => ({ ...f, esi_wage_ceiling: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* PT Section */}
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Professional Tax</CardTitle>
                  <Switch checked={form.pt_applicable} onCheckedChange={v => setForm(f => ({ ...f, pt_applicable: v }))} />
                </div>
              </CardHeader>
              {form.pt_applicable && (
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    <Label className="text-xs">State</Label>
                    <Select value={form.pt_state} onValueChange={v => setForm(f => ({ ...f, pt_state: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveProfile} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
