// Trace: SPEC-person-1, TASK-018
// Person creation validation and department existence checks

import { env, SELF } from 'cloudflare:test';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

beforeEach(async () => {
  // Clean related tables to ensure isolation per test
  await testEnv.DB.batch([
    testEnv.DB.prepare('DELETE FROM person_dept_history'),
    testEnv.DB.prepare('DELETE FROM persons'),
    testEnv.DB.prepare('DELETE FROM departments'),
  ]);
});

describe('Person creation validation', () => {
  it('should return validation error when department does not exist', async () => {
    const response = await SELF.fetch('http://localhost/api/persons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'test@example.com',
      },
      body: JSON.stringify({
        personId: '123456',
        name: '홍길동',
        currentDept: '비존재부서',
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json<{ code: string; message: string }>();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.message).toContain('부서');
  });

  it('should create person when department exists', async () => {
    await testEnv.DB.prepare('INSERT INTO departments (dept_name, description) VALUES (?, ?)')
      .bind('교무기획부', '테스트 부서')
      .run();

    const response = await SELF.fetch('http://localhost/api/persons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'test@example.com',
      },
      body: JSON.stringify({
        personId: '123457',
        name: '이순신',
        currentDept: '교무기획부',
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json<{
      personId: string;
      name: string;
      currentDept: string | null;
    }>();
    expect(data.personId).toBe('123457');
    expect(data.name).toBe('이순신');
    expect(data.currentDept).toBe('교무기획부');
  });
});

describe('Person import with auto department creation', () => {
  it('should auto-create department when importing person with non-existent department', async () => {
    // Verify department does not exist
    const deptBefore = await testEnv.DB.prepare('SELECT * FROM departments WHERE dept_name = ?')
      .bind('신규부서')
      .first();
    expect(deptBefore).toBeNull();

    // Import person with non-existent department
    const response = await SELF.fetch('http://localhost/api/persons/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'test@example.com',
      },
      body: JSON.stringify({
        personId: '999001',
        name: '김신규',
        currentDept: '신규부서',
        currentPosition: '팀장',
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json<{
      person: { personId: string; name: string; currentDept: string };
      isNew: boolean;
    }>();
    expect(data.isNew).toBe(true);
    expect(data.person.personId).toBe('999001');
    expect(data.person.currentDept).toBe('신규부서');

    // Verify department was auto-created
    const deptAfter = await testEnv.DB.prepare('SELECT * FROM departments WHERE dept_name = ?')
      .bind('신규부서')
      .first<{ dept_name: string; is_active: number }>();
    expect(deptAfter).not.toBeNull();
    expect(deptAfter?.dept_name).toBe('신규부서');
    expect(deptAfter?.is_active).toBe(1);
  });

  it('should use existing department when importing person', async () => {
    // Create department first
    await testEnv.DB.prepare('INSERT INTO departments (dept_name, description) VALUES (?, ?)')
      .bind('기존부서', '이미 존재하는 부서')
      .run();

    const response = await SELF.fetch('http://localhost/api/persons/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'test@example.com',
      },
      body: JSON.stringify({
        personId: '999002',
        name: '박기존',
        currentDept: '기존부서',
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json<{
      person: { personId: string; currentDept: string };
      isNew: boolean;
    }>();
    expect(data.person.currentDept).toBe('기존부서');

    // Verify only one department exists (not duplicated)
    const deptCount = await testEnv.DB.prepare(
      'SELECT COUNT(*) as count FROM departments WHERE dept_name = ?'
    )
      .bind('기존부서')
      .first<{ count: number }>();
    expect(deptCount?.count).toBe(1);
  });

  it('should update existing person and auto-create new department on import', async () => {
    // Create initial department and person
    await testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)')
      .bind('이전부서')
      .run();
    await testEnv.DB.prepare('INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)')
      .bind('999003', '이동훈', '이전부서')
      .run();

    // Import with new department (update scenario)
    const response = await SELF.fetch('http://localhost/api/persons/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'test@example.com',
      },
      body: JSON.stringify({
        personId: '999003',
        name: '이동훈',
        currentDept: '새부서',
      }),
    });

    expect(response.status).toBe(200); // 200 for update

    const data = await response.json<{
      person: { personId: string; currentDept: string };
      isNew: boolean;
    }>();
    expect(data.isNew).toBe(false);
    expect(data.person.currentDept).toBe('새부서');

    // Verify new department was created
    const newDept = await testEnv.DB.prepare('SELECT * FROM departments WHERE dept_name = ?')
      .bind('새부서')
      .first();
    expect(newDept).not.toBeNull();
  });
});
