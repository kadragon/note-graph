// Trace: SPEC-person-1, TASK-005
/**
 * Type definitions for Person and related entities
 */

/**
 * Person entity
 */
export interface Person {
  personId: string; // 6-digit string
  name: string;
  currentDept: string | null;
  currentPosition: string | null;
  currentRoleDesc: string | null;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

/**
 * Person department history entry
 */
export interface PersonDeptHistory {
  id: number;
  personId: string;
  deptName: string;
  position: string | null;
  roleDesc: string | null;
  startDate: string; // ISO 8601 date
  endDate: string | null; // ISO 8601 date
  isActive: boolean;
}

/**
 * Person with current department history (for detailed views)
 */
export interface PersonDetail extends Person {
  currentHistory?: PersonDeptHistory;
}

/**
 * Work note association role
 */
export type PersonWorkNoteRole = 'OWNER' | 'RELATED';

/**
 * Person's associated work note
 */
export interface PersonWorkNote {
  workId: string;
  title: string;
  category: string;
  role: PersonWorkNoteRole;
  createdAt: string;
  updatedAt: string;
}
