import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarCheck, Clock, Gift, Bell } from 'lucide-react';
import { format, addDays, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface SmartAlert {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  type: 'warning' | 'info' | 'success';
  action?: string;
}

export default function SmartNotificationsWidget() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);

  useEffect(() => {
    if (!user) return;
    generateAlerts();
  }, [user, profile]);

  const generateAlerts = async () => {
    const newAlerts: SmartAlert[] = [];
    const today = format(new Date(), 'yyyy-MM-dd');

    // 1. Check if punched in but not punched out yesterday
    const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
    const { data: yesterdayAtt } = await supabase
      .from('attendance')
      .select('check_in_time, check_out_time')
      .eq('user_id', user!.id)
      .eq('date', yesterday)
      .maybeSingle();

    if (yesterdayAtt?.check_in_time && !yesterdayAtt?.check_out_time) {
      newAlerts.push({
        id: 'missing-punchout',
        icon: <AlertTriangle className="w-4 h-4" />,
        title: 'Missing Punch-Out',
        description: `You forgot to check out yesterday. Request regularization.`,
        type: 'warning',
        action: '/my-attendance',
      });
    }

    // 2. Check today's attendance
    const { data: todayAtt } = await supabase
      .from('attendance')
      .select('check_in_time')
      .eq('user_id', user!.id)
      .eq('date', today)
      .maybeSingle();

    if (!todayAtt?.check_in_time) {
      const hour = new Date().getHours();
      if (hour >= 9) {
        newAlerts.push({
          id: 'not-checked-in',
          icon: <Clock className="w-4 h-4" />,
          title: 'Not Checked In Yet',
          description: 'Don\'t forget to mark your attendance today!',
          type: 'warning',
          action: '/employee-home',
        });
      }
    }

    // 3. Upcoming holidays (next 7 days)
    const weekLater = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const { data: holidays } = await supabase
      .from('holidays')
      .select('name, date')
      .gte('date', today)
      .lte('date', weekLater)
      .order('date')
      .limit(3);

    holidays?.forEach(h => {
      const hDate = new Date(h.date);
      const label = isToday(hDate) ? 'Today' : isTomorrow(hDate) ? 'Tomorrow' : format(hDate, 'EEE, MMM d');
      newAlerts.push({
        id: `holiday-${h.date}`,
        icon: <Gift className="w-4 h-4" />,
        title: `Holiday: ${h.name}`,
        description: label,
        type: 'info',
      });
    });

    // 4. Pending leave requests
    const { data: pendingLeaves, count } = await supabase
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('status', 'pending');

    if (count && count > 0) {
      newAlerts.push({
        id: 'pending-leaves',
        icon: <CalendarCheck className="w-4 h-4" />,
        title: `${count} Pending Leave Request${count > 1 ? 's' : ''}`,
        description: 'Waiting for approval',
        type: 'info',
        action: '/my-leaves',
      });
    }

    // 5. Work anniversary approaching (within 7 days)
    if (profile?.date_of_joining) {
      const joining = new Date(profile.date_of_joining);
      const now = new Date();
      const nextAnniv = new Date(joining);
      nextAnniv.setFullYear(now.getFullYear());
      if (nextAnniv < now) nextAnniv.setFullYear(now.getFullYear() + 1);
      
      const daysUntil = differenceInDays(nextAnniv, now);
      if (daysUntil >= 0 && daysUntil <= 7) {
        newAlerts.push({
          id: 'anniversary',
          icon: <Gift className="w-4 h-4" />,
          title: daysUntil === 0 ? '🎉 Happy Work Anniversary!' : `Work Anniversary in ${daysUntil} day${daysUntil > 1 ? 's' : ''}!`,
          description: daysUntil === 0 ? 'Congratulations on another year!' : 'Your work anniversary is coming up',
          type: 'success',
          action: '/my-timeline',
        });
      }
    }

    setAlerts(newAlerts);
  };

  if (alerts.length === 0) return null;

  const typeStyles = {
    warning: 'border-l-yellow-500 bg-yellow-500/5',
    info: 'border-l-primary bg-primary/5',
    success: 'border-l-emerald-500 bg-emerald-500/5',
  };

  const iconStyles = {
    warning: 'text-yellow-600',
    info: 'text-primary',
    success: 'text-emerald-600',
  };

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <Bell className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground">Smart Alerts</p>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{alerts.length}</Badge>
        </div>
        <div className="space-y-1.5">
          {alerts.slice(0, 4).map(alert => (
            <button
              key={alert.id}
              onClick={() => alert.action && navigate(alert.action)}
              className={`w-full text-left rounded-lg border-l-[3px] p-2.5 transition-colors hover:opacity-80 ${typeStyles[alert.type]}`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 ${iconStyles[alert.type]}`}>{alert.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{alert.title}</p>
                  <p className="text-[11px] text-muted-foreground">{alert.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
