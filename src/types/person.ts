// Trace: SPEC-person-1, SPEC-person-3, TASK-005, TASK-027, TASK-LLM-IMPORT
/**
 * Type definitions for Person and related entities
 */

/**
 * Employment status type
 */
export type EmploymentStatus = '재직' | '휴직' | '퇴직';

/**
 * Person entity
 */
export interface Person {
  personId: string; // 6-digit string
  name: string;
  phoneExt: string | null; // Up to 15 chars phone number (e.g., '043-230-3038')
  currentDept: string | null;
  currentPosition: string | null;
  currentRoleDesc: string | null;
  employmentStatus: EmploymentStatus; // 재직, 휴직, 퇴직
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
