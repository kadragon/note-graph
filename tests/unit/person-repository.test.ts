// Trace: SPEC-person-1, SPEC-person-3, TASK-027
// Unit tests for PersonRepository

import { PersonRepository } from '@worker/repositories/person-repository';
import type { CreatePersonInput, UpdatePersonInput } from '@worker/schemas/person';
import type { DatabaseClient } from '@worker/types/database';
import { ConflictError, NotFoundError, ValidationError } from '@worker/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { pglite, testPgDb } from '../pg-setup';

const createMockDb = (overrides: Partial<DatabaseClient> = {}): DatabaseClient => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  queryOne: vi.fn().mockResolvedValue(null),
  execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
  transaction: vi.fn(),
  executeBatch: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('PersonRepository', () => {
  let repository: PersonRepository;

  beforeEach(async () => {
    repository = new PersonRepository(testPgDb);

    await pgCleanupAll(pglite);
  });

  describe('findById()', () => {
    it('should find person by ID', async () => {
      // Arrange
      const personId = '123456';
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [personId, '홍길동', now, now]
      );

      // Act
      const result = await repository.findById(personId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.personId).toBe(personId);
      expect(result?.name).toBe('홍길동');
    });

    it('should return null for non-existent person', async () => {
      // Act
      const result = await repository.findById('NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });

    it('should include all person fields', async () => {
      // Arrange
      const personId = '123456';
      const now = new Date().toISOString();
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);
      await pglite.query(
        'INSERT INTO persons (person_id, name, current_dept, current_position, current_role_desc, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [personId, '홍길동', '개발팀', '선임', '백엔드 개발', now, now]
      );

      // Act
      const result = await repository.findById(personId);

      // Assert
      expect(result?.currentDept).toBe('개발팀');
      expect(result?.currentPosition).toBe('선임');
      expect(result?.currentRoleDesc).toBe('백엔드 개발');
      expect(result?.createdAt).toBeDefined();
      expect(result?.updatedAt).toBeDefined();
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
      const now = new Date().toISOString();
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['기획팀']);
      await pglite.query(
        'INSERT INTO persons (person_id, name, current_dept, current_position, phone_ext, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['100010', '강나', '개발팀', '사원', '2222', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, current_dept, current_position, phone_ext, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['100001', '김가', '개발팀', '과장', '1234', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, current_dept, current_position, phone_ext, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['100002', '김가', '개발팀', '부장', '5678', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, current_dept, current_position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        ['100003', '박나', '기획팀', '대리', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['100004', '최다', now, now]
      );
    });

    it('should return all persons when no search query', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should order results by dept → name → position → personId → phoneExt → createdAt', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(5);

      // 1) Dept asc, 2) Name asc, 3) Position asc, 4) personId asc
      expect(result[0]).toMatchObject({
        personId: '100010',
        name: '강나',
        currentDept: '개발팀',
        currentPosition: '사원',
      });
      expect(result[1]).toMatchObject({
        personId: '100001',
        name: '김가',
        currentDept: '개발팀',
        currentPosition: '과장',
      });
      expect(result[2]).toMatchObject({
        personId: '100002',
        name: '김가',
        currentDept: '개발팀',
        currentPosition: '부장',
      });
      expect(result[3]).toMatchObject({ personId: '100003', name: '박나', currentDept: '기획팀' });
      expect(result[4]).toMatchObject({ personId: '100004', name: '최다', currentDept: null });
    });

    it('should search by name', async () => {
      // Act
      const result = await repository.findAll('김가');

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((p) => p.name.includes('김가'))).toBe(true);
    });

    it('should search by person ID', async () => {
      // Act
      const result = await repository.findAll('100001');

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((p) => p.personId.includes('100001'))).toBe(true);
    });

    it('should handle partial name search', async () => {
      // Act
      const result = await repository.findAll('가');

      // Assert
      expect(result.some((p) => p.name.includes('가'))).toBe(true);
    });
  });

  describe('findByIds()', () => {
    it('should return persons in input ID order and ignore missing IDs', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['100001', '김가', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['100002', '박나', now, now]
      );

      const result = await repository.findByIds(['100002', 'MISSING', '100001']);

      expect(result.map((person) => person.personId)).toEqual(['100002', '100001']);
    });
  });

  describe('create()', () => {
    it('should create person with minimal fields', async () => {
      // Arrange
      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.personId).toBe('123456');
      expect(result.name).toBe('홍길동');
      expect(result.currentDept).toBeNull();
      expect(result.currentPosition).toBeNull();
      expect(result.currentRoleDesc).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      // Verify in DB
      const found = await repository.findById('123456');
      expect(found).not.toBeNull();
    });

    it('should throw ConflictError when person already exists', async () => {
      // Arrange
      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
      };
      await repository.create(input);

      // Act & Assert
      await expect(repository.create(input)).rejects.toThrow(ConflictError);
      await expect(repository.create(input)).rejects.toThrow('Person already exists');
    });

    it('should create person with department', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);

      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
        currentDept: '개발팀',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.currentDept).toBe('개발팀');
    });

    it('should throw ValidationError for non-existent department', async () => {
      // Arrange
      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
        currentDept: '비존재부서',
      };

      // Act & Assert
      await expect(repository.create(input)).rejects.toThrow(ValidationError);
      await expect(repository.create(input)).rejects.toThrow('존재하지 않는 부서');
    });

    it('should create person with full details', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);

      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
        currentDept: '개발팀',
        currentPosition: '선임',
        currentRoleDesc: '백엔드 개발',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.currentDept).toBe('개발팀');
      expect(result.currentPosition).toBe('선임');
      expect(result.currentRoleDesc).toBe('백엔드 개발');
    });

    it('should create person with phone extension', async () => {
      // Arrange
      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
        phoneExt: '3346',
      };

      // Act
      const result = await repository.create(input);

      // Assert
      expect(result.phoneExt).toBe('3346');

      // Verify in DB
      const found = await repository.findById('123456');
      expect(found?.phoneExt).toBe('3346');
    });

    it('should create department history entry when department is provided', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);

      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
        currentDept: '개발팀',
        currentPosition: '선임',
      };

      // Act
      await repository.create(input);

      // Assert
      const history = await repository.getDepartmentHistory('123456');
      expect(history.length).toBe(1);
      expect(history[0].deptName).toBe('개발팀');
      expect(history[0].position).toBe('선임');
      expect(history[0].isActive).toBe(true);
    });

    it('should not create department history when no department provided', async () => {
      // Arrange
      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
      };

      // Act
      await repository.create(input);

      // Assert
      const history = await repository.getDepartmentHistory('123456');
      expect(history.length).toBe(0);
    });

    it('should auto-create department when importing person', async () => {
      // Arrange
      const importRepository = new PersonRepository(testPgDb, {
        autoCreateDepartment: true,
      });
      const deptName = '신규부서';

      // Act
      const result = await importRepository.create({
        personId: '999001',
        name: '김신규',
        currentDept: deptName,
      });

      // Assert
      expect(result.currentDept).toBe(deptName);

      const deptResult = await pglite.query(
        'SELECT dept_name AS "deptName", is_active AS "isActive" FROM departments WHERE dept_name = $1',
        [deptName]
      );
      const department = deptResult.rows[0] as { deptName: string; isActive: boolean } | undefined;
      expect(department).not.toBeUndefined();
      expect(department?.deptName).toBe(deptName);
      expect(department?.isActive).toBe(true);
    });

    it('should write PostgreSQL-safe boolean literals when auto-creating department data', async () => {
      // Arrange
      const executeBatch = vi.fn().mockResolvedValue(undefined);
      const mockDb = createMockDb({ executeBatch });
      const importRepository = new PersonRepository(mockDb, {
        autoCreateDepartment: true,
      });

      // Act
      await importRepository.create({
        personId: '999001',
        name: '김신규',
        currentDept: '신규부서',
      });

      // Assert
      expect(executeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            sql: expect.stringContaining('VALUES ($1, NULL, TRUE, $2)'),
          }),
          expect.objectContaining({
            sql: expect.stringContaining('VALUES ($1, $2, $3, $4, $5, TRUE)'),
          }),
        ])
      );
    });
  });

  describe('update()', () => {
    let existingPersonId: string;

    beforeEach(async () => {
      existingPersonId = '123456';
      const input: CreatePersonInput = {
        personId: existingPersonId,
        name: '홍길동',
      };
      await repository.create(input);
    });

    it('should throw NotFoundError for non-existent person', async () => {
      // Act & Assert
      await expect(repository.update('NONEXISTENT', { name: 'New Name' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should update name', async () => {
      // Arrange
      const update: UpdatePersonInput = {
        name: '홍길순',
      };

      // Act
      const result = await repository.update(existingPersonId, update);

      // Assert
      expect(result.name).toBe('홍길순');
    });

    it('should update department', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);

      const update: UpdatePersonInput = {
        currentDept: '개발팀',
      };

      // Act
      const result = await repository.update(existingPersonId, update);

      // Assert
      expect(result.currentDept).toBe('개발팀');
    });

    it('should update position and role description', async () => {
      // Arrange
      const update: UpdatePersonInput = {
        currentPosition: '책임',
        currentRoleDesc: '프론트엔드 개발',
      };

      // Act
      const result = await repository.update(existingPersonId, update);

      // Assert
      expect(result.currentPosition).toBe('책임');
      expect(result.currentRoleDesc).toBe('프론트엔드 개발');
    });

    it('should update phone extension', async () => {
      // Arrange
      const update: UpdatePersonInput = {
        phoneExt: '1234',
      };

      // Act
      const result = await repository.update(existingPersonId, update);

      // Assert
      expect(result.phoneExt).toBe('1234');

      // Verify in DB
      const found = await repository.findById(existingPersonId);
      expect(found?.phoneExt).toBe('1234');
    });

    it('should create new department history entry when department changes', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['기획팀']);

      // First, set a department
      await repository.update(existingPersonId, { currentDept: '개발팀' });

      // Act - Change department
      await repository.update(existingPersonId, { currentDept: '기획팀' });

      // Assert
      const history = await repository.getDepartmentHistory(existingPersonId);
      expect(history.length).toBe(2);
      expect(history[0].deptName).toBe('기획팀');
      expect(history[0].isActive).toBe(true);
      expect(history[1].deptName).toBe('개발팀');
      expect(history[1].isActive).toBe(false);
      expect(history[1].endDate).toBeDefined();
    });

    it('should deactivate previous department history when changing department', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['디자인팀']);

      await repository.update(existingPersonId, { currentDept: '개발팀' });

      // Act
      await repository.update(existingPersonId, { currentDept: '디자인팀' });

      // Assert
      const history = await repository.getDepartmentHistory(existingPersonId);
      const oldHistory = history.find((h) => h.deptName === '개발팀');
      expect(oldHistory?.isActive).toBe(false);
      expect(oldHistory?.endDate).toBeDefined();
    });

    it('should write PostgreSQL-safe FALSE literal when deactivating department history', async () => {
      // Arrange
      const executeBatch = vi.fn().mockResolvedValue(undefined);
      const queryOne = vi
        .fn()
        .mockResolvedValueOnce({
          personId: '123456',
          name: '홍길동',
          phoneExt: null,
          currentDept: '개발팀',
          currentPosition: '선임',
          currentRoleDesc: null,
          employmentStatus: '재직',
          createdAt: '2026-03-06T00:00:00.000Z',
          updatedAt: '2026-03-06T00:00:00.000Z',
        })
        .mockResolvedValueOnce(null);
      const mockDb = createMockDb({ executeBatch, queryOne });
      const importRepository = new PersonRepository(mockDb, {
        autoCreateDepartment: true,
      });

      // Act
      await importRepository.update('123456', { currentDept: '기획팀' });

      // Assert
      expect(executeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            sql: expect.stringContaining('VALUES ($1, NULL, TRUE, $2)'),
          }),
          expect.objectContaining({
            sql: expect.stringContaining('SET is_active = FALSE, end_date = $1'),
          }),
          expect.objectContaining({
            sql: expect.stringContaining('VALUES ($1, $2, $3, $4, $5, TRUE)'),
          }),
        ])
      );
    });

    it('should throw ValidationError when changing to non-existent department', async () => {
      // Act & Assert
      await expect(
        repository.update(existingPersonId, { currentDept: '비존재부서' })
      ).rejects.toThrow(ValidationError);
    });

    it('should not create history entry when department is not changing', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);
      await repository.update(existingPersonId, { currentDept: '개발팀' });

      // Act - Update name but not department
      await repository.update(existingPersonId, { name: '새이름' });

      // Assert
      const history = await repository.getDepartmentHistory(existingPersonId);
      expect(history.length).toBe(1); // Still only one entry
    });

    it('should update updatedAt timestamp', async () => {
      // Arrange
      const forcedUpdatedAt = '2000-01-01T00:00:00.000Z';
      await pglite.query('UPDATE persons SET updated_at = $1 WHERE person_id = $2', [
        forcedUpdatedAt,
        existingPersonId,
      ]);

      // Act
      await repository.update(existingPersonId, { name: 'New Name' });

      // Assert
      const updated = await repository.findById(existingPersonId);
      expect(updated?.updatedAt).not.toBe(forcedUpdatedAt);
    });
  });

  describe('getDepartmentHistory()', () => {
    it('should throw NotFoundError for non-existent person', async () => {
      // Act & Assert
      await expect(repository.getDepartmentHistory('NONEXISTENT')).rejects.toThrow(NotFoundError);
    });

    it('should return empty array for person with no department history', async () => {
      // Arrange
      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
      };
      await repository.create(input);

      // Act
      const result = await repository.getDepartmentHistory('123456');

      // Assert
      expect(result).toEqual([]);
    });

    it('should return department history in descending order by start date', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['기획팀']);
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['디자인팀']);

      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
        currentDept: '개발팀',
      };
      await repository.create(input);
      await repository.update('123456', { currentDept: '기획팀' });
      await repository.update('123456', { currentDept: '디자인팀' });

      // Act
      const result = await repository.getDepartmentHistory('123456');

      // Assert
      expect(result.length).toBe(3);
      expect(result[0].deptName).toBe('디자인팀'); // Most recent
      expect(result[1].deptName).toBe('기획팀');
      expect(result[2].deptName).toBe('개발팀'); // Oldest
    });

    it('should include all history fields', async () => {
      // Arrange
      await pglite.query('INSERT INTO departments (dept_name) VALUES ($1)', ['개발팀']);

      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
        currentDept: '개발팀',
        currentPosition: '선임',
        currentRoleDesc: '백엔드 개발',
      };
      await repository.create(input);

      // Act
      const result = await repository.getDepartmentHistory('123456');

      // Assert
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('personId');
      expect(result[0]).toHaveProperty('deptName');
      expect(result[0]).toHaveProperty('position');
      expect(result[0]).toHaveProperty('roleDesc');
      expect(result[0]).toHaveProperty('startDate');
      expect(result[0]).toHaveProperty('isActive');
    });
  });

  describe('getWorkNotes()', () => {
    it('should throw NotFoundError for non-existent person', async () => {
      // Act & Assert
      await expect(repository.getWorkNotes('NONEXISTENT')).rejects.toThrow(NotFoundError);
    });

    it('should return empty array for person with no work notes', async () => {
      // Arrange
      const input: CreatePersonInput = {
        personId: '123456',
        name: '홍길동',
      };
      await repository.create(input);

      // Act
      const result = await repository.getWorkNotes('123456');

      // Assert
      expect(result).toEqual([]);
    });

    it('should return work notes for person', async () => {
      // Arrange
      const personId = '123456';
      const workId = 'WORK-001';
      const now = new Date().toISOString();

      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [personId, '홍길동', now, now]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [workId, 'Test Work', 'Content', '업무', now, now]
      );
      await pglite.query(
        'INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)',
        [workId, personId, 'OWNER']
      );

      // Act
      const result = await repository.getWorkNotes(personId);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].workId).toBe(workId);
      expect(result[0].title).toBe('Test Work');
      expect(result[0].category).toBe('업무');
      expect(result[0].role).toBe('OWNER');
    });

    it('should order work notes by created_at DESC', async () => {
      // Arrange
      const personId = '123456';
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000);

      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [personId, '홍길동', now.toISOString(), now.toISOString()]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-001', 'Earlier Work', 'Content', earlier.toISOString(), earlier.toISOString()]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-002', 'Later Work', 'Content', now.toISOString(), now.toISOString()]
      );
      await pglite.query(
        'INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)',
        ['WORK-001', personId, 'OWNER']
      );
      await pglite.query(
        'INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)',
        ['WORK-002', personId, 'PARTICIPANT']
      );

      // Act
      const result = await repository.getWorkNotes(personId);

      // Assert
      expect(result[0].title).toBe('Later Work');
      expect(result[1].title).toBe('Earlier Work');
    });
  });
});
