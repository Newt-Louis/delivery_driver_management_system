import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope, enforceResourceScope } from '../middleware/auth';
import { HistoryFormRequest } from '../modules/history/historyFormRequest';

const router = Router();

// ─── Delivery History ─────────────────────────────────────────────────────────

router.get('/delivery', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const form = HistoryFormRequest.parseDeliveryHistoryQuery(req.query as Record<string, unknown>);

  const where: Prisma.DeliveryHistoryWhereInput = {};

  // Scope
  if (req.scope?.businessLocationId) {
    where.businessLocationId = req.scope.businessLocationId;
  }
  const operationUnitIds = req.user?.role === 'SUPERADMIN'
    ? undefined
    : req.user?.operationUnits?.filter((unit) => unit.isActive).map((unit) => unit.id);
  if (req.scope?.unitConfigId) {
    where.unitConfigId = req.scope.unitConfigId;
  } else if (operationUnitIds) {
    where.unitConfigId = operationUnitIds.length > 0 ? { in: operationUnitIds } : '__NO_UNIT_SCOPE__';
  }

  // Date range
  if (form.from || form.to) {
    where.registeredAt = {
      ...(form.from ? { gte: form.from } : {}),
      ...(form.to ? { lte: form.to } : {}),
    };
  }

  // Filters
  if (form.finalStatus) where.finalStatus = form.finalStatus;
  if (form.receivingUnit) where.receivingUnit = form.receivingUnit;
  if (form.goodsType) where.goodsType = form.goodsType;
  if (form.vehicleType) where.vehicleType = form.vehicleType;

  // Search
  if (form.search) {
    const q = form.search;
    where.OR = [
      { vendorName: { contains: q, mode: 'insensitive' } },
      { driverName: { contains: q, mode: 'insensitive' } },
      { vehiclePlate: { contains: q, mode: 'insensitive' } },
      { registrationCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orderBy = { [form.sortField]: form.sortDir } as Prisma.DeliveryHistoryOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.deliveryHistory.findMany({
      where,
      orderBy,
      skip: form.skip,
      take: form.limit,
      select: {
        id: true,
        registrationCode: true,
        vendorName: true,
        driverName: true,
        driverPhone: true,
        vehiclePlate: true,
        receivingUnit: true,
        unitConfigId: true,
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

  const unitConfigIds = [...new Set(items.map((item) => item.unitConfigId).filter(Boolean))] as string[];
  const unitConfigs = unitConfigIds.length
    ? await prisma.unitConfig.findMany({
        where: { id: { in: unitConfigIds } },
        select: {
          id: true,
          unit: true,
          displayName: true,
          shortName: true,
          icon: true,
          logoUrl: true,
          primaryColor: true,
          businessLocationId: true,
        },
      })
    : [];
  const unitConfigById = new Map(unitConfigs.map((unit) => [unit.id, unit]));

  res.json({
    items: items.map((item) => ({
      ...item,
      unitConfig: item.unitConfigId ? unitConfigById.get(item.unitConfigId) ?? null : null,
    })),
    total,
    page: form.page,
    limit: form.limit,
    pages: Math.ceil(total / form.limit),
  });
}));

// ─── Delivery History Events ──────────────────────────────────────────────────

router.get('/delivery/:id/events', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const history = await prisma.deliveryHistory.findUnique({
    where: { id: req.params.id },
    select: { businessLocationId: true, unitConfigId: true },
  });
  if (!history) {
    res.status(404).json({ error: 'Không tìm thấy bản ghi lịch sử.' });
    return;
  }
  if (!enforceResourceScope(req, res, history.businessLocationId)) return;
  if (req.user?.role !== 'SUPERADMIN') {
    const allowed = req.user?.operationUnits?.some((unit) => unit.isActive && unit.id === history.unitConfigId);
    if (!allowed) {
      res.status(403).json({ error: 'Bạn không có quyền xem lịch sử của đơn vị này.' });
      return;
    }
  }

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

router.get('/audit', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const form = HistoryFormRequest.parseAuditHistoryQuery(req.query as Record<string, unknown>);

  const where: Prisma.AuditLogWhereInput = {};

  // Scope
  if (req.scope?.businessLocationId) {
    where.businessLocationId = req.scope.businessLocationId;
  }
  const operationUnitIds = req.user?.role === 'SUPERADMIN'
    ? undefined
    : req.user?.operationUnits?.filter((unit) => unit.isActive).map((unit) => unit.id);
  if (req.scope?.unitConfigId) {
    where.unitConfigId = req.scope.unitConfigId;
  } else if (operationUnitIds) {
    where.unitConfigId = operationUnitIds.length > 0 ? { in: operationUnitIds } : '__NO_UNIT_SCOPE__';
  }

  // Date range
  if (form.from || form.to) {
    where.createdAt = {
      ...(form.from ? { gte: form.from } : {}),
      ...(form.to ? { lte: form.to } : {}),
    };
  }

  // Filters
  if (form.actorType) where.actorType = form.actorType;
  if (form.action) where.action = { contains: form.action, mode: 'insensitive' };
  if (form.targetType) where.targetType = { contains: form.targetType, mode: 'insensitive' };

  // Search
  if (form.search) {
    const q = form.search;
    where.OR = [
      { actorLabel: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
      { targetType: { contains: q, mode: 'insensitive' } },
      { targetId: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orderBy = { [form.sortField]: form.sortDir } as Prisma.AuditLogOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy,
      skip: form.skip,
      take: form.limit,
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
    page: form.page,
    limit: form.limit,
    pages: Math.ceil(total / form.limit),
  });
}));

export default router;
