import userEvent from '@testing-library/user-event';
import { PWA_CONFIG } from '@web/lib/config';
import { forcePwaRefresh } from '@web/lib/pwa-reload';
import { act, fireEvent, render, screen } from '@web/test/setup';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PwaUpdatePrompt from '../pwa-update-prompt';

const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
const mockRegistrationUpdate = vi.fn();

let capturedOptions: RegisterSWOptions | undefined;
let currentNeedRefresh = true;
let controllerChangeHandler: ((event: Event) => void) | null = null;
const addServiceWorkerListener = vi.fn(
  (type: string, listener: EventListenerOrEventListenerObject) => {
    if (type !== 'controllerchange') return;
    if (typeof listener === 'function') {
      controllerChangeHandler = listener;
      return;
    }
    controllerChangeHandler = listener.handleEvent.bind(listener);
  }
);
const removeServiceWorkerListener = vi.fn((type: string) => {
  if (type === 'controllerchange') {
    controllerChangeHandler = null;
  }
});

vi.mock('@web/lib/pwa-reload', () => ({
  forcePwaRefresh: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: RegisterSWOptions) => {
    capturedOptions = options;
    return {
      needRefresh: [currentNeedRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

describe('pwa update prompt', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: addServiceWorkerListener,
        removeEventListener: removeServiceWorkerListener,
      },
    });

    vi.mocked(forcePwaRefresh).mockReset();
    mockUpdateServiceWorker.mockReset();
    mockUpdateServiceWorker.mockResolvedValue(undefined);
    mockRegistrationUpdate.mockClear();
    addServiceWorkerListener.mockClear();
    removeServiceWorkerListener.mockClear();
    controllerChangeHandler = null;
    capturedOptions = undefined;
    currentNeedRefresh = true;
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('checks for updates and prompts the user to apply the update', async () => {
    render(<PwaUpdatePrompt />);

    const registration = {
      update: mockRegistrationUpdate,
    } as unknown as ServiceWorkerRegistration;

    await act(() => {
      capturedOptions?.onRegisteredSW?.('/sw.js', registration);
    });

    expect(mockRegistrationUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('새 버전이 있습니다.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '업데이트' }));

    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(forcePwaRefresh).not.toHaveBeenCalled();
    expect(screen.getByText('업데이트 중...')).toBeInTheDocument();
  });

  it('returns to idle state when controllerchange is detected', async () => {
    vi.useFakeTimers();

    render(<PwaUpdatePrompt />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '업데이트' }));
      await Promise.resolve();
    });

    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(screen.getByText('업데이트 중...')).toBeInTheDocument();

    await act(async () => {
      controllerChangeHandler?.(new Event('controllerchange'));
      await Promise.resolve();
    });

    expect(forcePwaRefresh).not.toHaveBeenCalled();
    expect(screen.getByText('새 버전이 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '업데이트' })).toBeEnabled();
  });

  it('starts force refresh when controllerchange is not detected within timeout', async () => {
    vi.useFakeTimers();
    mockUpdateServiceWorker.mockResolvedValue(undefined);
    vi.mocked(forcePwaRefresh).mockImplementation(() => new Promise(() => {}));

    render(<PwaUpdatePrompt />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '업데이트' }));
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(PWA_CONFIG.UPDATE_APPLY_TIMEOUT_MS + 1);
      await Promise.resolve();
    });

    expect(forcePwaRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('강제 갱신 중...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '업데이트' })).toBeDisabled();
  });

  it('does not force refresh again when session guard is already set', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(PWA_CONFIG.FORCE_REFRESH_SESSION_KEY, '1');

    render(<PwaUpdatePrompt />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '업데이트' }));
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(PWA_CONFIG.UPDATE_APPLY_TIMEOUT_MS + 1);
      await Promise.resolve();
    });

    expect(forcePwaRefresh).not.toHaveBeenCalled();
    expect(
      screen.getByText('업데이트에 실패했습니다. 앱을 완전히 종료 후 다시 열어주세요.')
    ).toBeInTheDocument();
  });

  it('logs an error when updateServiceWorker rejects', async () => {
    const error = new Error('update failed');
    mockUpdateServiceWorker.mockRejectedValueOnce(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PwaUpdatePrompt />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '업데이트' }));

    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(forcePwaRefresh).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to apply service worker update:', error);
    expect(
      screen.getByText('업데이트에 실패했습니다. 앱을 완전히 종료 후 다시 열어주세요.')
    ).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('logs an error when force refresh fails', async () => {
    vi.useFakeTimers();
    const error = new Error('force refresh failed');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(forcePwaRefresh).mockRejectedValueOnce(error);

    render(<PwaUpdatePrompt />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '업데이트' }));
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(PWA_CONFIG.UPDATE_APPLY_TIMEOUT_MS + 1);
      await Promise.resolve();
    });

    expect(forcePwaRefresh).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to force refresh PWA:', error);
    expect(
      screen.getByText('업데이트에 실패했습니다. 앱을 완전히 종료 후 다시 열어주세요.')
    ).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('checks for updates every hour after registration', async () => {
    vi.useFakeTimers();
    render(<PwaUpdatePrompt />);

    const registration = {
      update: mockRegistrationUpdate,
    } as unknown as ServiceWorkerRegistration;

    await act(() => {
      capturedOptions?.onRegisteredSW?.('/sw.js', registration);
    });

    expect(mockRegistrationUpdate).toHaveBeenCalledTimes(1);

    await act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(mockRegistrationUpdate).toHaveBeenCalledTimes(2);
  });

  it('checks for updates when the document becomes visible again', async () => {
    render(<PwaUpdatePrompt />);

    const registration = {
      update: mockRegistrationUpdate,
    } as unknown as ServiceWorkerRegistration;

    await act(() => {
      capturedOptions?.onRegisteredSW?.('/sw.js', registration);
    });

    expect(mockRegistrationUpdate).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    await act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockRegistrationUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not render when no update is needed', () => {
    currentNeedRefresh = false;
    const { container } = render(<PwaUpdatePrompt />);

    expect(container).toBeEmptyDOMElement();
  });
});
