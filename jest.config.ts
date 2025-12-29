// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-001
import type { Config } from 'jest';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Path aliases matching vitest.config.ts
  moduleNameMapper: {
    '^@/(.*)$': resolve(__dirname, './apps/worker/src/$1'),
    '^@worker/(.*)$': resolve(__dirname, './apps/worker/src/$1'),
    '^@web/(.*)$': resolve(__dirname, './apps/web/src/$1'),
    '^@shared/(.*)$': resolve(__dirname, './packages/shared/$1'),
  },

  // Setup file for Miniflare initialization and D1 migrations
  setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.ts'],

  // Test file patterns (initially empty, will be populated during migration)
  testMatch: [
    '<rootDir>/tests/jest/**/*.test.ts',
  ],

  // Coverage configuration matching vitest
  collectCoverageFrom: [
    'apps/worker/src/**/*.ts',
    'packages/shared/**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/*.config.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },

  // TypeScript transformation
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          moduleResolution: 'node',
          target: 'ES2022',
          lib: ['ES2022'],
        },
      },
    ],
  },

  // Improved output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

export default config;
