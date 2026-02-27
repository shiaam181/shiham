import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Building2, Plus, Copy, Users, Link2, Crown, Loader2, Pencil, Share2, Settings2, Infinity, Calendar, RotateCcw, Trash2, Settings, MapPin } from 'lucide-react';
import { PendingEmployeesList } from '@/components/PendingEmployeesList';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import AppLayout from '@/components/AppLayout';
import { LiveLocationMap } from '@/components/LiveLocationMap';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  invite_code: string | null;
  is_active: boolean;
  created_at: string;
  invite_max_uses: number | null;
  invite_uses_count: number | null;
  invite_expires_at: string | null;
}

interface CompanyUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role?: string;
}

export default function CompanyManagement() {
  const { isDeveloper } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignOwnerDialog, setShowAssignOwnerDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [newCompanyName, setNewCompanyName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  // Invite settings dialog state
  const [showInviteSettingsDialog, setShowInviteSettingsDialog] = useState(false);
  const [inviteSettingsCompany, setInviteSettingsCompany] = useState<Company | null>(null);
  const [inviteMaxUses, setInviteMaxUses] = useState<string>('unlimited');
  const [inviteMaxUsesCustom, setInviteMaxUsesCustom] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState<Date | undefined>(undefined);
  const [isSavingInviteSettings, setIsSavingInviteSettings] = useState(false);

  // Delete company state (double confirmation)
  const [showDeleteConfirm1, setShowDeleteConfirm1] = useState(false);
  const [showDeleteConfirm2, setShowDeleteConfirm2] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete employee state (double confirmation)
  const [deleteEmployee, setDeleteEmployee] = useState<CompanyUser | null>(null);
  const [deleteEmpStep, setDeleteEmpStep] = useState(0);
  const [isDeletingEmp, setIsDeletingEmp] = useState(false);

  useEffect(() => {
    if (!isDeveloper) {
      navigate('/dashboard');
      return;
    }
    fetchCompanies();
  }, [isDeveloper, navigate]);

  const handleDeleteEmployee = async () => {
    if (!deleteEmployee) return;
    setIsDeletingEmp(true);
    try {
      const res = await supabase.functions.invoke('delete-employee', {
        body: { target_user_id: deleteEmployee.user_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: 'Employee Deleted', description: `${deleteEmployee.full_name} has been removed.` });
      if (selectedCompany) fetchCompanyUsers(selectedCompany.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete employee', variant: 'destructive' });
    } finally {
      setIsDeletingEmp(false);
      setDeleteEmpStep(0);
      setDeleteEmployee(null);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanyUsers = async (companyId: string) => {
    try {
      // Get profiles for this company
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email')
        .eq('company_id', companyId);

      if (profilesError) throw profilesError;

      // Get roles for these users
      const userIds = (profiles || []).map(p => p.user_id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      const rolesMap = new Map((roles || []).map(r => [r.user_id, r.role]));

      const usersWithRoles = (profiles || []).map(p => ({
        ...p,
        role: rolesMap.get(p.user_id) || 'employee'
      }));

      setCompanyUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching company users:', error);
    }
  };

  const handleSelectCompany = (company: Company) => {
    navigate(`/developer/companies/${company.id}`);
  };

  const slugifyCompanyName = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'company';

  const randomHex = (bytes = 2) => {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const getUniqueCompanySlug = async (baseSlug: string, excludeCompanyId?: string) => {
    // Try base slug first, otherwise append a short suffix.
    // This prevents "companies_slug_key" errors when a company is deleted/recreated.
    const trySlugs = [baseSlug, `${baseSlug}-${randomHex(2)}`, `${baseSlug}-${randomHex(3)}`];

    for (const candidate of trySlugs) {
      let q = supabase.from('companies').select('id').eq('slug', candidate).limit(1);
      if (excludeCompanyId) q = q.neq('id', excludeCompanyId);

      const { data, error } = await q;
      if (!error && (!data || data.length === 0)) return candidate;
    }

    return `${baseSlug}-${randomHex(4)}`;
  };

  const createCompany = async () => {
    const trimmedName = newCompanyName.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    try {
      const baseSlug = slugifyCompanyName(trimmedName);
      const slug = await getUniqueCompanySlug(baseSlug);

      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: trimmedName,
          slug,
        })
        .select()
        .single();

      if (error) throw error;

      setCompanies([data, ...companies]);
      setNewCompanyName('');
      setShowCreateDialog(false);

      toast({
        title: 'Company Created',
        description: `${data.name} has been created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create company',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getInviteBaseUrl = () => {
    return window.location.origin;
  };

  const getInviteLink = (inviteCode?: string | null) => {
    if (!inviteCode) return '';
    // Clean share link (product-style): /invite/<code>
    return `${getInviteBaseUrl()}/invite/${encodeURIComponent(inviteCode)}`;
  };

  const copyInviteLink = (inviteCode?: string | null) => {
    const link = getInviteLink(inviteCode);
    if (!link) {
      toast({
        title: 'Invite link not available',
        description: 'This company does not have an invite link yet.',
        variant: 'destructive',
      });
      return;
    }

    navigator.clipboard.writeText(link);
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard',
    });
  };

  const shareInviteLink = async (inviteCode: string | null, companyName: string) => {
    const link = getInviteLink(inviteCode);

    if (!link) {
      copyInviteLink(inviteCode);
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${companyName}`,
          text: `You've been invited to join ${companyName}. Click the link to register.`,
          url: link,
        });
      } catch {
        copyInviteLink(inviteCode);
      }
    } else {
      copyInviteLink(inviteCode);
    }
  };

  const openInviteSettingsDialog = (company: Company) => {
    setInviteSettingsCompany(company);
    if (company.invite_max_uses === null) {
      setInviteMaxUses('unlimited');
      setInviteMaxUsesCustom('');
    } else {
      setInviteMaxUses('limited');
      setInviteMaxUsesCustom(company.invite_max_uses.toString());
    }
    setInviteExpiresAt(company.invite_expires_at ? new Date(company.invite_expires_at) : undefined);
    setShowInviteSettingsDialog(true);
  };

  const saveInviteSettings = async () => {
    if (!inviteSettingsCompany) return;

    setIsSavingInviteSettings(true);
    try {
      const maxUses = inviteMaxUses === 'unlimited' ? null : parseInt(inviteMaxUsesCustom) || null;
      const expiresAt = inviteExpiresAt ? inviteExpiresAt.toISOString() : null;

      const { error } = await supabase
        .from('companies')
        .update({
          invite_max_uses: maxUses,
          invite_expires_at: expiresAt,
        })
        .eq('id', inviteSettingsCompany.id);

      if (error) throw error;

      // Update local state
      const updatedCompany = {
        ...inviteSettingsCompany,
        invite_max_uses: maxUses,
        invite_expires_at: expiresAt,
      };

      setCompanies(companies.map(c => c.id === inviteSettingsCompany.id ? updatedCompany : c));
      if (selectedCompany?.id === inviteSettingsCompany.id) {
        setSelectedCompany(updatedCompany);
      }

      setShowInviteSettingsDialog(false);
      toast({
        title: 'Invite Settings Updated',
        description: 'Invite link settings have been saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save invite settings',
        variant: 'destructive',
      });
    } finally {
      setIsSavingInviteSettings(false);
    }
  };

  const resetInviteUsage = async (company: Company) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ invite_uses_count: 0 })
        .eq('id', company.id);

      if (error) throw error;

      const updatedCompany = { ...company, invite_uses_count: 0 };
      setCompanies(companies.map(c => c.id === company.id ? updatedCompany : c));
      if (selectedCompany?.id === company.id) {
        setSelectedCompany(updatedCompany);
      }

      toast({
        title: 'Usage Reset',
        description: 'Invite link usage count has been reset to 0.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset usage',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    setEditCompanyName(company.name);
    setShowEditDialog(true);
  };

  const updateCompany = async () => {
    const trimmed = editCompanyName.trim();
    if (!editingCompany || !trimmed) return;

    setIsUpdating(true);
    try {
      const baseSlug = slugifyCompanyName(trimmed);
      const newSlug = await getUniqueCompanySlug(baseSlug, editingCompany.id);

      const { error } = await supabase
        .from('companies')
        .update({
          name: trimmed,
          slug: newSlug,
        })
        .eq('id', editingCompany.id);

      if (error) throw error;

      setCompanies(
        companies.map((c) =>
          c.id === editingCompany.id ? { ...c, name: trimmed, slug: newSlug } : c
        )
      );

      if (selectedCompany?.id === editingCompany.id) {
        setSelectedCompany({ ...selectedCompany, name: trimmed, slug: newSlug });
      }

      setShowEditDialog(false);
      setEditingCompany(null);

      toast({
        title: 'Company Updated',
        description: 'Company name and invite link updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update company',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const assignOwner = async () => {
    if (!selectedCompany || !selectedUserId) return;

    try {
      // First, ensure user is in this company
      await supabase
        .from('profiles')
        .update({ company_id: selectedCompany.id })
        .eq('user_id', selectedUserId);

      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedUserId)
        .maybeSingle();

      if (existingRole) {
        // Update existing role to owner
        await supabase
          .from('user_roles')
          .update({ role: 'owner' })
          .eq('user_id', selectedUserId);
      } else {
        // Insert new owner role
        await supabase
          .from('user_roles')
          .insert({ user_id: selectedUserId, role: 'owner' });
      }

      toast({
        title: 'Owner Assigned',
        description: 'The user has been assigned as company owner.'
      });

      setShowAssignOwnerDialog(false);
      setSelectedUserId('');
      fetchCompanyUsers(selectedCompany.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign owner',
        variant: 'destructive'
      });
    }
  };

  // Delete company handlers
  const openDeleteConfirm = (company: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompanyToDelete(company);
    setShowDeleteConfirm1(true);
  };

  const proceedToSecondConfirm = () => {
    setShowDeleteConfirm1(false);
    setShowDeleteConfirm2(true);
  };

  const deleteCompany = async () => {
    if (!companyToDelete) return;

    setIsDeleting(true);
    try {
      // First, unassign users from this company
      await supabase
        .from('profiles')
        .update({ company_id: null })
        .eq('company_id', companyToDelete.id);

      // Delete the company
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyToDelete.id);

      if (error) throw error;

      // Update local state
      setCompanies(companies.filter(c => c.id !== companyToDelete.id));
      if (selectedCompany?.id === companyToDelete.id) {
        setSelectedCompany(null);
        setCompanyUsers([]);
      }

      setShowDeleteConfirm2(false);
      setCompanyToDelete(null);

      toast({
        title: 'Company Deleted',
        description: `${companyToDelete.name} has been permanently deleted.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete company',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm1(false);
    setShowDeleteConfirm2(false);
    setCompanyToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-6">
      <TopHeader currentView="developer" />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">Company Management</h1>
            <p className="text-sm text-muted-foreground">Manage companies and their owners</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Company</DialogTitle>
                <DialogDescription>
                  Add a new company. Each company will get a unique invite link.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    placeholder="Enter company name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createCompany} disabled={isCreating || !newCompanyName.trim()}>
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Company Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
              <DialogDescription>
                Update company name. The invite link will be updated automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  placeholder="Enter company name"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                />
              </div>
              {editCompanyName && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">New Slug</Label>
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded">
                    /{editCompanyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={updateCompany} disabled={isUpdating || !editCompanyName.trim()}>
                {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
          {/* Companies List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5 text-primary" />
                Companies
              </CardTitle>
              <CardDescription>Click on a company to view its users</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {companies.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No companies yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedCompany?.id === company.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleSelectCompany(company)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{company.name}</p>
                          <p className="text-xs text-muted-foreground truncate">/{company.slug}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(company);
                            }}
                            title="Edit Company"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openInviteSettingsDialog(company);
                            }}
                            title="Invite Settings"
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              shareInviteLink(company.invite_code, company.name);
                            }}
                            title="Share Invite Link"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInviteLink(company.invite_code);
                            }}
                            title="Copy Invite Link"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => openDeleteConfirm(company, e)}
                            title="Delete Company"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Badge variant={company.is_active ? 'default' : 'secondary'} className="hidden sm:flex">
                            {company.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-primary" />
                {selectedCompany ? selectedCompany.name : 'Company Details'}
              </CardTitle>
              {selectedCompany && (
                <div className="space-y-3 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          readOnly
                          value={getInviteLink(selectedCompany.invite_code)}
                          className="h-9 font-mono text-xs"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                      </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => openInviteSettingsDialog(selectedCompany)}
                      title="Invite Settings"
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => shareInviteLink(selectedCompany.invite_code, selectedCompany.name)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => copyInviteLink(selectedCompany.invite_code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Invite Usage Stats */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      {selectedCompany.invite_max_uses === null ? (
                        <>
                          <Infinity className="w-3 h-3" />
                          Unlimited uses
                        </>
                      ) : (
                        <>
                          {selectedCompany.invite_uses_count}/{selectedCompany.invite_max_uses} used
                        </>
                      )}
                    </Badge>
                    {selectedCompany.invite_expires_at && (
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="w-3 h-3" />
                        Expires {format(new Date(selectedCompany.invite_expires_at), 'MMM d, yyyy')}
                      </Badge>
                    )}
                    {!selectedCompany.invite_expires_at && (
                      <Badge variant="outline" className="gap-1">
                        No expiry
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selectedCompany ? (
                <div className="text-center text-muted-foreground py-8">
                  Select a company to view details
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pending Employees Section */}
                  <PendingEmployeesList 
                    companyId={selectedCompany.id} 
                    onUpdate={() => fetchCompanyUsers(selectedCompany.id)}
                  />
                  {/* Actions Bar */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => resetInviteUsage(selectedCompany)}
                      title="Reset usage count"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Usage
                    </Button>
                    <Dialog open={showAssignOwnerDialog} onOpenChange={setShowAssignOwnerDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Crown className="w-4 h-4" />
                          Assign Owner
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Company Owner</DialogTitle>
                          <DialogDescription>
                            Select a user to be the owner of {selectedCompany.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Select User</Label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a user" />
                              </SelectTrigger>
                              <SelectContent>
                                {companyUsers.map((u) => (
                                  <SelectItem key={u.user_id} value={u.user_id}>
                                    {u.full_name} ({u.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAssignOwnerDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={assignOwner} disabled={!selectedUserId}>
                            Assign Owner
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Company Users Table */}
                  {companyUsers.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No users in this company yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyUsers.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.full_name}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {u.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>
                                {u.role === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {u.role !== 'developer' && u.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => { setDeleteEmployee(u); setDeleteEmpStep(1); }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Live Location Tracking Map */}
                  <div className="mt-6">
                    <LiveLocationMap 
                      companyId={selectedCompany.id} 
                      isDeveloper={true}
                      companies={companies.map(c => ({ id: c.id, name: c.name }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invite Settings Dialog */}
        <Dialog open={showInviteSettingsDialog} onOpenChange={setShowInviteSettingsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Link Settings</DialogTitle>
              <DialogDescription>
                Configure usage limits and expiry for {inviteSettingsCompany?.name}'s invite link.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Max Uses */}
              <div className="space-y-3">
                <Label>Maximum Uses</Label>
                <div className="flex gap-2">
                  <Button
                    variant={inviteMaxUses === 'unlimited' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => setInviteMaxUses('unlimited')}
                  >
                    <Infinity className="w-4 h-4" />
                    Unlimited
                  </Button>
                  <Button
                    variant={inviteMaxUses === 'limited' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInviteMaxUses('limited')}
                  >
                    Limited
                  </Button>
                </div>
                {inviteMaxUses === 'limited' && (
                  <Input
                    type="number"
                    placeholder="Enter max uses (e.g. 10)"
                    value={inviteMaxUsesCustom}
                    onChange={(e) => setInviteMaxUsesCustom(e.target.value)}
                    min={1}
                  />
                )}
                {inviteSettingsCompany && (
                  <p className="text-xs text-muted-foreground">
                    Current usage: {inviteSettingsCompany.invite_uses_count} signups
                  </p>
                )}
              </div>

              {/* Expiry */}
              <div className="space-y-3">
                <Label>Expiry Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {inviteExpiresAt ? format(inviteExpiresAt, 'PPP') : 'No expiry (never expires)'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={inviteExpiresAt}
                      onSelect={setInviteExpiresAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {inviteExpiresAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteExpiresAt(undefined)}
                    className="text-xs"
                  >
                    Clear expiry date
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteSettingsDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveInviteSettings} disabled={isSavingInviteSettings}>
                {isSavingInviteSettings && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation - Step 1 */}
        <AlertDialog open={showDeleteConfirm1} onOpenChange={setShowDeleteConfirm1}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Company?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{companyToDelete?.name}</strong>? 
                This will unassign all users from this company.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={proceedToSecondConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation - Step 2 (Final) */}
        <AlertDialog open={showDeleteConfirm2} onOpenChange={setShowDeleteConfirm2}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Final Confirmation</AlertDialogTitle>
              <AlertDialogDescription>
                This action is <strong>permanent and cannot be undone</strong>. 
                All data associated with <strong>{companyToDelete?.name}</strong> will be lost forever.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteCompany}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Employee - First Confirmation */}
        <AlertDialog open={deleteEmpStep === 1}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Delete {deleteEmployee?.full_name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this employee's account and all associated data (attendance, leave requests, face data, etc.).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => { setDeleteEmpStep(0); setDeleteEmployee(null); }}>Cancel</Button>
              <Button variant="destructive" onClick={() => setDeleteEmpStep(2)}>
                Continue
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Employee - Second Confirmation */}
        <AlertDialog open={deleteEmpStep === 2}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. {deleteEmployee?.full_name}'s account and all associated data will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => { setDeleteEmpStep(0); setDeleteEmployee(null); }} disabled={isDeletingEmp}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleDeleteEmployee}
                disabled={isDeletingEmp}
              >
                {isDeletingEmp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {isDeletingEmp ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      
      <MobileBottomNav />
    </div>
  );
}
