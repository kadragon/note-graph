// Trace: SPEC-person-1, TASK-018
// Person creation validation and department existence checks

import { beforeEach, describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import type { Env } from '../src/types/env';

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
    const response = await SELF.fetch('http://localhost/persons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-Email': 'test@example.com',
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

    const response = await SELF.fetch('http://localhost/persons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-Email': 'test@example.com',
      },
      body: JSON.stringify({
        personId: '123457',
        name: '이순신',
        currentDept: '교무기획부',
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json<{ personId: string; name: string; currentDept: string | null }>();
    expect(data.personId).toBe('123457');
    expect(data.name).toBe('이순신');
    expect(data.currentDept).toBe('교무기획부');
  });
});

