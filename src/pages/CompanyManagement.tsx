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
import { Building2, Plus, Copy, Users, Link2, Crown, Loader2, Pencil, Share2 } from 'lucide-react';
import TopHeader from '@/components/TopHeader';
import MobileBottomNav from '@/components/MobileBottomNav';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  invite_code: string;
  is_active: boolean;
  created_at: string;
}

interface CompanyUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role?: string;
}

export default function CompanyManagement() {
  const { user, isDeveloper } = useAuth();
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

  useEffect(() => {
    if (!isDeveloper) {
      navigate('/dashboard');
      return;
    }
    fetchCompanies();
  }, [isDeveloper, navigate]);

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
    setSelectedCompany(company);
    fetchCompanyUsers(company.id);
  };

  const createCompany = async () => {
    if (!newCompanyName.trim()) return;

    setIsCreating(true);
    try {
      const slug = newCompanyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: newCompanyName,
          slug: slug
        })
        .select()
        .single();

      if (error) throw error;

      setCompanies([data, ...companies]);
      setNewCompanyName('');
      setShowCreateDialog(false);
      
      toast({
        title: 'Company Created',
        description: `${data.name} has been created successfully.`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create company',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Get the production URL (use custom domain or .lovable.app, not .lovableproject.com)
  const getProductionUrl = () => {
    const origin = window.location.origin;
    // If we're on the preview domain, convert to production domain
    if (origin.includes('lovableproject.com')) {
      // Extract the project ID and use the production URL
      const projectId = origin.match(/([a-f0-9-]+)\.lovableproject\.com/)?.[1];
      if (projectId) {
        return `https://${projectId}.lovable.app`;
      }
    }
    return origin;
  };

  const copyInviteLink = (inviteCode: string) => {
    const link = `${getProductionUrl()}/auth?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard'
    });
  };

  const shareInviteLink = async (inviteCode: string, companyName: string) => {
    const link = `${getProductionUrl()}/auth?invite=${inviteCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${companyName} on AttendanceHub`,
          text: `You've been invited to join ${companyName}. Click the link to register.`,
          url: link
        });
      } catch (error) {
        // User cancelled or share failed, fallback to copy
        copyInviteLink(inviteCode);
      }
    } else {
      // Fallback to copy if share not supported
      copyInviteLink(inviteCode);
    }
  };

  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    setEditCompanyName(company.name);
    setShowEditDialog(true);
  };

  const updateCompany = async () => {
    if (!editingCompany || !editCompanyName.trim()) return;

    setIsUpdating(true);
    try {
      const newSlug = editCompanyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const { error } = await supabase
        .from('companies')
        .update({
          name: editCompanyName,
          slug: newSlug
        })
        .eq('id', editingCompany.id);

      if (error) throw error;

      setCompanies(companies.map(c => 
        c.id === editingCompany.id 
          ? { ...c, name: editCompanyName, slug: newSlug }
          : c
      ));
      
      if (selectedCompany?.id === editingCompany.id) {
        setSelectedCompany({ ...selectedCompany, name: editCompanyName, slug: newSlug });
      }

      setShowEditDialog(false);
      setEditingCompany(null);
      
      toast({
        title: 'Company Updated',
        description: `Company name and invite link updated successfully.`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update company',
        variant: 'destructive'
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
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInviteLink(company.invite_code);
                            }}
                          >
                            <Copy className="w-4 h-4" />
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
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm min-w-0 flex-1 overflow-hidden">
                    <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <code className="text-xs truncate block">
                      /auth?invite={selectedCompany.invite_code.slice(0, 8)}...
                    </code>
                  </div>
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
              )}
            </CardHeader>
            <CardContent>
              {!selectedCompany ? (
                <div className="text-center text-muted-foreground py-8">
                  Select a company to view details
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <MobileBottomNav />
    </div>
  );
}
