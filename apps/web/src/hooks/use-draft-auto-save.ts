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
  draftStatus: 'idle' | 'saving' | 'saved' | 'restored';
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
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'restored'>('idle');
  const initializedRef = useRef(false);

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
    setRestoredDraft(null);
    setDraftStatus('idle');
  }, []);

  return { restoredDraft, draftStatus, clearDraft, dismissRestoredDraft };
}
