import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { format } from 'date-fns';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
  created_at: string;
}

export default function HolidayManagement() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const fromDeveloper = location.state?.from === 'developer';
  
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    description: '',
  });

  const fetchHolidays = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast({
        title: 'Error',
        description: 'Failed to load holidays',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchHolidays();
  }, [authLoading, isAdmin, navigate, fetchHolidays]);

  const handleOpenDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        name: holiday.name,
        date: holiday.date,
        description: holiday.description || '',
      });
    } else {
      setEditingHoliday(null);
      setFormData({ name: '', date: '', description: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.date) {
      toast({
        title: 'Error',
        description: 'Name and date are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingHoliday) {
        const { error } = await supabase
          .from('holidays')
          .update({
            name: formData.name,
            date: formData.date,
            description: formData.description || null,
          })
          .eq('id', editingHoliday.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Holiday updated successfully' });
      } else {
        const { error } = await supabase
          .from('holidays')
          .insert({
            name: formData.name,
            date: formData.date,
            description: formData.description || null,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Holiday added successfully' });
      }

      setIsDialogOpen(false);
      fetchHolidays();
    } catch (error: any) {
      console.error('Error saving holiday:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save holiday',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Holiday deleted successfully' });
      fetchHolidays();
    } catch (error: any) {
      console.error('Error deleting holiday:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete holiday',
        variant: 'destructive',
      });
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

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-6">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-warning-soft flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-lg truncate">Holiday Management</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Manage company holidays</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm" onClick={() => handleOpenDialog()} className="shrink-0">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Holiday</span>
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-[90vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    {editingHoliday ? 'Update holiday details' : 'Add a new company holiday'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Holiday Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., New Year's Day"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Add any additional details..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="hero" onClick={handleSubmit}>
                    <Save className="w-4 h-4 mr-2" />
                    {editingHoliday ? 'Update' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Company Holidays</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {holidays.length} {holidays.length === 1 ? 'holiday' : 'holidays'} configured
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs sm:text-sm">Holiday Name</TableHead>
                    <TableHead className="text-xs sm:text-sm">Date</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Description</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                        No holidays configured. Add your first holiday.
                      </TableCell>
                    </TableRow>
                  ) : (
                    holidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">{holiday.name}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{format(new Date(holiday.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate text-xs sm:text-sm hidden sm:table-cell">
                          {holiday.description || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 sm:w-8 sm:h-8"
                              onClick={() => handleOpenDialog(holiday)}
                            >
                              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-7 h-7 sm:w-8 sm:h-8">
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-base sm:text-lg">Delete Holiday</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs sm:text-sm">
                                    Are you sure you want to delete "{holiday.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(holiday.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
