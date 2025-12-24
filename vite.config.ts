import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { VitePWAOptions } from 'vite-plugin-pwa';
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

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'favicon.svg'],
  manifest: {
    name: '업무노트 관리 시스템',
    short_name: '업무노트',
    description: 'Personal work note management system with AI-powered features',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    icons: [
      {
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24, // 1 day
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
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
  build: {
    outDir: '../../dist/web',
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
