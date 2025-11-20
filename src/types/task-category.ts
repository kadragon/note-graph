// Trace: SPEC-taskcategory-1, TASK-003
/**
 * Type definitions for TaskCategory and related entities
 */

/**
 * Task Category entity (업무 구분)
 */
export interface TaskCategory {
  categoryId: string; // Category ID (serves as primary key)
  name: string; // Category name (unique)
  isActive: boolean; // Whether category is active for suggestions
  createdAt: string; // ISO 8601 timestamp
}

/**
 * Task Category's work note
 */
export interface TaskCategoryWorkNote {
  workId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
