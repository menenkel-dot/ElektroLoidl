"use client";

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registerServiceWorker = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('ServiceWorker registration failed:', error);
      });
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
      return;
    }

    window.addEventListener('load', registerServiceWorker, { once: true });
    return () => window.removeEventListener('load', registerServiceWorker);
  }, []);

  return null;
}
