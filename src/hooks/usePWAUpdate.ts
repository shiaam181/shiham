import { useRegisterSW } from 'virtual:pwa-register/react';

const DEFERRED_KEY = 'pwa-update-deferred';

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

  // When a new SW is detected, silently defer it (no popup)
  // and mark it so the Updates page knows
  if (needRefresh) {
    localStorage.setItem(DEFERRED_KEY, Date.now().toString());
    setNeedRefresh(false);
  }

  const update = () => {
    localStorage.removeItem(DEFERRED_KEY);
    updateServiceWorker(true);
  };

  const hasDeferredUpdate = !!localStorage.getItem(DEFERRED_KEY);

  return { needRefresh: false, update, hasDeferredUpdate };
}
