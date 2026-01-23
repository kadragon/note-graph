import userEvent from '@testing-library/user-event';
import { act, render, screen } from '@web/test/setup';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PwaUpdatePrompt from '../pwa-update-prompt';

const mockUpdateServiceWorker = vi.fn();
const mockRegistrationUpdate = vi.fn();

let capturedOptions: RegisterSWOptions | undefined;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: RegisterSWOptions) => {
    capturedOptions = options;
    return {
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

describe('pwa update prompt', () => {
  beforeEach(() => {
    mockUpdateServiceWorker.mockClear();
    mockRegistrationUpdate.mockClear();
    capturedOptions = undefined;
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
});
