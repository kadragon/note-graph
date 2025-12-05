// Trace: SPEC-stats-1, TASK-047, TASK-054
/**
 * Type definitions for statistics feature
 */

import type { WorkNote } from './work-note';

/**
 * Period type for statistics filtering
 */
export type StatisticsPeriod =
  | 'this-week'
  | 'this-month'
  | 'first-half'
  | 'second-half'
  | 'this-year'
  | 'last-week'
  | 'custom';

/**
 * Work note with completion statistics
 */
export interface WorkNoteWithStats extends WorkNote {
  completedTodoCount: number;
  totalTodoCount: number;
  assignedPersons: Array<{
    personId: string;
    personName: string;
    currentDept: string | null;
    role: 'OWNER' | 'RELATED';
  }>;
  /**
   * Human-readable category name from task_categories table
   * Used for UI display instead of categoryId
   */
  categoryName?: string | null;
}

/**
 * Category distribution item
 */
export interface CategoryDistribution {
  /** Category ID from task_categories table (used for filtering/grouping) */
  categoryId: string | null;
  /** Human-readable category name (used for UI display) */
  categoryName: string | null;
  /** Number of work notes in this category */
  count: number;
}

/**
 * Person distribution item
 */
export interface PersonDistribution {
  personId: string;
  personName: string;
  currentDept: string | null;
  count: number;
}

/**
 * Department distribution item
 */
export interface DepartmentDistribution {
  deptName: string | null;
  count: number;
}

/**
 * Comprehensive statistics response
 */
export interface WorkNoteStatistics {
  summary: {
    totalWorkNotes: number;
    totalCompletedTodos: number;
    totalTodos: number;
    completionRate: number; // Percentage (0-100)
  };
  distributions: {
    byCategory: CategoryDistribution[];
    byPerson: PersonDistribution[];
    byDepartment: DepartmentDistribution[];
  };
  workNotes: WorkNoteWithStats[];
}

/**
 * Date range for statistics query
 */
export interface StatisticsDateRange {
  startDate: string; // ISO 8601 date string
  endDate: string; // ISO 8601 date string
}
