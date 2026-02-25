import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Users, CheckCircle2, XCircle, Calendar, Loader2, User } from 'lucide-react';

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  designation: string | null;
}

interface TodayAttendance {
  user_id: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

export default function ManagerTeam() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [todayAtt, setTodayAtt] = useState<TodayAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTeam = async () => {
      const { data: members } = await supabase.from('profiles')
        .select('user_id, full_name, email, department, designation')
        .eq('manager_id', user.id).eq('is_active', true);

      setTeam(members || []);

      if (members && members.length > 0) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: att } = await supabase.from('attendance').select('user_id, status, check_in_time, check_out_time')
          .in('user_id', members.map(m => m.user_id)).eq('date', today);
        setTodayAtt(att || []);
      }
      setLoading(false);
    };
    fetchTeam();
  }, [user]);

  const getAttendance = (userId: string) => todayAtt.find(a => a.user_id === userId);
  const presentCount = todayAtt.filter(a => a.status === 'present').length;

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> My Team
          </h1>
          <p className="text-sm text-muted-foreground">View your team members and their attendance</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 border-l-4 border-l-primary">
            <p className="text-[10px] text-muted-foreground uppercase">Team Size</p>
            <p className="text-xl font-bold">{team.length}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-success">
            <p className="text-[10px] text-muted-foreground uppercase">Present Today</p>
            <p className="text-xl font-bold text-success">{presentCount}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-destructive">
            <p className="text-[10px] text-muted-foreground uppercase">Absent</p>
            <p className="text-xl font-bold text-destructive">{team.length - presentCount}</p>
          </Card>
        </div>

        {team.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No team members assigned to you yet</p>
            <p className="text-xs text-muted-foreground mt-1">Ask your admin to assign employees to your team</p>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map(m => {
                  const att = getAttendance(m.user_id);
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{m.full_name}</p>
                            <p className="text-xs text-muted-foreground">{m.designation || ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{m.department || '-'}</TableCell>
                      <TableCell className="text-sm">{att?.check_in_time ? format(new Date(att.check_in_time), 'hh:mm a') : '-'}</TableCell>
                      <TableCell className="text-sm">{att?.check_out_time ? format(new Date(att.check_out_time), 'hh:mm a') : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={att?.status === 'present' ? 'default' : 'secondary'} className="text-xs">
                          {att?.status || 'not marked'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
