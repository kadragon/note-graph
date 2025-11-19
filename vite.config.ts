import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
const proxyPaths = [
  '/api',
  '/me',
  '/work-notes',
  '/persons',
  '/departments',
  '/task-categories',
  '/todos',
  '/search',
  '/rag',
  '/ai',
  '/pdf-jobs',
];

const proxyConfig = proxyPaths.reduce(
  (config, path) => {
    config[path] = {
      target: 'http://localhost:8787',
      changeOrigin: true,
      // Bypass proxy for HTML requests (direct browser navigation)
      // Only proxy API requests (application/json)
      bypass: (req, _res, _options) => {
        const accept = req.headers.accept || '';
        // If browser is requesting HTML (direct navigation/refresh), don't proxy
        if (accept.includes('text/html')) {
          return '/index.html';
        }
        // Otherwise, proxy to backend (API requests)
        return null;
      },
    };
    return config;
  },
  {} as Record<string, ProxyOptions>
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
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
            '@uiw/react-md-editor',
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
