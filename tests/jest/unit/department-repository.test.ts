// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-002

import type { D1Database } from '@cloudflare/workers-types';
import { DepartmentRepository } from '@worker/repositories/department-repository';
import type { CreateDepartmentInput, UpdateDepartmentInput } from '@worker/schemas/department';
import { ConflictError, NotFoundError } from '@worker/types/errors';

// Global helper to get D1 database from Jest setup
declare global {
  function getDB(): Promise<D1Database>;
}

describe('DepartmentRepository', () => {
  let repository: DepartmentRepository;
  let db: D1Database;

  beforeEach(async () => {
    db = await getDB();
    repository = new DepartmentRepository(db);

    // Clean up test data
    await db.batch([
      db.prepare('DELETE FROM work_note_person'),
      db.prepare('DELETE FROM person_dept_history'),
      db.prepare('DELETE FROM work_notes'),
      db.prepare('DELETE FROM persons'),
      db.prepare('DELETE FROM departments'),
    ]);
  });

  describe('findByName()', () => {
    it('should find department by name', async () => {
      // Arrange
      const deptName = '개발팀';
      const now = new Date().toISOString();
      await db
        .prepare('INSERT INTO departments (dept_name, description, created_at) VALUES (?, ?, ?)')
        .bind(deptName, '개발 부서', now)
        .run();

      // Act
      const result = await repository.findByName(deptName);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.deptName).toBe(deptName);
      expect(result?.description).toBe('개발 부서');
    });

    it('should return null for non-existent department', async () => {
      // Act
      const result = await repository.findByName('비존재부서');

      // Assert
      expect(result).toBeNull();
    });

    it('should include created_at field', async () => {
      // Arrange
      const deptName = '기획팀';
      const now = new Date().toISOString();
      await db
        .prepare('INSERT INTO departments (dept_name, created_at) VALUES (?, ?)')
        .bind(deptName, now)
        .run();

      // Act
      const result = await repository.findByName(deptName);

      // Assert
      expect(result?.createdAt).toBeDefined();
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare('INSERT INTO departments (dept_name, description, created_at) VALUES (?, ?, ?)')
          .bind('개발팀', '개발 부서', now),
        db
          .prepare('INSERT INTO departments (dept_name, description, created_at) VALUES (?, ?, ?)')
          .bind('기획팀', '기획 부서', now),
        db
          .prepare('INSERT INTO departments (dept_name, created_at) VALUES (?, ?)')
          .bind('디자인팀', now),
      ]);
    });

    it('should return all departments when no search query', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should order departments by name ASC', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.length).toBeGreaterThan(0);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].deptName.localeCompare(result[i].deptName)).toBeLessThanOrEqual(0);
      }
    });

    it('should search departments by name', async () => {
      // Act
      const result = await repository.findAll('개발');

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((d) => d.deptName.includes('개발'))).toBe(true);
    });

    it('should handle partial name search', async () => {
      // Act
      const result = await repository.findAll('기획');

      // Assert
      expect(result.some((d) => d.deptName.includes('기획'))).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Act
      const result = await repository.findAll(undefined, 2);

      // Assert
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should use default limit of 100', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('create()', () => {
    it('should create department with minimal fields', async () => {
      // Arrange
      const input: CreateDepartmentInput = {
        deptName: '개발팀',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.deptName).toBe('개발팀');
      expect(result.description).toBeNull();
      expect(result.createdAt).toBeDefined();

      // Verify in DB
      const found = await repository.findByName('개발팀');
      expect(found).not.toBeNull();
    });

    it('should create department with description', async () => {
      // Arrange
      const input: CreateDepartmentInput = {
        deptName: '기획팀',
        description: '사업 기획 부서',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.deptName).toBe('기획팀');
      expect(result.description).toBe('사업 기획 부서');
    });

    it('should throw ConflictError when department already exists', async () => {
      // Arrange
      const input: CreateDepartmentInput = {
        deptName: '개발팀',
      };
      await repository.create(input);

      // Act & Assert
      await expect(repository.create(input)).rejects.toThrow(ConflictError);
      await expect(repository.create(input)).rejects.toThrow('Department already exists');
    });

    it('should handle Korean department names', async () => {
      // Arrange
      const input: CreateDepartmentInput = {
        deptName: '교무기획부',
        description: '교무 및 기획 담당',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.deptName).toBe('교무기획부');
      expect(result.description).toBe('교무 및 기획 담당');
    });
  });

  describe('update()', () => {
    let existingDeptName: string;

    beforeEach(async () => {
      existingDeptName = '개발팀';
      const input: CreateDepartmentInput = {
        deptName: existingDeptName,
        description: 'Original description',
      };
      await repository.create(input);
    });

    it('should throw NotFoundError for non-existent department', async () => {
      // Act & Assert
      await expect(repository.update('비존재부서', { description: 'New' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should update description', async () => {
      // Arrange
      const update: UpdateDepartmentInput = {
        description: 'Updated description',
      };

      // Act
      const result = await repository.update(existingDeptName, update);

      // Assert
      expect(result.description).toBe('Updated description');
    });

    it('should handle null description', async () => {
      // Arrange
      const update: UpdateDepartmentInput = {
        description: null,
      };

      // Act
      const result = await repository.update(existingDeptName, update);

      // Assert
      expect(result.description).toBeNull();
    });

    it('should preserve department name and created_at', async () => {
      // Arrange
      const original = await repository.findByName(existingDeptName);

      const update: UpdateDepartmentInput = {
        description: 'New description',
      };

      // Act
      const result = await repository.update(existingDeptName, update);

      // Assert
      expect(result.deptName).toBe(original?.deptName);
      expect(result.createdAt).toBe(original?.createdAt);
    });

    it('should handle Korean description', async () => {
      // Arrange
      const update: UpdateDepartmentInput = {
        description: '소프트웨어 개발 및 유지보수 담당',
      };

      // Act
      const result = await repository.update(existingDeptName, update);

      // Assert
      expect(result.description).toBe('소프트웨어 개발 및 유지보수 담당');
    });
  });

  describe('getMembers()', () => {
    let deptName: string;

    beforeEach(async () => {
      deptName = '개발팀';
      const now = new Date().toISOString();

      await db.batch([
        db
          .prepare('INSERT INTO departments (dept_name, created_at) VALUES (?, ?)')
          .bind(deptName, now),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind('123456', '홍길동', deptName, now, now),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind('234567', '이순신', deptName, now, now),
        db
          .prepare(
            'INSERT INTO person_dept_history (person_id, dept_name, position, role_desc, start_date, is_active) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind('123456', deptName, '선임', '백엔드 개발', now, 1),
        db
          .prepare(
            'INSERT INTO person_dept_history (person_id, dept_name, position, role_desc, start_date, is_active) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind('234567', deptName, '책임', '프론트엔드 개발', now, 1),
      ]);
    });

    it('should throw NotFoundError for non-existent department', async () => {
      // Act & Assert
      await expect(repository.getMembers('비존재부서')).rejects.toThrow(NotFoundError);
    });

    it('should return all members when onlyActive is false', async () => {
      // Act
      const result = await repository.getMembers(deptName, false);

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should include member details', async () => {
      // Act
      const result = await repository.getMembers(deptName);

      // Assert
      const member = result.find((m) => m.personId === '123456');
      expect(member).toBeDefined();
      expect(member?.name).toBe('홍길동');
      expect(member?.position).toBe('선임');
      expect(member?.roleDesc).toBe('백엔드 개발');
      // D1 returns is_active as 0 or 1 (number), not boolean
      expect((member?.isActive as unknown as number) === 1 || member?.isActive === true).toBe(true);
    });

    it('should return only active members when onlyActive is true', async () => {
      // Arrange - Make one member inactive
      const now = new Date().toISOString();
      await db
        .prepare('UPDATE person_dept_history SET is_active = 0, end_date = ? WHERE person_id = ?')
        .bind(now, '234567')
        .run();

      // Act
      const result = await repository.getMembers(deptName, true);

      // Assert
      // D1 returns is_active as 0 or 1 (number), not boolean
      expect(
        result.every((m) => (m.isActive as unknown as number) === 1 || m.isActive === true)
      ).toBe(true);
      expect(result.some((m) => m.personId === '234567')).toBe(false);
    });

    it('should order members by start_date DESC', async () => {
      // Act
      const result = await repository.getMembers(deptName);

      // Assert
      expect(result.length).toBeGreaterThan(0);
      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1].startDate).getTime();
        const curr = new Date(result[i].startDate).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should return empty array for department with no members', async () => {
      // Arrange
      const emptyDept = '빈부서';
      const now = new Date().toISOString();
      await db
        .prepare('INSERT INTO departments (dept_name, created_at) VALUES (?, ?)')
        .bind(emptyDept, now)
        .run();

      // Act
      const result = await repository.getMembers(emptyDept);

      // Assert
      expect(result).toEqual([]);
    });

    it('should include historical members when onlyActive is false', async () => {
      // Arrange - Add a historical member
      const now = new Date().toISOString();
      const earlier = new Date(Date.now() - 86400000).toISOString();

      await db.batch([
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('345678', '김유신', now, now),
        db
          .prepare(
            'INSERT INTO person_dept_history (person_id, dept_name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)'
          )
          .bind('345678', deptName, earlier, now, 0),
      ]);

      // Act
      const result = await repository.getMembers(deptName, false);

      // Assert
      expect(result.some((m) => m.personId === '345678')).toBe(true);
    });
  });

  describe('getWorkNotes()', () => {
    let deptName: string;
    let personId: string;
    let workId: string;

    beforeEach(async () => {
      deptName = '개발팀';
      personId = '123456';
      workId = 'WORK-001';
      const now = new Date().toISOString();

      await db.batch([
        db
          .prepare('INSERT INTO departments (dept_name, created_at) VALUES (?, ?)')
          .bind(deptName, now),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(personId, '홍길동', deptName, now, now),
        db
          .prepare(
            'INSERT INTO person_dept_history (person_id, dept_name, start_date, is_active) VALUES (?, ?, ?, ?)'
          )
          .bind(personId, deptName, now, 1),
        db
          .prepare(
            'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(workId, 'Test Work', 'Content', '업무', now, now),
        db
          .prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)')
          .bind(workId, personId, 'OWNER'),
      ]);
    });

    it('should throw NotFoundError for non-existent department', async () => {
      // Act & Assert
      await expect(repository.getWorkNotes('비존재부서')).rejects.toThrow(NotFoundError);
    });

    it('should return work notes associated with department members', async () => {
      // Act
      const result = await repository.getWorkNotes(deptName);

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].workId).toBe(workId);
      expect(result[0].title).toBe('Test Work');
      expect(result[0].category).toBe('업무');
    });

    it('should include owner information', async () => {
      // Act
      const result = await repository.getWorkNotes(deptName);

      // Assert
      const workNote = result.find((w) => w.workId === workId);
      expect(workNote?.ownerPersonId).toBe(personId);
      expect(workNote?.ownerPersonName).toBe('홍길동');
    });

    it('should order work notes by created_at DESC', async () => {
      // Arrange - Add another work note
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000);

      await db.batch([
        db
          .prepare(
            'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(
            'WORK-002',
            'Earlier Work',
            'Content',
            earlier.toISOString(),
            earlier.toISOString()
          ),
        db
          .prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)')
          .bind('WORK-002', personId, 'PARTICIPANT'),
      ]);

      // Act
      const result = await repository.getWorkNotes(deptName);

      // Assert
      expect(result[0].title).toBe('Test Work');
      expect(result[1].title).toBe('Earlier Work');
    });

    it('should return empty array for department with no work notes', async () => {
      // Arrange
      const emptyDept = '빈부서';
      const now = new Date().toISOString();
      await db
        .prepare('INSERT INTO departments (dept_name, created_at) VALUES (?, ?)')
        .bind(emptyDept, now)
        .run();

      // Act
      const result = await repository.getWorkNotes(emptyDept);

      // Assert
      expect(result).toEqual([]);
    });

    it('should include work notes from historical members', async () => {
      // Arrange - Create a work note from when person was in a different dept
      const oldWorkId = 'WORK-003';
      const now = new Date().toISOString();

      await db.batch([
        db
          .prepare(
            'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(oldWorkId, 'Old Work', 'Content', now, now),
        db
          .prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)')
          .bind(oldWorkId, personId, 'OWNER'),
      ]);

      // Act
      const result = await repository.getWorkNotes(deptName);

      // Assert
      expect(result.some((w) => w.workId === oldWorkId)).toBe(true);
    });

    it('should handle work notes with multiple participants from same department', async () => {
      // Arrange
      const person2Id = '234567';
      const now = new Date().toISOString();

      await db.batch([
        db
          .prepare(
            'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(person2Id, '이순신', deptName, now, now),
        db
          .prepare(
            'INSERT INTO person_dept_history (person_id, dept_name, start_date, is_active) VALUES (?, ?, ?, ?)'
          )
          .bind(person2Id, deptName, now, 1),
        db
          .prepare('INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)')
          .bind(workId, person2Id, 'PARTICIPANT'),
      ]);

      // Act
      const result = await repository.getWorkNotes(deptName);

      // Assert - Should not duplicate the work note
      const workNotes = result.filter((w) => w.workId === workId);
      expect(workNotes.length).toBe(1);
    });
  });
});
