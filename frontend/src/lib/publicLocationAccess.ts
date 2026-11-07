export function canSelectPublicLocation(isLoading: boolean, isAuthenticated: boolean, role?: string): boolean {
  return !isLoading && (!isAuthenticated || role === 'SUPERADMIN');
}
