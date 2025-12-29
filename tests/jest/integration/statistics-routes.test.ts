// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-005
/**
 * Integration tests for statistics API routes (Jest)
 */

import app from '@worker/index';
import type { Env } from '@worker/types/env';

type StatisticsResponse = {
  summary: {
    totalWorkNotes: number;
    totalTodos: number;
    completedTodos: number;
    overdueTodos: number;
  };
  workNotes: Array<{ workId: string }>;
};

const createExecutionContext = () => ({
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
});

async function createTestEnv(overrides: Partial<Env> = {}): Promise<Env> {
  const db = await globalThis.getDB();
  return {
    DB: db,
    VECTORIZE: {
      query: async () => ({ matches: [] }),
      deleteByIds: async () => undefined,
      upsert: async () => undefined,
    } as unknown as Env['VECTORIZE'],
    AI_GATEWAY: { fetch: async () => new Response('') } as unknown as Env['AI_GATEWAY'],
    ASSETS: { fetch: async () => new Response('') } as unknown as Env['ASSETS'],
    R2_BUCKET: {} as unknown as Env['R2_BUCKET'],
    ENVIRONMENT: 'production',
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
    AI_GATEWAY_ID: 'test-gateway',
    OPENAI_MODEL_CHAT: 'gpt-test',
    OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
    OPENAI_MODEL_LIGHTWEIGHT: 'gpt-5-mini',
    OPENAI_API_KEY: 'test-key',
    ...overrides,
  } as Env;
}

const authFetch = (env: Env, path: string, options?: RequestInit) => {
  return app.request(
    path,
    {
      ...options,
      headers: {
        'Cf-Access-Authenticated-User-Email': 'test@example.com',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    },
    env,
    createExecutionContext()
  );
};

describe('Statistics API Routes', () => {
  let testEnv: Env;

  beforeEach(async () => {
    testEnv = await createTestEnv();

    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_note_task_category'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
      testEnv.DB.prepare('DELETE FROM task_categories'),
    ]);
  });

  describe('GET /api/statistics', () => {
    it('should return statistics for this-week period', async () => {
      // Arrange: Create test data with completed todos
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO task_categories (category_id, name, created_at) VALUES (?, ?, ?)`
        ).bind('CAT-001', '버그수정', `${today}T00:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`
        ).bind('WORK-001', 'CAT-001'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-001',
          'WORK-001',
          'Task 1',
          '완료',
          `${today}T10:00:00Z`,
          `${today}T10:00:00Z`
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-002',
          'WORK-001',
          'Task 2',
          '진행중',
          `${today}T10:00:00Z`,
          `${today}T10:00:00Z`
        ),
      ]);

      // Act
      const response = await authFetch(testEnv, '/api/statistics?period=this-week');

      // Assert
      expect(response.status).toBe(200);
      const data = (await response.json()) as StatisticsResponse;
      expect(data.summary).toBeDefined();
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.summary.totalCompletedTodos).toBe(1);
      expect(data.summary.totalTodos).toBe(2);
      expect(data.distributions).toBeDefined();
      expect(data.workNotes).toHaveLength(1);
      expect(data.distributions.byCategory[0].categoryName).toBe('버그수정');
    });

    it('should return empty statistics when no completed todos exist', async () => {
      // Arrange: Create work note with no completed todos
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-001',
          'WORK-001',
          'Task 1',
          '진행중',
          `${today}T10:00:00Z`,
          `${today}T10:00:00Z`
        ),
      ]);

      // Act
      const response = await authFetch(testEnv, '/api/statistics?period=this-week');

      // Assert
      expect(response.status).toBe(200);
      const data = (await response.json()) as StatisticsResponse;
      expect(data.summary.totalWorkNotes).toBe(0);
      expect(data.workNotes).toHaveLength(0);
    });

    it('should filter by person correctly', async () => {
      // Arrange: Create work notes for different persons
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P002', '김철수', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-002', 'Work 2', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-002', 'P002', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-001', 'WORK-001', 'Task', '완료', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-002', 'WORK-002', 'Task', '완료', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
      ]);

      // Act: Filter by P001
      const response = await authFetch(testEnv, '/api/statistics?period=this-week&personId=P001');

      // Assert
      expect(response.status).toBe(200);
      const data = (await response.json()) as StatisticsResponse;
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.workNotes[0].workId).toBe('WORK-001');
    });

    it('should support first-half period with year parameter', async () => {
      // Arrange: Create work notes in different periods
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(
          'WORK-JAN',
          'January Work',
          'Content',
          '2025-01-15T10:00:00Z',
          '2025-01-15T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-JUL', 'July Work', 'Content', '2025-07-15T10:00:00Z', '2025-07-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-JAN', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-JUL', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-JAN',
          'WORK-JAN',
          'Task',
          '완료',
          '2025-01-15T10:00:00Z',
          '2025-01-15T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-JUL',
          'WORK-JUL',
          'Task',
          '완료',
          '2025-07-15T10:00:00Z',
          '2025-07-15T10:00:00Z'
        ),
      ]);

      // Act
      const response = await authFetch(testEnv, '/api/statistics?period=first-half&year=2025');

      // Assert
      expect(response.status).toBe(200);
      const data = (await response.json()) as StatisticsResponse;
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.workNotes[0].workId).toBe('WORK-JAN');
    });
  });
});
