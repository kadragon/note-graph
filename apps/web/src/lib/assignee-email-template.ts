// Trace: spec_id=SPEC-worknote-email-copy-001 task_id=TASK-0071

const DEFAULT_TEMPLATE = `안녕하세요. {{ASSIGNEE_NAME}} {{HONORIFIC}}, 정보전산원 강동욱입니다.

{{WORK_NOTE_TITLE}} 관련하여,

감사합니다.

강동욱 드림.`;

export function resolveHonorific(position?: string | null): string {
  if (position?.endsWith('주사')) return '팀장님';
  return '선생님';
}

export function buildAssigneeEmailTemplate(
  assigneeName: string,
  workNoteTitle: string,
  options?: { position?: string | null; template?: string }
): string {
  const t = options?.template ?? DEFAULT_TEMPLATE;
  const honorific = resolveHonorific(options?.position);
  const replacements: Record<string, string> = {
    '{{ASSIGNEE_NAME}}': assigneeName,
    '{{WORK_NOTE_TITLE}}': workNoteTitle,
    '{{HONORIFIC}}': honorific,
  };
  return t.replace(
    /\{\{(ASSIGNEE_NAME|WORK_NOTE_TITLE|HONORIFIC)\}\}/g,
    (match) => replacements[match] ?? match
  );
}
