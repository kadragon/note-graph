// Trace: Test coverage improvement
// Unit tests for WorkNoteRepository - CRUD operations (create, update, delete)

import { env } from 'cloudflare:test';
import { WorkNoteRepository } from '@worker/repositories/work-note-repository';
import type { CreateWorkNoteInput, UpdateWorkNoteInput } from '@worker/schemas/work-note';
import type { Env } from '@worker/types/env';
import { NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('WorkNoteRepository - CRUD operations', () => {
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
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

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

    it('should create work note with related meeting references', async () => {
      // Arrange
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

      // Act
      const result = await repository.create(input);

      // Assert
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
      await expect(repository.update('WORK-NONEXISTENT', { title: 'New Title' })).rejects.toThrow(
        NotFoundError
      );
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
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

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

    it('should replace meeting links when relatedMeetingIds is provided', async () => {
      // Arrange
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

      // Act
      await repository.update(existingWorkId, update);

      // Assert
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
      const forcedUpdatedAt = '2000-01-01T00:00:00.000Z';
      await testEnv.DB.prepare('UPDATE work_notes SET updated_at = ? WHERE work_id = ?')
        .bind(forcedUpdatedAt, existingWorkId)
        .run();

      // Act
      await repository.update(existingWorkId, { title: 'New Title' });

      // Assert
      const updatedNote = await repository.findById(existingWorkId);
      expect(updatedNote?.updatedAt).not.toBe(forcedUpdatedAt);
    });

    it('should handle empty persons array', async () => {
      // Arrange
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
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

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
});
