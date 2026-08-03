import type { AuthPermissionUnit, User } from './types';

export type UnitAccessState = 'enabled' | 'readOnly' | 'disabled' | 'hidden';

export type PermissionProfile = Pick<User, 'id' | 'email' | 'name' | 'role' | 'businessLocationId'> & {
  operationUnits?: AuthPermissionUnit[];
  manageableUnits?: AuthPermissionUnit[];
  capabilities?: string[];
};

export function isSuperadmin(user: Pick<PermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'SUPERADMIN';
}

export function isAdminLoc(user: Pick<PermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'ADMIN_LOC';
}

export function isAdminOpe(user: Pick<PermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'ADMIN_OPE';
}

export function isReceiving(user: Pick<PermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'RECEIVING';
}

export function isCheckin(user: Pick<PermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'CHECKIN';
}

export function isLocationAdmin(user: Pick<PermissionProfile, 'role'> | null | undefined): boolean {
  return isAdminLoc(user) || isAdminOpe(user);
}

export function isOperationalUser(user: Pick<PermissionProfile, 'role'> | null | undefined): boolean {
  return isAdminLoc(user) || isAdminOpe(user) || isReceiving(user) || isCheckin(user);
}

export function roleHasUnitOperationScope(role: string | null | undefined): boolean {
  return role === 'ADMIN_LOC' || role === 'ADMIN_OPE' || role === 'RECEIVING' || role === 'CHECKIN';
}

export function canManageUserRole(actorRole: string | null | undefined, targetRole: string): boolean {
  if (actorRole === 'SUPERADMIN') return targetRole === 'ADMIN_LOC' || targetRole === 'ADMIN_OPE';
  if (actorRole === 'ADMIN_LOC') return targetRole === 'RECEIVING' || targetRole === 'CHECKIN';
  return false;
}

export const canCreateRole = canManageUserRole;
export const canUpdateRole = canManageUserRole;

export function canAssignUserScope(actorRole: string | null | undefined, targetRole: string): boolean {
  if (actorRole === 'SUPERADMIN') return targetRole === 'ADMIN_LOC' || targetRole === 'ADMIN_OPE';
  if (actorRole === 'ADMIN_LOC') return targetRole === 'ADMIN_OPE' || targetRole === 'RECEIVING' || targetRole === 'CHECKIN';
  return false;
}

export function getOperationUnitIds(profile: Pick<PermissionProfile, 'operationUnits'> | null | undefined): string[] {
  return profile?.operationUnits?.filter((unit) => unit.isActive).map((unit) => unit.id) ?? [];
}

export function getManageableUnitIds(profile: Pick<PermissionProfile, 'manageableUnits'> | null | undefined): string[] {
  return profile?.manageableUnits?.filter((unit) => unit.isActive).map((unit) => unit.id) ?? [];
}

export function canOperateUnit(
  profile: Pick<PermissionProfile, 'role' | 'operationUnits'> | null | undefined,
  unitConfigId: string | null | undefined,
): boolean {
  if (!profile || !unitConfigId) return false;
  if (profile.role === 'SUPERADMIN') return true;
  return profile.operationUnits?.some((unit) => unit.id === unitConfigId && unit.isActive) ?? false;
}

export function canAssignUnits(
  profile: Pick<PermissionProfile, 'role' | 'manageableUnits'> | null | undefined,
  unitConfigIds: string[],
): boolean {
  if (!profile) return false;
  if (profile.role === 'SUPERADMIN') return true;
  const manageable = new Set(getManageableUnitIds(profile));
  return unitConfigIds.every((id) => manageable.has(id));
}

export function filterOperableUnits<T extends { id: string }>(
  profile: Pick<PermissionProfile, 'role' | 'operationUnits'>,
  units: T[],
): T[] {
  if (profile.role === 'SUPERADMIN') return units;
  const allowed = new Set(getOperationUnitIds(profile));
  return units.filter((unit) => allowed.has(unit.id));
}

export function getUnitAccessState(
  profile: Pick<PermissionProfile, 'role' | 'operationUnits'> | null | undefined,
  unitConfigId: string | null | undefined,
  deniedState: UnitAccessState = 'readOnly',
): UnitAccessState {
  return canOperateUnit(profile, unitConfigId) ? 'enabled' : deniedState;
}
