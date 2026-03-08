import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { UserCheck, Coffee, Palmtree, HelpCircle } from 'lucide-react';

type AvailabilityStatus = 'present' | 'absent' | 'on_leave' | 'unknown';

interface TeamMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  status: AvailabilityStatus;
}

const statusConfig: Record<AvailabilityStatus, { label: string; icon: React.ElementType; badgeClass: string }> = {
  present: { label: 'In Office', icon: UserCheck, badgeClass: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
  absent: { label: 'Absent', icon: Coffee, badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  on_leave: { label: 'On Leave', icon: Palmtree, badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  unknown: { label: 'Unknown', icon: HelpCircle, badgeClass: 'bg-muted text-muted-foreground border-border' },
};

export default function TeamAvailabilityBoard() {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user || !profile?.company_id) return;
    fetchTeam();
  }, [user, profile?.company_id]);

  const fetchTeam = async () => {
    setLoading(true);
    const companyId = profile?.company_id;

    // Fetch profiles + today's attendance + today's leaves
    const [profilesRes, attendanceRes, leavesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, avatar_url, department')
        .eq('company_id', companyId!).eq('is_active', true).limit(50),
      supabase.from('attendance').select('user_id, status, check_in_time')
        .eq('date', today),
      supabase.from('leave_requests').select('user_id')
        .eq('status', 'approved')
        .lte('start_date', today).gte('end_date', today),
    ]);

    const attendanceMap = new Map<string, string>();
    (attendanceRes.data || []).forEach(a => attendanceMap.set(a.user_id, a.status));

    const leaveSet = new Set<string>();
    (leavesRes.data || []).forEach(l => leaveSet.add(l.user_id));

    const team: TeamMember[] = (profilesRes.data || []).map(p => {
      let status: AvailabilityStatus = 'unknown';
      if (leaveSet.has(p.user_id)) status = 'on_leave';
      else if (attendanceMap.has(p.user_id)) status = attendanceMap.get(p.user_id) === 'present' ? 'present' : 'absent';
      return { ...p, status };
    });

    // Sort: present first, then on_leave, then absent, then unknown
    const order: Record<AvailabilityStatus, number> = { present: 0, on_leave: 1, absent: 2, unknown: 3 };
    team.sort((a, b) => order[a.status] - order[b.status]);

    setMembers(team);
    setLoading(false);
  };

  const counts = members.reduce<Record<AvailabilityStatus, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, { present: 0, absent: 0, on_leave: 0, unknown: 0 });

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Team Availability</p>
          <p className="text-[10px] text-muted-foreground">Live • {format(new Date(), 'MMM d')}</p>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap">
          {(['present', 'on_leave', 'absent'] as AvailabilityStatus[]).map(s => {
            const cfg = statusConfig[s];
            return (
              <Badge key={s} variant="outline" className={`${cfg.badgeClass} text-[10px] gap-1`}>
                <cfg.icon className="w-3 h-3" />
                {counts[s]} {cfg.label}
              </Badge>
            );
          })}
        </div>

        {/* Member list */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
          {members.slice(0, 30).map(m => {
            const cfg = statusConfig[m.status];
            return (
              <div key={m.user_id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">
                    {m.full_name?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-foreground truncate">{m.full_name}</p>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      m.status === 'present' ? 'bg-green-500' :
                      m.status === 'on_leave' ? 'bg-blue-500' :
                      m.status === 'absent' ? 'bg-orange-500' : 'bg-muted-foreground'
                    }`} />
                    <span className="text-[9px] text-muted-foreground">{cfg.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
