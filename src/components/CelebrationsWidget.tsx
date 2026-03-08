import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PartyPopper, Award } from 'lucide-react';
import { format, differenceInYears, isSameDay, addDays } from 'date-fns';

interface Anniversary {
  full_name: string;
  date_of_joining: string;
  years: number;
  daysUntil: number;
}

export default function CelebrationsWidget() {
  const { profile } = useAuth();
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, date_of_joining')
        .eq('is_active', true)
        .not('date_of_joining', 'is', null);

      if (!data) return;

      const today = new Date();
      const upcoming: Anniversary[] = [];

      data.forEach(emp => {
        if (!emp.date_of_joining) return;
        const doj = new Date(emp.date_of_joining);
        const years = differenceInYears(today, doj);
        if (years < 1) return; // Skip if less than 1 year

        // Check if anniversary is within next 7 days
        const thisYearAnniversary = new Date(today.getFullYear(), doj.getMonth(), doj.getDate());
        const diff = Math.ceil((thisYearAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diff >= 0 && diff <= 7) {
          upcoming.push({
            full_name: emp.full_name,
            date_of_joining: emp.date_of_joining,
            years,
            daysUntil: diff,
          });
        }
      });

      upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
      setAnniversaries(upcoming);
    };
    fetch();
  }, []);

  if (anniversaries.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-accent/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <PartyPopper className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Upcoming Work Anniversaries</p>
        </div>
        <div className="space-y-2">
          {anniversaries.slice(0, 5).map((a, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm truncate">{a.full_name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary" className="text-[10px]">{a.years} yr{a.years > 1 ? 's' : ''}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  {a.daysUntil === 0 ? 'Today!' : `in ${a.daysUntil}d`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
