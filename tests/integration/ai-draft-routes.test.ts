import type { WorkNoteDraft } from '@shared/types/search';
import { TodoRepository } from '@worker/repositories/todo-repository';
import { AIDraftService } from '@worker/services/ai-draft-service';
import { PdfExtractionService } from '@worker/services/pdf-extraction-service';
import { WorkNoteService } from '@worker/services/work-note-service';
import type { OpenTodoDueDateContextForAI } from '@worker/types/todo-due-date-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

const TODO_DUE_DATE_CONTEXT: OpenTodoDueDateContextForAI = {
  totalOpenTodos: 8,
  undatedOpenTodos: 2,
  topDueDateCounts: [{ dueDate: '2026-02-14', count: 4 }],
};

const DRAFT_RESPONSE: WorkNoteDraft = {
  title: 'AI 제목',
  content: 'AI 내용',
  category: '업무',
  todos: [{ title: '할 일', description: '설명', dueDate: '2026-02-14' }],
};

describe('AI Draft Routes - due date distribution context wiring', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM task_categories'),
      testEnv.DB.prepare('DELETE FROM pdf_jobs'),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes due date context to draft-from-text generation', async () => {
    const dueContextSpy = vi
      .spyOn(TodoRepository.prototype, 'getOpenTodoDueDateContextForAI')
      .mockResolvedValue(TODO_DUE_DATE_CONTEXT);
    const generateSpy = vi
      .spyOn(AIDraftService.prototype, 'generateDraftFromText')
      .mockResolvedValue(DRAFT_RESPONSE);

    const response = await authFetch('/api/ai/work-notes/draft-from-text', {
      method: 'POST',
      body: JSON.stringify({ inputText: '초안 생성 테스트' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json<{ draft: WorkNoteDraft }>();
    expect(data.draft.title).toBe('AI 제목');
    expect(dueContextSpy).toHaveBeenCalledWith(10);
    expect(generateSpy).toHaveBeenCalled();
    const options = generateSpy.mock.calls[0]?.[1];
    expect(options?.todoDueDateContext).toEqual(TODO_DUE_DATE_CONTEXT);
  });

  it('passes due date context to todo suggestions generation', async () => {
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at, embedded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('WORK-TODO-SUGGEST', '업무노트', '업무 내용', '업무', now, now, null)
      .run();

    const dueContextSpy = vi
      .spyOn(TodoRepository.prototype, 'getOpenTodoDueDateContextForAI')
      .mockResolvedValue(TODO_DUE_DATE_CONTEXT);
    const suggestionSpy = vi
      .spyOn(AIDraftService.prototype, 'generateTodoSuggestions')
      .mockResolvedValue([{ title: '추천', description: '설명', dueDate: '2026-02-15' }]);

    const response = await authFetch('/api/ai/work-notes/WORK-TODO-SUGGEST/todo-suggestions', {
      method: 'POST',
      body: JSON.stringify({ contextText: '추가 정보' }),
    });

    expect(response.status).toBe(200);
    expect(dueContextSpy).toHaveBeenCalledWith(10);
    expect(suggestionSpy).toHaveBeenCalled();
    const options = suggestionSpy.mock.calls[0]?.[2];
    expect(options?.todoDueDateContext).toEqual(TODO_DUE_DATE_CONTEXT);
  });

  it('passes due date context to enhance generation', async () => {
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at, embedded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('WORK-ENHANCE', '기존 제목', '기존 내용', '기획', now, now, null)
      .run();

    const dueContextSpy = vi
      .spyOn(TodoRepository.prototype, 'getOpenTodoDueDateContextForAI')
      .mockResolvedValue(TODO_DUE_DATE_CONTEXT);
    vi.spyOn(WorkNoteService.prototype, 'findSimilarNotes').mockResolvedValue([]);
    const enhanceSpy = vi
      .spyOn(AIDraftService.prototype, 'enhanceExistingWorkNote')
      .mockResolvedValue({ ...DRAFT_RESPONSE, title: '향상 제목' });

    const formData = new FormData();
    formData.append('newContent', '새로운 내용');
    formData.append('generateNewTodos', 'true');

    const response = await authFetch('/api/ai/work-notes/WORK-ENHANCE/enhance', {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(200);
    expect(dueContextSpy).toHaveBeenCalledWith(10);
    expect(enhanceSpy).toHaveBeenCalled();
    const options = enhanceSpy.mock.calls[0]?.[3];
    expect(options?.todoDueDateContext).toEqual(TODO_DUE_DATE_CONTEXT);
  });

  it('passes due date context to pdf draft generation', async () => {
    const dueContextSpy = vi
      .spyOn(TodoRepository.prototype, 'getOpenTodoDueDateContextForAI')
      .mockResolvedValue(TODO_DUE_DATE_CONTEXT);
    vi.spyOn(PdfExtractionService.prototype, 'validatePdfBuffer').mockImplementation(
      () => undefined
    );
    vi.spyOn(PdfExtractionService.prototype, 'extractText').mockResolvedValue('추출된 텍스트');
    vi.spyOn(WorkNoteService.prototype, 'findSimilarNotes').mockResolvedValue([]);
    const generateSpy = vi
      .spyOn(AIDraftService.prototype, 'generateDraftFromText')
      .mockResolvedValue(DRAFT_RESPONSE);

    const file = new File([new Uint8Array([37, 80, 68, 70])], 'sample.pdf', {
      type: 'application/pdf',
    });
    const formData = new FormData();
    formData.append('file', file);

    const response = await authFetch('/api/pdf-jobs', {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(200);
    expect(dueContextSpy).toHaveBeenCalledWith(10);
    expect(generateSpy).toHaveBeenCalled();
    const options = generateSpy.mock.calls[0]?.[1];
    expect(options?.todoDueDateContext).toEqual(TODO_DUE_DATE_CONTEXT);
  });
});
