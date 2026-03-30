import type { TodoPriority } from '@shared/types/todo';

/**
 * Clamp a numeric priority value to the valid range [1, 4].
 * Returns 3 (보통) for null, undefined, or out-of-range values.
 */
export function clampPriority(v?: number | null): TodoPriority {
  if (v == null || v < 1 || v > 4) return 3;
  return Math.round(v) as TodoPriority;
}
