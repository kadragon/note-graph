import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '../use-toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('shows a toast with the provided variant', async () => {
    const { result, unmount } = renderHook(() => useToast());
    let toastId = '';

    act(() => {
      const toastRef = result.current.toast({
        title: '알림',
        description: '내용',
        variant: 'destructive',
      });
      toastId = toastRef.id;
    });

    expect(result.current.toasts).toHaveLength(1);

    expect(result.current.toasts[0]?.variant).toBe('destructive');

    act(() => {
      result.current.dismiss(toastId);
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);

    unmount();
  });

  it('dismisses a toast and marks it closed before removal', async () => {
    const { result, unmount } = renderHook(() => useToast());
    let toastId = '';

    act(() => {
      const toastRef = result.current.toast({ title: '숨김' });
      toastId = toastRef.id;
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts[0]?.open).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);

    unmount();
  });
});
