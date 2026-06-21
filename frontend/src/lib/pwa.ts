export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('[PWA] Service worker registration failed:', err);
    return null;
  }
}

export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    void registerAppServiceWorker();
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
