export function minutesSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

export function formatWait(dateStr: string | null): string {
  if (!dateStr) return '-';
  const m = minutesSince(dateStr);
  if (m < 60) return `${m} phút`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Estimated wait: queue position × avg dock time (18 min), minus concurrent docks
export function estimatedWaitMinutes(queuePosition: number, availableDocks: number): number {
  if (queuePosition <= availableDocks) return 0;
  return (queuePosition - availableDocks) * 18;
}
