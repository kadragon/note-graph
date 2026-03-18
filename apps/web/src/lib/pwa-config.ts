import type { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
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
    navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
    runtimeCaching: [
      {
        urlPattern: ({ url }) =>
          [
            '/api/persons',
            '/api/departments',
            '/api/task-categories',
            '/api/work-note-groups',
          ].includes(url.pathname),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'reference-data',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60,
          },
        },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api'),
        handler: 'NetworkOnly',
      },
    ],
  },
};
