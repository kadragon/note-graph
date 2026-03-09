import { describe, expect, it } from 'vitest';
import { buildAssigneeEmailTemplate, resolveHonorific } from './assignee-email-template';

describe('resolveHonorific', () => {
  it('returns 팀장님 when position ends with 주사', () => {
    expect(resolveHonorific('전산주사')).toBe('팀장님');
  });

  it('returns 팀장님 for any position ending with 주사', () => {
    expect(resolveHonorific('행정주사')).toBe('팀장님');
  });

  it('returns 선생님 for other positions', () => {
    expect(resolveHonorific('주무관')).toBe('선생님');
  });

  it('returns 선생님 when position is null or undefined', () => {
    expect(resolveHonorific(null)).toBe('선생님');
    expect(resolveHonorific(undefined)).toBe('선생님');
  });

  it('returns 선생님 when position is empty string', () => {
    expect(resolveHonorific('')).toBe('선생님');
  });
});

describe('buildAssigneeEmailTemplate', () => {
  it('replaces all placeholders including HONORIFIC', () => {
    const result = buildAssigneeEmailTemplate('홍길동', '서버 점검 안내', {
      position: '전산주사',
    });

    expect(result).toContain('홍길동');
    expect(result).toContain('팀장님');
    expect(result).toContain('서버 점검 안내');
    expect(result).not.toContain('{{ASSIGNEE_NAME}}');
    expect(result).not.toContain('{{HONORIFIC}}');
    expect(result).not.toContain('{{WORK_NOTE_TITLE}}');
  });

  it('uses 선생님 for non-주사 positions', () => {
    const result = buildAssigneeEmailTemplate('김철수', '네트워크 장애 보고', {
      position: '주무관',
    });

    expect(result).toContain('김철수 선생님');
  });

  it('uses default template when template option is not provided', () => {
    const result = buildAssigneeEmailTemplate('김철수', '네트워크 장애 보고');

    expect(result).toContain('김철수 선생님');
    expect(result).toContain('네트워크 장애 보고 관련하여');
    expect(result).toContain('강동욱 드림');
  });

  it('uses custom template when provided', () => {
    const customTemplate = '{{ASSIGNEE_NAME}} {{HONORIFIC}}, {{WORK_NOTE_TITLE}} 건 회신드립니다.';
    const result = buildAssigneeEmailTemplate('이영희', 'PC 교체', {
      position: '행정주사',
      template: customTemplate,
    });

    expect(result).toBe('이영희 팀장님, PC 교체 건 회신드립니다.');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const template = '{{ASSIGNEE_NAME}} {{ASSIGNEE_NAME}}';
    const result = buildAssigneeEmailTemplate('박민수', '테스트', { template });

    expect(result).toBe('박민수 박민수');
  });

  it('returns empty string when template is explicitly empty', () => {
    const result = buildAssigneeEmailTemplate('김철수', '테스트', { template: '' });

    expect(result).toBe('');
  });

  it('falls back to default template when template is undefined', () => {
    const result = buildAssigneeEmailTemplate('김철수', '네트워크 장애 보고', {
      template: undefined,
    });

    expect(result).toContain('김철수 선생님');
    expect(result).toContain('강동욱 드림');
  });
});
