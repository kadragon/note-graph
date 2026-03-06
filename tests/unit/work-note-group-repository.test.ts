import { WorkNoteGroupRepository } from '@worker/repositories/work-note-group-repository';
import { ConflictError, NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import { pglite, testPgDb } from '../pg-setup';

describe('WorkNoteGroupRepository', () => {
  let repository: WorkNoteGroupRepository;

  beforeEach(async () => {
    repository = new WorkNoteGroupRepository(testPgDb);
    await pglite.query('DELETE FROM work_note_group_items');
    await pglite.query('DELETE FROM work_note_groups');
    await pglite.query('DELETE FROM work_notes');
  });

  describe('migration: tables exist', () => {
    it('should have work_note_groups table with expected columns', async () => {
      const result = await pglite.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'work_note_groups'`
      );
      const columns = result.rows.map((r: Record<string, unknown>) => r.column_name);

      expect(columns).toContain('group_id');
      expect(columns).toContain('name');
      expect(columns).toContain('is_active');
      expect(columns).toContain('created_at');
    });

    it('should have work_note_group_items junction table with expected columns', async () => {
      const result = await pglite.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'work_note_group_items'`
      );
      const columns = result.rows.map((r: Record<string, unknown>) => r.column_name);

      expect(columns).toContain('id');
      expect(columns).toContain('work_id');
      expect(columns).toContain('group_id');
    });

    it('should enforce unique name constraint on work_note_groups', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_note_groups (group_id, name, created_at) VALUES ($1, $2, $3)',
        ['g1', '그룹A', now]
      );

      await expect(
        pglite.query(
          'INSERT INTO work_note_groups (group_id, name, created_at) VALUES ($1, $2, $3)',
          ['g2', '그룹A', now]
        )
      ).rejects.toThrow();
    });

    it('should enforce unique (work_id, group_id) constraint on junction', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_note_groups (group_id, name, created_at) VALUES ($1, $2, $3)',
        ['g1', '그룹A', now]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );
      await pglite.query('INSERT INTO work_note_group_items (work_id, group_id) VALUES ($1, $2)', [
        'WORK-001',
        'g1',
      ]);

      await expect(
        pglite.query('INSERT INTO work_note_group_items (work_id, group_id) VALUES ($1, $2)', [
          'WORK-001',
          'g1',
        ])
      ).rejects.toThrow();
    });

    it('should cascade delete junction rows when group is deleted', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_note_groups (group_id, name, created_at) VALUES ($1, $2, $3)',
        ['g1', '그룹A', now]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );
      await pglite.query('INSERT INTO work_note_group_items (work_id, group_id) VALUES ($1, $2)', [
        'WORK-001',
        'g1',
      ]);

      await pglite.query('DELETE FROM work_note_groups WHERE group_id = $1', ['g1']);

      const remaining = await pglite.query(
        'SELECT * FROM work_note_group_items WHERE group_id = $1',
        ['g1']
      );
      expect(remaining.rows).toHaveLength(0);
    });

    it('should cascade delete junction rows when work note is deleted', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_note_groups (group_id, name, created_at) VALUES ($1, $2, $3)',
        ['g1', '그룹A', now]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );
      await pglite.query('INSERT INTO work_note_group_items (work_id, group_id) VALUES ($1, $2)', [
        'WORK-001',
        'g1',
      ]);

      await pglite.query('DELETE FROM work_notes WHERE work_id = $1', ['WORK-001']);

      const remaining = await pglite.query(
        'SELECT * FROM work_note_group_items WHERE work_id = $1',
        ['WORK-001']
      );
      expect(remaining.rows).toHaveLength(0);
    });
  });

  describe('findById()', () => {
    it('should return group by ID', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_note_groups (group_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['g1', '프로젝트A', true, now]
      );

      const result = await repository.findById('g1');

      expect(result).not.toBeNull();
      expect(result?.groupId).toBe('g1');
      expect(result?.name).toBe('프로젝트A');
      expect(result?.isActive).toBe(true);
      expect(new Date(result!.createdAt).toISOString()).toBe(now);
    });

    it('should return null for non-existent group', async () => {
      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create a new group and return it', async () => {
      const result = await repository.create({ name: '신규그룹' });

      expect(result.groupId).toMatch(/^GRP-/);
      expect(result.name).toBe('신규그룹');
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toBeDefined();

      const found = await repository.findById(result.groupId);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('신규그룹');
    });

    it('should throw ConflictError when name already exists', async () => {
      await repository.create({ name: '중복그룹' });

      await expect(repository.create({ name: '중복그룹' })).rejects.toThrow(ConflictError);
    });
  });

  describe('findByName()', () => {
    it('should return group by name', async () => {
      await repository.create({ name: '검색그룹' });

      const result = await repository.findByName('검색그룹');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('검색그룹');
      expect(result?.groupId).toMatch(/^GRP-/);
    });

    it('should return null for non-existent name', async () => {
      const result = await repository.findByName('없는그룹');

      expect(result).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return all groups ordered by name', async () => {
      await repository.create({ name: '다그룹' });
      await repository.create({ name: '가그룹' });
      await repository.create({ name: '나그룹' });

      const result = await repository.findAll();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('가그룹');
      expect(result[1].name).toBe('나그룹');
      expect(result[2].name).toBe('다그룹');
    });

    it('should return empty array when no groups exist', async () => {
      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should filter by search query', async () => {
      await repository.create({ name: '개발그룹' });
      await repository.create({ name: '기획그룹' });
      await repository.create({ name: '디자인팀' });

      const result = await repository.findAll('그룹');

      expect(result).toHaveLength(2);
      expect(result.every((g) => g.name.includes('그룹'))).toBe(true);
    });

    it('should filter inactive groups when activeOnly is true', async () => {
      await repository.create({ name: '활성그룹' });
      const inactive = await repository.create({ name: '비활성그룹' });
      // Deactivate directly via DB
      await pglite.query('UPDATE work_note_groups SET is_active = false WHERE group_id = $1', [
        inactive.groupId,
      ]);

      const result = await repository.findAll(undefined, 100, true);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('활성그룹');
    });
  });

  describe('update()', () => {
    it('should update group name', async () => {
      const created = await repository.create({ name: '원래이름' });

      const result = await repository.update(created.groupId, { name: '새이름' });

      expect(result.groupId).toBe(created.groupId);
      expect(result.name).toBe('새이름');
      expect(result.isActive).toBe(true);

      const found = await repository.findById(created.groupId);
      expect(found?.name).toBe('새이름');
    });

    it('should throw ConflictError when updating to duplicate name', async () => {
      await repository.create({ name: '기존그룹' });
      const target = await repository.create({ name: '변경대상' });

      await expect(repository.update(target.groupId, { name: '기존그룹' })).rejects.toThrow(
        ConflictError
      );
    });

    it('should throw NotFoundError for nonexistent group', async () => {
      await expect(repository.update('nonexistent', { name: '새이름' })).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('toggleActive()', () => {
    it('should flip is_active from true to false', async () => {
      const created = await repository.create({ name: '토글그룹' });
      expect(created.isActive).toBe(true);

      const result = await repository.toggleActive(created.groupId);

      expect(result.isActive).toBe(false);

      const found = await repository.findById(created.groupId);
      expect(found?.isActive).toBe(false);
    });

    it('should flip is_active from false to true', async () => {
      const created = await repository.create({ name: '토글그룹' });
      await repository.toggleActive(created.groupId);

      const result = await repository.toggleActive(created.groupId);

      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundError for nonexistent group', async () => {
      await expect(repository.toggleActive('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete()', () => {
    it('should delete group', async () => {
      const created = await repository.create({ name: '삭제그룹' });

      await repository.delete(created.groupId);

      const found = await repository.findById(created.groupId);
      expect(found).toBeNull();
    });

    it('should throw NotFoundError for nonexistent group', async () => {
      await expect(repository.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should cascade delete junction rows', async () => {
      const group = await repository.create({ name: '연결그룹' });
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );
      await pglite.query('INSERT INTO work_note_group_items (work_id, group_id) VALUES ($1, $2)', [
        'WORK-001',
        group.groupId,
      ]);

      await repository.delete(group.groupId);

      const remaining = await pglite.query(
        'SELECT * FROM work_note_group_items WHERE group_id = $1',
        [group.groupId]
      );
      expect(remaining.rows).toHaveLength(0);
    });
  });

  describe('addWorkNote()', () => {
    it('should create junction record', async () => {
      const group = await repository.create({ name: '연결그룹' });
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );

      await repository.addWorkNote(group.groupId, 'WORK-001');

      const rows = await pglite.query(
        'SELECT * FROM work_note_group_items WHERE group_id = $1 AND work_id = $2',
        [group.groupId, 'WORK-001']
      );
      expect(rows.rows).toHaveLength(1);
    });

    it('should be idempotent (no error on duplicate)', async () => {
      const group = await repository.create({ name: '연결그룹' });
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );

      await repository.addWorkNote(group.groupId, 'WORK-001');
      await repository.addWorkNote(group.groupId, 'WORK-001');

      const rows = await pglite.query(
        'SELECT * FROM work_note_group_items WHERE group_id = $1 AND work_id = $2',
        [group.groupId, 'WORK-001']
      );
      expect(rows.rows).toHaveLength(1);
    });
  });

  describe('removeWorkNote()', () => {
    it('should delete junction record', async () => {
      const group = await repository.create({ name: '연결그룹' });
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );
      await repository.addWorkNote(group.groupId, 'WORK-001');

      await repository.removeWorkNote(group.groupId, 'WORK-001');

      const rows = await pglite.query(
        'SELECT * FROM work_note_group_items WHERE group_id = $1 AND work_id = $2',
        [group.groupId, 'WORK-001']
      );
      expect(rows.rows).toHaveLength(0);
    });
  });

  describe('getWorkNotes()', () => {
    it('should return work notes for group', async () => {
      const group = await repository.create({ name: '조회그룹' });
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', '노트1', 'Content1', now, now]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-002', '노트2', 'Content2', now, now]
      );
      await repository.addWorkNote(group.groupId, 'WORK-001');
      await repository.addWorkNote(group.groupId, 'WORK-002');

      const result = await repository.getWorkNotes(group.groupId);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.workId).sort()).toEqual(['WORK-001', 'WORK-002']);
    });

    it('should return empty array when no work notes linked', async () => {
      const group = await repository.create({ name: '빈그룹' });

      const result = await repository.getWorkNotes(group.groupId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundError for nonexistent group', async () => {
      await expect(repository.getWorkNotes('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getByWorkNoteId()', () => {
    it('should return groups for a work note', async () => {
      const group1 = await repository.create({ name: '그룹A' });
      const group2 = await repository.create({ name: '그룹B' });
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Test', 'Content', now, now]
      );
      await repository.addWorkNote(group1.groupId, 'WORK-001');
      await repository.addWorkNote(group2.groupId, 'WORK-001');

      const result = await repository.getByWorkNoteId('WORK-001');

      expect(result).toHaveLength(2);
      expect(result.map((g) => g.name).sort()).toEqual(['그룹A', '그룹B']);
    });

    it('should return empty array when work note has no groups', async () => {
      const result = await repository.getByWorkNoteId('WORK-NONE');

      expect(result).toEqual([]);
    });
  });
});
