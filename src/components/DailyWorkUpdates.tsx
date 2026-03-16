import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Send, Image as ImageIcon, Calendar, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import PhotoThumbnail from '@/components/PhotoThumbnail';

interface DailyUpdate {
  id: string;
  photo_url: string | null;
  description: string;
  update_date: string;
  created_at: string;
}

export default function DailyWorkUpdates() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayPosted = updates.some(u => u.update_date === today);

  const fetchUpdates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('daily_work_updates')
      .select('*')
      .eq('user_id', user.id)
      .order('update_date', { ascending: false })
      .limit(30);
    setUpdates((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Too large', description: 'Max 5MB allowed', variant: 'destructive' });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user || !profile?.company_id || !description.trim()) {
      toast({ title: 'Error', description: 'Please write what you did today', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const path = `${user.id}/${today}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('daily-updates')
          .upload(path, photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        photoUrl = path;
      }

      const { error } = await supabase.from('daily_work_updates').insert({
        user_id: user.id,
        company_id: profile.company_id,
        photo_url: photoUrl,
        description: description.trim(),
        update_date: today,
      } as any);

      if (error) throw error;

      toast({ title: 'Posted!', description: 'Your daily update has been submitted' });
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);
      fetchUpdates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('daily_work_updates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
      fetchUpdates();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Post new update */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            Daily Work Update
          </CardTitle>
          <CardDescription>
            {todayPosted ? "You've already posted today's update" : "Share what you worked on today"}
          </CardDescription>
        </CardHeader>
        {!todayPosted && (
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>What did you do today?</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your work, tasks completed, progress made..."
                rows={3}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">{description.length}/1000</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed hover:bg-muted/50 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {photoFile ? photoFile.name : 'Attach photo'}
                  </span>
                </div>
              </label>

              {photoPreview && (
                <div className="relative w-12 h-12 rounded-md overflow-hidden border">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    className="absolute top-0 right-0 bg-destructive/80 text-white rounded-bl p-0.5"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="w-full sm:w-auto"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Post Update
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Previous updates */}
      {updates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {updates.map(u => (
              <div key={u.id} className="flex gap-3 p-3 rounded-lg border bg-muted/20">
                {u.photo_url && (
                  <PhotoThumbnail photoUrl={u.photo_url} alt="Work photo" size="md" bucket="daily-updates" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(new Date(u.update_date), 'dd MMM yyyy')}
                    </Badge>
                    {u.update_date === today && (
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Today</Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{u.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(u.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
