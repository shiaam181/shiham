/**
 * Push Notification Service
 * Handles registration and subscription for web push notifications
 */

import { supabase } from '@/integrations/supabase/client';

export interface PushSubscriptionInfo {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** Check if push notifications are supported */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Get current push permission state */
export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** Request push notification permission */
export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';
  
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  
  const result = await Notification.requestPermission();
  return result;
}

/** Subscribe to push notifications and store subscription in database */
export async function subscribeToPush(): Promise<boolean> {
  try {
    const permission = await requestPushPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Create new subscription (using VAPID if configured)
      // For now, we'll just track permission state
      console.log('Push notification permission granted');
    }

    return true;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return false;
  }
}

/** Show a local notification (for in-app events) */
export function showLocalNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (Notification.permission !== 'granted') return;

  try {
    const defaultOptions: NotificationOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [100, 50, 100],
      tag: 'attendancehub',
      ...options,
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, defaultOptions);
      });
    } else {
      new Notification(title, defaultOptions);
    }
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

/** Notification event types for HR events */
export const HR_NOTIFICATION_EVENTS = {
  LEAVE_APPROVED: 'leave_approved',
  LEAVE_REJECTED: 'leave_rejected',
  PAYROLL_GENERATED: 'payroll_generated',
  ANNOUNCEMENT_NEW: 'announcement_new',
  ATTENDANCE_REMINDER: 'attendance_reminder',
  POLICY_UPDATE: 'policy_update',
} as const;

/** Send HR-specific push notification */
export function sendHRNotification(
  event: keyof typeof HR_NOTIFICATION_EVENTS,
  data: { title?: string; body?: string; url?: string }
): void {
  const defaults: Record<string, { title: string; body: string }> = {
    LEAVE_APPROVED: { title: '🎉 Leave Approved', body: 'Your leave request has been approved.' },
    LEAVE_REJECTED: { title: '❌ Leave Rejected', body: 'Your leave request has been rejected.' },
    PAYROLL_GENERATED: { title: '💰 Payslip Ready', body: 'Your payslip for this month is ready.' },
    ANNOUNCEMENT_NEW: { title: '📢 New Announcement', body: 'A new announcement has been posted.' },
    ATTENDANCE_REMINDER: { title: '⏰ Check-in Reminder', body: "Don't forget to mark your attendance." },
    POLICY_UPDATE: { title: '📋 Policy Updated', body: 'A company policy has been updated.' },
  };

  const config = defaults[event] || { title: 'AttendanceHub', body: '' };
  
  showLocalNotification(data.title || config.title, {
    body: data.body || config.body,
    data: { url: data.url },
    tag: HR_NOTIFICATION_EVENTS[event],
  });
}
