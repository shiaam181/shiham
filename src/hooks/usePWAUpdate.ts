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

  const update = () => {
    localStorage.removeItem(DEFERRED_KEY);
    updateServiceWorker(true);
  };

  const dismiss = () => {
    localStorage.setItem(DEFERRED_KEY, Date.now().toString());
    setNeedRefresh(false);
  };

  const hasDeferredUpdate = !!localStorage.getItem(DEFERRED_KEY);

  return { needRefresh, update, dismiss, hasDeferredUpdate };
}
