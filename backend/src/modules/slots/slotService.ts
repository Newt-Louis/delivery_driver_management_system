import { prisma } from '../../lib/prisma';
import type { AuthUser } from '../../middleware/auth';
import { roleHasUnitOperationScope } from '../../domain/permissions';
import { assertCanAccessOperationalLocation, assertCanOperateUnit } from '../../domain/permissionAssertions';
import { emitSlotUpdated, type SocketScope } from '../../socket';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { getScopeForDelivery, getScopeForSlot } from '../../services/realtimeScope';
import { isManualSlotStatus, reconcileAllSlots, reconcileOneSlot, reconcileSlotState } from '../../services/slotState';
import { domainError } from '../shared/domainError';
import type { CreateSlotPayload, UpdateSlotPayload } from './slotFormRequest';
import * as slotRepository from './slotRepository';

function assertSlotOperationAccess(user: AuthUser | undefined, slot: { zone: { unitConfig: { businessLocationId: string }; unitConfigId: string } }) {
  assertCanAccessOperationalLocation(user, slot.zone.unitConfig.businessLocationId);
  assertCanOperateUnit(user, slot.zone.unitConfigId);
}

async function emitSlotList(scope?: SocketScope) {
  emitSlotUpdated(await slotRepository.listSlotsWithDeliveries(true, scope), scope);
}

export function listSlots(activeOnly: boolean, scope?: SocketScope, user?: AuthUser) {
  let allowedUnitIds = user && user.role !== 'SUPERADMIN' && roleHasUnitOperationScope(user.role)
    ? user.operationUnits
        .filter((unit) => unit.isActive && (!scope?.businessLocationId || unit.businessLocationId === scope.businessLocationId))
        .map((unit) => unit.id)
    : null;

  if (scope?.unitConfigId && allowedUnitIds) {
    if (!allowedUnitIds.includes(scope.unitConfigId)) return Promise.resolve([]);
    allowedUnitIds = [scope.unitConfigId];
  }

  if (allowedUnitIds && allowedUnitIds.length === 0) {
    return Promise.resolve([]);
  }

  return slotRepository.listSlotsWithDeliveries(activeOnly, {
    ...scope,
    unitConfigId: scope?.unitConfigId ?? (allowedUnitIds && allowedUnitIds.length === 1 ? allowedUnitIds[0] : undefined),
    unitConfigIds: allowedUnitIds ?? undefined,
  });
}

export async function updateSlotStatus(id: string, status: Parameters<typeof isManualSlotStatus>[0], user: AuthUser | undefined) {
  const current = await slotRepository.findSlotWithLocation(id);
  if (!current) throw domainError.notFound('Not found');

  assertSlotOperationAccess(user, current);

  const slot = await prisma.$transaction(async (tx) => {
    if (isManualSlotStatus(status)) {
      await tx.slot.update({ where: { id }, data: { status } });
      return (await reconcileSlotState(tx, id))?.slot;
    }
    return (await reconcileSlotState(tx, id, { preserveManualStatus: false }))?.slot;
  });

  if (!slot) throw domainError.notFound('Not found');
  const scope = await getScopeForSlot(id);
  await emitSlotList(scope);
  return slot;
}

export async function reconcileSlot(id: string, force: boolean, user: AuthUser | undefined) {
  const current = await slotRepository.findSlotWithLocation(id);
  if (!current) throw domainError.notFound('Not found');

  assertSlotOperationAccess(user, current);

  const snapshot = await reconcileOneSlot(id, { preserveManualStatus: !force });
  if (!snapshot) throw domainError.notFound('Not found');

  const scope = await getScopeForSlot(id);
  await emitSlotList(scope);
  return snapshot;
}

export async function reconcileSlots(
  activeOnly: boolean,
  force: boolean,
  scope: SocketScope | undefined,
  user: AuthUser | undefined,
) {
  assertCanAccessOperationalLocation(user, scope?.businessLocationId);

  const allowedUnitIds = roleHasUnitOperationScope(user?.role)
    ? user!.operationUnits
        .filter((unit) => unit.isActive && unit.businessLocationId === scope!.businessLocationId)
        .map((unit) => unit.id)
    : undefined;
  const unitConfigIds = scope?.unitConfigId
    ? [scope.unitConfigId]
    : allowedUnitIds;

  const snapshots = await reconcileAllSlots({
    activeOnly,
    preserveManualStatus: !force,
    businessLocationId: scope?.businessLocationId,
    unitConfigIds,
  });
  await emitSlotList({ ...scope, unitConfigIds });
  return { reconciled: snapshots.length, slots: snapshots };
}

export async function assignDeliveryToSlot(id: string, deliveryId: string, user: AuthUser | undefined) {
  const slotCheck = await slotRepository.findSlotWithLocation(id);
  if (!slotCheck) throw domainError.notFound('Slot not found');

  assertSlotOperationAccess(user, slotCheck);

  const deliveryCheck = await slotRepository.findDeliveryForScope(deliveryId);
  if (!deliveryCheck) throw domainError.notFound('Delivery not found');
  const deliveryScope = await getScopeForDelivery(deliveryCheck);
  assertCanAccessOperationalLocation(user, deliveryScope.businessLocationId);
  assertCanOperateUnit(user, deliveryScope.unitConfigId);

  const snapshot = await prisma.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({ where: { id } });
    if (!slot) return null;
    if (isManualSlotStatus(slot.status)) return { manual: true as const, snapshot: null };

    await tx.deliveryRegistration.update({
      where: { id: deliveryId },
      data: { assignedSlotId: id },
    });
    await tx.slot.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
    return { manual: false as const, snapshot: await reconcileSlotState(tx, id) };
  });

  if (!snapshot) throw domainError.notFound('Slot not found');
  if (snapshot.manual) {
    throw domainError.conflict('Slot đang ở trạng thái manual, không thể assign trực tiếp.', 'SlotManualStatus');
  }

  const scope = await getScopeForSlot(id);
  await emitSlotList(scope);
  return snapshot.snapshot?.slot;
}

