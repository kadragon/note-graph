export function reloadApp() {
  window.location.reload();
}

export function isPwaCacheName(name: string) {
  return name.startsWith('workbox-') || name.startsWith('vite-pwa-');
}

export async function forcePwaRefresh() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const pwaCacheNames = cacheNames.filter(isPwaCacheName);
    await Promise.all(pwaCacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  window.location.replace(window.location.href);
}
