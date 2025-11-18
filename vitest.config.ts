import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        singleWorker: true,
        main: "./src/index.ts",
        miniflare: {
          // Miniflare options for local testing
          compatibilityDate: "2024-01-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "worknote-db" },
          d1Persist: false,
          bindings: {
            ENVIRONMENT: "development",
          },
        },
      },
    },
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.config.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    globals: true,
  },
});
