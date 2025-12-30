// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-001
// Trace: spec_id=SPEC-devx-3 task_id=TASK-0070
import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load tsconfig to get path mappings
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, './tsconfig.base.json'), 'utf-8'));

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  injectGlobals: true,

  // Path aliases matching tsconfig paths
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    ...pathsToModuleNameMapper(tsconfig.compilerOptions?.paths || {}, {
      prefix: '<rootDir>/',
    }),
    // Add @worker alias that exists in runtime but not in tsconfig
    '^@worker/(.*)$': '<rootDir>/apps/worker/src/$1',
    // Add test helpers alias
    '^@test-helpers/(.*)$': '<rootDir>/tests/jest/helpers/$1',
  },

  // Setup file for Miniflare initialization and D1 migrations
  setupFiles: ['<rootDir>/tests/jest-preload.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.ts'],

  // Test file patterns (initially empty, will be populated during migration)
  testMatch: [
    '<rootDir>/tests/jest/**/*.test.ts',
  ],

  // Coverage configuration
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
        useESM: true,
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          moduleResolution: 'node',
          module: 'esnext',
          target: 'ES2022',
          lib: ['ES2022'],
          baseUrl: '.',
          types: ['node', '@cloudflare/workers-types', 'jest'],
          paths: {
            '@/*': ['./apps/worker/src/*'],
            '@worker/*': ['./apps/worker/src/*'],
            '@web/*': ['./apps/web/src/*'],
            '@shared/*': ['./packages/shared/*'],
            '@test-helpers/*': ['./tests/jest/helpers/*'],
          },
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

  // Handle ESM modules like nanoid
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid)/)',
  ],
};

export default config;
