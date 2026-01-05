export type NotificationPrefs = {
  readIds: Set<string>;
  dismissedIds: Set<string>;
};

type StoredPrefs = {
  readIds: string[];
  dismissedIds: string[];
};

function storageKey(userId: string) {
  return `attendancehub:notif_prefs:${userId}`;
}

function safeParse(json: string | null): StoredPrefs | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<StoredPrefs>;
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds.filter((x) => typeof x === 'string') : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter((x) => typeof x === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

export function getNotificationPrefs(userId: string): NotificationPrefs {
  if (!userId) return { readIds: new Set(), dismissedIds: new Set() };

  const stored = safeParse(localStorage.getItem(storageKey(userId)));
  return {
    readIds: new Set(stored?.readIds ?? []),
    dismissedIds: new Set(stored?.dismissedIds ?? []),
  };
}

function saveNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  const payload: StoredPrefs = {
    readIds: Array.from(prefs.readIds),
    dismissedIds: Array.from(prefs.dismissedIds),
  };
  localStorage.setItem(storageKey(userId), JSON.stringify(payload));
}

export function addNotificationRead(userId: string, id: string) {
  if (!userId || !id) return;
  const prefs = getNotificationPrefs(userId);
  prefs.readIds.add(id);
  saveNotificationPrefs(userId, prefs);
}

export function addNotificationDismissed(userId: string, id: string) {
  if (!userId || !id) return;
  const prefs = getNotificationPrefs(userId);
  prefs.dismissedIds.add(id);
  // also mark as read to avoid badge count
  prefs.readIds.add(id);
  saveNotificationPrefs(userId, prefs);
}

export function markAllNotificationsRead(userId: string, ids: string[]) {
  if (!userId) return;
  const prefs = getNotificationPrefs(userId);
  for (const id of ids) prefs.readIds.add(id);
  saveNotificationPrefs(userId, prefs);
}
