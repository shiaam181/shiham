import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, Building2, Users, Save, Loader2, Copy, Share2, Settings2,
  Trash2, Crown, Palette, Link2, User, Shield, MapPin, Eye, Pencil,
  UserPlus, Mail
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/components/AppLayout';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  brand_color_secondary: string | null;
  tagline: string | null;
  invite_code: string | null;
  is_active: boolean;
  invite_max_uses: number | null;
  invite_uses_count: number | null;
  invite_expires_at: string | null;
  face_verification_disabled: boolean;
  live_tracking_enabled: boolean | null;
  tracking_interval_seconds: number | null;
}

interface CompanyUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  role?: string;
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isDeveloper } = useAuth();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // Editable fields
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [brandColor, setBrandColor] = useState('#0284c7');
  const [brandColorSecondary, setBrandColorSecondary] = useState('#64748b');
  const [faceVerificationDisabled, setFaceVerificationDisabled] = useState(false);
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState('60');

  // Delete employee state
  const [deleteEmployee, setDeleteEmployee] = useState<CompanyUser | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [isDeletingEmp, setIsDeletingEmp] = useState(false);

  // Assign owner state
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Invite member state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteSending, setInviteSending] = useState(false);

  const fetchCompany = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Company not found', variant: 'destructive' });
      navigate('/developer/companies');
      return;
    }

    setCompany(data);
    setName(data.name);
    setTagline(data.tagline || '');
    setBrandColor(data.brand_color || '#0284c7');
    setBrandColorSecondary((data as any).brand_color_secondary || '#64748b');
    setFaceVerificationDisabled(data.face_verification_disabled);
    setLiveTrackingEnabled(data.live_tracking_enabled || false);
    setTrackingInterval(String(data.tracking_interval_seconds || 60));
  }, [id, navigate, toast]);

  const fetchUsers = useCallback(async () => {
    if (!id) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, department, position, is_active')
      .eq('company_id', id);

    if (!profiles) return;

    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    const rolesMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    setUsers(profiles.map(p => ({ ...p, role: rolesMap.get(p.user_id) || 'employee' })));
  }, [id]);

  useEffect(() => {
    if (!isDeveloper) { navigate('/dashboard'); return; }
    Promise.all([fetchCompany(), fetchUsers()]).finally(() => setIsLoading(false));
  }, [isDeveloper, navigate, fetchCompany, fetchUsers]);

  const handleSave = async () => {
    if (!company || !name.trim()) return;
    setIsSaving(true);

    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { error } = await supabase.from('companies').update({
      name: name.trim(),
      slug,
      tagline: tagline.trim() || null,
      brand_color: brandColor,
      brand_color_secondary: brandColorSecondary,
      face_verification_disabled: faceVerificationDisabled,
      live_tracking_enabled: liveTrackingEnabled,
      tracking_interval_seconds: parseInt(trackingInterval) || 60,
    }).eq('id', company.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Company settings updated successfully' });
      fetchCompany();
    }
    setIsSaving(false);
  };

  const copyInviteLink = () => {
    if (!company?.invite_code) return;
    const link = `${window.location.origin}/invite/${company.invite_code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Copied!', description: 'Invite link copied to clipboard' });
  };

  const handleDeleteEmployee = async () => {
    if (!deleteEmployee) return;
    setIsDeletingEmp(true);
    try {
      const res = await supabase.functions.invoke('delete-employee', {
        body: { target_user_id: deleteEmployee.user_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: 'Deleted', description: `${deleteEmployee.full_name} removed.` });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeletingEmp(false);
      setDeleteStep(0);
      setDeleteEmployee(null);
    }
  };

  const assignOwner = async () => {
    if (!company || !selectedUserId) return;
    try {
      const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', selectedUserId).maybeSingle();
      if (existing) {
        await supabase.from('user_roles').update({ role: 'owner' }).eq('user_id', selectedUserId);
      } else {
        await supabase.from('user_roles').insert({ user_id: selectedUserId, role: 'owner' });
      }
      toast({ title: 'Owner Assigned', description: 'Role updated successfully.' });
      setShowAssignOwner(false);
      setSelectedUserId('');
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'developer': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'hr': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'manager': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400';
      case 'payroll_team': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleInviteMember = async () => {
    if (!inviteName.trim() || !inviteEmail.trim() || !company) return;
    setInviteSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-email', {
        body: {
          employee_email: inviteEmail.trim(),
          employee_name: inviteName.trim(),
          tenant_id: company.id,
          invited_by: user?.id,
          role: inviteRole,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      const roleLabel = inviteRole === 'employee' ? 'Employee' : 
                        inviteRole === 'owner' ? 'Owner' :
                        inviteRole === 'admin' ? 'Admin' :
                        inviteRole === 'hr' ? 'HR' :
                        inviteRole === 'manager' ? 'Manager' : inviteRole;
      
      toast({ title: 'Invite Sent', description: `Invitation sent to ${inviteEmail} as ${roleLabel}` });
      setShowInviteDialog(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('employee');
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send invite', variant: 'destructive' });
    } finally {
      setInviteSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) return null;

  return (
    <AppLayout>

      {/* Company Hero Banner */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColorSecondary} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 shrink-0"
              onClick={() => navigate('/developer/companies')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{company.name}</h1>
                {company.tagline && (
                  <p className="text-white/80 text-sm truncate">{company.tagline}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-white/20 text-white border-white/30 text-xs">
                    /{company.slug}
                  </Badge>
                  <Badge className={`text-xs ${company.is_active ? 'bg-green-500/20 text-green-100 border-green-300/30' : 'bg-red-500/20 text-red-100 border-red-300/30'}`}>
                    {company.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <p className="text-white/70 text-xs">Employees</p>
              <p className="text-2xl font-bold text-white">{users.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <p className="text-white/70 text-xs">Invite Uses</p>
              <p className="text-2xl font-bold text-white">{company.invite_uses_count || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <p className="text-white/70 text-xs">Max Uses</p>
              <p className="text-2xl font-bold text-white">{company.invite_max_uses || '∞'}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="employees">Team ({users.length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="w-5 h-5 text-primary" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Company name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tagline</Label>
                    <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Company tagline" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Slug (auto-generated)</Label>
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded">
                    /{name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'company'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Invite Link */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="w-5 h-5 text-primary" />
                  Invite Link
                </CardTitle>
              </CardHeader>
              <CardContent>
                {company.invite_code ? (
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/invite/${company.invite_code}`}
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={copyInviteLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Join ${company.name}`,
                          url: `${window.location.origin}/invite/${company.invite_code}`,
                        });
                      } else copyInviteLink();
                    }}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No invite code generated</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="w-5 h-5 text-primary" />
                  Brand Colors
                </CardTitle>
                <CardDescription>
                  These colors will be applied to the UI for employees in this company
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Primary Color */}
                  <div className="space-y-3">
                    <Label className="font-semibold">Primary Color</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={brandColor}
                          onChange={e => setBrandColor(e.target.value)}
                          className="w-16 h-16 rounded-xl cursor-pointer border-2 border-border"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          value={brandColor}
                          onChange={e => setBrandColor(e.target.value)}
                          placeholder="#0284c7"
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">Used for buttons, links, and accents</p>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Color */}
                  <div className="space-y-3">
                    <Label className="font-semibold">Secondary Color</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={brandColorSecondary}
                          onChange={e => setBrandColorSecondary(e.target.value)}
                          className="w-16 h-16 rounded-xl cursor-pointer border-2 border-border"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          value={brandColorSecondary}
                          onChange={e => setBrandColorSecondary(e.target.value)}
                          placeholder="#64748b"
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">Used for gradients, backgrounds</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label className="font-semibold">Preview</Label>
                  <div
                    className="rounded-xl p-6 text-white"
                    style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColorSecondary} 100%)` }}
                  >
                    <h3 className="font-bold text-lg">{name || 'Company Name'}</h3>
                    <p className="text-white/80 text-sm mt-1">{tagline || 'Company Tagline'}</p>
                    <div className="flex gap-2 mt-4">
                      <button className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium border border-white/30">
                        Button Preview
                      </button>
                      <button className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium">
                        Solid Button
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Color Presets */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Quick Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Ocean Blue', primary: '#0284c7', secondary: '#0ea5e9' },
                      { name: 'Forest Green', primary: '#059669', secondary: '#34d399' },
                      { name: 'Royal Purple', primary: '#7c3aed', secondary: '#a78bfa' },
                      { name: 'Sunset Orange', primary: '#ea580c', secondary: '#fb923c' },
                      { name: 'Rose Pink', primary: '#e11d48', secondary: '#fb7185' },
                      { name: 'Midnight', primary: '#1e293b', secondary: '#475569' },
                      { name: 'Teal', primary: '#0d9488', secondary: '#2dd4bf' },
                      { name: 'Amber', primary: '#d97706', secondary: '#fbbf24' },
                    ].map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => { setBrandColor(preset.primary); setBrandColorSecondary(preset.secondary); }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-xs"
                      >
                        <div className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-primary" />
                    Team Members
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Invite Member
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAssignOwner(true)}>
                      <Crown className="w-4 h-4 mr-1" />
                      Assign Owner
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {users.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No employees in this company yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden sm:table-cell">Department</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="hidden sm:table-cell">Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map(u => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{u.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{u.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {u.department || '-'}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role || 'employee')}`}>
                                {u.role === 'payroll_team' ? 'Payroll' : u.role}
                              </span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant={u.is_active ? 'default' : 'destructive'} className="text-xs">
                                {u.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {u.role !== 'owner' && u.role !== 'developer' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => { setDeleteEmployee(u); setDeleteStep(1); }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Company Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label className="font-medium">Face Verification</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {faceVerificationDisabled ? 'Disabled — employees skip face check' : 'Enabled — employees must verify face'}
                    </p>
                  </div>
                  <Switch
                    checked={!faceVerificationDisabled}
                    onCheckedChange={v => setFaceVerificationDisabled(!v)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label className="font-medium">Live Location Tracking</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {liveTrackingEnabled ? 'Enabled — employee locations tracked' : 'Disabled'}
                    </p>
                  </div>
                  <Switch
                    checked={liveTrackingEnabled}
                    onCheckedChange={setLiveTrackingEnabled}
                  />
                </div>

                {liveTrackingEnabled && (
                  <div className="space-y-2 pl-3">
                    <Label>Tracking Interval (seconds)</Label>
                    <Input
                      type="number"
                      value={trackingInterval}
                      onChange={e => setTrackingInterval(e.target.value)}
                      min="10"
                      max="300"
                      className="w-32"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg" className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </main>

      {/* Assign Owner Dialog */}
      <AlertDialog open={showAssignOwner} onOpenChange={setShowAssignOwner}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Owner</AlertDialogTitle>
            <AlertDialogDescription>Select an employee to make company owner.</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {users.filter(u => u.role !== 'owner' && u.role !== 'developer').map(u => (
                <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={assignOwner} disabled={!selectedUserId}>Assign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Employee Confirmation (Step 1) */}
      <AlertDialog open={deleteStep === 1} onOpenChange={() => { setDeleteStep(0); setDeleteEmployee(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteEmployee?.full_name}</strong> and their auth account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setDeleteStep(2)} className="bg-destructive text-destructive-foreground">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Employee Confirmation (Step 2) */}
      <AlertDialog open={deleteStep === 2} onOpenChange={() => { setDeleteStep(0); setDeleteEmployee(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data for <strong>{deleteEmployee?.full_name}</strong> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} disabled={isDeletingEmp} className="bg-destructive text-destructive-foreground">
              {isDeletingEmp ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
