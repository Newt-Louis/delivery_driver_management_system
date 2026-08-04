export type AppRole = 'SUPERADMIN' | 'ADMIN_LOC' | 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';

export type AuthPermissionUnit = {
  id: string;
  unit?: string;
  code: string;
  displayName: string;
  shortName: string;
  icon: string | null;
  businessLocationId: string;
  isActive: boolean;
};

export type AuthPermissionProfile = {
  id: string;
  email: string;
  name: string;
  role: AppRole | string;
  businessLocationId: string | null;
  operationUnits: AuthPermissionUnit[];
  manageableUnits?: AuthPermissionUnit[];
  capabilities?: string[];
};

export type UnitAccessState = 'enabled' | 'readOnly' | 'disabled' | 'hidden';

export function isSuperadmin(user: Pick<AuthPermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'SUPERADMIN';
}

export function isAdminLoc(user: Pick<AuthPermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'ADMIN_LOC';
}

export function isAdminOpe(user: Pick<AuthPermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'ADMIN_OPE';
}

export function isReceiving(user: Pick<AuthPermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'RECEIVING';
}

export function isCheckin(user: Pick<AuthPermissionProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'CHECKIN';
}

export function isLocationAdmin(user: Pick<AuthPermissionProfile, 'role'> | null | undefined): boolean {
  return isAdminLoc(user) || isAdminOpe(user);
}

export function isOperationalUser(user: Pick<AuthPermissionProfile, 'role'> | null | undefined): boolean {
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

export function canAssignBusinessLocation(
  actor: Pick<AuthPermissionProfile, 'role' | 'businessLocationId'> | null | undefined,
  targetBusinessLocationId: string | null | undefined,
): boolean {
  if (!actor) return false;
  if (actor.role === 'SUPERADMIN') return true;
  return !!targetBusinessLocationId && actor.businessLocationId === targetBusinessLocationId;
}

export function canAssignUnits(
  actor: Pick<AuthPermissionProfile, 'role' | 'manageableUnits'> | null | undefined,
  unitConfigIds: string[],
): boolean {
  if (!actor) return false;
  if (actor.role === 'SUPERADMIN') return true;
  const manageable = new Set(actor.manageableUnits?.filter((unit) => unit.isActive).map((unit) => unit.id) ?? []);
  return unitConfigIds.every((id) => manageable.has(id));
}

export function getOperationUnitIds(profile: Pick<AuthPermissionProfile, 'operationUnits'> | null | undefined): string[] {
  return profile?.operationUnits?.filter((unit) => unit.isActive).map((unit) => unit.id) ?? [];
}

export function canOperateUnit(
  profile: Pick<AuthPermissionProfile, 'role' | 'operationUnits'> | null | undefined,
  unitConfigId: string | null | undefined,
): boolean {
  if (!profile || !unitConfigId) return false;
  if (profile.role === 'SUPERADMIN') return true;
  return profile.operationUnits?.some((unit) => unit.id === unitConfigId && unit.isActive) ?? false;
}

export function filterOperableUnits<T extends { id: string }>(
  profile: Pick<AuthPermissionProfile, 'role' | 'operationUnits'>,
  units: T[],
): T[] {
  if (profile.role === 'SUPERADMIN') return units;
  const allowed = new Set(getOperationUnitIds(profile));
  return units.filter((unit) => allowed.has(unit.id));
}

export function getUnitAccessState(
  profile: Pick<AuthPermissionProfile, 'role' | 'operationUnits'> | null | undefined,
  unitConfigId: string | null | undefined,
  deniedState: UnitAccessState = 'readOnly',
): UnitAccessState {
  return canOperateUnit(profile, unitConfigId) ? 'enabled' : deniedState;
}

export function requireUnitOperation(
  profile: Pick<AuthPermissionProfile, 'role' | 'operationUnits'> | null | undefined,
  unitConfigId: string | null | undefined,
): void {
  if (!canOperateUnit(profile, unitConfigId)) {
    throw new Error('FORBIDDEN_UNIT_OPERATION');
  }
}
