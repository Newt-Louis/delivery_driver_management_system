import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SlotStatus, VehicleType, ReceivingUnit, GoodsType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope, enforceResourceScope } from '../middleware/auth';
import { emitSlotUpdated, type SocketScope } from '../socket';
import { reconcileAllSlots, reconcileOneSlot, reconcileSlotState, isManualSlotStatus } from '../services/slotState';
import { getScopeForSlot, getScopeForDelivery } from '../services/realtimeScope';
import { recordAuditLog, userActor } from '../services/auditLog';

const router = Router();

async function getAllSlotsWithDeliveries(activeOnly = true, scope?: SocketScope) {
  return prisma.slot.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      zone: {
        ...(scope?.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
        ...(scope?.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
      },
    },
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, code: true, name: true, unitConfig: { select: { id: true, unit: true, businessLocationId: true } } } },
      deliveries: {
        where: { status: { in: ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

// GET /api/slots — active slots (Dashboard, SlotManagement, CallModal)
router.get('/', enforceScope, asyncHandler(async (req: Request, res: Response) => {
  res.json(await getAllSlotsWithDeliveries(true, req.scope));
}));

// GET /api/slots/all — all slots including inactive (admin backoffice)
router.get('/all', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  res.json(await getAllSlotsWithDeliveries(false, req.scope));
}));

const statusSchema = z.object({ status: z.nativeEnum(SlotStatus) });

// PATCH /api/slots/:id/status
router.patch('/:id/status', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const { status } = statusSchema.parse(req.body);
  const current = await prisma.slot.findUnique({
    where: { id: req.params.id },
    include: { zone: { include: { unitConfig: { select: { businessLocationId: true } } } } },
  });
  if (!current) { res.status(404).json({ error: 'Not found' }); return; }
  if (!enforceResourceScope(req, res, current.zone.unitConfig.businessLocationId)) return;

  const slot = await prisma.$transaction(async (tx) => {
    if (isManualSlotStatus(status)) {
      await tx.slot.update({ where: { id: req.params.id }, data: { status } });
      return (await reconcileSlotState(tx, req.params.id))?.slot;
    }
    return (await reconcileSlotState(tx, req.params.id, { preserveManualStatus: false }))?.slot;
  });

  if (!slot) { res.status(404).json({ error: 'Not found' }); return; }
  const scope = await getScopeForSlot(req.params.id);
  emitSlotUpdated(await getAllSlotsWithDeliveries(true, scope), scope);
  res.json(slot);
}));

// POST /api/slots/:id/reconcile — recompute AVAILABLE/OCCUPIED from active deliveries.
router.post('/:id/reconcile', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const current = await prisma.slot.findUnique({
    where: { id: req.params.id },
    include: { zone: { include: { unitConfig: { select: { businessLocationId: true } } } } },
  });
  if (!current) { res.status(404).json({ error: 'Not found' }); return; }
  if (!enforceResourceScope(req, res, current.zone.unitConfig.businessLocationId)) return;

  const force = req.query.force === 'true';
  const snapshot = await reconcileOneSlot(req.params.id, { preserveManualStatus: !force });
  if (!snapshot) { res.status(404).json({ error: 'Not found' }); return; }

  const scope = await getScopeForSlot(req.params.id);
  emitSlotUpdated(await getAllSlotsWithDeliveries(true, scope), scope);
  res.json(snapshot);
}));

// POST /api/slots/reconcile — admin maintenance endpoint for all slots.
router.post('/reconcile', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.activeOnly !== 'false';
  const force = req.query.force === 'true';
  const snapshots = await reconcileAllSlots({ activeOnly, preserveManualStatus: !force });

  emitSlotUpdated(await getAllSlotsWithDeliveries(true));
  res.json({ reconciled: snapshots.length, slots: snapshots });
}));

const assignSchema = z.object({ deliveryId: z.string() });

