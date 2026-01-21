// Trace: Test coverage improvement
// Unit tests for WorkNoteRepository - Version management (getVersions)

import { env } from 'cloudflare:test';
import { WorkNoteRepository } from '@worker/repositories/work-note-repository';
import type { CreateWorkNoteInput } from '@worker/schemas/work-note';
import type { Env } from '@worker/types/env';
import { NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('WorkNoteRepository - Version management', () => {
  let repository: WorkNoteRepository;

  beforeEach(async () => {
    repository = new WorkNoteRepository(testEnv.DB);

    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_relation'),
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_note_versions'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM person_dept_history'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);
  });

  describe('getVersions()', () => {
    it('should throw NotFoundError for non-existent work note', async () => {
      // Act & Assert
      await expect(repository.getVersions('WORK-NONEXISTENT')).rejects.toThrow(NotFoundError);
    });

    it('should return versions in descending order', async () => {
      // Arrange
      const input: CreateWorkNoteInput = {
        title: 'Original',
        contentRaw: 'Content',
      };
      const created = await repository.create(input);
      await repository.update(created.workId, { title: 'Version 2' });
      await repository.update(created.workId, { title: 'Version 3' });

      // Act
      const versions = await repository.getVersions(created.workId);

      // Assert
      expect(versions.length).toBe(3);
      expect(versions[0].versionNo).toBe(3);
      expect(versions[1].versionNo).toBe(2);
      expect(versions[2].versionNo).toBe(1);
    });

    it('should include all version fields', async () => {
      // Arrange
      const input: CreateWorkNoteInput = {
        title: 'Test',
        contentRaw: 'Content',
        category: '업무',
      };
      const created = await repository.create(input);

      // Act
      const versions = await repository.getVersions(created.workId);

      // Assert
      expect(versions[0]).toHaveProperty('id');
      expect(versions[0]).toHaveProperty('workId');
      expect(versions[0]).toHaveProperty('versionNo');
      expect(versions[0]).toHaveProperty('title');
      expect(versions[0]).toHaveProperty('contentRaw');
      expect(versions[0]).toHaveProperty('category');
      expect(versions[0]).toHaveProperty('createdAt');
    });
  });
});
