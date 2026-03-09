// Trace: spec_id=SPEC-worknote-email-copy-001 task_id=TASK-0071

const DEFAULT_TEMPLATE = `안녕하세요. {{ASSIGNEE_NAME}} {{HONORIFIC}}, 전산정보원 강동욱입니다.

{{WORK_NOTE_TITLE}} 관련하여,

감사합니다.

강동욱 드림.`;

export function resolveHonorific(position?: string | null): string {
  if (position && position.endsWith('주사')) return '팀장님';
  return '선생님';
}

export function buildAssigneeEmailTemplate(
  assigneeName: string,
  workNoteTitle: string,
  options?: { position?: string | null; template?: string }
): string {
  const t = options?.template || DEFAULT_TEMPLATE;
  const honorific = resolveHonorific(options?.position);
  return t
    .replace(/\{\{ASSIGNEE_NAME\}\}/g, assigneeName)
    .replace(/\{\{WORK_NOTE_TITLE\}\}/g, workNoteTitle)
    .replace(/\{\{HONORIFIC\}\}/g, honorific);
}
