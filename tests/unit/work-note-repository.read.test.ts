// Trace: Test coverage improvement
// Unit tests for WorkNoteRepository - Read operations (findById, findByIdWithDetails, findAll)

import { env } from 'cloudflare:test';
import { WorkNoteRepository } from '@worker/repositories/work-note-repository';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('WorkNoteRepository - Read operations', () => {
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
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          personId,
          '홍길동'
        ),
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(workId, 'Test', 'Content', '업무', now, now),
        testEnv.DB.prepare(
          'INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)'
        ).bind(workId, personId, 'OWNER'),
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
        testEnv.DB.prepare(
          'INSERT INTO work_note_relation (work_id, related_work_id) VALUES (?, ?)'
        ).bind(workId, relatedWorkId),
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
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          personId,
          '홍길동'
        ),
        testEnv.DB.prepare(
          'INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)'
        ).bind('WORK-001', personId, 'OWNER'),
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
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)'
        ).bind(personId, '홍길동', deptName),
        testEnv.DB.prepare(
          'INSERT INTO person_dept_history (person_id, dept_name, start_date, is_active) VALUES (?, ?, ?, ?)'
        ).bind(personId, deptName, new Date().toISOString(), 1),
        testEnv.DB.prepare(
          'INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)'
        ).bind('WORK-001', personId, 'OWNER'),
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
});
