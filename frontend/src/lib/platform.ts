export type ClientPlatform = 'android' | 'ios' | 'desktop' | 'unknown';

export interface PushPlatformSupport {
  platform: ClientPlatform;
  supported: boolean;
  reason?: 'ios_todo' | 'missing_browser_api';
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
  const hasRequiredApis =
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  if (platform === 'ios') {
    // TODO(iOS): implement the installed-PWA flow for iOS/iPadOS 16.4+ later.
    return { platform, supported: false, reason: 'ios_todo' };
  }

  if (!hasRequiredApis) {
    return { platform, supported: false, reason: 'missing_browser_api' };
  }

  return { platform, supported: true };
}
