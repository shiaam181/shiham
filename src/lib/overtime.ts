import { differenceInMinutes, differenceInHours } from 'date-fns';

// Standard work day in minutes (8 hours)
const STANDARD_WORK_DAY_MINUTES = 8 * 60; // 480 minutes
const MAX_SHIFT_HOURS = 24; // Maximum hours before marking as punch missing

interface OvertimeResult {
  regularMinutes: number;
  overtimeMinutes: number;
  totalMinutes: number;
  isLate: boolean;
  lateMinutes: number;
  isPunchMissing: boolean;
  status: 'normal' | 'overtime' | 'punch_missing' | 'incomplete';
}

/**
 * Calculate overtime based on 8-hour standard work day
 * - First 8 hours = regular time
 * - After 8 hours = overtime
 * - If no checkout within 24 hours = punch missing (no OT counted)
 */
export function calculateOvertime(
  checkInTime: string | null,
  checkOutTime: string | null
): OvertimeResult {
  const result: OvertimeResult = {
    regularMinutes: 0,
    overtimeMinutes: 0,
    totalMinutes: 0,
    isLate: false,
    lateMinutes: 0,
    isPunchMissing: false,
    status: 'incomplete',
  };

  if (!checkInTime) {
    return result;
  }

  const checkIn = new Date(checkInTime);
  const now = new Date();

  // If no checkout, check if it's been over 24 hours
  if (!checkOutTime) {
    const hoursElapsed = differenceInHours(now, checkIn);
    
    if (hoursElapsed >= MAX_SHIFT_HOURS) {
      // Mark as punch missing - no OT calculated
      result.isPunchMissing = true;
      result.status = 'punch_missing';
      result.regularMinutes = STANDARD_WORK_DAY_MINUTES; // Count only 8 hours as worked
      result.totalMinutes = STANDARD_WORK_DAY_MINUTES;
      result.overtimeMinutes = 0; // No OT for missing punch
    } else {
      // Still within 24 hours, waiting for checkout
      result.status = 'incomplete';
    }
    
    return result;
  }

  const checkOut = new Date(checkOutTime);
  
  // Calculate total minutes worked
  result.totalMinutes = differenceInMinutes(checkOut, checkIn);

  // Check if checkout is more than 24 hours after check-in
  const hoursWorked = differenceInHours(checkOut, checkIn);
  if (hoursWorked >= MAX_SHIFT_HOURS) {
    // Punch missing - only count 8 hours, no OT
    result.isPunchMissing = true;
    result.status = 'punch_missing';
    result.regularMinutes = STANDARD_WORK_DAY_MINUTES;
    result.totalMinutes = STANDARD_WORK_DAY_MINUTES;
    result.overtimeMinutes = 0;
    return result;
  }

  // Normal calculation: 8 hours regular, rest is OT
  if (result.totalMinutes <= STANDARD_WORK_DAY_MINUTES) {
    // Worked less than or equal to 8 hours - all regular time
    result.regularMinutes = result.totalMinutes;
    result.overtimeMinutes = 0;
    result.status = 'normal';
  } else {
    // Worked more than 8 hours - calculate OT
    result.regularMinutes = STANDARD_WORK_DAY_MINUTES;
    result.overtimeMinutes = result.totalMinutes - STANDARD_WORK_DAY_MINUTES;
    result.status = 'overtime';
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
 * Get status color based on overtime status
 */
export function getOvertimeStatusColor(overtime: OvertimeResult): string {
  if (overtime.isPunchMissing) return 'text-destructive';
  if (overtime.overtimeMinutes > 0) return 'text-info';
  if (overtime.status === 'incomplete') return 'text-warning';
  return 'text-success';
}

/**
 * Check if a check-in is approaching 24 hour limit
 */
export function isApproaching24Hours(checkInTime: string): boolean {
  const checkIn = new Date(checkInTime);
  const now = new Date();
  const hoursElapsed = differenceInHours(now, checkIn);
  return hoursElapsed >= 20 && hoursElapsed < 24; // Warning after 20 hours
}

/**
 * Get remaining time before punch missing
 */
export function getRemainingTime(checkInTime: string): { hours: number; minutes: number } | null {
  const checkIn = new Date(checkInTime);
  const now = new Date();
  const minutesElapsed = differenceInMinutes(now, checkIn);
  const maxMinutes = MAX_SHIFT_HOURS * 60;
  
  if (minutesElapsed >= maxMinutes) {
    return null; // Already past 24 hours
  }
  
  const remainingMinutes = maxMinutes - minutesElapsed;
  return {
    hours: Math.floor(remainingMinutes / 60),
    minutes: remainingMinutes % 60,
  };
}
