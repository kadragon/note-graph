import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
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
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/me': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/work-notes': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/persons': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/departments': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/todos': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/search': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/rag': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/ai': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/pdf-jobs': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
