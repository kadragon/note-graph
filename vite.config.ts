import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { pwaOptions } from './apps/web/src/lib/pwa-config';

// https://vitejs.dev/config/
// All API routes are now under /api prefix, so we only need one proxy rule
const proxyConfig = {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
  '/health': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaOptions)],
  resolve: {
    alias: {
      '@web': path.resolve(__dirname, './apps/web/src'),
      '@shared': path.resolve(__dirname, './packages/shared'),
    },
  },
  root: './apps/web',
  envDir: '../../',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/](react|react-dom|react-router-dom)[\\/]/.test(id))
              return 'react-vendor';
            if (id.includes('@tanstack/react-query')) return 'query-vendor';
            if (/[\\/](@radix-ui|cmdk)[\\/]/.test(id)) return 'ui-vendor';
            if (id.includes('lucide-react')) return 'icon-vendor';
            if (
              /[\\/](class-variance-authority|clsx|tailwind-merge|date-fns|nanoid|zod)[\\/]/.test(
                id,
              )
            )
              return 'utility-vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: proxyConfig,
  },
});
