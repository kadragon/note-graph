// Trace: SPEC-worknote-2, TASK-025
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format person display text based on available fields
 * Priority: dept/position/name > dept/name > name
 *
 * @param person - Person object with name, currentDept, currentPosition
 * @returns Formatted string: dept/position/name or dept/name or name
 *
 * @example
 * formatPersonBadge({ name: '홍길동', currentDept: '개발팀', currentPosition: '팀장' })
 * // returns '개발팀/팀장/홍길동'
 *
 * formatPersonBadge({ name: '김철수', currentDept: '기획팀', currentPosition: null })
 * // returns '기획팀/김철수'
 *
 * formatPersonBadge({ name: '이영희', currentDept: null, currentPosition: null })
 * // returns '이영희'
 */
export function formatPersonBadge(person: {
  name: string;
  currentDept?: string | null;
  currentPosition?: string | null;
}): string {
  const parts: string[] = [];

  if (person.currentDept) {
    parts.push(person.currentDept);
  }

  if (person.currentPosition) {
    parts.push(person.currentPosition);
  }

  parts.push(person.name);

  return parts.join('/');
}
