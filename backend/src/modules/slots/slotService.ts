import { prisma } from '../../lib/prisma';
import type { AuthUser } from '../../middleware/auth';
import { roleHasUnitOperationScope } from '../../domain/permissions';
import { assertCanAccessOperationalLocation, assertCanOperateUnit } from '../../domain/permissionAssertions';
import { emitSlotUpdated, type SocketScope } from '../../socket';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { getScopeForDelivery, getScopeForSlot } from '../../services/realtimeScope';
import { isManualSlotStatus, reconcileAllSlots, reconcileOneSlot, reconcileSlotState } from '../../services/slotState';
import { triggerAutoAssign } from '../../services/autoAssign';
import { domainError } from '../shared/domainError';
import { formatSlotCode, nextSlotCodeSequence, normalizeSlotName } from '../../domain/slotCode';
import type { Prisma } from '@prisma/client';
import type { CreateSlotPayload, UpdateSlotPayload } from './slotFormRequest';
import * as slotRepository from './slotRepository';

function assertSlotOperationAccess(user: AuthUser | undefined, slot: { zone: { unitConfig: { businessLocationId: string }; unitConfigId: string } }) {
  assertCanAccessOperationalLocation(user, slot.zone.unitConfig.businessLocationId);
  assertCanOperateUnit(user, slot.zone.unitConfigId);
}

/** Tên slot là nhãn hiển thị duy nhất, nên không được trùng trong cùng business location. */
async function assertSlotNameAvailable(tx: Prisma.TransactionClient, businessLocationId: string, name: string, excludeSlotId?: string) {
  const conflict = await slotRepository.findSlotNameConflict(tx, businessLocationId, name, excludeSlotId);
  if (!conflict) return;
  throw domainError.conflict(
    conflict.isActive
      ? `Tên slot "${conflict.name}" đã tồn tại trong khu vực này.`
      : `Tên slot "${conflict.name}" đang thuộc một slot đã vô hiệu hóa. Hãy kích hoạt lại slot đó hoặc đổi tên nó trước.`,
    'SlotNameExists',
  );
}

/** Mã slot tự sinh: `<mã zone>-<số lớn nhất trong zone + 1>`. Gọi sau `lockSlotWrites`. */
async function generateSlotCode(tx: Prisma.TransactionClient, zone: { id: string; code: string }) {
  const codes = await slotRepository.listZoneSlotCodes(tx, zone.id);
  return formatSlotCode(zone.code, nextSlotCodeSequence(zone.code, codes));
}

async function emitSlotList(scope?: SocketScope) {
  emitSlotUpdated(scope);
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

  const zoneError = await slotRepository.validateZoneForUnit(body.zoneId, body.assignedUnit);
  if (zoneError) {
    throw domainError.badRequest(zoneError);
  }

  const businessLocationId = zone.unitConfig.businessLocationId;
  const name = normalizeSlotName(body.name);
  const slot = await prisma.$transaction(async (tx) => {
    await slotRepository.lockSlotWrites(tx, businessLocationId);
    await assertSlotNameAvailable(tx, businessLocationId, name);
    const code = await generateSlotCode(tx, zone);
    return slotRepository.createSlot(tx, { ...body, name, code });
  });
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
  const zoneChanged = nextZoneId !== current.zoneId;
  let nextZone: { id: string; code: string; unitConfig: { businessLocationId: string } } = current.zone;
  if (zoneChanged) {
    const found = await slotRepository.findZoneWithLocation(nextZoneId);
    if (!found) throw domainError.badRequest('Khu nhận hàng không tồn tại.');
    assertCanAccessOperationalLocation(user, found.unitConfig.businessLocationId);
    assertCanOperateUnit(user, found.unitConfigId);
    nextZone = found;
  }
  const zoneError = await slotRepository.validateZoneForUnit(nextZoneId, nextAssignedUnit);
  if (zoneError) {
    throw domainError.badRequest(zoneError);
  }

  const { status, ...slotFields } = body;
  const nextBusinessLocationId = nextZone.unitConfig.businessLocationId;
  const slot = await prisma.$transaction(async (tx) => {
    const slotData: Prisma.SlotUncheckedUpdateInput = { ...slotFields };
    const checksName = slotFields.name !== undefined || nextBusinessLocationId !== current.zone.unitConfig.businessLocationId;
    if (checksName || zoneChanged) await slotRepository.lockSlotWrites(tx, nextBusinessLocationId);
    if (checksName) {
      const name = normalizeSlotName(slotFields.name ?? current.name);
      await assertSlotNameAvailable(tx, nextBusinessLocationId, name, id);
      slotData.name = name;
    }
    // Đổi zone: cấp mã mới trong zone đích (số lớn nhất + 1) để giữ unique (zoneId, code).
    if (zoneChanged) slotData.code = await generateSlotCode(tx, nextZone);
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
    before: { code: current.code, name: current.name, assignedUnit: current.assignedUnit, vehicleType: current.vehicleType, zoneId: current.zoneId, isActive: current.isActive, autoAssign: current.autoAssign, maxCapacity: current.maxCapacity },
    after: { code: slot.slot?.code ?? current.code, name: slot.slot?.name ?? current.name, assignedUnit: slot.slot?.assignedUnit ?? current.assignedUnit, vehicleType: slot.slot?.vehicleType ?? current.vehicleType, zoneId: slot.slot?.zoneId ?? nextZoneId, isActive: slot.slot?.isActive ?? current.isActive, autoAssign: slot.slot?.autoAssign ?? current.autoAssign, maxCapacity: slot.slot?.maxCapacity ?? current.maxCapacity },
  });
  await emitSlotList(scope);

  // Turning auto-assign back on must take effect immediately: call waiting vehicles into this unit's
  // free slots now instead of waiting for the next check-in/complete/cancel event.
  // (Turning it off needs nothing here: autoAssign is re-read under the slot row lock on every assignment.)
  const updatedSlot = slot.slot;
  if (updatedSlot && !current.autoAssign && updatedSlot.autoAssign && updatedSlot.isActive) {
    triggerAutoAssign(updatedSlot.assignedUnit, {
      businessLocationId: nextBusinessLocationId,
      unitConfigId: zoneChanged ? undefined : current.zone.unitConfigId,
    }).catch(console.error);
  }
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
