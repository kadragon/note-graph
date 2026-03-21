import type { WorkNoteDraft } from '@shared/types/search';
import { TodoRepository } from '@worker/repositories/todo-repository';
import { AIDraftService } from '@worker/services/ai-draft-service';
import { PdfExtractionService } from '@worker/services/pdf-extraction-service';
import { WorkNoteService } from '@worker/services/work-note-service';
import type { OpenTodoDueDateContextForAI } from '@worker/types/todo-due-date-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBufferedSSE } from '../helpers/buffered-sse';
import { mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { createAuthFetch } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const authFetch = createAuthFetch(worker);

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
    await pgCleanupAll(pglite);
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
    const data = await parseBufferedSSE<{ draft: WorkNoteDraft }>(response);
    expect(data.draft.title).toBe('AI 제목');
    expect(dueContextSpy).toHaveBeenCalledWith(10);
    expect(generateSpy).toHaveBeenCalled();
    const options = generateSpy.mock.calls[0]?.[1];
    expect(options?.todoDueDateContext).toEqual(TODO_DUE_DATE_CONTEXT);
  });

  it('passes due date context to draft-from-text-with-similar generation', async () => {
    const dueContextSpy = vi
      .spyOn(TodoRepository.prototype, 'getOpenTodoDueDateContextForAI')
      .mockResolvedValue(TODO_DUE_DATE_CONTEXT);
    vi.spyOn(WorkNoteService.prototype, 'findSimilarNotes').mockResolvedValue([
      {
        workId: 'WORK-REF-1',
        title: '참고 노트',
        content: '참고 내용',
        category: '업무',
        similarityScore: 0.8,
      },
    ]);
    const generateSpy = vi
      .spyOn(AIDraftService.prototype, 'generateDraftFromTextWithContext')
      .mockResolvedValue(DRAFT_RESPONSE);

    const response = await authFetch('/api/ai/work-notes/draft-from-text-with-similar', {
      method: 'POST',
      body: JSON.stringify({ inputText: '유사노트 포함 초안 생성 테스트' }),
    });

    expect(response.status).toBe(200);
    await parseBufferedSSE(response); // consume stream so async work completes
    expect(dueContextSpy).toHaveBeenCalledWith(10);
    expect(generateSpy).toHaveBeenCalled();
    const options = generateSpy.mock.calls[0]?.[2];
    expect(options?.todoDueDateContext).toEqual(TODO_DUE_DATE_CONTEXT);
  });

  it('returns meetingReferences when meeting minute suggestions exist', async () => {
    const now = new Date().toISOString();
    await pglite.query(
      `INSERT INTO meeting_minutes (
        meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-DRAFT-001',
        '2026-02-11',
        'API latency review',
        'Investigated unicornlatency spikes and mitigation',
        JSON.stringify(['unicornlatency', 'api']),
        'unicornlatency api',
        now,
        now,
      ]
    );

    vi.spyOn(WorkNoteService.prototype, 'findSimilarNotes').mockResolvedValue([]);
    vi.spyOn(AIDraftService.prototype, 'generateDraftFromText').mockResolvedValue(DRAFT_RESPONSE);

    const response = await authFetch('/api/ai/work-notes/draft-from-text-with-similar', {
      method: 'POST',
      body: JSON.stringify({ inputText: 'Please summarize unicornlatency findings' }),
    });

    expect(response.status).toBe(200);
    const data = await parseBufferedSSE<{
      meetingReferences?: Array<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        keywords: string[];
        score: number;
      }>;
    }>(response);

    expect(data.meetingReferences).toHaveLength(1);
    expect(data.meetingReferences?.[0]).toMatchObject({
      meetingId: 'MEET-DRAFT-001',
      meetingDate: expect.stringContaining('2026-02-11'),
      topic: 'API latency review',
      keywords: ['unicornlatency', 'api'],
    });
    expect(data.meetingReferences?.[0]?.score).toBeGreaterThan(0);
  });

  it('returns meetingReferences ordered by FTS relevance with higher score first', async () => {
    const now = new Date().toISOString();
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-DRAFT-R1',
        '2026-02-11',
        'Roadmap budget review',
        'Roadmap and budget alignment',
        JSON.stringify(['roadmap', 'budget']),
        'roadmap budget',
        now,
        now,
      ]
    );
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-DRAFT-R2',
        '2026-02-10',
        'Roadmap budget staffing',
        'Roadmap budget with staffing topics',
        JSON.stringify(['roadmap', 'budget', 'staffing']),
        'roadmap budget staffing',
        now,
        now,
      ]
    );
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-DRAFT-R3',
        '2026-02-09',
        'General staffing only',
        'Staffing only discussion unrelated to roadmap',
        JSON.stringify(['staffing']),
        'staffing',
        now,
        now,
      ]
    );

    vi.spyOn(WorkNoteService.prototype, 'findSimilarNotes').mockResolvedValue([]);
    vi.spyOn(AIDraftService.prototype, 'generateDraftFromText').mockResolvedValue(DRAFT_RESPONSE);

    const response = await authFetch('/api/ai/work-notes/draft-from-text-with-similar', {
      method: 'POST',
      body: JSON.stringify({ inputText: 'roadmap budget' }),
    });

    expect(response.status).toBe(200);
    const data = await parseBufferedSSE<{
      meetingReferences?: Array<{
        meetingId: string;
        score: number;
      }>;
    }>(response);

    // R3 (staffing only) should be filtered out by minScore threshold
    expect(data.meetingReferences).toHaveLength(2);
    expect(data.meetingReferences?.[0]?.meetingId).toBe('MEET-DRAFT-R1');
    expect(data.meetingReferences?.[1]?.meetingId).toBe('MEET-DRAFT-R2');
    expect(data.meetingReferences?.[0]?.score).toBeGreaterThanOrEqual(
      data.meetingReferences?.[1]?.score ?? 0
    );
  });

  it('sanitizes punctuation-heavy meeting reference queries without MATCH errors', async () => {
    vi.spyOn(WorkNoteService.prototype, 'findSimilarNotes').mockResolvedValue([]);
    vi.spyOn(AIDraftService.prototype, 'generateDraftFromText').mockResolvedValue(DRAFT_RESPONSE);

    const response = await authFetch('/api/ai/work-notes/draft-from-text-with-similar', {
      method: 'POST',
      body: JSON.stringify({ inputText: '!!! ((( ))) :::' }),
    });

    expect(response.status).toBe(200);
    const data = await parseBufferedSSE<{
      meetingReferences?: Array<{ meetingId: string }>;
    }>(response);

    expect(data.meetingReferences).toEqual([]);
  });

  it('passes due date context to todo suggestions generation', async () => {
    const now = new Date().toISOString();
    await pglite.query(
      `INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at, embedded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['WORK-TODO-SUGGEST', '업무노트', '업무 내용', '업무', now, now, null]
    );

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
    await parseBufferedSSE(response); // consume stream so async work completes
    expect(dueContextSpy).toHaveBeenCalledWith(10);
    expect(suggestionSpy).toHaveBeenCalled();
    const options = suggestionSpy.mock.calls[0]?.[2];
    expect(options?.todoDueDateContext).toEqual(TODO_DUE_DATE_CONTEXT);
  });

  it('passes due date context to enhance generation', async () => {
    const now = new Date().toISOString();
    await pglite.query(
      `INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at, embedded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['WORK-ENHANCE', '기존 제목', '기존 내용', '기획', now, now, null]
    );

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
    await parseBufferedSSE(response); // consume stream so async work completes
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
