// Browser Push Notifications Service

export type NotificationPermissionState = 'granted' | 'denied' | 'default';

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
  }

  return Notification.permission as NotificationPermissionState;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission as NotificationPermissionState;
}

export function isNotificationsSupported(): boolean {
  return 'Notification' in window;
}

interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export function showBrowserNotification({
  title,
  body,
  icon = '/pwa-192x192.png',
  tag,
  onClick,
}: BrowserNotificationOptions): Notification | null {
  if (!isNotificationsSupported()) {
    console.warn('Browser notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  const notification = new Notification(title, {
    body,
    icon,
    tag,
    badge: icon,
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }

  return notification;
}

export function showLeaveApprovalNotification(
  leaveType: string,
  status: 'approved' | 'rejected',
  adminNotes?: string | null,
  onClick?: () => void
): Notification | null {
  const isApproved = status === 'approved';
  const title = isApproved ? '🎉 Leave Approved!' : '❌ Leave Rejected';
  
  let body = `Your ${formatLeaveType(leaveType)} request has been ${status}.`;
  if (!isApproved && adminNotes) {
    body += ` Reason: ${adminNotes}`;
  }

  return showBrowserNotification({
    title,
    body,
    tag: `leave-${status}`,
    onClick,
  });
}

function formatLeaveType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
