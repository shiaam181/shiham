import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { FileText, Upload, Trash2, Download, Search, Filter, Plus } from 'lucide-react';
import { format } from 'date-fns';

const DOCUMENT_TYPES = [
  { value: 'id_proof', label: 'ID Proof' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'experience_letter', label: 'Experience Letter' },
  { value: 'educational', label: 'Educational Certificate' },
  { value: 'pan_card', label: 'PAN Card' },
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'bank_details', label: 'Bank Details' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

interface Document {
  id: string;
  user_id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  notes: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
}

export default function DocumentManagement() {
  const { user, isAdmin, isDeveloper, isHR, isOwner } = useAuth();
  const isManagerRole = isAdmin || isDeveloper || isHR || isOwner;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('other');
  const [docNotes, setDocNotes] = useState('');
  const [targetUserId, setTargetUserId] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setDocuments(data as Document[]);
    setLoading(false);
  };

  const fetchEmployees = async () => {
    if (!isManagerRole) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, department')
      .eq('is_active', true)
      .order('full_name');
    if (data) setEmployees(data);
  };

  useEffect(() => {
    fetchDocuments();
    fetchEmployees();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !docName) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }

    const uploadUserId = isManagerRole && targetUserId ? targetUserId : user?.id;
    if (!uploadUserId) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${uploadUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('employee_documents').insert({
        user_id: uploadUserId,
        company_id: null, // Will be set by profile's company_id context
        document_name: docName,
        document_type: docType,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        uploaded_by: user!.id,
        notes: docNotes || null,
      });

      if (insertError) throw insertError;

      toast({ title: 'Document uploaded successfully' });
      setShowUpload(false);
      resetForm();
      fetchDocuments();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    const { error: storageError } = await supabase.storage
      .from('employee-documents')
      .remove([doc.file_path]);

    const { error: dbError } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', doc.id);

    if (!dbError) {
      toast({ title: 'Document deleted' });
      fetchDocuments();
    } else {
      toast({ title: 'Delete failed', description: dbError.message, variant: 'destructive' });
    }
  };

  const handleDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage
      .from('employee-documents')
      .createSignedUrl(doc.file_path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setDocName('');
    setDocType('other');
    setDocNotes('');
    setTargetUserId('');
  };

  const getEmployeeName = (userId: string) => {
    const emp = employees.find(e => e.user_id === userId);
    return emp?.full_name || 'Unknown';
  };

  const getTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = documents.filter(doc => {
    const matchesSearch = doc.document_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || doc.document_type === filterType;
    const matchesEmployee = filterEmployee === 'all' || doc.user_id === filterEmployee;
    return matchesSearch && matchesType && matchesEmployee;
  });

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <PageHeader title="Document Management" description="Upload and manage employee documents securely" />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{documents.length}</p>
              <p className="text-sm text-muted-foreground">Total Documents</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {new Set(documents.map(d => d.user_id)).size}
              </p>
              <p className="text-sm text-muted-foreground">Employees</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {new Set(documents.map(d => d.document_type)).size}
              </p>
              <p className="text-sm text-muted-foreground">Document Types</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {formatFileSize(documents.reduce((sum, d) => sum + (d.file_size || 0), 0))}
              </p>
              <p className="text-sm text-muted-foreground">Total Size</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCUMENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isManagerRole && (
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-2" /> Upload Document
          </Button>
        </div>

        {/* Documents table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3" />
                <p>No documents found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    {isManagerRole && <TableHead>Employee</TableHead>}
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium">{doc.document_name}</p>
                            {doc.notes && <p className="text-xs text-muted-foreground">{doc.notes}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getTypeLabel(doc.document_type)}</Badge>
                      </TableCell>
                      {isManagerRole && (
                        <TableCell>{getEmployeeName(doc.user_id)}</TableCell>
                      )}
                      <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>{format(new Date(doc.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(doc)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isManagerRole && (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={targetUserId} onValueChange={setTargetUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee (or self)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={user?.id || ''}>Myself</SelectItem>
                      {employees.filter(e => e.user_id !== user?.id).map(e => (
                        <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Document Name *</Label>
                <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Aadhaar Card" />
              </div>
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>File *</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOC — max 10 MB</p>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowUpload(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile || !docName}>
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
