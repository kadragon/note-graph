import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDepartment,
  createPerson,
  createProject,
  createProjectDetail,
  createSearchResult,
  createTaskCategory,
  createTodo,
  createWorkNote,
  createWorkNoteWithStats,
  resetFactoryCounter,
} from './factories';

describe('test factories', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  describe('createWorkNote', () => {
    it('creates a valid WorkNote with defaults', () => {
      const workNote = createWorkNote();

      expect(workNote.id).toMatch(/^work-\d+$/);
      expect(workNote.title).toBe('Test Work Note');
      expect(workNote.content).toBe('Test content');
      expect(workNote.category).toBe('일반');
      expect(workNote.createdAt).toBeDefined();
      expect(workNote.updatedAt).toBeDefined();
    });

    it('allows overriding properties', () => {
      const workNote = createWorkNote({ title: 'Custom Title', category: '보고' });

      expect(workNote.title).toBe('Custom Title');
      expect(workNote.category).toBe('보고');
    });
  });

  describe('createWorkNoteWithStats', () => {
    it('creates a WorkNote with todo stats', () => {
      const workNote = createWorkNoteWithStats();

      expect(workNote.todoStats).toEqual({
        total: 0,
        completed: 0,
        remaining: 0,
        pending: 0,
      });
      expect(workNote.latestTodoDate).toBeNull();
    });

    it('allows overriding todoStats', () => {
      const workNote = createWorkNoteWithStats({
        todoStats: { total: 5, completed: 3, remaining: 2, pending: 1 },
      });

      expect(workNote.todoStats.total).toBe(5);
      expect(workNote.todoStats.completed).toBe(3);
    });
  });

  describe('createTodo', () => {
    it('creates a valid Todo with defaults', () => {
      const todo = createTodo();

      expect(todo.id).toMatch(/^todo-\d+$/);
      expect(todo.title).toBe('Test Todo');
      expect(todo.status).toBe('진행중');
    });

    it('allows overriding status', () => {
      const todo = createTodo({ status: '완료' });

      expect(todo.status).toBe('완료');
    });
  });

  describe('createDepartment', () => {
    it('creates a valid Department', () => {
      const dept = createDepartment();

      expect(dept.deptName).toMatch(/^Department \d+$/);
      expect(dept.isActive).toBe(true);
      expect(dept.description).toBeNull();
    });

    it('allows overriding deptName', () => {
      const dept = createDepartment({ deptName: '교무기획부' });

      expect(dept.deptName).toBe('교무기획부');
    });
  });

  describe('createPerson', () => {
    it('creates a valid Person', () => {
      const person = createPerson();

      expect(person.personId).toMatch(/^\d{6}$/);
      expect(person.name).toMatch(/^Person \d+$/);
      expect(person.employmentStatus).toBe('재직');
    });

    it('allows overriding employmentStatus', () => {
      const person = createPerson({ employmentStatus: '퇴직' });

      expect(person.employmentStatus).toBe('퇴직');
    });
  });

  describe('createTaskCategory', () => {
    it('creates a valid TaskCategory', () => {
      const category = createTaskCategory();

      expect(category.categoryId).toMatch(/^cat-\d+$/);
      expect(category.isActive).toBe(true);
    });

    it('allows overriding name', () => {
      const category = createTaskCategory({ name: '회의' });

      expect(category.name).toBe('회의');
    });
  });

  describe('createProject', () => {
    it('creates a valid Project', () => {
      const project = createProject();

      expect(project.projectId).toMatch(/^PROJECT-\d+$/);
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe('진행중');
      expect(project.deletedAt).toBeNull();
    });

    it('allows overriding status', () => {
      const project = createProject({ status: '완료' });

      expect(project.status).toBe('완료');
    });
  });

  describe('createProjectDetail', () => {
    it('creates a ProjectDetail with empty arrays', () => {
      const project = createProjectDetail();

      expect(project.participants).toEqual([]);
      expect(project.workNotes).toEqual([]);
      expect(project.files).toEqual([]);
      expect(project.stats.projectId).toBe(project.projectId);
    });
  });

  describe('createSearchResult', () => {
    it('creates a valid SearchResult', () => {
      const result = createSearchResult();

      expect(result.id).toMatch(/^work-\d+$/);
      expect(result.score).toBe(0.95);
      expect(result.source).toBe('hybrid');
    });

    it('allows overriding source', () => {
      const result = createSearchResult({ source: 'lexical' });

      expect(result.source).toBe('lexical');
    });
  });

  describe('resetFactoryCounter', () => {
    it('resets the counter for unique IDs', () => {
      createWorkNote();
      createWorkNote();
      resetFactoryCounter();
      const workNote = createWorkNote();

      expect(workNote.id).toBe('work-1');
    });
  });
});
