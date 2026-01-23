import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@web/components/ui/button';
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
    return () => window.clearInterval(intervalId);
  }, [registration]);

  if (!needRefresh) return null;

  return (
    <output className="flex items-center justify-between gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>새 버전이 있습니다.</span>
      <Button size="sm" onClick={() => void updateServiceWorker()}>
        업데이트
      </Button>
    </output>
  );
}
