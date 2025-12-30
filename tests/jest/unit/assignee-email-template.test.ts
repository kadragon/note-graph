// Trace: spec_id=SPEC-worknote-email-copy-001 task_id=TASK-0071

import { buildAssigneeEmailTemplate } from '@web/lib/assignee-email-template';

describe('buildAssigneeEmailTemplate', () => {
  it('should inject the assignee name and keep the two-paragraph format', () => {
    const result = buildAssigneeEmailTemplate('홍길동');

    expect(result).toBe('안녕하세요. 홍길동 선생님, 교육정보원 강동욱입니다.\n\n강동욱 드림.');
  });
});
