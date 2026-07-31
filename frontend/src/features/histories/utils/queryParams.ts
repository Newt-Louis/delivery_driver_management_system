export function cleanQueryParams(params: object): Record<string, string | number> {
  const cleaned: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null && (typeof value === 'string' || typeof value === 'number')) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
