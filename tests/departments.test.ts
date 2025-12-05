// Trace: SPEC-dept-1, TASK-020
// Department search and listing

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '@/types/env';

const testEnv = env as unknown as Env;

beforeEach(async () => {
  await testEnv.DB.prepare('DELETE FROM departments').run();
});

describe('Department search', () => {
  it('should return filtered departments by query', async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('INSERT INTO departments (dept_name, description) VALUES (?, ?)').bind(
        '교무기획부',
        'A'
      ),
      testEnv.DB.prepare('INSERT INTO departments (dept_name, description) VALUES (?, ?)').bind(
        '연구개발실',
        'B'
      ),
    ]);

    const response = await SELF.fetch('http://localhost/api/departments?q=기획', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'test@example.com' },
    });

    expect(response.status).toBe(200);
    const data = await response.json<Array<{ deptName: string }>>();
    expect(data).toHaveLength(1);
    expect(data[0].deptName).toBe('교무기획부');
  });

  it('should return all departments when no query provided', async () => {
    await testEnv.DB.prepare('INSERT INTO departments (dept_name, description) VALUES (?, ?)')
      .bind('행정지원실', 'C')
      .run();

    const response = await SELF.fetch('http://localhost/api/departments', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'test@example.com' },
    });

    expect(response.status).toBe(200);
    const data = await response.json<Array<{ deptName: string }>>();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});
