import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

interface WeeklyData {
  day: string;
  present: number;
  absent: number;
  leave: number;
}

interface DeptData {
  name: string;
  count: number;
  fill: string;
}

interface LeaveTypeData {
  type: string;
  count: number;
  fill: string;
}

interface MonthlyTrend {
  date: string;
  attendance: number;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const weeklyChartConfig = {
  present: { label: 'Present', color: 'hsl(var(--chart-1))' },
  absent: { label: 'Absent', color: 'hsl(var(--chart-2))' },
  leave: { label: 'Leave', color: 'hsl(var(--chart-3))' },
};

const deptChartConfig = {
  count: { label: 'Employees' },
};

const leaveChartConfig = {
  count: { label: 'Requests' },
};

const trendChartConfig = {
  attendance: { label: 'Attendance %', color: 'hsl(var(--chart-1))' },
};

export default function DashboardAnalytics() {
  const { profile, role } = useAuth();
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [deptData, setDeptData] = useState<DeptData[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveTypeData[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [profile?.company_id, role]);

  const fetchAnalytics = async () => {
    try {
      await Promise.all([
        fetchWeeklyAttendance(),
        fetchDepartmentBreakdown(),
        fetchLeaveBreakdown(),
        fetchMonthlyTrend(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyAttendance = async () => {
    const days: WeeklyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('date', dateStr);

      const records = data || [];
      days.push({
        day: format(date, 'EEE'),
        present: records.filter(r => r.status === 'present').length,
        absent: records.filter(r => r.status === 'absent').length,
        leave: records.filter(r => r.status === 'leave').length,
      });
    }
    setWeeklyData(days);
  };

  const fetchDepartmentBreakdown = async () => {
    let query = supabase.from('profiles').select('department').eq('is_active', true);
    if (role === 'owner' && profile?.company_id) {
      query = query.eq('company_id', profile.company_id);
    }
    
    const { data } = await query;
    if (!data) return;

    const deptMap = new Map<string, number>();
    data.forEach(p => {
      const dept = p.department || 'Unassigned';
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });

    const sorted = Array.from(deptMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], i) => ({ name, count, fill: COLORS[i % COLORS.length] }));

    setDeptData(sorted);
  };

  const fetchLeaveBreakdown = async () => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('leave_requests')
      .select('leave_type')
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    if (!data) return;

    const typeMap = new Map<string, number>();
    data.forEach(r => {
      const type = r.leave_type || 'Other';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const result = Array.from(typeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        fill: COLORS[i % COLORS.length],
      }));

    setLeaveData(result);
  };

  const fetchMonthlyTrend = async () => {
    const start = startOfMonth(new Date());
    const end = new Date();
    const allDays = eachDayOfInterval({ start, end });

    let query = supabase.from('profiles').select('user_id').eq('is_active', true);
    if (role === 'owner' && profile?.company_id) {
      query = query.eq('company_id', profile.company_id);
    }
    const { data: profiles } = await query;
    const totalEmployees = profiles?.length || 1;

    const trend: MonthlyTrend[] = [];
    for (const day of allDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr)
        .eq('status', 'present');

      trend.push({
        date: format(day, 'dd'),
        attendance: Math.round(((count || 0) / totalEmployees) * 100),
      });
    }
    setMonthlyTrend(trend);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="h-[280px] animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Weekly Attendance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Weekly Attendance
          </CardTitle>
          <CardDescription className="text-xs">Last 7 days breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={weeklyChartConfig} className="h-[200px] w-full">
            <BarChart data={weeklyData}>
              <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="present" fill="var(--color-present)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="absent" fill="var(--color-absent)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="leave" fill="var(--color-leave)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly Attendance Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Monthly Trend
          </CardTitle>
          <CardDescription className="text-xs">Attendance % this month</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendChartConfig} className="h-[200px] w-full">
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="var(--color-attendance)"
                fill="url(#attendanceGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Department Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Department Distribution
          </CardTitle>
          <CardDescription className="text-xs">Active employees by department</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={deptChartConfig} className="h-[200px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={deptData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={40}
                paddingAngle={2}
              >
                {deptData.map((entry, index) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          {deptData.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {deptData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                  {d.name} ({d.count})
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Requests Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Leave Requests
          </CardTitle>
          <CardDescription className="text-xs">This month by type</CardDescription>
        </CardHeader>
        <CardContent>
          {leaveData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              No leave requests this month
            </div>
          ) : (
            <ChartContainer config={leaveChartConfig} className="h-[200px] w-full">
              <BarChart data={leaveData} layout="vertical">
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="type" type="category" fontSize={11} tickLine={false} axisLine={false} width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {leaveData.map((entry) => (
                    <Cell key={entry.type} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
