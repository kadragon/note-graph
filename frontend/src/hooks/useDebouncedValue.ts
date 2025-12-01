// Trace: SPEC-person-1, TASK-021

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay: number = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
