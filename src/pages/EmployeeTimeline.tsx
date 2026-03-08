import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/AppLayout';
import { Briefcase, Award, Calendar, Star, TrendingUp, UserCheck, Clock, Gift } from 'lucide-react';
import { format, differenceInDays, differenceInYears, differenceInMonths } from 'date-fns';

interface TimelineEvent {
  id: string;
  date: string;
  type: 'joining' | 'promotion' | 'award' | 'milestone' | 'department_change';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export default function EmployeeTimeline() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [awards, setAwards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchData = async () => {
      // Fetch awards
      const { data: awardsData } = await supabase
        .from('employee_awards')
        .select('*')
        .eq('user_id', user.id)
        .order('award_date', { ascending: true });

      setAwards(awardsData || []);
      buildTimeline(awardsData || []);
      setIsLoading(false);
    };

    fetchData();
  }, [user, profile]);

  const buildTimeline = (awardsData: any[]) => {
    if (!profile) return;
    const timeline: TimelineEvent[] = [];

    // Joining event
    if (profile.date_of_joining) {
      const joiningDate = new Date(profile.date_of_joining);
      timeline.push({
        id: 'joining',
        date: profile.date_of_joining,
        type: 'joining',
        title: 'Joined the Team! 🎉',
        description: `Started as ${profile.designation || profile.position || 'Team Member'} in ${profile.department || 'the company'}`,
        icon: <Briefcase className="w-5 h-5" />,
        color: 'bg-primary',
      });

      // Work anniversaries
      const now = new Date();
      const yearsWorked = differenceInYears(now, joiningDate);
      for (let y = 1; y <= yearsWorked; y++) {
        const annivDate = new Date(joiningDate);
        annivDate.setFullYear(annivDate.getFullYear() + y);
        timeline.push({
          id: `anniversary-${y}`,
          date: format(annivDate, 'yyyy-MM-dd'),
          type: 'milestone',
          title: `${y} Year${y > 1 ? 's' : ''} Work Anniversary 🏆`,
          description: `Completed ${y} year${y > 1 ? 's' : ''} of dedicated service`,
          icon: <Star className="w-5 h-5" />,
          color: 'bg-yellow-500',
        });
      }

      // Tenure milestones (100, 500, 1000 days)
      const totalDays = differenceInDays(now, joiningDate);
      [100, 500, 1000, 2000].forEach(milestone => {
        if (totalDays >= milestone) {
          const milestoneDate = new Date(joiningDate);
          milestoneDate.setDate(milestoneDate.getDate() + milestone);
          timeline.push({
            id: `days-${milestone}`,
            date: format(milestoneDate, 'yyyy-MM-dd'),
            type: 'milestone',
            title: `${milestone} Days Milestone! 🔥`,
            description: `Reached ${milestone} days with the organization`,
            icon: <TrendingUp className="w-5 h-5" />,
            color: 'bg-orange-500',
          });
        }
      });
    }

    // Awards
    awardsData.forEach(award => {
      timeline.push({
        id: `award-${award.id}`,
        date: award.award_date,
        type: 'award',
        title: award.award_title,
        description: award.description || `Awarded by ${award.awarded_by}`,
        icon: <Award className="w-5 h-5" />,
        color: 'bg-emerald-500',
      });
    });

    // Sort by date descending (most recent first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEvents(timeline);
  };

  const getTenure = () => {
    if (!profile?.date_of_joining) return null;
    const joining = new Date(profile.date_of_joining);
    const now = new Date();
    const years = differenceInYears(now, joining);
    const months = differenceInMonths(now, joining) % 12;
    const days = differenceInDays(now, joining);
    return { years, months, days };
  };

  const tenure = getTenure();

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-display font-bold text-foreground">My Journey</h1>
          <p className="text-sm text-muted-foreground">Your career timeline & milestones</p>
        </div>

        {/* Tenure Summary */}
        {tenure && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="gradient-hero p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.04] rounded-full -translate-y-1/2 translate-x-1/3" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-80">Total Tenure</p>
                  <p className="text-xl font-display font-bold">
                    {tenure.years > 0 && `${tenure.years}y `}{tenure.months}m · {tenure.days} days
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 rounded-lg p-2.5 text-center">
                  <p className="text-2xl font-bold">{tenure.years}</p>
                  <p className="text-[10px] opacity-70">Years</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2.5 text-center">
                  <p className="text-2xl font-bold">{tenure.months}</p>
                  <p className="text-[10px] opacity-70">Months</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2.5 text-center">
                  <p className="text-2xl font-bold">{tenure.days}</p>
                  <p className="text-[10px] opacity-70">Total Days</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Timeline */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Gift className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Your timeline will appear once your profile is set up.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {events.map((event, idx) => (
                <div key={event.id} className="relative flex gap-4 items-start">
                  {/* Icon circle */}
                  <div className={`relative z-10 w-10 h-10 rounded-full ${event.color} text-white flex items-center justify-center shrink-0 shadow-md`}>
                    {event.icon}
                  </div>

                  {/* Content card */}
                  <Card className="flex-1 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{event.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {format(new Date(event.date), 'MMM d, yyyy')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
