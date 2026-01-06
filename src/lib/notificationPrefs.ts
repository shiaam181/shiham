import { supabase } from '@/integrations/supabase/client';

export type NotificationPrefs = {
  readIds: Set<string>;
  dismissedIds: Set<string>;
};

// Fetch notification prefs from backend
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  if (!userId) return { readIds: new Set(), dismissedIds: new Set() };

  try {
    const { data, error } = await supabase
      .from('notification_prefs')
      .select('notification_id, is_read, is_dismissed')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching notification prefs:', error);
      return { readIds: new Set(), dismissedIds: new Set() };
    }

    const readIds = new Set<string>();
    const dismissedIds = new Set<string>();

    for (const row of data || []) {
      if (row.is_read) readIds.add(row.notification_id);
      if (row.is_dismissed) dismissedIds.add(row.notification_id);
    }

    return { readIds, dismissedIds };
  } catch (err) {
    console.error('Error fetching notification prefs:', err);
    return { readIds: new Set(), dismissedIds: new Set() };
  }
}

// Upsert a notification pref record
async function upsertNotificationPref(
  userId: string,
  notificationId: string,
  updates: { is_read?: boolean; is_dismissed?: boolean }
) {
  if (!userId || !notificationId) return;

  try {
    // Try to update first
    const { data: existing } = await supabase
      .from('notification_prefs')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_id', notificationId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('notification_prefs')
        .update(updates)
        .eq('user_id', userId)
        .eq('notification_id', notificationId);
    } else {
      await supabase.from('notification_prefs').insert({
        user_id: userId,
        notification_id: notificationId,
        is_read: updates.is_read ?? false,
        is_dismissed: updates.is_dismissed ?? false,
      });
    }
  } catch (err) {
    console.error('Error upserting notification pref:', err);
  }
}

export async function addNotificationRead(userId: string, id: string) {
  await upsertNotificationPref(userId, id, { is_read: true });
}

export async function addNotificationDismissed(userId: string, id: string) {
  await upsertNotificationPref(userId, id, { is_read: true, is_dismissed: true });
}

export async function markAllNotificationsRead(userId: string, ids: string[]) {
  if (!userId || ids.length === 0) return;

  try {
    // Batch upsert - for each ID, upsert the pref
    const promises = ids.map((id) => upsertNotificationPref(userId, id, { is_read: true }));
    await Promise.all(promises);
  } catch (err) {
    console.error('Error marking all notifications read:', err);
  }
}
