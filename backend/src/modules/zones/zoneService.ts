import type { AuthUser } from '../../middleware/auth';
import type { SocketScope } from '../../socket';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { domainError } from '../shared/domainError';
import type { ZonePayload, ZoneUpdatePayload } from './zoneFormRequest';
import * as zoneRepository from './zoneRepository';

function assertResourceAccess(user: AuthUser | undefined, businessLocationId: string | null | undefined) {
  if (!user) throw domainError.unauthorized();
  if (user.role === 'SUPERADMIN') return;
  if (!businessLocationId) {
    throw domainError.forbidden('Không thể xác định khu vực của tài nguyên này.');
  }
  if (businessLocationId !== user.businessLocationId) {
    throw domainError.forbidden('Tài nguyên không thuộc khu vực của bạn.');
  }
}

export function listZones(scope?: SocketScope) {
  return zoneRepository.listZones(scope);
}

export async function createZone(body: ZonePayload, user: AuthUser | undefined) {
  const unitConfig = await zoneRepository.findUnitConfig(body.unitConfigId);
  if (!unitConfig) {
    throw domainError.badRequest('Unit config không tồn tại.');
  }

  assertResourceAccess(user, unitConfig.businessLocationId);

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

  assertResourceAccess(user, existing.unitConfig.businessLocationId);

  if (body.unitConfigId) {
    const unitConfig = await zoneRepository.findUnitConfig(body.unitConfigId);
    if (!unitConfig) {
      throw domainError.badRequest('Unit config không tồn tại.');
    }
    assertResourceAccess(user, unitConfig.businessLocationId);
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

  assertResourceAccess(user, zone.unitConfig.businessLocationId);

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
