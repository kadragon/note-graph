import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@web/components/ui/button';
import { PWA_CONFIG } from '@web/lib/config';
import { forcePwaRefresh } from '@web/lib/pwa-reload';
import { useEffect, useState } from 'react';

type UpdateState = 'idle' | 'applying' | 'forcing' | 'failed';

const UPDATE_FAILURE_MESSAGE = '업데이트에 실패했습니다. 앱을 완전히 종료 후 다시 열어주세요.';

function hasForceRefreshAttempted() {
  try {
    return sessionStorage.getItem(PWA_CONFIG.FORCE_REFRESH_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markForceRefreshAttempted() {
  try {
    sessionStorage.setItem(PWA_CONFIG.FORCE_REFRESH_SESSION_KEY, '1');
  } catch {
    // noop
  }
}

function clearForceRefreshAttempt() {
  try {
    sessionStorage.removeItem(PWA_CONFIG.FORCE_REFRESH_SESSION_KEY);
  } catch {
    // noop
  }
}

function waitForControllerChange(timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve(false);
      return;
    }

    const onControllerChange = () => {
      cleanup();
      resolve(true);
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  });
}

export default function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swUrl: string, registration: ServiceWorkerRegistration | undefined) => {
      if (!registration) return;
      setRegistration(registration);
      void registration.update();
    },
  });

  useEffect(() => {
    if (!registration) return;
    const intervalId = window.setInterval(() => {
      void registration.update();
    }, PWA_CONFIG.UPDATE_CHECK_INTERVAL_MS);

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

  if (!needRefresh && updateState === 'idle') return null;

  const handleUpdate = async () => {
    if (updateState === 'applying' || updateState === 'forcing') return;

    setUpdateState('applying');
    try {
      const controllerChangePromise = waitForControllerChange(PWA_CONFIG.UPDATE_APPLY_TIMEOUT_MS);
      await updateServiceWorker();
      const isControllerChanged = await controllerChangePromise;

      if (isControllerChanged) {
        clearForceRefreshAttempt();
        setUpdateState('idle');
        return;
      }
    } catch (error) {
      console.error('Failed to apply service worker update:', error);
      setUpdateState('failed');
      return;
    }

    if (hasForceRefreshAttempted()) {
      setUpdateState('failed');
      return;
    }

    markForceRefreshAttempted();
    setUpdateState('forcing');

    try {
      await forcePwaRefresh();
    } catch (error) {
      console.error('Failed to force refresh PWA:', error);
      setUpdateState('failed');
    }
  };

  const isUpdating = updateState === 'applying' || updateState === 'forcing';

  const statusMessage =
    updateState === 'applying'
      ? '업데이트 중...'
      : updateState === 'forcing'
        ? '강제 갱신 중...'
        : updateState === 'failed'
          ? UPDATE_FAILURE_MESSAGE
          : '새 버전이 있습니다.';

  return (
    <output className="flex items-center justify-between gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>{statusMessage}</span>
      <Button size="sm" onClick={handleUpdate} disabled={isUpdating}>
        업데이트
      </Button>
    </output>
  );
}