export async function createSlot(body: CreateSlotPayload, user: AuthUser | undefined) {
  const zone = await slotRepository.findZoneWithLocation(body.zoneId);
  if (!zone) throw domainError.badRequest('Khu nhận hàng không tồn tại.');

  assertCanAccessOperationalLocation(user, zone.unitConfig.businessLocationId);
  assertCanOperateUnit(user, zone.unitConfigId);

  const exists = await slotRepository.findSlotByCode(body.code);
  if (exists) {
    throw domainError.conflict(`Mã slot "${body.code}" đã tồn tại.`);
  }

  const zoneError = await slotRepository.validateZoneForUnit(body.zoneId, body.assignedUnit);
  if (zoneError) {
    throw domainError.badRequest(zoneError);
  }

  const slot = await slotRepository.createSlot(body);
  const scope = await getScopeForSlot(slot.id);
  await recordAuditLog({
    ...userActor(user),
    action: 'slot.create',
    targetType: 'Slot',
    targetId: slot.id,
    businessLocationId: zone.unitConfig.businessLocationId,
    unitConfigId: zone.unitConfigId,
    after: { code: slot.code, name: slot.name, assignedUnit: slot.assignedUnit, vehicleType: slot.vehicleType, zoneId: slot.zoneId },
  });
  await emitSlotList(scope);
  return slot;
}

export async function updateSlot(id: string, body: UpdateSlotPayload, user: AuthUser | undefined) {
  const current = await slotRepository.findSlotWithLocation(id);
  if (!current) throw domainError.notFound('Not found');

  assertSlotOperationAccess(user, current);

  const nextZoneId = body.zoneId ?? current.zoneId;
  const nextAssignedUnit = body.assignedUnit ?? current.assignedUnit;
  if (nextZoneId !== current.zoneId) {
    const nextZone = await slotRepository.findZoneWithLocation(nextZoneId);
    if (!nextZone) throw domainError.badRequest('Khu nhận hàng không tồn tại.');
    assertCanAccessOperationalLocation(user, nextZone.unitConfig.businessLocationId);
    assertCanOperateUnit(user, nextZone.unitConfigId);
  }
  const zoneError = await slotRepository.validateZoneForUnit(nextZoneId, nextAssignedUnit);
  if (zoneError) {
    throw domainError.badRequest(zoneError);
  }

  const { status, ...slotData } = body;
  const slot = await prisma.$transaction(async (tx) => {
    await tx.slot.update({ where: { id }, data: slotData });
    if (!status) {
      return reconcileSlotState(tx, id);
    }
    if (isManualSlotStatus(status)) {
      await tx.slot.update({ where: { id }, data: { status } });
      return reconcileSlotState(tx, id);
    }
    return reconcileSlotState(tx, id, { preserveManualStatus: false });
  });

  if (!slot) throw domainError.notFound('Not found');

  const scope = await getScopeForSlot(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'slot.update',
    targetType: 'Slot',
    targetId: id,
    businessLocationId: current.zone.unitConfig.businessLocationId,
    unitConfigId: current.zone.unitConfigId,
    before: { code: current.code, name: current.name, assignedUnit: current.assignedUnit, vehicleType: current.vehicleType, isActive: current.isActive },
    after: { code: slot.slot?.code ?? current.code, name: slot.slot?.name ?? current.name, assignedUnit: slot.slot?.assignedUnit ?? current.assignedUnit, vehicleType: slot.slot?.vehicleType ?? current.vehicleType, isActive: slot.slot?.isActive ?? current.isActive },
  });
  await emitSlotList(scope);
  return slot.slot;
}

export async function deleteSlot(id: string, user: AuthUser | undefined) {
  const slot = await slotRepository.findSlotForDelete(id);
  if (!slot) throw domainError.notFound('Not found');

  assertSlotOperationAccess(user, slot);
  const scope: SocketScope = {
    businessLocationId: slot.zone.unitConfig.businessLocationId,
    unitConfigId: slot.zone.unitConfigId,
  };

  const historyEvents = await slotRepository.countSlotHistoryEvents(slot.id);
  let resultBody: unknown;
  if (historyEvents > 0 || slot._count.deliveries > 0) {
    await slotRepository.deactivateSlot(id);
    await recordAuditLog({
      ...userActor(user),
      action: 'slot.deactivate',
      targetType: 'Slot',
      targetId: slot.id,
      businessLocationId: slot.zone.unitConfig.businessLocationId,
      before: { code: slot.code, name: slot.name, isActive: slot.isActive },
      after: { code: slot.code, name: slot.name, isActive: false },
    });
    resultBody = { deleted: false, deactivated: true, message: 'Slot có lịch sử sử dụng — đã vô hiệu hóa thay vì xóa.' };
  } else {
    await slotRepository.deleteSlot(id);
    await recordAuditLog({
      ...userActor(user),
      action: 'slot.delete',
      targetType: 'Slot',
      targetId: slot.id,
      businessLocationId: slot.zone.unitConfig.businessLocationId,
      before: { code: slot.code, name: slot.name, assignedUnit: slot.assignedUnit },
    });
    resultBody = { deleted: true };
  }

  await emitSlotList(scope);
  return resultBody;
}
