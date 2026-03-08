import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Flame, Medal, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, eachDayOfInterval, isWeekend } from 'date-fns';

interface LeaderEntry {
  userId: string;
  name: string;
  presentDays: number;
  streak: number;
  onTimeRate: number;
}

export default function TeamLeaderboard() {
  const { user, profile } = useAuth();
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [myStreak, setMyStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.company_id) return;
    fetchLeaderboard();
  }, [user, profile]);

  const fetchLeaderboard = async () => {
    try {
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Get company profiles
      const { data: companyProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('company_id', profile!.company_id!)
        .eq('is_active', true)
        .limit(50);

      if (!companyProfiles?.length) { setIsLoading(false); return; }

      const userIds = companyProfiles.map(p => p.user_id);

      // Get attendance for this month
      const { data: attendance } = await supabase
        .from('attendance')
        .select('user_id, date, status, check_in_time')
        .in('user_id', userIds)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (!attendance) { setIsLoading(false); return; }

      // Build leaderboard
      const userMap = new Map<string, { present: number; onTime: number; total: number }>();
      attendance.forEach(a => {
        if (!userMap.has(a.user_id)) userMap.set(a.user_id, { present: 0, onTime: 0, total: 0 });
        const entry = userMap.get(a.user_id)!;
        entry.total++;
        if (a.status === 'present') {
          entry.present++;
          // Consider on-time if checked in before 10:00 AM
          if (a.check_in_time) {
            const checkInHour = new Date(a.check_in_time).getHours();
            if (checkInHour < 10) entry.onTime++;
          }
        }
      });

      // Calculate streaks (consecutive present days working backwards)
      const streakMap = new Map<string, number>();
      for (const uid of userIds) {
        let streak = 0;
        let checkDate = new Date();
        for (let i = 0; i < 60; i++) {
          checkDate = subDays(new Date(), i);
          if (isWeekend(checkDate)) continue;
          const dateStr = format(checkDate, 'yyyy-MM-dd');
          const att = attendance.find(a => a.user_id === uid && a.date === dateStr);
          if (att?.status === 'present') {
            streak++;
          } else if (i > 0) { // Skip today if not marked yet
            break;
          }
        }
        streakMap.set(uid, streak);
      }

      const leaderboard: LeaderEntry[] = companyProfiles.map(p => {
        const stats = userMap.get(p.user_id) || { present: 0, onTime: 0, total: 0 };
        return {
          userId: p.user_id,
          name: p.full_name,
          presentDays: stats.present,
          streak: streakMap.get(p.user_id) || 0,
          onTimeRate: stats.present > 0 ? Math.round((stats.onTime / stats.present) * 100) : 0,
        };
      });

      // Sort by present days, then streak
      leaderboard.sort((a, b) => b.presentDays - a.presentDays || b.streak - a.streak);

      setLeaders(leaderboard.slice(0, 10));
      setMyStreak(streakMap.get(user!.id) || 0);
    } catch (e) {
      console.error('Leaderboard error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="text-lg">🥇</span>;
    if (index === 1) return <span className="text-lg">🥈</span>;
    if (index === 2) return <span className="text-lg">🥉</span>;
    return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (isLoading) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Team Leaderboard
          </CardTitle>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            My Streak: {myStreak}d
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {leaders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No attendance data this month yet</p>
        ) : (
          <div className="space-y-1.5">
            {leaders.map((entry, idx) => {
              const isMe = entry.userId === user?.id;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                    isMe ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="w-5 flex justify-center">{getRankBadge(idx)}</div>
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-[10px] bg-muted">{getInitials(entry.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                      {entry.name} {isMe && '(You)'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{entry.presentDays}d present</span>
                      {entry.streak > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5 text-orange-500" />{entry.streak}d streak
                        </span>
                      )}
                    </div>
                  </div>
                  {entry.onTimeRate > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                      {entry.onTimeRate}%
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
