import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDialogState } from '../use-dialog-state';

describe('useDialogState', () => {
  describe('without id (simple dialog)', () => {
    it('initializes as closed', () => {
      const { result } = renderHook(() => useDialogState());

      expect(result.current.isOpen).toBe(false);
    });

    it('opens the dialog', () => {
      const { result } = renderHook(() => useDialogState());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes the dialog', () => {
      const { result } = renderHook(() => useDialogState());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('provides onOpenChange handler', () => {
      const { result } = renderHook(() => useDialogState());

      act(() => {
        result.current.onOpenChange(true);
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.onOpenChange(false);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('with id (edit/view dialog)', () => {
    it('initializes with no id', () => {
      const { result } = renderHook(() => useDialogState<string>());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.id).toBeNull();
    });

    it('opens with an id', () => {
      const { result } = renderHook(() => useDialogState<string>());

      act(() => {
        result.current.open('item-123');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.id).toBe('item-123');
    });

    it('closes and clears the id', () => {
      const { result } = renderHook(() => useDialogState<string>());

      act(() => {
        result.current.open('item-123');
      });

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.id).toBeNull();
    });

    it('onOpenChange clears id when closing', () => {
      const { result } = renderHook(() => useDialogState<string>());

      act(() => {
        result.current.open('item-123');
      });

      act(() => {
        result.current.onOpenChange(false);
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.id).toBeNull();
    });

    it('can change to a different id', () => {
      const { result } = renderHook(() => useDialogState<string>());

      act(() => {
        result.current.open('item-1');
      });

      act(() => {
        result.current.open('item-2');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.id).toBe('item-2');
    });
  });

  describe('with number id', () => {
    it('works with number ids', () => {
      const { result } = renderHook(() => useDialogState<number>());

      act(() => {
        result.current.open(42);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.id).toBe(42);
    });
  });

  describe('initialOpen option', () => {
    it('can initialize as open', () => {
      const { result } = renderHook(() => useDialogState({ initialOpen: true }));

      expect(result.current.isOpen).toBe(true);
    });

    it('can initialize with an id', () => {
      const { result } = renderHook(() =>
        useDialogState<string>({ initialOpen: true, initialId: 'preset-id' })
      );

      expect(result.current.isOpen).toBe(true);
      expect(result.current.id).toBe('preset-id');
    });
  });
});
