import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
const proxyPaths = [
  '/api',
  '/me',
  '/work-notes',
  '/persons',
  '/departments',
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
    };
    return config;
  },
  {} as Record<string, { target: string; changeOrigin: boolean }>
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
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: proxyConfig,
  },
});
