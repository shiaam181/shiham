import { differenceInMinutes, parse, format } from 'date-fns';

interface Shift {
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
}

interface OvertimeResult {
  regularMinutes: number;
  overtimeMinutes: number;
  totalMinutes: number;
  isLate: boolean;
  lateMinutes: number;
  isEarlyCheckout: boolean;
  earlyMinutes: number;
}

/**
 * Calculate overtime and attendance metrics based on shift timing
 */
export function calculateOvertime(
  checkInTime: string | null,
  checkOutTime: string | null,
  shift: Shift | null,
  dateStr: string
): OvertimeResult {
  const result: OvertimeResult = {
    regularMinutes: 0,
    overtimeMinutes: 0,
    totalMinutes: 0,
    isLate: false,
    lateMinutes: 0,
    isEarlyCheckout: false,
    earlyMinutes: 0,
  };

  if (!checkInTime || !checkOutTime) {
    return result;
  }

  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);
  
  // Calculate total minutes worked
  result.totalMinutes = differenceInMinutes(checkOut, checkIn);

  if (!shift) {
    // If no shift defined, all time is regular
    result.regularMinutes = result.totalMinutes;
    return result;
  }

  // Parse shift times for the attendance date
  const shiftStart = parse(shift.start_time, 'HH:mm:ss', new Date(dateStr));
  const shiftEnd = parse(shift.end_time, 'HH:mm:ss', new Date(dateStr));
  
  // Handle overnight shifts
  let shiftEndAdjusted = shiftEnd;
  if (shiftEnd <= shiftStart) {
    shiftEndAdjusted = new Date(shiftEnd);
    shiftEndAdjusted.setDate(shiftEndAdjusted.getDate() + 1);
  }

  // Calculate shift duration in minutes
  const shiftDuration = differenceInMinutes(shiftEndAdjusted, shiftStart);

  // Check for late arrival (considering grace period)
  const graceEnd = new Date(shiftStart);
  graceEnd.setMinutes(graceEnd.getMinutes() + (shift.grace_period_minutes || 0));
  
  if (checkIn > graceEnd) {
    result.isLate = true;
    result.lateMinutes = differenceInMinutes(checkIn, shiftStart);
  }

  // Check for early checkout
  if (checkOut < shiftEndAdjusted) {
    result.isEarlyCheckout = true;
    result.earlyMinutes = differenceInMinutes(shiftEndAdjusted, checkOut);
  }

  // Calculate overtime (time worked beyond shift end)
  if (checkOut > shiftEndAdjusted) {
    result.overtimeMinutes = differenceInMinutes(checkOut, shiftEndAdjusted);
    result.regularMinutes = result.totalMinutes - result.overtimeMinutes;
  } else {
    result.regularMinutes = result.totalMinutes;
    result.overtimeMinutes = 0;
  }

  return result;
}

/**
 * Format minutes as hours and minutes string
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Get status color based on overtime/late status
 */
export function getOvertimeStatusColor(overtime: OvertimeResult): string {
  if (overtime.overtimeMinutes > 0) return 'text-info';
  if (overtime.isLate) return 'text-warning';
  if (overtime.isEarlyCheckout) return 'text-destructive';
  return 'text-success';
}
