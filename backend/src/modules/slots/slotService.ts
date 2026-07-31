import { prisma } from '../../lib/prisma';
import type { AuthUser } from '../../middleware/auth';
import { emitSlotUpdated, type SocketScope } from '../../socket';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { getScopeForDelivery, getScopeForSlot } from '../../services/realtimeScope';
import { isManualSlotStatus, reconcileAllSlots, reconcileOneSlot, reconcileSlotState } from '../../services/slotState';
import { domainError } from '../shared/domainError';
import type { CreateSlotPayload, UpdateSlotPayload } from './slotFormRequest';
import * as slotRepository from './slotRepository';

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

async function emitSlotList(scope?: SocketScope) {
  emitSlotUpdated(await slotRepository.listSlotsWithDeliveries(true, scope), scope);
}

export function listSlots(activeOnly: boolean, scope?: SocketScope) {
  return slotRepository.listSlotsWithDeliveries(activeOnly, scope);
}

export async function updateSlotStatus(id: string, status: Parameters<typeof isManualSlotStatus>[0], user: AuthUser | undefined) {
  const current = await slotRepository.findSlotWithLocation(id);
  if (!current) throw domainError.notFound('Not found');

  assertResourceAccess(user, current.zone.unitConfig.businessLocationId);

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

  assertResourceAccess(user, current.zone.unitConfig.businessLocationId);

  const snapshot = await reconcileOneSlot(id, { preserveManualStatus: !force });
  if (!snapshot) throw domainError.notFound('Not found');

  const scope = await getScopeForSlot(id);
  await emitSlotList(scope);
  return snapshot;
}

export async function reconcileSlots(activeOnly: boolean, force: boolean) {
  const snapshots = await reconcileAllSlots({ activeOnly, preserveManualStatus: !force });
  await emitSlotList();
  return { reconciled: snapshots.length, slots: snapshots };
}

export async function assignDeliveryToSlot(id: string, deliveryId: string, user: AuthUser | undefined) {
  const slotCheck = await slotRepository.findSlotWithLocation(id);
  if (!slotCheck) throw domainError.notFound('Slot not found');

  assertResourceAccess(user, slotCheck.zone.unitConfig.businessLocationId);

  const deliveryCheck = await slotRepository.findDeliveryForScope(deliveryId);
  if (deliveryCheck) {
    const deliveryScope = await getScopeForDelivery(deliveryCheck);
    assertResourceAccess(user, deliveryScope.businessLocationId);
  }

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

  assertResourceAccess(user, zone.unitConfig.businessLocationId);

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

  assertResourceAccess(user, current.zone.unitConfig.businessLocationId);

  const nextZoneId = body.zoneId ?? current.zoneId;
  const nextAssignedUnit = body.assignedUnit ?? current.assignedUnit;
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

  assertResourceAccess(user, slot.zone.unitConfig.businessLocationId);

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

  const scope = await getScopeForSlot(id);
  await emitSlotList(scope);
  return resultBody;
}
