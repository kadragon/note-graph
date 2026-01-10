// Trace: SPEC-dept-1, TASK-022
// Ensure department form input is mapped to API payload with deptName

import { describe, expect, it } from 'vitest';
import { toCreateDepartmentRequest } from './department';

describe('toCreateDepartmentRequest', () => {
  it('maps name and description to deptName payload', () => {
    const payload = toCreateDepartmentRequest('교무기획부', '기획 총괄');

    expect(payload).toEqual({
      deptName: '교무기획부',
      description: '기획 총괄',
    });
  });

  it('omits description when not provided', () => {
    const payload = toCreateDepartmentRequest('행정지원실');

    expect(payload).toEqual({
      deptName: '행정지원실',
    });
  });

  it('trims name and ignores whitespace-only description', () => {
    const payload = toCreateDepartmentRequest('  연구개발부  ', '   ');

    expect(payload).toEqual({
      deptName: '연구개발부',
    });
  });
});
