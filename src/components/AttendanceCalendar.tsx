import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addMonths,
  subMonths,
  getDay
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttendanceRecord {
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

interface AttendanceCalendarProps {
  userId?: string;
}

const statusColors: Record<string, string> = {
  present: 'bg-success text-success-foreground',
  absent: 'bg-destructive text-destructive-foreground',
  leave: 'bg-info text-info-foreground',
  week_off: 'bg-muted text-muted-foreground',
  holiday: 'bg-warning text-warning-foreground',
  half_day: 'bg-info/50 text-info-foreground',
};

const statusLabels: Record<string, string> = {
  present: 'P',
  absent: 'A',
  leave: 'L',
  week_off: 'W',
  holiday: 'H',
  half_day: 'HD',
};

export default function AttendanceCalendar({ userId }: AttendanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [weekOffs, setWeekOffs] = useState<Set<number>>(new Set([0, 6])); // Default: Sun & Sat
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    try {
      // Fetch attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('date, status, check_in_time, check_out_time')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end);

      if (attendanceError) throw attendanceError;

      const attendanceMap = new Map<string, AttendanceRecord>();
      attendanceData?.forEach(record => {
        attendanceMap.set(record.date, record);
      });
      setAttendance(attendanceMap);

      // Fetch holidays
      const { data: holidayData, error: holidayError } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', start)
        .lte('date', end);

      if (holidayError) throw holidayError;

      const holidaySet = new Set<string>();
      holidayData?.forEach(h => holidaySet.add(h.date));
      setHolidays(holidaySet);

      // Fetch week offs
      const { data: weekOffData, error: weekOffError } = await supabase
        .from('week_offs')
        .select('day_of_week')
        .or('is_global.eq.true,user_id.eq.' + userId);

      if (weekOffError) throw weekOffError;

      const weekOffSet = new Set<number>();
      weekOffData?.forEach(w => weekOffSet.add(w.day_of_week));
      setWeekOffs(weekOffSet);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const startDayOfWeek = getDay(startOfMonth(currentMonth));
  const emptyDays = Array(startDayOfWeek).fill(null);

  const getDayStatus = (date: Date): string | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date);

    if (holidays.has(dateStr)) return 'holiday';
    
    const record = attendance.get(dateStr);
    if (record) return record.status;

    if (weekOffs.has(dayOfWeek)) return 'week_off';

    // Check if date is in the past and no attendance
    if (date < new Date() && !isToday(date)) return 'absent';

    return null;
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="font-display font-semibold text-lg">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-info" />
          <span>Leave</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning" />
          <span>Holiday</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-muted" />
          <span>Week Off</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Empty cells for start offset */}
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Days */}
        {days.map(day => {
          const status = getDayStatus(day);
          const today = isToday(day);
          
          return (
            <div
              key={day.toString()}
              className={`
                aspect-square flex flex-col items-center justify-center rounded-lg text-sm
                transition-all duration-200 cursor-pointer hover:scale-105
                ${today ? 'ring-2 ring-primary ring-offset-2' : ''}
                ${status ? statusColors[status] : 'bg-muted/30 text-foreground'}
              `}
            >
              <span className="font-medium">{format(day, 'd')}</span>
              {status && (
                <span className="text-[10px] font-bold opacity-80">
                  {statusLabels[status]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
