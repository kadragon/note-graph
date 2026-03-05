import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@worker': path.resolve(__dirname, './apps/worker/src'),
      '@shared': path.resolve(__dirname, './packages/shared'),
    },
  },
  test: {
    include: ['tests/integration/supabase-*.test.ts'],
    globals: true,
  },
});
