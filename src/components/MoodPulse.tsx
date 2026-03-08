import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const MOODS = [
  { key: 'great', emoji: '🤩', label: 'Great', color: 'bg-green-500/20 border-green-500/50' },
  { key: 'good', emoji: '😊', label: 'Good', color: 'bg-emerald-500/20 border-emerald-500/50' },
  { key: 'okay', emoji: '😐', label: 'Okay', color: 'bg-yellow-500/20 border-yellow-500/50' },
  { key: 'bad', emoji: '😔', label: 'Bad', color: 'bg-orange-500/20 border-orange-500/50' },
  { key: 'terrible', emoji: '😫', label: 'Terrible', color: 'bg-red-500/20 border-red-500/50' },
] as const;

export default function MoodPulse() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('mood_entries')
      .select('mood')
      .eq('user_id', user.id)
      .eq('entry_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTodayMood(data.mood);
      });
  }, [user, today]);

  const submitMood = async (mood: string) => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('mood_entries').upsert({
        user_id: user.id,
        company_id: profile?.company_id || null,
        mood,
        entry_date: today,
      }, { onConflict: 'user_id,entry_date' });

      if (error) throw error;
      setTodayMood(mood);
      toast({ title: 'Mood logged! ✨', description: 'Thanks for sharing how you feel today.' });
    } catch {
      toast({ title: 'Error', description: 'Could not save mood', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-foreground mb-3">
          {todayMood ? "Today's mood" : 'How are you feeling today?'}
        </p>
        <div className="flex justify-between gap-1">
          {MOODS.map(m => (
            <button
              key={m.key}
              onClick={() => submitMood(m.key)}
              disabled={submitting}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all duration-200 
                ${todayMood === m.key ? `${m.color} scale-110 shadow-md` : 'border-transparent hover:border-border hover:bg-muted/50'}
                ${todayMood && todayMood !== m.key ? 'opacity-40' : ''}
              `}
            >
              <span className="text-2xl" role="img" aria-label={m.label}>{m.emoji}</span>
              <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
