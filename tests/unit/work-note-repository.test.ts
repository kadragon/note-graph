// Unit tests for WorkNoteRepository
// Consolidated from crud, read, associations, and versions test files

import { env } from 'cloudflare:test';
import { D1DatabaseClient } from '@worker/adapters/d1-database-client';
import { WorkNoteRepository } from '@worker/repositories/work-note-repository';
import type { CreateWorkNoteInput, UpdateWorkNoteInput } from '@worker/schemas/work-note';
import type { Env } from '@worker/types/env';
import { NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;
const testDb = new D1DatabaseClient(testEnv.DB);

describe('WorkNoteRepository', () => {
  let repository: WorkNoteRepository;

  beforeEach(async () => {
    repository = new WorkNoteRepository(testDb);

    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_relation'),
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_note_versions'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM person_dept_history'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);
  });

  // --- CRUD operations ---

  describe('create()', () => {
    it('should create work note with minimal fields', async () => {
      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'New Content',
      };

      const result = await repository.create(input);

      expect(result.workId).toBeDefined();
      expect(result.workId).toMatch(/^WORK-/);
      expect(result.title).toBe('New Note');
      expect(result.contentRaw).toBe('New Content');
      expect(result.category).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      const found = await repository.findById(result.workId);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('New Note');
    });

    it('should create work note with category', async () => {
      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
        category: '회의',
      };

      const result = await repository.create(input);

      expect(result.category).toBe('회의');
    });

    it('should create work note with person associations', async () => {
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
        persons: [{ personId, role: 'OWNER' }],
      };

      const result = await repository.create(input);

      const details = await repository.findByIdWithDetails(result.workId);
      expect(details?.persons.length).toBe(1);
      expect(details?.persons[0].personId).toBe(personId);
      expect(details?.persons[0].role).toBe('OWNER');
    });

    it('should create work note with multiple person associations', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          'P-001',
          'Person 1'
        ),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          'P-002',
          'Person 2'
        ),
      ]);

      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
        persons: [
          { personId: 'P-001', role: 'OWNER' },
          { personId: 'P-002', role: 'PARTICIPANT' },
        ],
      };

      const result = await repository.create(input);

      const details = await repository.findByIdWithDetails(result.workId);
      expect(details?.persons.length).toBe(2);
    });

    it('should create work note with related work notes', async () => {
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

      const result = await repository.create(input);

      const details = await repository.findByIdWithDetails(result.workId);
      expect(details?.relatedWorkNotes.length).toBe(1);
      expect(details?.relatedWorkNotes[0].relatedWorkId).toBe(relatedWorkId);
    });

    it('should create work note with related meeting references', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'MEET-REL-001',
          '2026-02-11',
          '주간 동기화',
          '회의 내용 1',
          JSON.stringify(['동기화']),
          '동기화',
          '2026-02-11T09:00:00.000Z',
          '2026-02-11T09:00:00.000Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'MEET-REL-002',
          '2026-02-12',
          '이슈 점검',
          '회의 내용 2',
          JSON.stringify(['이슈']),
          '이슈',
          '2026-02-12T09:00:00.000Z',
          '2026-02-12T09:00:00.000Z'
        ),
      ]);

      const input: CreateWorkNoteInput = {
        title: 'Meeting linked note',
        contentRaw: 'Content',
        relatedMeetingIds: ['MEET-REL-001', 'MEET-REL-002'],
      };

      const result = await repository.create(input);

      const rows = await testEnv.DB.prepare(
        `SELECT meeting_id as meetingId
           FROM work_note_meeting_minute
           WHERE work_id = ?
           ORDER BY meeting_id ASC`
      )
        .bind(result.workId)
        .all<{ meetingId: string }>();

      expect((rows.results || []).map((row) => row.meetingId)).toEqual([
        'MEET-REL-001',
        'MEET-REL-002',
      ]);
    });

    it('should create first version when creating work note', async () => {
      const input: CreateWorkNoteInput = {
        title: 'New Note',
        contentRaw: 'Content',
      };

      const result = await repository.create(input);

      const versions = await repository.getVersions(result.workId);
      expect(versions.length).toBe(1);
      expect(versions[0].versionNo).toBe(1);
      expect(versions[0].title).toBe('New Note');
    });

    it('should generate unique work IDs', async () => {
      const input: CreateWorkNoteInput = {
        title: 'Test',
        contentRaw: 'Content',
      };

      const result1 = await repository.create(input);
      const result2 = await repository.create(input);

      expect(result1.workId).not.toBe(result2.workId);
      expect(result1.workId).toMatch(/^WORK-/);
      expect(result2.workId).toMatch(/^WORK-/);
    });
  });

  describe('update()', () => {
    let existingWorkId: string;

    beforeEach(async () => {
      const input: CreateWorkNoteInput = {
        title: 'Original Title',
        contentRaw: 'Original Content',
        category: '업무',
      };
      const created = await repository.create(input);
      existingWorkId = created.workId;
    });

    it('should throw NotFoundError for non-existent work note', async () => {
      await expect(repository.update('WORK-NONEXISTENT', { title: 'New Title' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should update title only', async () => {
      const update: UpdateWorkNoteInput = {
        title: 'Updated Title',
      };

      const result = await repository.update(existingWorkId, update);

      expect(result.title).toBe('Updated Title');
      expect(result.contentRaw).toBe('Original Content');
      expect(result.category).toBe('업무');
    });

    it('should update content only', async () => {
      const update: UpdateWorkNoteInput = {
        contentRaw: 'Updated Content',
      };

      const result = await repository.update(existingWorkId, update);

      expect(result.title).toBe('Original Title');
      expect(result.contentRaw).toBe('Updated Content');
    });

    it('should update category', async () => {
      const update: UpdateWorkNoteInput = {
        category: '회의',
      };

      const result = await repository.update(existingWorkId, update);

      expect(result.category).toBe('회의');
    });

    it('should update multiple fields at once', async () => {
      const update: UpdateWorkNoteInput = {
        title: 'New Title',
        contentRaw: 'New Content',
        category: '보고',
      };

      const result = await repository.update(existingWorkId, update);

      expect(result.title).toBe('New Title');
      expect(result.contentRaw).toBe('New Content');
      expect(result.category).toBe('보고');
    });

    it('should create new version when updating', async () => {
      await repository.update(existingWorkId, { title: 'Updated Title' });

      const versions = await repository.getVersions(existingWorkId);
      expect(versions.length).toBe(2);
      expect(versions[0].versionNo).toBe(2);
      expect(versions[1].versionNo).toBe(1);
    });

    it('should update person associations', async () => {
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

      const update: UpdateWorkNoteInput = {
        persons: [{ personId, role: 'OWNER' }],
      };

      await repository.update(existingWorkId, update);

      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.persons.length).toBe(1);
      expect(details?.persons[0].personId).toBe(personId);
    });

    it('should replace existing person associations', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          'P-001',
          'Person 1'
        ),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          'P-002',
          'Person 2'
        ),
        testEnv.DB.prepare(
          'INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)'
        ).bind(existingWorkId, 'P-001', 'OWNER'),
      ]);

      const update: UpdateWorkNoteInput = {
        persons: [{ personId: 'P-002', role: 'PARTICIPANT' }],
      };

      await repository.update(existingWorkId, update);

      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.persons.length).toBe(1);
      expect(details?.persons[0].personId).toBe('P-002');
    });

    it('should update related work notes', async () => {
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

      await repository.update(existingWorkId, update);

      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.relatedWorkNotes.length).toBe(1);
      expect(details?.relatedWorkNotes[0].relatedWorkId).toBe(relatedWorkId);
    });

    it('should replace meeting links when relatedMeetingIds is provided', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'MEET-OLD-001',
          '2026-02-11',
          '기존 회의',
          '기존 내용',
          JSON.stringify(['기존']),
          '기존',
          '2026-02-11T09:00:00.000Z',
          '2026-02-11T09:00:00.000Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'MEET-NEW-001',
          '2026-02-12',
          '신규 회의',
          '신규 내용',
          JSON.stringify(['신규']),
          '신규',
          '2026-02-12T09:00:00.000Z',
          '2026-02-12T09:00:00.000Z'
        ),
        testEnv.DB.prepare(
          'INSERT INTO work_note_meeting_minute (work_id, meeting_id) VALUES (?, ?)'
        ).bind(existingWorkId, 'MEET-OLD-001'),
      ]);

      const update: UpdateWorkNoteInput = {
        relatedMeetingIds: ['MEET-NEW-001'],
      };

      await repository.update(existingWorkId, update);

      const rows = await testEnv.DB.prepare(
        `SELECT meeting_id as meetingId
           FROM work_note_meeting_minute
           WHERE work_id = ?
           ORDER BY meeting_id ASC`
      )
        .bind(existingWorkId)
        .all<{ meetingId: string }>();

      expect((rows.results || []).map((row) => row.meetingId)).toEqual(['MEET-NEW-001']);
    });

    it('should prune old versions after 5 versions', async () => {
      for (let i = 1; i <= 6; i++) {
        await repository.update(existingWorkId, { title: `Version ${i}` });
      }

      const versions = await repository.getVersions(existingWorkId);
      expect(versions.length).toBeLessThanOrEqual(5);
    });

    it('should update updatedAt timestamp', async () => {
      const forcedUpdatedAt = '2000-01-01T00:00:00.000Z';
      await testEnv.DB.prepare('UPDATE work_notes SET updated_at = ? WHERE work_id = ?')
        .bind(forcedUpdatedAt, existingWorkId)
        .run();

      await repository.update(existingWorkId, { title: 'New Title' });

      const updatedNote = await repository.findById(existingWorkId);
      expect(updatedNote?.updatedAt).not.toBe(forcedUpdatedAt);
    });

    it('should handle empty persons array', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          'P-001',
          'Person 1'
        ),
        testEnv.DB.prepare(
          'INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)'
        ).bind(existingWorkId, 'P-001', 'OWNER'),
      ]);

      const update: UpdateWorkNoteInput = {
        persons: [],
      };

      await repository.update(existingWorkId, update);

      const details = await repository.findByIdWithDetails(existingWorkId);
      expect(details?.persons.length).toBe(0);
    });
  });

  describe('delete()', () => {
    it('should delete existing work note', async () => {
      const input: CreateWorkNoteInput = {
        title: 'To Delete',
        contentRaw: 'Content',
      };
      const created = await repository.create(input);

      await repository.delete(created.workId);

      const found = await repository.findById(created.workId);
      expect(found).toBeNull();
    });

    it('should throw NotFoundError for non-existent work note', async () => {
      await expect(repository.delete('WORK-NONEXISTENT')).rejects.toThrow(NotFoundError);
    });

    it('should cascade delete person associations', async () => {
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

      const input: CreateWorkNoteInput = {
        title: 'To Delete',
        contentRaw: 'Content',
        persons: [{ personId, role: 'OWNER' }],
      };
      const created = await repository.create(input);

      await repository.delete(created.workId);

      const associations = await testEnv.DB.prepare(
        'SELECT * FROM work_note_person WHERE work_id = ?'
      )
        .bind(created.workId)
        .all();
      expect(associations.results.length).toBe(0);
    });
  });

  describe('updateEmbeddedAtIfUpdatedAtMatches()', () => {
    it('updates embedded_at only when updated_at matches expected timestamp', async () => {
      const created = await repository.create({
        title: 'Embedding target',
        contentRaw: 'content',
      });

      const updated = await repository.updateEmbeddedAtIfUpdatedAtMatches(
        created.workId,
        created.updatedAt
      );

      expect(updated).toBe(true);
      const found = await repository.findById(created.workId);
      expect(found?.embeddedAt).not.toBeNull();
    });

    it('does not update embedded_at when updated_at does not match', async () => {
      const created = await repository.create({
        title: 'Embedding mismatch target',
        contentRaw: 'content',
      });

      const updated = await repository.updateEmbeddedAtIfUpdatedAtMatches(
        created.workId,
        '1999-01-01T00:00:00.000Z'
      );

      expect(updated).toBe(false);
      const found = await repository.findById(created.workId);
      expect(found?.embeddedAt).toBeNull();
    });
  });

  // --- Read operations ---

  describe('findById()', () => {
    it('should find work note by ID', async () => {
      const workId = 'WORK-TEST-001';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(workId, 'Test Title', 'Test Content', '업무', now, now)
        .run();

      const result = await repository.findById(workId);

      expect(result).not.toBeNull();
      expect(result?.workId).toBe(workId);
      expect(result?.title).toBe('Test Title');
      expect(result?.contentRaw).toBe('Test Content');
      expect(result?.category).toBe('업무');
    });

    it('should return null for non-existent work note', async () => {
      const result = await repository.findById('WORK-NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should handle Korean text in title and content', async () => {
      const workId = 'WORK-TEST-002';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(workId, '한글 제목', '한글 내용입니다', '회의', now, now)
        .run();

      const result = await repository.findById(workId);

      expect(result?.title).toBe('한글 제목');
      expect(result?.contentRaw).toBe('한글 내용입니다');
    });
  });

  describe('findByIdWithDetails()', () => {
    it('should return null for non-existent work note', async () => {
      const result = await repository.findByIdWithDetails('WORK-NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should find work note with person associations', async () => {
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

      const result = await repository.findByIdWithDetails(workId);

      expect(result).not.toBeNull();
      expect(result?.persons).toBeDefined();
      expect(result?.persons.length).toBe(1);
      expect(result?.persons[0].personId).toBe(personId);
      expect(result?.persons[0].role).toBe('OWNER');
      expect(result?.persons[0].personName).toBe('홍길동');
    });

    it('should find work note with related work notes', async () => {
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

      const result = await repository.findByIdWithDetails(workId);

      expect(result).not.toBeNull();
      expect(result?.relatedWorkNotes).toBeDefined();
      expect(result?.relatedWorkNotes.length).toBe(1);
      expect(result?.relatedWorkNotes[0].relatedWorkId).toBe(relatedWorkId);
      expect(result?.relatedWorkNotes[0].relatedWorkTitle).toBe('Related Work');
    });

    it('should return empty arrays when no associations exist', async () => {
      const workId = 'WORK-TEST-006';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(workId, 'Test', 'Content', '업무', now, now)
        .run();

      const result = await repository.findByIdWithDetails(workId);

      expect(result?.persons).toEqual([]);
      expect(result?.relatedWorkNotes).toEqual([]);
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
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
      const result = await repository.findAll({});

      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by category', async () => {
      const result = await repository.findAll({ category: '업무' });

      expect(result.length).toBe(2);
      expect(result.every((note) => note.category === '업무')).toBe(true);
    });

    it('should filter by keyword in title', async () => {
      const result = await repository.findAll({ q: 'First' });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((note) => note.title.includes('First'))).toBe(true);
    });

    it('should filter by keyword in content', async () => {
      const result = await repository.findAll({ q: 'Content 2' });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((note) => note.contentRaw.includes('Content 2'))).toBe(true);
    });

    it('should filter by person ID', async () => {
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

      const result = await repository.findAll({ personId });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((note) => note.workId === 'WORK-001')).toBe(true);
    });

    it('should filter by department name', async () => {
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

      const result = await repository.findAll({ deptName });

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return results ordered by created_at DESC', async () => {
      const result = await repository.findAll({});

      expect(result.length).toBeGreaterThan(0);
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(result[i].createdAt).getTime()
        );
      }
    });

    it('should filter by date range (from)', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = await repository.findAll({ from: futureDate.toISOString() });

      expect(result.length).toBe(0);
    });

    it('should filter by date range (to)', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const result = await repository.findAll({ to: pastDate.toISOString() });

      expect(result.length).toBe(0);
    });
  });

  // --- Associations ---

  describe('getDeptNameForPerson()', () => {
    it('should return department name for person', async () => {
      const personId = '123456';
      const deptName = '개발팀';
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind(deptName),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)'
        ).bind(personId, '홍길동', deptName),
      ]);

      const result = await repository.getDeptNameForPerson(personId);

      expect(result).toBe(deptName);
    });

    it('should return null for person without department', async () => {
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

      const result = await repository.getDeptNameForPerson(personId);

      expect(result).toBeNull();
    });

    it('should return null for non-existent person', async () => {
      const result = await repository.getDeptNameForPerson('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('findTodosByWorkIds()', () => {
    it('should return empty map for empty work IDs array', async () => {
      const result = await repository.findTodosByWorkIds([]);

      expect(result.size).toBe(0);
    });

    it('should return todos grouped by work ID', async () => {
      const now = new Date().toISOString();
      const dueDate = '2025-12-01';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('WORK-001', 'Note 1', 'Content 1', now, now),
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('WORK-002', 'Note 2', 'Content 2', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, description, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-001', 'WORK-001', '할 일 1', '설명 1', '진행중', dueDate, now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, description, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-002', 'WORK-001', '할 일 2', null, '완료', null, now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, description, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-003', 'WORK-002', '할 일 3', '설명 3', '보류', dueDate, now, now),
      ]);

      const result = await repository.findTodosByWorkIds(['WORK-001', 'WORK-002']);

      expect(result.size).toBe(2);

      const work1Todos = result.get('WORK-001');
      expect(work1Todos).toBeDefined();
      expect(work1Todos?.length).toBe(2);
      expect(work1Todos?.[0].title).toBe('할 일 1');
      expect(work1Todos?.[0].description).toBe('설명 1');
      expect(work1Todos?.[0].status).toBe('진행중');
      expect(work1Todos?.[0].dueDate).toBe(dueDate);
      expect(work1Todos?.[1].title).toBe('할 일 2');
      expect(work1Todos?.[1].description).toBeNull();
      expect(work1Todos?.[1].status).toBe('완료');

      const work2Todos = result.get('WORK-002');
      expect(work2Todos).toBeDefined();
      expect(work2Todos?.length).toBe(1);
      expect(work2Todos?.[0].title).toBe('할 일 3');
    });

    it('should return empty map when no todos exist for work IDs', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
        .bind('WORK-001', 'Note 1', 'Content 1', now, now)
        .run();

      const result = await repository.findTodosByWorkIds(['WORK-001']);

      expect(result.size).toBe(0);
    });

    it('should order todos by due date ascending, then created_at', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('WORK-001', 'Note 1', 'Content 1', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-001', 'WORK-001', '나중 할 일', '진행중', '2025-12-31', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-002', 'WORK-001', '먼저 할 일', '진행중', '2025-12-01', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-003', 'WORK-001', '기한 없음', '진행중', null, now, now),
      ]);

      const result = await repository.findTodosByWorkIds(['WORK-001']);

      const todos = result.get('WORK-001');
      expect(todos?.length).toBe(3);
      expect(todos?.[0].title).toBe('먼저 할 일');
      expect(todos?.[1].title).toBe('나중 할 일');
      expect(todos?.[2].title).toBe('기한 없음');
    });
  });

  // --- Version management ---

  describe('getVersions()', () => {
    it('should throw NotFoundError for non-existent work note', async () => {
      await expect(repository.getVersions('WORK-NONEXISTENT')).rejects.toThrow(NotFoundError);
    });

    it('should return versions in descending order', async () => {
      const input: CreateWorkNoteInput = {
        title: 'Original',
        contentRaw: 'Content',
      };
      const created = await repository.create(input);
      await repository.update(created.workId, { title: 'Version 2' });
      await repository.update(created.workId, { title: 'Version 3' });

      const versions = await repository.getVersions(created.workId);

      expect(versions.length).toBe(3);
      expect(versions[0].versionNo).toBe(3);
      expect(versions[1].versionNo).toBe(2);
      expect(versions[2].versionNo).toBe(1);
    });

    it('should include all version fields', async () => {
      const input: CreateWorkNoteInput = {
        title: 'Test',
        contentRaw: 'Content',
        category: '업무',
      };
      const created = await repository.create(input);

      const versions = await repository.getVersions(created.workId);

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
