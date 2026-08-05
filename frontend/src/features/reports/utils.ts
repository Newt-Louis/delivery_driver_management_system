export function fmt(n: number | null | undefined, suffix = ''): string {
  if (n == null) return '—';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + suffix;
}

export function unitLabel(unitLabels: Record<string, string>, unit: string): string {
  return unitLabels[unit] ?? unit;
}

export function defaultFrom(): string {
  return new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
}

export function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}
