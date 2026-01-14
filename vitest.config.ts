import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import path from "path";

export default defineWorkersConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/worker/src"),
      "@worker": path.resolve(__dirname, "./apps/worker/src"),
      "@web": path.resolve(__dirname, "./apps/web/src"),
      "@shared": path.resolve(__dirname, "./packages/shared"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "apps/web/**"],
    poolOptions: {
      workers: {
        singleWorker: true,
        main: "./apps/worker/src/index.ts",
        miniflare: {
          // Miniflare options for local testing
          compatibilityDate: "2024-01-01",
          compatibilityFlags: [
            "nodejs_compat",
            "enable_nodejs_tty_module",
            "enable_nodejs_fs_module",
            "enable_nodejs_http_modules",
            "enable_nodejs_perf_hooks_module",
          ],
          d1Databases: { DB: "worknote-db" },
          d1Persist: false,
          bindings: {
            ENVIRONMENT: "production",
            GOOGLE_CLIENT_ID: "test-client-id",
            GOOGLE_CLIENT_SECRET: "test-client-secret",
            GOOGLE_REDIRECT_URI: "https://example.test/oauth/callback",
          },
        },
      },
    },
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        // Standard exclusions
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.config.ts",
        // Type-only definitions (no runtime code to test)
        "packages/shared/types/**",
        // Third-party UI components (shadcn/ui)
        "apps/web/src/components/ui/**",
        // CSS-only files
        "apps/web/src/styles/**",
        // Test utilities and setup files
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
    globals: true,
  },
});
