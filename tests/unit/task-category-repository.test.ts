import { env } from 'cloudflare:test';
import { TaskCategoryRepository } from '@worker/repositories/task-category-repository';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('TaskCategoryRepository', () => {
  let repository: TaskCategoryRepository;

  beforeEach(async () => {
    repository = new TaskCategoryRepository(testEnv.DB);

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_task_category'),
      testEnv.DB.prepare('DELETE FROM task_categories'),
    ]);
  });

  describe('findByIds()', () => {
    it('returns categories in input ID order and ignores missing IDs', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES (?, ?, ?, ?)'
        ).bind('CAT-001', '기획', 1, now),
        testEnv.DB.prepare(
          'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES (?, ?, ?, ?)'
        ).bind('CAT-002', '실행', 1, now),
      ]);

      const result = await repository.findByIds(['CAT-002', 'MISSING', 'CAT-001']);

      expect(result.map((category) => category.categoryId)).toEqual(['CAT-002', 'CAT-001']);
    });
  });
});
