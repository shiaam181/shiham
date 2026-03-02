import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const DEFERRED_KEY = 'pwa-update-deferred';
const NOTIFIED_KEY = 'pwa-update-notified';

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      }
    },
  });

  const [deferredAt, setDeferredAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const value = localStorage.getItem(DEFERRED_KEY);
    return value ? Number(value) : null;
  });

  useEffect(() => {
    if (!needRefresh) return;

    const timestamp = Date.now();
    localStorage.setItem(DEFERRED_KEY, timestamp.toString());
    setDeferredAt(timestamp);
    setNeedRefresh(false);
  }, [needRefresh, setNeedRefresh]);

  const update = () => {
    localStorage.removeItem(DEFERRED_KEY);
    localStorage.removeItem(NOTIFIED_KEY);
    setDeferredAt(null);
    updateServiceWorker(true);
  };

  const hasDeferredUpdate = deferredAt !== null;
  const hasBeenNotified =
    deferredAt !== null && localStorage.getItem(NOTIFIED_KEY) === deferredAt.toString();

  const markDeferredAsNotified = () => {
    if (deferredAt === null) return;
    localStorage.setItem(NOTIFIED_KEY, deferredAt.toString());
  };

  return {
    update,
    hasDeferredUpdate,
    deferredAt,
    hasBeenNotified,
    markDeferredAsNotified,
  };
}

