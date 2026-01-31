import type { EmploymentStatus, Person } from '@shared/types/person';

// Person import types
export interface ParsedPersonData {
  personId: string;
  name: string;
  phoneExt?: string | null;
  currentDept?: string | null;
  currentPosition?: string | null;
  currentRoleDesc?: string | null;
  employmentStatus: EmploymentStatus;
}

export interface ImportPersonResponse {
  person: Person;
  isNew: boolean;
}
