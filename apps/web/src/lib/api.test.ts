// Trace: SPEC-dept-1, TASK-022
// Ensure API client sends correct payload when creating departments

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from './api';

describe('API.createDepartment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends deptName in request body', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({
        deptName: '교무기획부',
        description: null,
        createdAt: now,
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.createDepartment({ deptName: '교무기획부' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/departments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ deptName: '교무기획부' }),
      })
    );
  });
});

describe('API.getDepartments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('includes query params and forwards abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const controller = new AbortController();
    const params = new URLSearchParams({ q: '교무', limit: '5' });

    await API.getDepartments({ q: '교무', limit: 5 }, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/departments?${params.toString()}`,
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('uses base endpoint when no params are provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.getDepartments();

    expect(fetchMock).toHaveBeenCalledWith('/api/departments', expect.any(Object));
  });
});

describe('API.getWorkNotes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps backend fields to frontend work note shape', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([
        {
          workId: 'work-1',
          title: '회의 정리',
          contentRaw: '원문 내용',
          category: null,
          createdAt: now,
          updatedAt: now,
        },
      ]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const [note] = await API.getWorkNotes();

    expect(note).toEqual({
      id: 'work-1',
      title: '회의 정리',
      content: '원문 내용',
      category: '',
      categories: [],
      persons: [],
      relatedWorkNotes: [],
      files: [],
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('API.request error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws server-provided message for non-ok responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ message: '잘못된 요청입니다' }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await expect(API.getMe()).rejects.toThrow('잘못된 요청입니다');
  });

  it('falls back to a default message when error payload cannot be parsed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('bad json')),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await expect(API.getMe()).rejects.toThrow('알 수 없는 오류가 발생했습니다');
  });

  it('falls back to HTTP status when message is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 418,
      json: vi.fn().mockResolvedValue({}),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await expect(API.getMe()).rejects.toThrow('HTTP 418');
  });
});

describe('API.deleteWorkNote', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for 204 responses without parsing JSON', async () => {
    const jsonMock = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: jsonMock,
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await expect(API.deleteWorkNote('work-1')).resolves.toBeNull();
    expect(jsonMock).not.toHaveBeenCalled();
  });
});

describe('API.uploadFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('appends file and metadata to FormData and skips undefined values', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({ fileId: 'file-1' }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    await API.uploadWorkNoteFile('work-1', file);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/work-notes/work-1/files',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    const formData = options.body as FormData;
    const uploadedFile = formData.get('file') as File;
    expect(uploadedFile.name).toBe('test.pdf');
    expect(uploadedFile.type).toBe('application/pdf');
  });

  it('throws error message from server for non-ok upload responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ message: '파일 형식이 지원되지 않습니다' }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    await expect(API.uploadWorkNoteFile('work-1', file)).rejects.toThrow(
      '파일 형식이 지원되지 않습니다'
    );
  });

  it('falls back to default message when upload error response fails to parse', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    await expect(API.uploadWorkNoteFile('work-1', file)).rejects.toThrow('업로드 실패');
  });
});

describe('API.createWorkNote', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('transforms content to contentRaw in request body', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({
        workId: 'work-1',
        title: '새 업무노트',
        contentRaw: '내용입니다',
        category: null,
        createdAt: now,
        updatedAt: now,
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.createWorkNote({
      title: '새 업무노트',
      content: '내용입니다',
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.contentRaw).toBe('내용입니다');
    expect(body.content).toBeUndefined();
  });

  it('transforms relatedPersonIds to persons array with RELATED role', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({
        workId: 'work-1',
        title: '테스트',
        contentRaw: '내용',
        category: null,
        createdAt: now,
        updatedAt: now,
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.createWorkNote({
      title: '테스트',
      content: '내용',
      relatedPersonIds: ['person-1', 'person-2'],
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.persons).toEqual([
      { personId: 'person-1', role: 'RELATED' },
      { personId: 'person-2', role: 'RELATED' },
    ]);
  });

  it('passes relatedWorkIds to request body', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({
        workId: 'work-1',
        title: '테스트',
        contentRaw: '내용',
        category: null,
        createdAt: now,
        updatedAt: now,
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.createWorkNote({
      title: '테스트',
      content: '내용',
      relatedWorkIds: ['work-2', 'work-3'],
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.relatedWorkIds).toEqual(['work-2', 'work-3']);
  });
});

describe('API.updateWorkNote', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('transforms content to contentRaw only when content is provided', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        workId: 'work-1',
        title: '업데이트된 제목',
        contentRaw: '기존 내용',
        category: null,
        createdAt: now,
        updatedAt: now,
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    // Update only title (not content)
    await API.updateWorkNote('work-1', { title: '업데이트된 제목' });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.title).toBe('업데이트된 제목');
    expect(body.contentRaw).toBeUndefined();
    expect(body.content).toBeUndefined();
  });

  it('transforms content to contentRaw when content is provided', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        workId: 'work-1',
        title: '테스트',
        contentRaw: '새 내용',
        category: null,
        createdAt: now,
        updatedAt: now,
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.updateWorkNote('work-1', { content: '새 내용' });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.contentRaw).toBe('새 내용');
    expect(body.content).toBeUndefined();
  });
});

describe('API.search', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('transforms backend search response to frontend format', async () => {
    const createdAt = '2024-01-15T10:00:00Z';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        workNotes: [
          {
            workNote: {
              workId: 'work-1',
              title: '검색 결과',
              category: '업무',
              createdAt,
            },
            score: 0.95,
            source: 'SEMANTIC',
          },
        ],
        persons: [
          {
            personId: 'person-1',
            name: '홍길동',
            currentDept: '개발팀',
            currentPosition: '팀장',
            phoneExt: '1234',
            employmentStatus: 'ACTIVE',
          },
        ],
        departments: [
          {
            deptName: '개발팀',
            description: '소프트웨어 개발',
            isActive: true,
          },
        ],
        query: '검색어',
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const result = await API.search({ query: '검색어' });

    expect(result.workNotes).toEqual([
      {
        id: 'work-1',
        title: '검색 결과',
        category: '업무',
        score: 0.95,
        source: 'semantic',
        createdAt,
      },
    ]);
    expect(result.persons).toEqual([
      {
        personId: 'person-1',
        name: '홍길동',
        currentDept: '개발팀',
        currentPosition: '팀장',
        phoneExt: '1234',
        employmentStatus: 'ACTIVE',
      },
    ]);
    expect(result.departments).toEqual([
      {
        deptName: '개발팀',
        description: '소프트웨어 개발',
        isActive: true,
      },
    ]);
    expect(result.query).toBe('검색어');
  });

  it('throws error for invalid response structure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        // Missing required arrays
        query: '검색어',
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await expect(API.search({ query: '검색어' })).rejects.toThrow(
      'Invalid search response from server'
    );
  });

  it('handles null category in work note results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        workNotes: [
          {
            workNote: {
              workId: 'work-1',
              title: '제목',
              category: null,
              createdAt: '2024-01-01T00:00:00Z',
            },
            score: 0.8,
            source: 'LEXICAL',
          },
        ],
        persons: [],
        departments: [],
        query: '테스트',
      }),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const result = await API.search({ query: '테스트' });

    expect(result.workNotes[0].category).toBe('');
    expect(result.workNotes[0].source).toBe('lexical');
  });
});

describe('API.getTodos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('transforms backend todo response to frontend format', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([
        {
          todoId: 'todo-1',
          workId: 'work-1',
          title: '할 일',
          description: '설명',
          status: 'PENDING',
          dueDate: '2024-01-20',
          waitUntil: null,
          repeatRule: 'DAILY',
          recurrenceType: 'AFTER_COMPLETION',
          customInterval: 1,
          customUnit: 'DAYS',
          skipWeekends: true,
          createdAt: now,
          updatedAt: now,
          workTitle: '업무노트 제목',
          workCategory: '업무',
        },
      ]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const [todo] = await API.getTodos('today');

    expect(todo).toEqual({
      id: 'todo-1',
      workNoteId: 'work-1',
      title: '할 일',
      description: '설명',
      status: 'PENDING',
      dueDate: '2024-01-20',
      waitUntil: null,
      repeatRule: 'DAILY',
      recurrenceType: 'AFTER_COMPLETION',
      customInterval: 1,
      customUnit: 'DAYS',
      skipWeekends: true,
      createdAt: now,
      updatedAt: now,
      workTitle: '업무노트 제목',
      workCategory: '업무',
    });
  });

  it('includes view and year params in request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.getTodos('completed', 2024);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/todos?view=completed&year=2024',
      expect.any(Object)
    );
  });

  it('includes workIds param when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.getTodos('remaining', undefined, ['work-1', 'work-2']);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/todos?view=remaining&workIds=work-1%2Cwork-2',
      expect.any(Object)
    );
  });

  it('defaults view to today when not specified', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.getTodos();

    expect(fetchMock).toHaveBeenCalledWith('/api/todos?view=today', expect.any(Object));
  });
});

describe('API.getProjectWorkNotes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('transforms backend format work notes', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([
        {
          workId: 'work-1',
          title: '프로젝트 업무노트',
          contentRaw: '내용',
          category: '업무',
          createdAt: now,
          updatedAt: now,
        },
      ]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const [note] = await API.getProjectWorkNotes('project-1');

    expect(note.id).toBe('work-1');
    expect(note.content).toBe('내용');
  });

  it('passes through already-transformed frontend format', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([
        {
          id: 'work-1',
          title: '프로젝트 업무노트',
          content: '이미 변환된 내용',
          category: '업무',
          createdAt: now,
          updatedAt: now,
        },
      ]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const [note] = await API.getProjectWorkNotes('project-1');

    expect(note.id).toBe('work-1');
    expect(note.content).toBe('이미 변환된 내용');
  });

  it('handles mixed format responses using fallbacks', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([
        {
          // Has id but no content - needs transformation via fallback
          id: 'work-1',
          workId: 'work-1',
          title: '혼합 형식',
          contentRaw: '원본 내용',
          category: null,
          createdAt: now,
          updatedAt: now,
        },
      ]),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const [note] = await API.getProjectWorkNotes('project-1');

    expect(note.id).toBe('work-1');
    expect(note.content).toBe('원본 내용');
  });
});

describe('API.downloadWorkNoteFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns blob for successful downloads', async () => {
    const mockBlob = new Blob(['file content'], { type: 'application/pdf' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const result = await API.downloadWorkNoteFile('work-1', 'file-1');

    expect(result).toBe(mockBlob);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/work-notes/work-1/files/file-1/download',
      expect.any(Object)
    );
  });

  it('throws error for failed downloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await expect(API.downloadWorkNoteFile('work-1', 'file-1')).rejects.toThrow(
      '파일 다운로드 실패: 404'
    );
  });
});

describe('API.downloadProjectFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns blob for successful downloads', async () => {
    const mockBlob = new Blob(['project file'], { type: 'text/plain' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const result = await API.downloadProjectFile('project-1', 'file-1');

    expect(result).toBe(mockBlob);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/files/file-1/download',
      expect.any(Object)
    );
  });

  it('throws error with status for failed downloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await expect(API.downloadProjectFile('project-1', 'file-1')).rejects.toThrow(
      '파일 다운로드 실패: 500'
    );
  });
});

describe('API.getWorkNoteFileViewUrl', () => {
  it('returns correct view URL for work note file', () => {
    const url = API.getWorkNoteFileViewUrl('work-1', 'file-1');
    expect(url).toBe('/api/work-notes/work-1/files/file-1/view');
  });
});
