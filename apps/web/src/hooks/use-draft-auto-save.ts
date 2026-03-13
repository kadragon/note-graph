import { useDebouncedValue } from '@web/hooks/use-debounced-value';
import { useCallback, useEffect, useRef, useState } from 'react';

interface DraftAutoSaveOptions<T> {
  key: string;
  data: T;
  debounceMs?: number;
  enabled?: boolean;
}

interface DraftAutoSaveReturn<T> {
  restoredDraft: T | null;
  draftStatus: 'idle' | 'saved' | 'restored';
  clearDraft: () => void;
  dismissRestoredDraft: () => void;
}

interface StoredDraft<T> {
  data: T;
  savedAt: number;
}

const DRAFT_DEBOUNCE_MS = 3000;

export function useDraftAutoSave<T>({
  key,
  data,
  debounceMs = DRAFT_DEBOUNCE_MS,
  enabled = true,
}: DraftAutoSaveOptions<T>): DraftAutoSaveReturn<T> {
  const [restoredDraft, setRestoredDraft] = useState<T | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'restored'>('idle');
  const initializedRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const saveCountRef = useRef(0);

  // Restore draft from localStorage on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredDraft<T>;
        setRestoredDraft(parsed.data);
        setDraftStatus('restored');
      }
    } catch {
      // Ignore parse errors
    }
  }, [key]);

  const debouncedData = useDebouncedValue(data, debounceMs);

  // Auto-save debounced data to localStorage
  useEffect(() => {
    if (!enabled || !initializedRef.current) return;
    // Skip saving if draft was just restored and not yet dismissed
    if (draftStatus === 'restored') return;

    // Skip the first save after enable to avoid persisting initial/empty data
    saveCountRef.current += 1;
    if (!hasUserEditedRef.current) {
      if (saveCountRef.current <= 1) return;
      hasUserEditedRef.current = true;
    }

    try {
      const draft: StoredDraft<T> = { data: debouncedData, savedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(draft));
      setDraftStatus('saved');
    } catch {
      // Ignore storage errors
    }
  }, [debouncedData, key, enabled, draftStatus]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    setRestoredDraft(null);
    setDraftStatus('idle');
  }, [key]);

  const dismissRestoredDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    setRestoredDraft(null);
    setDraftStatus('idle');
  }, [key]);

  return { restoredDraft, draftStatus, clearDraft, dismissRestoredDraft };
}
