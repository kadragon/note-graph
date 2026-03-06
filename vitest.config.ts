import path from "path";
import { defineConfig } from "vitest/config";

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
    exclude: ["**/node_modules/**", "**/dist/**", "apps/web/**"],
    setupFiles: ["./tests/pg-setup.ts"],
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
