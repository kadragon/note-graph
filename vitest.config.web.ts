import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
      '@web': path.resolve(__dirname, './apps/web/src'),
      '@shared': path.resolve(__dirname, './packages/shared'),
      'virtual:pwa-register/react': path.resolve(
        __dirname,
        './apps/web/src/test/mocks/pwa-register-react.ts'
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['apps/web/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./apps/web/src/test/setup.tsx'],
    globals: true,
  },
});
