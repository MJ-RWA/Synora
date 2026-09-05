import { registerSW } from 'virtual:pwa-register';

export function initServiceWorker() {
  if ('serviceWorker' in navigator && typeof window !== 'undefined') {
    const updateSW = registerSW({
      onNeedRefresh() {
        // Automatically activate new service worker when an update is detected
        updateSW(true);
      },
      onOfflineReady() {
        console.log('[PWA] Synora is ready for offline caching of app assets.');
      },
      onRegisterError(error) {
        console.warn('[PWA] Service worker registration error:', error);
      },
    });
  }
}
