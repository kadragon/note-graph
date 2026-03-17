// Trace: SPEC-ai-draft-1
/**
 * Date utility functions for consistent date handling across the application
 */

const DEFAULT_OFFSET_MINUTES = 540; // KST (UTC+9)

/**
 * Get today's date in YYYY-MM-DD format for the given timezone offset.
 *
 * @param offsetMinutes - Timezone offset in minutes from UTC (default: 540 for KST)
 * @returns Today's date as YYYY-MM-DD string in the target timezone
 */
export function getTodayDateForOffset(offsetMinutes: number = DEFAULT_OFFSET_MINUTES): string {
  const now = new Date();
  const offsetDate = new Date(now.getTime() + offsetMinutes * 60_000);
  const year = offsetDate.getUTCFullYear();
  const month = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(offsetDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @deprecated Use getTodayDateForOffset() instead. This returns UTC date which
 * is incorrect for KST users between 00:00–08:59 KST.
 */
export function getTodayDateUTC(): string {
  return getTodayDateForOffset(0);
}
