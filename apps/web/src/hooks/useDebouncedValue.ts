// Trace: SPEC-person-1, TASK-021

import { useEffect, useState } from 'react';
import { SEARCH_DEBOUNCE_MS } from '@/constants/search';

export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
