// Trace: SPEC-dept-1, TASK-006
/**
 * Type definitions for Department and related entities
 */

/**
 * Department entity
 */
export interface Department {
  deptName: string; // Department name (serves as primary key)
  description: string | null;
  isActive: boolean; // Whether the department is currently active (true) or closed/disbanded (false)
  createdAt: string; // ISO 8601 timestamp
}

/**
 * Department member (person currently or previously assigned)
 */
export interface DepartmentMember {
  personId: string;
  name: string;
  position: string | null;
  roleDesc: string | null;
  startDate: string; // ISO 8601 date
  endDate: string | null; // ISO 8601 date
  isActive: boolean;
}

/**
 * Department's work note
 */
export interface DepartmentWorkNote {
  workId: string;
  title: string;
  category: string;
  ownerPersonId: string | null; // Person who owns the work note
  ownerPersonName: string | null;
  createdAt: string;
  updatedAt: string;
}
