// Einfacher Service Worker für PWA-Installierbarkeit
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker...');
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Grundlegendes Fetch-Handling für PWA-Kriterien
  event.respondWith(fetch(event.request));
});