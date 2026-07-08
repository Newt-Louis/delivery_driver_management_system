import { Router, Request, Response } from 'express';
import { Prisma, AuditActorType, DeliveryHistoryFinalStatus, ReceivingUnit, GoodsType, VehicleType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope, enforceResourceScope } from '../middleware/auth';

const router = Router();

// ─── Delivery History ─────────────────────────────────────────────────────────

const DELIVERY_SORT_FIELDS = new Set([
  'registrationCode', 'registeredAt', 'checkinTime', 'calledTime', 'receivingStartTime',
  'completedTime', 'archivedAt', 'finalStatus', 'receivingUnit',
  'goodsType', 'vehicleType', 'ticketNumber', 'callCount',
]);

router.get('/delivery', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1', limit = '50',
    sortField = 'registeredAt', sortDir = 'desc',
    from, to, finalStatus, receivingUnit, goodsType, vehicleType, search,
  } = req.query as Record<string, string>;

  const safeSortField = DELIVERY_SORT_FIELDS.has(sortField) ? sortField : 'registeredAt';
  const safeSortDir = sortDir === 'asc' ? 'asc' : 'desc';
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.DeliveryHistoryWhereInput = {};

  // Scope
  if (req.user?.role !== 'SUPERADMIN' && req.user?.businessLocationId) {
    where.businessLocationId = req.user.businessLocationId;
  }

  // Date range
  if (from || to) {
    where.registeredAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + 'T23:59:59.999Z') } : {}),
    };
  }

  // Filters
  if (finalStatus) where.finalStatus = finalStatus as DeliveryHistoryFinalStatus;
  if (receivingUnit) where.receivingUnit = receivingUnit as ReceivingUnit;
  if (goodsType) where.goodsType = goodsType as GoodsType;
  if (vehicleType) where.vehicleType = vehicleType as VehicleType;

  // Search
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { vendorName: { contains: q, mode: 'insensitive' } },
      { driverName: { contains: q, mode: 'insensitive' } },
      { vehiclePlate: { contains: q, mode: 'insensitive' } },
      { registrationCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orderBy = { [safeSortField]: safeSortDir } as Prisma.DeliveryHistoryOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.deliveryHistory.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      select: {
        id: true,
        registrationCode: true,
        vendorName: true,
        driverName: true,
        driverPhone: true,
        vehiclePlate: true,
        receivingUnit: true,
        goodsType: true,
        vehicleType: true,
        autoWarehouse: true,
        finalStatus: true,
        closeReason: true,
        ticketNumber: true,
        assignedSlotCode: true,
        assignedSlotName: true,
        callCount: true,
        lastCalledAt: true,
        registeredAt: true,
        checkinTime: true,
        calledTime: true,
        receivingStartTime: true,
        completedTime: true,
        cancelledAt: true,
        expiredAt: true,
        archivedAt: true,
        durationWaitingMinutes: true,
        durationReceivingMinutes: true,
        note: true,
      },
    }),
    prisma.deliveryHistory.count({ where }),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  });
}));

// ─── Delivery History Events ──────────────────────────────────────────────────

router.get('/delivery/:id/events', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const history = await prisma.deliveryHistory.findUnique({
    where: { id: req.params.id },
    select: { businessLocationId: true },
  });
  if (!history) {
    res.status(404).json({ error: 'Không tìm thấy bản ghi lịch sử.' });
    return;
  }
  if (!enforceResourceScope(req, res, history.businessLocationId)) return;

  const events = await prisma.deliveryHistoryEvent.findMany({
    where: { deliveryHistoryId: req.params.id },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      eventType: true,
      fromStatus: true,
      toStatus: true,
      occurredAt: true,
      actorType: true,
      actorLabel: true,
      slotCode: true,
      slotName: true,
      message: true,
      reason: true,
    },
  });
  res.json(events);
}));

// ─── Audit Logs ───────────────────────────────────────────────────────────────

const AUDIT_SORT_FIELDS = new Set([
  'createdAt', 'actorType', 'action', 'targetType',
]);

router.get('/audit', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1', limit = '50',
    sortField = 'createdAt', sortDir = 'desc',
    from, to, actorType, action, targetType, search,
  } = req.query as Record<string, string>;

  const safeSortField = AUDIT_SORT_FIELDS.has(sortField) ? sortField : 'createdAt';
  const safeSortDir = sortDir === 'asc' ? 'asc' : 'desc';
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.AuditLogWhereInput = {};

  // Scope
  if (req.user?.role !== 'SUPERADMIN' && req.user?.businessLocationId) {
    where.businessLocationId = req.user.businessLocationId;
  }

  // Date range
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + 'T23:59:59.999Z') } : {}),
    };
  }

  // Filters
  if (actorType) where.actorType = actorType as AuditActorType;
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (targetType) where.targetType = { contains: targetType, mode: 'insensitive' };

  // Search
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { actorLabel: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
      { targetType: { contains: q, mode: 'insensitive' } },
      { targetId: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orderBy = { [safeSortField]: safeSortDir } as Prisma.AuditLogOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      select: {
        id: true,
        actorType: true,
        actorId: true,
        actorLabel: true,
        businessLocationId: true,
        unitConfigId: true,
        action: true,
        targetType: true,
        targetId: true,
        before: true,
        after: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  });
}));

export default router;
