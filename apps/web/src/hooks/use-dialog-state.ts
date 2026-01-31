import { useCallback, useState } from 'react';

export interface UseDialogStateOptions<T = undefined> {
  initialOpen?: boolean;
  initialId?: T;
}

export interface DialogState<T = undefined> {
  isOpen: boolean;
  id: T | null;
  open: T extends undefined ? () => void : (id: T) => void;
  close: () => void;
  onOpenChange: (open: boolean) => void;
}

export function useDialogState<T = undefined>(options?: UseDialogStateOptions<T>): DialogState<T> {
  const [isOpen, setIsOpen] = useState(options?.initialOpen ?? false);
  const [id, setId] = useState<T | null>(options?.initialId ?? null);

  const open = useCallback((newId?: T) => {
    if (newId !== undefined) {
      setId(newId);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setId(null);
  }, []);

  const onOpenChange = useCallback((newOpen: boolean) => {
    setIsOpen(newOpen);
    if (!newOpen) {
      setId(null);
    }
  }, []);

  return {
    isOpen,
    id,
    open: open as DialogState<T>['open'],
    close,
    onOpenChange,
  };
}