// PATCH /api/slots/:id/assign
router.patch('/:id/assign', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const { deliveryId } = assignSchema.parse(req.body);

  const slotCheck = await prisma.slot.findUnique({
    where: { id: req.params.id },
    include: { zone: { include: { unitConfig: { select: { businessLocationId: true } } } } },
  });
  if (!slotCheck) { res.status(404).json({ error: 'Slot not found' }); return; }
  if (!enforceResourceScope(req, res, slotCheck.zone.unitConfig.businessLocationId)) return;

  // Also check delivery scope
  const deliveryCheck = await prisma.deliveryRegistration.findUnique({
    where: { id: deliveryId },
    select: { id: true, receivingUnit: true, assignedSlotId: true },
  });
  if (deliveryCheck) {
    const deliveryScope = await getScopeForDelivery(deliveryCheck);
    if (!enforceResourceScope(req, res, deliveryScope.businessLocationId)) return;
  }

  const snapshot = await prisma.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({ where: { id: req.params.id } });
    if (!slot) return null;
    if (isManualSlotStatus(slot.status)) return { manual: true as const, snapshot: null };

    await tx.deliveryRegistration.update({
      where: { id: deliveryId },
      data: { assignedSlotId: req.params.id },
    });
    await tx.slot.update({
      where: { id: req.params.id },
      data: { lastUsedAt: new Date() },
    });
    return { manual: false as const, snapshot: await reconcileSlotState(tx, req.params.id) };
  });

  if (!snapshot) { res.status(404).json({ error: 'Slot not found' }); return; }
  if (snapshot.manual) {
    res.status(409).json({ error: 'Slot đang ở trạng thái manual, không thể assign trực tiếp.' });
    return;
  }

  const scope = await getScopeForSlot(req.params.id);
  emitSlotUpdated(await getAllSlotsWithDeliveries(true, scope), scope);
  res.json(snapshot.snapshot?.slot);
}));

// --- Admin CRUD ---

const createSlotSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  assignedUnit: z.nativeEnum(ReceivingUnit),
  vehicleType: z.nativeEnum(VehicleType).default(VehicleType.TRUCK),
  acceptedGoods: z.array(z.nativeEnum(GoodsType)).default([]),
  autoAssign: z.boolean().default(true),
  autoWarehouseOnly: z.boolean().default(false),
  maxCapacity: z.number().int().min(1).max(10).default(1),
  status: z.nativeEnum(SlotStatus).default(SlotStatus.AVAILABLE),
  zoneId: z.string().min(1),
});

async function validateZoneForUnit(zoneId: string, assignedUnit: ReceivingUnit) {
  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    include: { unitConfig: { select: { unit: true } } },
  });
  if (!zone) return 'Khu nhận hàng không tồn tại.';
  if (zone.unitConfig.unit !== assignedUnit) return 'Khu nhận hàng không thuộc đúng đơn vị của slot.';
  return null;
}

// POST /api/slots
router.post('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const body = createSlotSchema.parse(req.body);

  // Validate zone belongs to user's scope
  const zone = await prisma.zone.findUnique({
    where: { id: body.zoneId },
    include: { unitConfig: { select: { businessLocationId: true } } },
  });
  if (!zone) { res.status(400).json({ error: 'BadRequest', message: 'Khu nhận hàng không tồn tại.' }); return; }
  if (!enforceResourceScope(req, res, zone.unitConfig.businessLocationId)) return;

  const exists = await prisma.slot.findUnique({ where: { code: body.code } });
  if (exists) {
    res.status(409).json({ error: 'Conflict', message: `Mã slot "${body.code}" đã tồn tại.` });
    return;
  }

  const zoneError = await validateZoneForUnit(body.zoneId, body.assignedUnit);
  if (zoneError) {
    res.status(400).json({ error: 'BadRequest', message: zoneError });
    return;
  }

  const slot = await prisma.slot.create({ data: body });
  const scope = await getScopeForSlot(slot.id);
  await recordAuditLog({
    ...userActor(req.user),
    action: 'slot.create',
    targetType: 'Slot',
    targetId: slot.id,
    businessLocationId: zone.unitConfig.businessLocationId,
    unitConfigId: zone.unitConfigId,
    after: { code: slot.code, name: slot.name, assignedUnit: slot.assignedUnit, vehicleType: slot.vehicleType, zoneId: slot.zoneId },
  });
  emitSlotUpdated(await getAllSlotsWithDeliveries(true, scope), scope);
  res.status(201).json(slot);
}));

const updateSlotSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  assignedUnit: z.nativeEnum(ReceivingUnit).optional(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
  acceptedGoods: z.array(z.nativeEnum(GoodsType)).optional(),
  autoAssign: z.boolean().optional(),
  autoWarehouseOnly: z.boolean().optional(),
  maxCapacity: z.number().int().min(1).max(10).optional(),
  status: z.nativeEnum(SlotStatus).optional(),
  isActive: z.boolean().optional(),
  zoneId: z.string().min(1).optional(),
});

// PATCH /api/slots/:id
router.patch('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const body = updateSlotSchema.parse(req.body);
  const current = await prisma.slot.findUnique({
    where: { id: req.params.id },
    include: { zone: { include: { unitConfig: { select: { businessLocationId: true } } } } },
  });
  if (!current) { res.status(404).json({ error: 'Not found' }); return; }
  if (!enforceResourceScope(req, res, current.zone.unitConfig.businessLocationId)) return;
  const nextZoneId = body.zoneId ?? current.zoneId;
  const nextAssignedUnit = body.assignedUnit ?? current.assignedUnit;
  const zoneError = await validateZoneForUnit(nextZoneId, nextAssignedUnit);
  if (zoneError) {
    res.status(400).json({ error: 'BadRequest', message: zoneError });
    return;
  }

  const { status, ...slotData } = body;
  const slot = await prisma.$transaction(async (tx) => {
    await tx.slot.update({ where: { id: req.params.id }, data: slotData });
    if (!status) {
      return reconcileSlotState(tx, req.params.id);
    }
    if (isManualSlotStatus(status)) {
      await tx.slot.update({ where: { id: req.params.id }, data: { status } });
      return reconcileSlotState(tx, req.params.id);
    }
    return reconcileSlotState(tx, req.params.id, { preserveManualStatus: false });
  });

  if (!slot) { res.status(404).json({ error: 'Not found' }); return; }
  const scope = await getScopeForSlot(req.params.id);
  await recordAuditLog({
    ...userActor(req.user),
    action: 'slot.update',
    targetType: 'Slot',
    targetId: req.params.id,
    businessLocationId: current.zone.unitConfig.businessLocationId,
    unitConfigId: current.zone.unitConfigId,
    before: { code: current.code, name: current.name, assignedUnit: current.assignedUnit, vehicleType: current.vehicleType, isActive: current.isActive },
    after: { code: slot.slot?.code ?? current.code, name: slot.slot?.name ?? current.name, assignedUnit: slot.slot?.assignedUnit ?? current.assignedUnit, vehicleType: slot.slot?.vehicleType ?? current.vehicleType, isActive: slot.slot?.isActive ?? current.isActive },
  });
  emitSlotUpdated(await getAllSlotsWithDeliveries(true, scope), scope);
  res.json(slot.slot);
}));

// DELETE /api/slots/:id
router.delete('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const slot = await prisma.slot.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { callLogs: true, deliveries: true } }, zone: { include: { unitConfig: { select: { businessLocationId: true } } } } },
  });
  if (!slot) { res.status(404).json({ error: 'Not found' }); return; }
  if (!enforceResourceScope(req, res, slot.zone.unitConfig.businessLocationId)) return;

  if (slot._count.callLogs > 0 || slot._count.deliveries > 0) {
    await prisma.slot.update({ where: { id: req.params.id }, data: { isActive: false, status: SlotStatus.MAINTENANCE } });
    await recordAuditLog({
      ...userActor(req.user),
      action: 'slot.deactivate',
      targetType: 'Slot',
      targetId: slot.id,
      businessLocationId: slot.zone.unitConfig.businessLocationId,
      before: { code: slot.code, name: slot.name, isActive: slot.isActive },
      after: { code: slot.code, name: slot.name, isActive: false },
    });
    res.json({ deleted: false, deactivated: true, message: 'Slot có lịch sử sử dụng — đã vô hiệu hóa thay vì xóa.' });
  } else {
    await prisma.slot.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      ...userActor(req.user),
      action: 'slot.delete',
      targetType: 'Slot',
      targetId: slot.id,
      businessLocationId: slot.zone.unitConfig.businessLocationId,
      before: { code: slot.code, name: slot.name, assignedUnit: slot.assignedUnit },
    });
    res.json({ deleted: true });
  }

  const scope = await getScopeForSlot(req.params.id);
  emitSlotUpdated(await getAllSlotsWithDeliveries(true, scope), scope);
}));

export default router;
