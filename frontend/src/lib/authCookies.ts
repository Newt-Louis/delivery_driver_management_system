export const AUTH_TOKEN_COOKIE = 'dqm_token';
const DEVICE_ID_COOKIE = 'dqm_device_id';

function cookieSecureFlag(): string {
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.max(1, Math.floor(maxAgeSeconds))}; Path=/; SameSite=Lax${cookieSecureFlag()}`;
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${cookieSecureFlag()}`;
}

export function getAuthToken(): string | null {
  return getCookie(AUTH_TOKEN_COOKIE);
}

export function setAuthToken(token: string, maxAgeSeconds: number): void {
  setCookie(AUTH_TOKEN_COOKIE, token, maxAgeSeconds);
}

export function clearAuthToken(): void {
  deleteCookie(AUTH_TOKEN_COOKIE);
}

export function getOrCreateDeviceId(): string {
  const existing = getCookie(DEVICE_ID_COOKIE);
  if (existing) return existing;

  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setCookie(DEVICE_ID_COOKIE, id, 365 * 24 * 60 * 60);
  return id;
}
