import userEvent from '@testing-library/user-event';
import { reloadApp } from '@web/lib/pwa-reload';
import { act, render, screen } from '@web/test/setup';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PwaUpdatePrompt from '../pwa-update-prompt';

const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
const mockRegistrationUpdate = vi.fn();

let capturedOptions: RegisterSWOptions | undefined;
let currentNeedRefresh = true;

vi.mock('@web/lib/pwa-reload', () => ({
  reloadApp: vi.fn(),
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
    vi.mocked(reloadApp).mockReset();
    mockUpdateServiceWorker.mockReset();
    mockUpdateServiceWorker.mockResolvedValue(undefined);
    mockRegistrationUpdate.mockClear();
    capturedOptions = undefined;
    currentNeedRefresh = true;
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
    expect(reloadApp).toHaveBeenCalledTimes(1);
  });

  it('reloads after the update service worker promise resolves', async () => {
    let resolveUpdate: (() => void) | undefined;
    mockUpdateServiceWorker.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    render(<PwaUpdatePrompt />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '업데이트' }));

    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(reloadApp).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpdate?.();
      await Promise.resolve();
    });

    expect(reloadApp).toHaveBeenCalledTimes(1);
  });

  it('logs an error when the update service worker rejects', async () => {
    const error = new Error('update failed');
    mockUpdateServiceWorker.mockRejectedValueOnce(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PwaUpdatePrompt />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '업데이트' }));

    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(reloadApp).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to update service worker:', error);

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
