// Trace: spec_id=SPEC-worknote-email-copy-001 task_id=TASK-0071

export function buildAssigneeEmailTemplate(assigneeName: string): string {
  return `안녕하세요. ${assigneeName} 선생님, 교육정보원 강동욱입니다.\n\n강동욱 드림.`;
}
