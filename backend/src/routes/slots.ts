import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SlotStatus, VehicleType, ReceivingUnit, GoodsType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { emitSlotUpdated } from '../socket';

const router = Router();

async function getAllSlotsWithDeliveries(activeOnly = true) {
  return prisma.slot.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, code: true, name: true } },
      deliveries: {
        where: { status: { in: ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

// GET /api/slots — active slots (Dashboard, SlotManagement, CallModal)
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getAllSlotsWithDeliveries(true));
}));

// GET /api/slots/all — all slots including inactive (admin backoffice)
router.get('/all', authenticate, requireRole('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getAllSlotsWithDeliveries(false));
}));

const statusSchema = z.object({ status: z.nativeEnum(SlotStatus) });

// PATCH /api/slots/:id/status
router.patch('/:id/status', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const { status } = statusSchema.parse(req.body);
  const slot = await prisma.slot.update({ where: { id: req.params.id }, data: { status } });
  emitSlotUpdated(await getAllSlotsWithDeliveries(true));
  res.json(slot);
}));

const assignSchema = z.object({ deliveryId: z.string() });

// PATCH /api/slots/:id/assign
router.patch('/:id/assign', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const { deliveryId } = assignSchema.parse(req.body);

  const [slot] = await prisma.$transaction([
    prisma.slot.update({
      where: { id: req.params.id },
      data: { status: 'OCCUPIED', currentDeliveryId: deliveryId, lastUsedAt: new Date() },
    }),
    prisma.deliveryRegistration.update({
      where: { id: deliveryId },
      data: { assignedSlotId: req.params.id },
    }),
  ]);

  emitSlotUpdated(await getAllSlotsWithDeliveries(true));
  res.json(slot);
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
  zoneId: z.string().optional().nullable(),
});

// POST /api/slots
router.post('/', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = createSlotSchema.parse(req.body);

  const exists = await prisma.slot.findUnique({ where: { code: body.code } });
  if (exists) {
    res.status(409).json({ error: 'Conflict', message: `Mã slot "${body.code}" đã tồn tại.` });
    return;
  }

  const slot = await prisma.slot.create({ data: body });
  emitSlotUpdated(await getAllSlotsWithDeliveries(true));
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
  zoneId: z.string().optional().nullable(),
});

// PATCH /api/slots/:id
router.patch('/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = updateSlotSchema.parse(req.body);
  const slot = await prisma.slot.update({ where: { id: req.params.id }, data: body });
  emitSlotUpdated(await getAllSlotsWithDeliveries(true));
  res.json(slot);
}));

// DELETE /api/slots/:id
router.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const slot = await prisma.slot.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { callLogs: true, deliveries: true } } },
  });
  if (!slot) { res.status(404).json({ error: 'Not found' }); return; }

  if (slot._count.callLogs > 0 || slot._count.deliveries > 0) {
    await prisma.slot.update({ where: { id: req.params.id }, data: { isActive: false, status: SlotStatus.MAINTENANCE } });
    res.json({ deleted: false, deactivated: true, message: 'Slot có lịch sử sử dụng — đã vô hiệu hóa thay vì xóa.' });
  } else {
    await prisma.slot.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  }

  emitSlotUpdated(await getAllSlotsWithDeliveries(true));
}));

export default router;
