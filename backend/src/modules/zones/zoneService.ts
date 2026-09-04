import type { AuthUser } from '../../middleware/auth';
import type { SocketScope } from '../../socket';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { roleHasUnitOperationScope } from '../../domain/permissions';
import { assertCanAccessOperationalLocation, assertCanOperateUnit } from '../../domain/permissionAssertions';
import { domainError } from '../shared/domainError';
import type { ZonePayload, ZoneUpdatePayload } from './zoneFormRequest';
import * as zoneRepository from './zoneRepository';

export function listZones(scope?: SocketScope, user?: AuthUser) {
  const allowedUnitIds = user && roleHasUnitOperationScope(user.role)
    ? user.operationUnits
        .filter((unit) => unit.isActive && unit.businessLocationId === scope?.businessLocationId)
        .map((unit) => unit.id)
    : undefined;
  if (allowedUnitIds && allowedUnitIds.length === 0) return Promise.resolve([]);
  return zoneRepository.listZones({ ...scope, unitConfigIds: allowedUnitIds });
}

export async function createZone(body: ZonePayload, user: AuthUser | undefined) {
  const unitConfig = await zoneRepository.findUnitConfig(body.unitConfigId);
  if (!unitConfig) {
    throw domainError.badRequest('Unit config không tồn tại.');
  }

  assertCanAccessOperationalLocation(user, unitConfig.businessLocationId);
  assertCanOperateUnit(user, unitConfig.id);

  const exists = await zoneRepository.findZoneByUnitAndCode(body.unitConfigId, body.code);
  if (exists) {
    throw domainError.conflict(`Mã khu "${body.code}" đã tồn tại trong đơn vị này.`);
  }

  const zone = await zoneRepository.createZone(body);
  await recordAuditLog({
    ...userActor(user),
    action: 'zone.create',
    targetType: 'Zone',
    targetId: zone.id,
    businessLocationId: unitConfig.businessLocationId,
    unitConfigId: body.unitConfigId,
    after: { code: zone.code, name: zone.name },
  });
  return zone;
}

export async function updateZone(id: string, body: ZoneUpdatePayload, user: AuthUser | undefined) {
  const existing = await zoneRepository.findZoneForUpdate(id);
  if (!existing) throw domainError.notFound('Not found');

  assertCanAccessOperationalLocation(user, existing.unitConfig.businessLocationId);
  assertCanOperateUnit(user, existing.unitConfigId);

  if (body.unitConfigId) {
    const unitConfig = await zoneRepository.findUnitConfig(body.unitConfigId);
    if (!unitConfig) {
      throw domainError.badRequest('Unit config không tồn tại.');
    }
    assertCanAccessOperationalLocation(user, unitConfig.businessLocationId);
    assertCanOperateUnit(user, unitConfig.id);
  }

  const zone = await zoneRepository.updateZone(id, body);
  await recordAuditLog({
    ...userActor(user),
    action: 'zone.update',
    targetType: 'Zone',
    targetId: zone.id,
    businessLocationId: existing.unitConfig.businessLocationId,
    unitConfigId: existing.unitConfigId,
    before: { code: existing.code, name: existing.name },
    after: { code: zone.code, name: zone.name },
  });
  return zone;
}

export async function deleteZone(id: string, user: AuthUser | undefined) {
  const zone = await zoneRepository.findZoneForDelete(id);
  if (!zone) throw domainError.notFound('Not found');

  assertCanAccessOperationalLocation(user, zone.unitConfig.businessLocationId);
  assertCanOperateUnit(user, zone.unitConfigId);

  if (zone._count.slots > 0) {
    throw domainError.badRequest(`Khu "${zone.code}" còn ${zone._count.slots} slot. Hãy chuyển slot sang khu khác trước khi xóa.`);
  }

  await zoneRepository.deleteZone(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'zone.delete',
    targetType: 'Zone',
    targetId: zone.id,
    businessLocationId: zone.unitConfig.businessLocationId,
    unitConfigId: zone.unitConfigId,
    before: { code: zone.code, name: zone.name },
  });
  return { deleted: true };
}
