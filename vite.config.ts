import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

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
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  root: './frontend',
  build: {
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            'cmdk',
          ],
          'markdown-vendor': [
            'react-markdown',
            'remark-gfm',
            'rehype-sanitize',
          ],
          'icon-vendor': ['lucide-react'],
          'utility-vendor': [
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'date-fns',
            'nanoid',
            'zod',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: proxyConfig,
  },
});
