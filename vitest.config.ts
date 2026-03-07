import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Unit test files that require PGlite (import from pg-setup or pg-test-utils).
 * All other unit tests run without DB setup for faster execution.
 */
const dbUnitTests = [
  "tests/unit/department-repository.test.ts",
  "tests/unit/embedding-processor.batch.test.ts",
  "tests/unit/embedding-retry-queue-repository.test.ts",
  "tests/unit/meeting-minute-reference-service.test.ts",
  "tests/unit/meeting-minute-repository.test.ts",
  "tests/unit/migrate-r2-to-gdrive.test.ts",
  "tests/unit/migration-meeting-minutes.test.ts",
  "tests/unit/pdf-job-repository.test.ts",
  "tests/unit/person-repository.test.ts",
  "tests/unit/setting-repository.test.ts",
  "tests/unit/setting-service.test.ts",
  "tests/unit/statistics-repository.test.ts",
  "tests/unit/task-category-repository.test.ts",
  "tests/unit/todo-repository-ai-context.test.ts",
  "tests/unit/todo-repository-crud.test.ts",
  "tests/unit/todo-repository-filtering.test.ts",
  "tests/unit/todo-repository-query.test.ts",
  "tests/unit/todo-repository-recurrence.test.ts",
  "tests/unit/work-note-file-service.test.ts",
  "tests/unit/work-note-group-repository.test.ts",
  "tests/unit/work-note-repository.test.ts",
];

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/worker/src"),
      "@worker": path.resolve(__dirname, "./apps/worker/src"),
      "@web": path.resolve(__dirname, "./apps/web/src"),
      "@shared": path.resolve(__dirname, "./packages/shared"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "worker-db",
          include: ["tests/integration/**/*.test.ts", ...dbUnitTests],
          exclude: ["tests/integration/supabase-*.test.ts"],
          setupFiles: ["./tests/pg-setup.ts"],
          pool: "forks",
          poolOptions: {
            forks: { maxForks: 4 },
          },
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: "worker-pure",
          include: ["tests/unit/**/*.test.ts", "tests/search.test.ts"],
          exclude: [...dbUnitTests, "tests/integration/supabase-*.test.ts"],
          globals: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.config.ts",
        "packages/shared/types/**",
        "apps/web/src/components/ui/**",
        "apps/web/src/styles/**",
        "tests/",
        "apps/web/src/test/**",
      ],
      thresholds: {
        statements: 71,
        branches: 58,
        functions: 58,
        lines: 71,
      },
    },
  },
});
