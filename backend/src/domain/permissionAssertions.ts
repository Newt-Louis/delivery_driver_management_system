import type { AuthUser } from '../middleware/auth';
import {
  canAssignBusinessLocation,
  canAssignUnits,
  canAssignUserScope,
  canManageUserRole,
  canOperateUnit,
  roleHasUnitOperationScope,
} from './permissions';
import { domainError } from '../modules/shared/domainError';

export function assertCanManageUserRole(actor: AuthUser | undefined, targetRole: string): void {
  if (!actor) throw domainError.unauthorized();
  if (!canManageUserRole(actor.role, targetRole)) {
    throw domainError.forbidden('Bạn không có quyền quản trị role này.');
  }
}

export function assertCanAssignUserScope(actor: AuthUser | undefined, targetRole: string): void {
  if (!actor) throw domainError.unauthorized();
  if (!canAssignUserScope(actor.role, targetRole)) {
    throw domainError.forbidden('Bạn không có quyền chỉ định phạm vi đơn vị cho role này.');
  }
}

export function assertCanAssignBusinessLocation(
  actor: AuthUser | undefined,
  targetBusinessLocationId: string | null | undefined,
): void {
  if (!actor) throw domainError.unauthorized();
  if (!canAssignBusinessLocation(actor, targetBusinessLocationId)) {
    throw domainError.forbidden('Bạn không có quyền gán khu vực này.');
  }
}

export function assertCanAssignUnits(actor: AuthUser | undefined, unitConfigIds: string[]): void {
  if (!actor) throw domainError.unauthorized();
  if (!canAssignUnits(actor, unitConfigIds)) {
    throw domainError.forbidden('Bạn không có quyền gán một hoặc nhiều đơn vị đã chọn.');
  }
}

export function assertCanOperateUnit(actor: AuthUser | undefined, unitConfigId: string | null | undefined): void {
  if (!actor) throw domainError.unauthorized();
  if (!roleHasUnitOperationScope(actor.role)) return;
  if (!unitConfigId) {
    throw domainError.forbidden('Không thể xác định đơn vị thao tác.');
  }
  if (!canOperateUnit(actor, unitConfigId)) {
    throw domainError.forbidden('Bạn không có quyền thao tác trên đơn vị này.', { unitConfigId });
  }
}
