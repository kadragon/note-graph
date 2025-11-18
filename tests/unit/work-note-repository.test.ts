// Trace: Test coverage improvement
// Unit tests for WorkNoteRepository

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { WorkNoteRepository } from '../../src/repositories/work-note-repository';
import { NotFoundError } from '../../src/types/errors';
import type { Env } from '../../src/types/env';
import type { CreateWorkNoteInput, UpdateWorkNoteInput } from '../../src/schemas/work-note';

const testEnv = env as unknown as Env;

describe('WorkNoteRepository', () => {
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

  describe('findById()', () => {
    it('should find work note by ID', async () => {
      // Arrange - create a work note directly in DB
      const workId = 'WORK-TEST-001';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(workId, 'Test Title', 'Test Content', '업무', now, now)
        .run();

      // Act
      const result = await repository.findById(workId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.workId).toBe(workId);
      expect(result?.title).toBe('Test Title');
      expect(result?.contentRaw).toBe('Test Content');
      expect(result?.category).toBe('업무');
    });

    it('should return null for non-existent work note', async () => {
      // Act
      const result = await repository.findById('WORK-NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle Korean text in title and content', async () => {
      // Arrange
      const workId = 'WORK-TEST-002';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(workId, '한글 제목', '한글 내용입니다', '회의', now, now)
        .run();

      // Act
      const result = await repository.findById(workId);

      // Assert
      expect(result?.title).toBe('한글 제목');
      expect(result?.contentRaw).toBe('한글 내용입니다');
    });
  });

  describe('findByIdWithDetails()', () => {
    it('should return null for non-existent work note', async () => {
      // Act
      const result = await repository.findByIdWithDetails('WORK-NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });

    it('should find work note with person associations', async () => {
      // Arrange
      const workId = 'WORK-TEST-003';
      const personId = '123456';
      const now = new Date().toISOString();

      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(personId, '홍길동'),
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(workId, 'Test', 'Content', '업무', now, now),
        testEnv.DB.prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)').bind(
          workId,
          personId,
          'OWNER'
        ),
      ]);

      // Act
      const result = await repository.findByIdWithDetails(workId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.persons).toBeDefined();
      expect(result?.persons.length).toBe(1);
      expect(result?.persons[0].personId).toBe(personId);
      expect(result?.persons[0].role).toBe('OWNER');
      expect(result?.persons[0].personName).toBe('홍길동');
    });

    it('should find work note with related work notes', async () => {
      // Arrange
      const workId = 'WORK-TEST-004';
      const relatedWorkId = 'WORK-TEST-005';
      const now = new Date().toISOString();

      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(workId, 'Main Work', 'Content', '업무', now, now),
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(relatedWorkId, 'Related Work', 'Related Content', '회의', now, now),
        testEnv.DB.prepare('INSERT INTO work_note_relation (work_id, related_work_id) VALUES (?, ?)').bind(
          workId,
          relatedWorkId
        ),
      ]);

      // Act
      const result = await repository.findByIdWithDetails(workId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.relatedWorkNotes).toBeDefined();
      expect(result?.relatedWorkNotes.length).toBe(1);
      expect(result?.relatedWorkNotes[0].relatedWorkId).toBe(relatedWorkId);
      expect(result?.relatedWorkNotes[0].relatedWorkTitle).toBe('Related Work');
    });

    it('should return empty arrays when no associations exist', async () => {
      // Arrange
      const workId = 'WORK-TEST-006';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(workId, 'Test', 'Content', '업무', now, now)
        .run();

      // Act
      const result = await repository.findByIdWithDetails(workId);

      // Assert
      expect(result?.persons).toEqual([]);
      expect(result?.relatedWorkNotes).toEqual([]);
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
      // Create test data
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('WORK-001', 'First Note', 'Content 1', '업무', now, now),
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('WORK-002', 'Second Note', 'Content 2', '회의', now, now),
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('WORK-003', 'Third Note', 'Content 3', '업무', now, now),
      ]);
    });

    it('should return all work notes when no filters applied', async () => {
      // Act
      const result = await repository.findAll({});

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by category', async () => {
      // Act
      const result = await repository.findAll({ category: '업무' });

      // Assert
      expect(result.length).toBe(2);
      expect(result.every((note) => note.category === '업무')).toBe(true);
    });

    it('should filter by keyword in title', async () => {
      // Act
      const result = await repository.findAll({ q: 'First' });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((note) => note.title.includes('First'))).toBe(true);
    });

    it('should filter by keyword in content', async () => {
      // Act
      const result = await repository.findAll({ q: 'Content 2' });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((note) => note.contentRaw.includes('Content 2'))).toBe(true);
    });

    it('should filter by person ID', async () => {
      // Arrange
      const personId = '123456';
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(personId, '홍길동'),
        testEnv.DB.prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)').bind(
          'WORK-001',
          personId,
          'OWNER'
        ),
      ]);

      // Act
      const result = await repository.findAll({ personId });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((note) => note.workId === 'WORK-001')).toBe(true);
    });

    it('should filter by department name', async () => {
      // Arrange
      const personId = '123456';
      const deptName = '개발팀';
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind(deptName),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)').bind(
          personId,
          '홍길동',
          deptName
        ),
        testEnv.DB.prepare('INSERT INTO person_dept_history (person_id, dept_name, start_date, is_active) VALUES (?, ?, ?, ?)').bind(
          personId,
          deptName,
          new Date().toISOString(),
          1
        ),
        testEnv.DB.prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)').bind(
          'WORK-001',
          personId,
          'OWNER'
        ),
      ]);

      // Act
      const result = await repository.findAll({ deptName });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return results ordered by created_at DESC', async () => {
      // Act
      const result = await repository.findAll({});

      // Assert
      expect(result.length).toBeGreaterThan(0);
      // Verify ordering
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(result[i].createdAt).getTime()
        );
      }
    });

    it('should filter by date range (from)', async () => {
      // Act
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = await repository.findAll({ from: futureDate.toISOString() });

      // Assert - should return no results as all notes are created now
      expect(result.length).toBe(0);
    });

    it('should filter by date range (to)', async () => {
      // Act
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const result = await repository.findAll({ to: pastDate.toISOString() });

      // Assert - should return no results as all notes are created now
      expect(result.length).toBe(0);
    });
  });

  describe('create()', () => {
    it('should create work note with minimal fields', async () => {
      // Arrange
      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'New Content',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.workId).toBeDefined();
      expect(result.workId).toMatch(/^WORK-/);
      expect(result.title).toBe('New Note');
      expect(result.contentRaw).toBe('New Content');
      expect(result.category).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      // Verify in DB
      const found = await repository.findById(result.workId);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('New Note');
    });

    it('should create work note with category', async () => {
      // Arrange
      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
        category: '회의',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.category).toBe('회의');
    });

    it('should create work note with person associations', async () => {
      // Arrange
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(personId, '홍길동').run();

      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
        persons: [{ personId, role: 'OWNER' }],
      };

      // Act
      const result = await repository.create(input);

      // Assert
      const details = await repository.findByIdWithDetails(result.workId);
      expect(details?.persons.length).toBe(1);
      expect(details?.persons[0].personId).toBe(personId);
      expect(details?.persons[0].role).toBe('OWNER');
    });

    it('should create work note with multiple person associations', async () => {
      // Arrange
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind('P-001', 'Person 1'),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind('P-002', 'Person 2'),
      ]);

      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
        persons: [
          { personId: 'P-001', role: 'OWNER' },
          { personId: 'P-002', role: 'PARTICIPANT' },
        ],
      };

      // Act
      const result = await repository.create(input);

      // Assert
      const details = await repository.findByIdWithDetails(result.workId);
      expect(details?.persons.length).toBe(2);
    });

    it('should create work note with related work notes', async () => {
      // Arrange
      const relatedWorkId = 'WORK-RELATED';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(relatedWorkId, 'Related', 'Content', now, now)
        .run();

      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
        relatedWorkIds: [relatedWorkId],
      };

      // Act
      const result = await repository.create(input);

      // Assert
      const details = await repository.findByIdWithDetails(result.workId);
      expect(details?.relatedWorkNotes.length).toBe(1);
      expect(details?.relatedWorkNotes[0].relatedWorkId).toBe(relatedWorkId);
    });

    it('should create first version when creating work note', async () => {
      // Arrange
      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      const versions = await repository.getVersions(result.workId);
      expect(versions.length).toBe(1);
      expect(versions[0].versionNo).toBe(1);
      expect(versions[0].title).toBe('New Note');
    });

    it('should generate unique work IDs', async () => {
      // Arrange
      const input: CreateWorkNoteInput = {
        title: 'Test',
        contentRaw: 'Content',
      };

      // Act
      const result1 = await repository.create(input);
      const result2 = await repository.create(input);

      // Assert
      expect(result1.workId).not.toBe(result2.workId);
      expect(result1.workId).toMatch(/^WORK-/);
      expect(result2.workId).toMatch(/^WORK-/);
    });
  });

  describe('update()', () => {
    let existingWorkId: string;

    beforeEach(async () => {
      // Create an existing work note
      const input: CreateWorkNoteInput = {
        title: 'Original Title',
        contentRaw: 'Original Content',
        category: '업무',
      };
      const created = await repository.create(input);
      existingWorkId = created.workId;
    });

    it('should throw NotFoundError for non-existent work note', async () => {
      // Act & Assert
      await expect(repository.update('WORK-NONEXISTENT', { title: 'New Title' })).rejects.toThrow(NotFoundError);
    });

    it('should update title only', async () => {
      // Arrange
      const update: UpdateWorkNoteInput = {
        title: 'Updated Title',
      };

      // Act
      const result = await repository.update(existingWorkId, update);

      // Assert
      expect(result.title).toBe('Updated Title');
      expect(result.contentRaw).toBe('Original Content');
      expect(result.category).toBe('업무');
    });

    it('should update content only', async () => {
      // Arrange
      const update: UpdateWorkNoteInput = {
        contentRaw: 'Updated Content',
      };

      // Act
      const result = await repository.update(existingWorkId, update);

      // Assert
      expect(result.title).toBe('Original Title');
      expect(result.contentRaw).toBe('Updated Content');
    });

    it('should update category', async () => {
      // Arrange
      const update: UpdateWorkNoteInput = {
        category: '회의',
      };

      // Act
      const result = await repository.update(existingWorkId, update);

      // Assert
      expect(result.category).toBe('회의');
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const update: UpdateWorkNoteInput = {
        title: 'New Title',
        contentRaw: 'New Content',
        category: '보고',
      };

      // Act
      const result = await repository.update(existingWorkId, update);

      // Assert
      expect(result.title).toBe('New Title');
      expect(result.contentRaw).toBe('New Content');
      expect(result.category).toBe('보고');
    });

    it('should create new version when updating', async () => {
      // Act
      await repository.update(existingWorkId, { title: 'Updated Title' });

      // Assert
      const versions = await repository.getVersions(existingWorkId);
      expect(versions.length).toBe(2);
      expect(versions[0].versionNo).toBe(2);
      expect(versions[1].versionNo).toBe(1);
    });

    it('should update person associations', async () => {
      // Arrange
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(personId, '홍길동').run();

      const update: UpdateWorkNoteInput = {
        persons: [{ personId, role: 'OWNER' }],
      };

      // Act
      await repository.update(existingWorkId, update);

      // Assert
      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.persons.length).toBe(1);
      expect(details?.persons[0].personId).toBe(personId);
    });

    it('should replace existing person associations', async () => {
      // Arrange
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind('P-001', 'Person 1'),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind('P-002', 'Person 2'),
        testEnv.DB.prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)').bind(
          existingWorkId,
          'P-001',
          'OWNER'
        ),
      ]);

      const update: UpdateWorkNoteInput = {
        persons: [{ personId: 'P-002', role: 'PARTICIPANT' }],
      };

      // Act
      await repository.update(existingWorkId, update);

      // Assert
      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.persons.length).toBe(1);
      expect(details?.persons[0].personId).toBe('P-002');
    });

    it('should update related work notes', async () => {
      // Arrange
      const relatedWorkId = 'WORK-RELATED';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(relatedWorkId, 'Related', 'Content', now, now)
        .run();

      const update: UpdateWorkNoteInput = {
        relatedWorkIds: [relatedWorkId],
      };

      // Act
      await repository.update(existingWorkId, update);

      // Assert
      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.relatedWorkNotes.length).toBe(1);
      expect(details?.relatedWorkNotes[0].relatedWorkId).toBe(relatedWorkId);
    });

    it('should prune old versions after 5 versions', async () => {
      // Act - Create 6 versions (1 initial + 5 updates)
      for (let i = 1; i <= 6; i++) {
        await repository.update(existingWorkId, { title: `Version ${i}` });
      }

      // Assert
      const versions = await repository.getVersions(existingWorkId);
      expect(versions.length).toBeLessThanOrEqual(5);
    });

    it('should update updatedAt timestamp', async () => {
      // Arrange
      const originalNote = await repository.findById(existingWorkId);
      const originalUpdatedAt = originalNote?.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act
      await repository.update(existingWorkId, { title: 'New Title' });

      // Assert
      const updatedNote = await repository.findById(existingWorkId);
      expect(updatedNote?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should handle empty persons array', async () => {
      // Arrange
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind('P-001', 'Person 1'),
        testEnv.DB.prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)').bind(
          existingWorkId,
          'P-001',
          'OWNER'
        ),
      ]);

      const update: UpdateWorkNoteInput = {
        persons: [],
      };

      // Act
      await repository.update(existingWorkId, update);

      // Assert
      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.persons.length).toBe(0);
    });
  });

  describe('delete()', () => {
    it('should delete existing work note', async () => {
      // Arrange
      const input: CreateWorkNoteInput = {
        title: 'To Delete',
        contentRaw: 'Content',
      };
      const created = await repository.create(input);

      // Act
      await repository.delete(created.workId);

      // Assert
      const found = await repository.findById(created.workId);
      expect(found).toBeNull();
    });

    it('should throw NotFoundError for non-existent work note', async () => {
      // Act & Assert
      await expect(repository.delete('WORK-NONEXISTENT')).rejects.toThrow(NotFoundError);
    });

    it('should cascade delete person associations', async () => {
      // Arrange
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(personId, '홍길동').run();

      const input: CreateWorkNoteInput = {
        title: 'To Delete',
        contentRaw: 'Content',
        persons: [{ personId, role: 'OWNER' }],
      };
      const created = await repository.create(input);

      // Act
      await repository.delete(created.workId);

      // Assert
      const associations = await testEnv.DB.prepare(
        'SELECT * FROM work_note_person WHERE work_id = ?'
      )
        .bind(created.workId)
        .all();
      expect(associations.results.length).toBe(0);
    });
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

  describe('getDeptNameForPerson()', () => {
    it('should return department name for person', async () => {
      // Arrange
      const personId = '123456';
      const deptName = '개발팀';
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind(deptName),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)').bind(
          personId,
          '홍길동',
          deptName
        ),
      ]);

      // Act
      const result = await repository.getDeptNameForPerson(personId);

      // Assert
      expect(result).toBe(deptName);
    });

    it('should return null for person without department', async () => {
      // Arrange
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(personId, '홍길동').run();

      // Act
      const result = await repository.getDeptNameForPerson(personId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for non-existent person', async () => {
      // Act
      const result = await repository.getDeptNameForPerson('NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });
  });
});
