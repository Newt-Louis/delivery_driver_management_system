export type ClientPlatform = 'android' | 'ios' | 'desktop' | 'unknown';

export interface PushPlatformSupport {
  platform: ClientPlatform;
  supported: boolean;
  reason?: 'ios_needs_pwa' | 'missing_browser_api';
  standalone: boolean;
}

export function getClientPlatform(): ClientPlatform {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const touchPoints = navigator.maxTouchPoints || 0;

  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (platform === 'MacIntel' && touchPoints > 1) return 'ios';
  if (/Win|Mac|Linux|CrOS/i.test(platform)) return 'desktop';

  return 'unknown';
}

export function getPushPlatformSupport(): PushPlatformSupport {
  const platform = getClientPlatform();
  const standalone = isStandaloneWebApp();
  const hasRequiredApis =
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  if (platform === 'ios' && !standalone) {
    return { platform, supported: false, reason: 'ios_needs_pwa', standalone };
  }

  if (!hasRequiredApis) {
    return { platform, supported: false, reason: 'missing_browser_api', standalone };
  }

  return { platform, supported: true, standalone };
}

export function isStandaloneWebApp(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
}
