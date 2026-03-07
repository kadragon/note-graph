import { TaskCategoryRepository } from '@worker/repositories/task-category-repository';
import { beforeEach, describe, expect, it } from 'vitest';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { pglite, testPgDb } from '../pg-setup';

describe('TaskCategoryRepository', () => {
  let repository: TaskCategoryRepository;

  beforeEach(async () => {
    repository = new TaskCategoryRepository(testPgDb);

    await pgCleanupAll(pglite);
  });

  describe('findByIds()', () => {
    it('returns categories in input ID order and ignores missing IDs', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT-001', '기획', true, now]
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT-002', '실행', true, now]
      );

      const result = await repository.findByIds(['CAT-002', 'MISSING', 'CAT-001']);

      expect(result.map((category) => category.categoryId)).toEqual(['CAT-002', 'CAT-001']);
    });
  });
});
