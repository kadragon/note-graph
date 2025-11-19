// Trace: SPEC-dept-1, TASK-022
// Helpers for mapping department form data to API payloads

import type { CreateDepartmentRequest } from '@/types/api';

export function toCreateDepartmentRequest(
  name: string,
  description?: string
): CreateDepartmentRequest {
  const payload: CreateDepartmentRequest = { deptName: name.trim() };

  if (description && description.trim()) {
    payload.description = description.trim();
  }

  return payload;
}
