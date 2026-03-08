import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import {
  Bell, CheckCheck, Trash2, Megaphone, Wallet, Calendar,
  ClipboardList, Settings, ExternalLink, Inbox, Filter,
  BellRing, BellOff
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from 'date-fns';
import AppLayout from '@/components/AppLayout';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  ANNOUNCEMENT: Megaphone,
  PAYROLL: Wallet,
  LEAVE: Calendar,
  ATTENDANCE: ClipboardList,
  SYSTEM: Settings,
};

const typeLabels: Record<string, string> = {
  ANNOUNCEMENT: 'Announcements',
  PAYROLL: 'Payroll',
  LEAVE: 'Leave',
  ATTENDANCE: 'Attendance',
  SYSTEM: 'System',
};

type FilterType = 'all' | 'unread' | 'ANNOUNCEMENT' | 'LEAVE' | 'ATTENDANCE' | 'PAYROLL' | 'SYSTEM';

function groupByDate(notifications: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const groups: Map<string, NotificationItem[]> = new Map();

  for (const n of notifications) {
    const date = new Date(n.created_at);
    let label: string;
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else if (isThisWeek(date)) label = format(date, 'EEEE');
    else label = format(date, 'MMM d, yyyy');

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(n);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setNotifications(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as NotificationItem, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  };

  const handleClick = (n: NotificationItem) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link_url) navigate(n.link_url);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalCount = notifications.length;

  // Filter
  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return n.type === filter;
  });

  const grouped = groupByDate(filtered);

  // Type counts for filter badges
  const typeCounts = notifications.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl space-y-5">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total"
            value={totalCount}
            icon={<Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <StatCard
            label="Unread"
            value={unreadCount}
            valueColor="text-destructive"
            icon={<BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />}
            iconBg="bg-destructive/10"
          />
          <StatCard
            label="Read"
            value={totalCount - unreadCount}
            valueColor="text-success"
            icon={<BellOff className="w-4 h-4 sm:w-5 sm:h-5 text-success" />}
            iconBg="bg-success/10"
          />
        </div>

        {/* Header + Actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-2xl font-bold font-display flex items-center gap-2">
            <Inbox className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Notifications
          </h1>
          <div className="flex gap-1.5">
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllAsRead} className="text-xs">
                <CheckCheck className="w-3.5 h-3.5 mr-1" /> Read all
              </Button>
            )}
            {totalCount > 0 && (
              <Button size="sm" variant="ghost" onClick={clearAll} className="text-xs text-muted-foreground">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="overflow-x-auto -mx-3 px-3 pb-1">
          <div className="flex gap-1.5 min-w-max">
            {([
              { key: 'all', label: 'All' },
              { key: 'unread', label: `Unread (${unreadCount})` },
              ...Object.entries(typeCounts).map(([type, count]) => ({
                key: type,
                label: `${typeLabels[type] || type} (${count})`,
              })),
            ] as { key: FilterType; label: string }[]).map(tab => (
              <Button
                key={tab.key}
                size="sm"
                variant={filter === tab.key ? 'default' : 'outline'}
                className="text-xs h-7 px-2.5 rounded-full"
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">
              {filter === 'all' ? 'No notifications yet' : 'No notifications match this filter'}
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            {grouped.map(group => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.items.map(n => {
                    const Icon = typeIcons[n.type] || Bell;
                    return (
                      <Card
                        key={n.id}
                        className={`cursor-pointer hover:bg-muted/30 transition-colors ${!n.is_read ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
                        onClick={() => handleClick(n)}
                      >
                        <CardContent className="p-3 flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-primary/10' : 'bg-muted'}`}>
                            <Icon className={`w-4 h-4 ${!n.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                              <Badge variant="secondary" className="text-[9px] shrink-0">{n.type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                              </p>
                              {n.link_url && <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50" />}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 shrink-0"
                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          >
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  );
}
