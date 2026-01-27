import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@web/components/ui/button';
import { reloadApp } from '@web/lib/pwa-reload';
import { useEffect, useState } from 'react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export default function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swUrl: string, registration: ServiceWorkerRegistration | undefined) => {
      if (!registration) return;
      setRegistration(registration);
      registration.update();
    },
  });

  useEffect(() => {
    if (!registration) return;
    const intervalId = window.setInterval(() => {
      void registration.update();
    }, UPDATE_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void registration.update();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [registration]);

  if (!needRefresh) return null;

  const handleUpdate = () => {
    void updateServiceWorker()
      .then(() => {
        reloadApp();
      })
      .catch((error) => {
        console.error('Failed to update service worker:', error);
      });
  };

  return (
    <output className="flex items-center justify-between gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>새 버전이 있습니다.</span>
      <Button size="sm" onClick={handleUpdate}>
        업데이트
      </Button>
    </output>
  );
}
