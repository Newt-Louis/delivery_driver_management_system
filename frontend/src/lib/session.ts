const SESSION_KEY = 'qms_active_deliveries';
const MAX_SESSIONS = 5;
export const DELIVERY_SESSIONS_CHANGED = 'dqm-delivery-sessions-changed';

export function getDeliverySessions(): string[] {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, MAX_SESSIONS) : [];
  } catch {
    return [];
  }
}

export function saveDeliverySession(code: string) {
  if (!code) return;
  const upperCode = code.trim().toUpperCase();
  const sessions = getDeliverySessions();
  const newSessions = [upperCode, ...sessions.filter((c) => c !== upperCode)].slice(0, MAX_SESSIONS);
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(newSessions)); } catch { /* optional local history */ }
  window.dispatchEvent(new Event(DELIVERY_SESSIONS_CHANGED));
}

export function removeDeliverySession(code: string) {
  if (!code) return;
  const upperCode = code.trim().toUpperCase();
  const sessions = getDeliverySessions();
  const newSessions = sessions.filter((c) => c !== upperCode);
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(newSessions)); } catch { /* optional local history */ }
  window.dispatchEvent(new Event(DELIVERY_SESSIONS_CHANGED));
}

export function removeAllDeliverySessions() {
  localStorage.removeItem(SESSION_KEY);
}
