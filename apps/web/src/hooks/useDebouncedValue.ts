// Trace: SPEC-person-1, TASK-021

import { SEARCH_DEBOUNCE_MS } from '@web/constants/search';
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
