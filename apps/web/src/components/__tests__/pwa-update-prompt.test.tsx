import userEvent from '@testing-library/user-event';
import { act, render, screen } from '@web/test/setup';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { describe, expect, it, vi } from 'vitest';

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
});
