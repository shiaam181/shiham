import { useState, useEffect, useCallback } from 'react';
import { isPushSupported, getPushPermission, subscribeToPush } from '@/lib/pushNotifications';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);
    setPermission(getPushPermission());
  }, []);

  const subscribe = useCallback(async () => {
    const success = await subscribeToPush();
    if (success) {
      setIsSubscribed(true);
      setPermission('granted');
    }
    return success;
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    subscribe,
  };
}
