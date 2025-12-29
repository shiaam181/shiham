import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Timer, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

interface OvertimeData {
  week: string;
  overtime: number;
  regular: number;
}

interface AttendanceRecord {
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  overtime_minutes: number | null;
}

const chartConfig = {
  overtime: {
    label: "Overtime",
    color: "hsl(var(--warning))",
  },
  regular: {
    label: "Regular",
    color: "hsl(var(--primary))",
  },
};

export default function OvertimeChart() {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<OvertimeData[]>([]);
  const [totalOvertime, setTotalOvertime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOvertimeData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);

      const { data, error } = await supabase
        .from('attendance')
        .select('date, check_in_time, check_out_time, overtime_minutes')
        .eq('user_id', user.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .eq('status', 'present');

      if (error) throw error;

      // Calculate weekly data
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      
      const weeklyData: OvertimeData[] = weeks.map((weekStart, index) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        const weekRecords = (data || []).filter((record: AttendanceRecord) => {
          const recordDate = parseISO(record.date);
          return isWithinInterval(recordDate, { start: weekStart, end: weekEnd });
        });

        const overtimeMinutes = weekRecords.reduce((sum: number, record: AttendanceRecord) => {
          return sum + (record.overtime_minutes || 0);
        }, 0);

        // Estimate regular hours (8 hours per day present)
        const regularMinutes = weekRecords.length * 8 * 60;

        return {
          week: `Week ${index + 1}`,
          overtime: Math.round(overtimeMinutes / 60 * 10) / 10, // Convert to hours with 1 decimal
          regular: Math.round(regularMinutes / 60),
        };
      });

      setChartData(weeklyData);
      
      // Calculate total overtime for the month
      const total = (data || []).reduce((sum: number, record: AttendanceRecord) => {
        return sum + (record.overtime_minutes || 0);
      }, 0);
      setTotalOvertime(total);
    } catch (error) {
      console.error('Error fetching overtime data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOvertimeData();
  }, [fetchOvertimeData]);

  const formatOvertime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-warning" />
            Overtime This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-warning" />
              Overtime This Month
            </CardTitle>
            <CardDescription>{format(new Date(), 'MMMM yyyy')}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-display font-bold text-warning">{formatOvertime(totalOvertime)}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
              <TrendingUp className="w-3 h-3" />
              Total overtime
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="week" 
              tickLine={false} 
              axisLine={false}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis 
              tickLine={false} 
              axisLine={false}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              unit="h"
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar 
              dataKey="regular" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
              name="Regular Hours"
            />
            <Bar 
              dataKey="overtime" 
              fill="hsl(var(--warning))" 
              radius={[4, 4, 0, 0]}
              name="Overtime Hours"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
