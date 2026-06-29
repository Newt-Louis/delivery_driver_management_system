const SESSION_KEY = 'qms_active_deliveries';
const MAX_SESSIONS = 5;

export function getDeliverySessions(): string[] {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeliverySession(code: string) {
  if (!code) return;
  const upperCode = code.trim().toUpperCase();
  const sessions = getDeliverySessions();
  const newSessions = [upperCode, ...sessions.filter((c) => c !== upperCode)].slice(0, MAX_SESSIONS);
  localStorage.setItem(SESSION_KEY, JSON.stringify(newSessions));
}

export function removeDeliverySession(code: string) {
  if (!code) return;
  const upperCode = code.trim().toUpperCase();
  const sessions = getDeliverySessions();
  const newSessions = sessions.filter((c) => c !== upperCode);
  localStorage.setItem(SESSION_KEY, JSON.stringify(newSessions));
}

export function removeAllDeliverySessions() {
  localStorage.removeItem(SESSION_KEY);
}
