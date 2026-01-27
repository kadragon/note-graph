// Trace: SPEC-worknote-2, TASK-025, SPEC-ui-1, TASK-034
import { type ClassValue, clsx } from 'clsx';
import { format, getYear, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date with year if different from current year
 * Uses numeric date format (MM-DD or YYYY-MM-DD)
 *
 * @param dateString - ISO date string
 * @returns Formatted date string: 'yyyy-MM-dd' if different year, 'MM-dd' if same year
 *
 * @example
 * // Current year is 2025
 * formatDateWithYear('2025-12-23T00:00:00.000Z')
 * // returns '12-23'
 *
 * formatDateWithYear('2026-01-01T00:00:00.000Z')
 * // returns '2026-01-01'
 */
export function formatDateWithYear(dateString: string): string {
  const date = parseISO(dateString);
  const currentYear = getYear(new Date());
  const dateYear = getYear(date);

  if (dateYear !== currentYear) {
    return format(date, 'yyyy-MM-dd', { locale: ko });
  }
  return format(date, 'MM-dd', { locale: ko });
}

/**
 * Format person display text based on available fields
 * Priority: dept/position/name/personId/phone > dept/name/personId/phone > name/personId/phone
 *
 * Note: Position is only displayed when department is also present.
 * This prevents orphaned position displays like "팀장/홍길동" without context.
 *
 * @param person - Person object with name, personId, phoneExt, currentDept, currentPosition
 * @returns Formatted string: dept/position/name/personId/phone or dept/name/personId/phone or name/personId/phone
 *
 * @example
 * formatPersonBadge({ name: '홍길동', currentDept: '개발팀', currentPosition: '팀장', personId: '111111', phoneExt: '043-123-4567' })
 * // returns '개발팀/팀장/홍길동/111111/043-123-4567'
 *
 * formatPersonBadge({ name: '김철수', currentDept: '기획팀', currentPosition: null, personId: '222222' })
 * // returns '기획팀/김철수/222222'
 *
 * formatPersonBadge({ name: '이영희', currentDept: null, currentPosition: null, personId: '333333', phoneExt: '043-987-6543' })
 * // returns '이영희/333333/043-987-6543'
 *
 * formatPersonBadge({ name: '박철수', currentDept: null, currentPosition: '팀장', personId: '444444', phoneExt: '043-555-0000' })
 * // returns '박철수/444444/043-555-0000' (position without dept is ignored)
 */
export function formatPersonBadge(person: {
  name: string;
  personId?: string | null;
  phoneExt?: string | null;
  currentDept?: string | null;
  currentPosition?: string | null;
}): string {
  const parts: string[] = [];

  // Only include department and position if department exists
  if (person.currentDept) {
    parts.push(person.currentDept);

    // Position is only meaningful in the context of a department
    if (person.currentPosition) {
      parts.push(person.currentPosition);
    }
  }

  parts.push(person.name);

  if (person.personId) {
    parts.push(person.personId);
  }

  if (person.phoneExt) {
    parts.push(person.phoneExt);
  }

  return parts.join('/');
}

/**
 * Generate a consistent color class for a department name
 * Uses a simple hash to map department names to Tailwind color classes
 *
 * @param deptName - Department name
 * @returns Tailwind CSS classes for background and text color
 */
export function getDepartmentColor(deptName: string): string {
  // Define a palette of distinct colors for departments with hover states
  const colors = [
    'bg-blue-100 text-blue-800 hover:bg-blue-200',
    'bg-green-100 text-green-800 hover:bg-green-200',
    'bg-purple-100 text-purple-800 hover:bg-purple-200',
    'bg-orange-100 text-orange-800 hover:bg-orange-200',
    'bg-pink-100 text-pink-800 hover:bg-pink-200',
    'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
    'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
    'bg-rose-100 text-rose-800 hover:bg-rose-200',
    'bg-teal-100 text-teal-800 hover:bg-teal-200',
    'bg-lime-100 text-lime-800 hover:bg-lime-200',
    'bg-amber-100 text-amber-800 hover:bg-amber-200',
  ];

  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < deptName.length; i++) {
    const char = deptName.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Convert newline characters into Markdown-compatible hard line breaks.
 * Useful when rendering user-entered multiline text with ReactMarkdown
 * while preserving intentional line breaks.
 */
export function preserveLineBreaksForMarkdown(text: string): string {
  if (!text) return '';

  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line, index, lines) => (index === lines.length - 1 ? line : `${line}  \n`))
    .join('');
}

/**
 * Convert date string to UTC ISO string
 * This prevents timezone issues where dates shift by one day
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns ISO string with UTC timezone (e.g., "2025-12-01T00:00:00.000Z")
 *
 * @example
 * toUTCISOString('2025-12-01')
 * // returns '2025-12-01T00:00:00.000Z'
 */
export function toUTCISOString(dateString: string): string {
  return new Date(`${dateString}T00:00:00.000Z`).toISOString();
}
