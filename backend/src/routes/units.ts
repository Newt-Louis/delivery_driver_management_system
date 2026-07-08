import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DeliveryStatus, GoodsType, Prisma, ReceivingUnit, SlotStatus, VehicleType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope, enforceResourceScope } from '../middleware/auth';
import { publicReadLimiter } from '../middleware/rateLimit';
import { getDefaultBusinessLocation, getUnitConfigForDefaultLocation } from '../lib/businessLocation';
import { recordAuditLog, userActor } from '../services/auditLog';

const router = Router();

async function resolveLocationId(req: Request): Promise<string> {
  if (req.user?.role === 'SUPERADMIN') {
    return req.scope?.businessLocationId ?? (await getDefaultBusinessLocation()).id;
  }
  return req.user!.businessLocationId!;
}

async function assertUnitInLocation(unit: ReceivingUnit, businessLocationId: string): Promise<boolean> {
  const config = await prisma.unitConfig.findUnique({
    where: { businessLocationId_unit: { businessLocationId, unit } },
    select: { id: true },
  });
  return !!config;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
}

function unitAcceptsGoods(config: { freshFoodEnabled: boolean; generalGoodsEnabled: boolean; thiCongEnabled: boolean }, goodsType: GoodsType): boolean {
  if (goodsType === GoodsType.FRESH_FOOD) return config.freshFoodEnabled;
  if (goodsType === GoodsType.GENERAL_GOODS || goodsType === GoodsType.AUTO_WAREHOUSE) return config.generalGoodsEnabled;
  if (goodsType === GoodsType.THI_CONG) return config.thiCongEnabled;
  return false;
}

async function getMatchingOperationalSlots(args: {
  unitConfigId: string;
  unit: ReceivingUnit;
  vehicleType?: VehicleType;
}) {
  return prisma.slot.findMany({
    where: {
      assignedUnit: args.unit,
      isActive: true,
      status: { notIn: [SlotStatus.MAINTENANCE, SlotStatus.RESERVED] },
      ...(args.vehicleType ? { vehicleType: args.vehicleType } : {}),
      zone: { unitConfigId: args.unitConfigId },
    },
    select: {
      id: true,
      vehicleType: true,
      maxCapacity: true,
      acceptedGoods: true,
      autoWarehouseOnly: true,
    },
  });
}

// GET /api/units/configs — Admin: all unit configs
router.get('/configs', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const locationId = await resolveLocationId(req);
  const configs = await prisma.unitConfig.findMany({
    where: { businessLocationId: locationId },
    orderBy: { unit: 'asc' },
  });
  res.json(configs);
}));

// ─── Time window CRUD ───────────────────────────────────────────────────────
// These routes MUST come before /:unit/* to avoid Express treating "time-windows"
// as a unit parameter.

const timeWindowSchema = z.object({
  goodsType:       z.enum(['FRESH_FOOD', 'GENERAL_GOODS', 'THI_CONG', 'AUTO_WAREHOUSE']),
  unitGoodsTypeId: z.string().optional(),
  label:           z.string().max(40).nullable().optional(),
  startTime:       z.string().regex(/^\d{2}:\d{2}$/),
  endTime:         z.string().regex(/^\d{2}:\d{2}$/),
  enabled:         z.boolean().optional(),
  sortOrder:       z.number().int().optional(),
});

// GET /api/units/:unit/time-windows?goodsType=FRESH_FOOD&unitGoodsTypeId=xxx
router.get('/:unit/time-windows', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const unit            = req.params.unit.toUpperCase() as ReceivingUnit;
  const locationId      = await resolveLocationId(req);
  if (!await assertUnitInLocation(unit, locationId)) { res.status(404).json({ error: 'Config not found' }); return; }
  const goodsType       = req.query.goodsType       as GoodsType | undefined;
  const unitGoodsTypeId = req.query.unitGoodsTypeId as string    | undefined;

  let where: Prisma.DeliveryTimeWindowWhereInput;

  if (unitGoodsTypeId) {
    where = { unitGoodsTypeId };
  } else if (goodsType) {
    where = { unit, goodsType, unitGoodsTypeId: null };
  } else {
    where = { unit };
  }

  const windows = await prisma.deliveryTimeWindow.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
  });
  res.json(windows);
}));

// POST /api/units/:unit/time-windows
router.post('/:unit/time-windows', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const locationId = await resolveLocationId(req);
  if (!await assertUnitInLocation(unit, locationId)) { res.status(404).json({ error: 'Config not found' }); return; }
  const data = timeWindowSchema.parse(req.body);
  const win = await prisma.deliveryTimeWindow.create({
    data: {
      unit,
      goodsType:       data.goodsType as GoodsType,
      unitGoodsTypeId: data.unitGoodsTypeId ?? null,
      label:           data.label ?? null,
      startTime:       data.startTime,
      endTime:         data.endTime,
      sortOrder:       data.sortOrder ?? 0,
    },
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'time_window.create',
    targetType: 'DeliveryTimeWindow',
    targetId: win.id,
    businessLocationId: locationId,
    after: { unit: win.unit, goodsType: win.goodsType, label: win.label, startTime: win.startTime, endTime: win.endTime },
  });
  res.status(201).json(win);
}));

// PATCH /api/units/time-windows/:id  (no /:unit prefix — id is sufficient)
router.patch('/time-windows/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.deliveryTimeWindow.findUnique({ where: { id: req.params.id }, select: { unit: true, goodsType: true, label: true, startTime: true, endTime: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const locationId = await resolveLocationId(req);
  if (!await assertUnitInLocation(existing.unit, locationId)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const data = timeWindowSchema.omit({ goodsType: true, unitGoodsTypeId: true }).partial().parse(req.body);
  const win = await prisma.deliveryTimeWindow.update({
    where: { id: req.params.id },
    data,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'time_window.update',
    targetType: 'DeliveryTimeWindow',
    targetId: win.id,
    businessLocationId: locationId,
    before: { unit: existing.unit, goodsType: existing.goodsType, label: existing.label, startTime: existing.startTime, endTime: existing.endTime },
    after: { unit: win.unit, goodsType: win.goodsType, label: win.label, startTime: win.startTime, endTime: win.endTime },
  });
  res.json(win);
}));

// DELETE /api/units/time-windows/:id
router.delete('/time-windows/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.deliveryTimeWindow.findUnique({ where: { id: req.params.id }, select: { unit: true, goodsType: true, label: true, startTime: true, endTime: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const locationId = await resolveLocationId(req);
  if (!await assertUnitInLocation(existing.unit, locationId)) { res.status(403).json({ error: 'Forbidden' }); return; }

  await prisma.deliveryTimeWindow.delete({ where: { id: req.params.id } });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'time_window.delete',
    targetType: 'DeliveryTimeWindow',
    targetId: req.params.id,
    businessLocationId: locationId,
    before: { unit: existing.unit, goodsType: existing.goodsType, label: existing.label, startTime: existing.startTime, endTime: existing.endTime },
  });
  res.status(204).end();
}));
// ────────────────────────────────────────────────────────────────────────────

// ─── Custom goods type CRUD ──────────────────────────────────────────────────

const unitGoodsTypeSchema = z.object({
  name:      z.string().min(1).max(60),
  emoji:     z.string().max(4).default('📦'),
  baseType:  z.enum(['FRESH_FOOD', 'GENERAL_GOODS', 'THI_CONG']),
  enabled:   z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// GET /api/units/:unit/goods-types?baseType=FRESH_FOOD&all=1
// Public — used by registration form (enabled only) and backoffice (all with ?all=1)
router.get('/:unit/goods-types', asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const baseType = req.query.baseType as GoodsType | undefined;
  const showAll  = req.query.all === '1';
  const where: { unit: ReceivingUnit; baseType?: GoodsType; enabled?: boolean } = { unit };
  if (baseType) where.baseType = baseType;
  if (!showAll)  where.enabled = true;
  const types = await prisma.unitGoodsType.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json(types);
}));

// POST /api/units/:unit/goods-types
router.post('/:unit/goods-types', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const locationId = await resolveLocationId(req);
  if (!await assertUnitInLocation(unit, locationId)) { res.status(404).json({ error: 'Config not found' }); return; }
  const data = unitGoodsTypeSchema.parse(req.body);
  const item = await prisma.unitGoodsType.create({
    data: { unit, name: data.name, emoji: data.emoji, baseType: data.baseType as GoodsType, sortOrder: data.sortOrder ?? 0 },
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'goods_type.create',
    targetType: 'UnitGoodsType',
    targetId: item.id,
    businessLocationId: locationId,
    after: { unit: item.unit, name: item.name, emoji: item.emoji, baseType: item.baseType },
  });
  res.status(201).json(item);
}));

// PATCH /api/units/goods-types/:id
router.patch('/goods-types/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unitGoodsType.findUnique({ where: { id: req.params.id }, select: { unit: true, name: true, emoji: true, baseType: true, enabled: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const locationId = await resolveLocationId(req);
  if (!await assertUnitInLocation(existing.unit, locationId)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const data = unitGoodsTypeSchema.omit({ baseType: true }).partial().parse(req.body);
  const item = await prisma.unitGoodsType.update({
    where: { id: req.params.id },
    data,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'goods_type.update',
    targetType: 'UnitGoodsType',
    targetId: item.id,
    businessLocationId: locationId,
    before: { name: existing.name, emoji: existing.emoji, baseType: existing.baseType, enabled: existing.enabled },
    after: { name: item.name, emoji: item.emoji, baseType: item.baseType, enabled: item.enabled },
  });
  res.json(item);
}));

// DELETE /api/units/goods-types/:id
router.delete('/goods-types/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unitGoodsType.findUnique({ where: { id: req.params.id }, select: { unit: true, name: true, emoji: true, baseType: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const locationId = await resolveLocationId(req);
  if (!await assertUnitInLocation(existing.unit, locationId)) { res.status(403).json({ error: 'Forbidden' }); return; }

  await prisma.unitGoodsType.delete({ where: { id: req.params.id } });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'goods_type.delete',
    targetType: 'UnitGoodsType',
    targetId: req.params.id,
    businessLocationId: locationId,
    before: { unit: existing.unit, name: existing.name, emoji: existing.emoji, baseType: existing.baseType },
  });
  res.status(204).end();
}));
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/units/:unit/config — Public: single unit config (strips API keys)
router.get('/:unit/config', asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const config = await getUnitConfigForDefaultLocation(unit);
  if (!config) { res.status(404).json({ error: 'Config not found' }); return; }

  const { vendorApiKey, poApiKey, ...safe } = config;
  void vendorApiKey; void poApiKey;
  res.json(safe);
}));

// GET /api/units/:unit/vehicle-availability?goodsType=FRESH_FOOD&unitGoodsTypeId=xxx
router.get('/:unit/vehicle-availability', publicReadLimiter, asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const goodsType = req.query.goodsType as GoodsType | undefined;

  if (!goodsType) {
    res.status(400).json({ error: 'goodsType required' });
    return;
  }

  const config = await getUnitConfigForDefaultLocation(unit);
  if (!config) { res.status(404).json({ error: 'Config not found' }); return; }

  if (!unitAcceptsGoods(config, goodsType)) {
    res.json({ vehicles: [], reason: 'Đơn vị này không nhận loại hàng đã chọn' });
    return;
  }

  const slots = await getMatchingOperationalSlots({
    unitConfigId: config.id,
    unit,
  });

  const capacityByVehicle = new Map<VehicleType, { slotCount: number; capacity: number }>();
  for (const slot of slots) {
    const current = capacityByVehicle.get(slot.vehicleType) ?? { slotCount: 0, capacity: 0 };
    capacityByVehicle.set(slot.vehicleType, {
      slotCount: current.slotCount + 1,
      capacity: current.capacity + slot.maxCapacity,
    });
  }

  const vehicleOrder: VehicleType[] = [VehicleType.TRUCK, VehicleType.MOTORBIKE, VehicleType.OTHER];
  const vehicles = vehicleOrder
    .map(vehicleType => {
      const stats = capacityByVehicle.get(vehicleType);
      return stats ? { vehicleType, ...stats } : null;
    })
    .filter(Boolean);

  res.json({
    vehicles,
    reason: vehicles.length === 0 ? 'Không có slot khả dụng cho loại hàng này' : undefined,
  });
}));

// GET /api/units/:unit/slots?date=YYYY-MM-DD&goodsType=FRESH_FOOD&vehicleType=TRUCK&unitGoodsTypeId=xxx
router.get('/:unit/slots', publicReadLimiter, asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const { date, goodsType, vehicleType, unitGoodsTypeId } = req.query as {
    date?: string; goodsType?: string; vehicleType?: string; unitGoodsTypeId?: string;
  };

  if (!date || !goodsType || !vehicleType) {
    res.status(400).json({ error: 'date, goodsType, vehicleType required' });
    return;
  }

  const config = await getUnitConfigForDefaultLocation(unit);
  if (!config) { res.status(404).json({ error: 'Config not found' }); return; }

  // Parse date in local timezone
  const [year, month, day] = date.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  const dayOfWeek = parsedDate.getDay(); // 0 = Sunday

  // Sunday restriction (Emart only)
  if (dayOfWeek === 0 && config.sundayFreshFoodOnly && goodsType !== 'FRESH_FOOD') {
    res.json({ slots: [], reason: 'Chủ nhật chỉ nhận hàng tươi sống' });
    return;
  }

  if (!unitAcceptsGoods(config, goodsType as GoodsType)) {
    res.json({ slots: [], reason: 'Đơn vị này không nhận loại hàng đã chọn' });
    return;
  }

  const isMotorbike = vehicleType === 'MOTORBIKE';
  const slotMinutes = isMotorbike ? config.motorbikeSlotMinutes : config.truckSlotMinutes;
  const matchingSlots = await getMatchingOperationalSlots({
    unitConfigId: config.id,
    unit,
    vehicleType: vehicleType as VehicleType,
  });
  const maxPerSlot = matchingSlots.reduce((sum, slot) => sum + slot.maxCapacity, 0);

  if (maxPerSlot <= 0) {
    res.json({ slots: [], reason: 'Không có slot khả dụng cho loại xe này' });
    return;
  }

  // Prefer windows scoped to the specific custom goods type; fall back to base-type windows.
  let timeWindows = unitGoodsTypeId
    ? await prisma.deliveryTimeWindow.findMany({
        where: { unitGoodsTypeId, enabled: true },
        orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
      })
    : await prisma.deliveryTimeWindow.findMany({
        where: { unit, goodsType: goodsType as GoodsType, unitGoodsTypeId: null, enabled: true },
        orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
      });

  if (timeWindows.length === 0 && unitGoodsTypeId) {
    // Fallback: if custom type has no windows, try base-type windows
    timeWindows = await prisma.deliveryTimeWindow.findMany({
      where: { unit, goodsType: goodsType as GoodsType, unitGoodsTypeId: null, enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
    });
  }

  if (timeWindows.length === 0) {
    res.json({ slots: [], reason: 'Chưa cấu hình khung giờ nhận hàng. Liên hệ quản trị viên.' });
    return;
  }

  // Fetch existing bookings for this day (using local date boundaries)
  const dayStart = new Date(year, month - 1, day, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59);

  // All goods types share the same physical capacity for the same unit + vehicle + time.
  // Goods type is used for eligibility/time-window/dispatch priority, not for splitting capacity.
  const bookings = await prisma.deliveryRegistration.findMany({
    where: {
      receivingUnit: unit,
      vehicleType: vehicleType as VehicleType,
      requestedTime: { gte: dayStart, lte: dayEnd },
      status: { in: [DeliveryStatus.REGISTERED, DeliveryStatus.WAITING, DeliveryStatus.CALLED, DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING] },
    },
    select: { requestedTime: true },
  });

  const slotCounts: Record<string, number> = {};
  for (const b of bookings) {
    if (!b.requestedTime) continue;
    const key = minutesToTime(b.requestedTime.getHours() * 60 + b.requestedTime.getMinutes());
    slotCounts[key] = (slotCounts[key] ?? 0) + 1;
  }

  const now = new Date();
  const isToday = now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const slots = [];
  for (const win of timeWindows) {
    const startMins = timeToMinutes(win.startTime);
    const endMins = timeToMinutes(win.endTime);
    let cur = startMins;
    while (cur + slotMinutes <= endMins) {
      const t = minutesToTime(cur);
      const booked = slotCounts[t] ?? 0;
      const isPast = isToday && cur <= nowMins;
      slots.push({ time: t, booked, maxPerSlot, available: !isPast && booked < maxPerSlot, isPast, windowLabel: win.label });
      cur += slotMinutes;
    }
  }

  res.json({ slots });
}));

// PATCH /api/units/:unit/config — Admin: upsert config
const unitConfigSchema = z.object({
  freshFoodEnabled:    z.boolean().optional(),
  generalGoodsEnabled: z.boolean().optional(),
  thiCongEnabled:      z.boolean().optional(),
  sundayFreshFoodOnly: z.boolean().optional(),
  truckSlotMinutes: z.number().int().min(15).max(120).optional(),
  motorbikeSlotMinutes: z.number().int().min(5).max(60).optional(),
  truckMaxPerSlot: z.number().int().min(1).max(20).optional(),
  motorbikeMaxPerSlot: z.number().int().min(1).max(20).optional(),
  vendorApiUrl: z.string().url().nullable().optional(),
  vendorApiKey: z.string().nullable().optional(),
  poApiUrl: z.string().url().nullable().optional(),
  poApiKey: z.string().nullable().optional(),
  displayName:  z.string().max(100).optional(),
  shortName:    z.string().max(40).optional(),
  description:  z.string().max(200).optional(),
  icon:         z.string().max(40).nullable().optional(),
  logoUrl:      z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.patch('/:unit/config', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const data = unitConfigSchema.parse(req.body);
  const locationId = await resolveLocationId(req);

  const existingConfig = await prisma.unitConfig.findUnique({
    where: { businessLocationId_unit: { businessLocationId: locationId, unit } },
    select: { id: true, freshFoodEnabled: true, generalGoodsEnabled: true, thiCongEnabled: true, sundayFreshFoodOnly: true, truckSlotMinutes: true, motorbikeSlotMinutes: true, displayName: true, shortName: true, icon: true },
  });

  const config = await prisma.unitConfig.upsert({
    where: {
      businessLocationId_unit: {
        businessLocationId: locationId,
        unit,
      },
    },
    create: { businessLocationId: locationId, unit, ...data },
    update: data,
  });

  const { vendorApiKey, poApiKey, ...safe } = config;
  void vendorApiKey; void poApiKey;
  await recordAuditLog({
    ...userActor(req.user),
    action: 'unit_config.update',
    targetType: 'UnitConfig',
    targetId: config.id,
    businessLocationId: locationId,
    before: existingConfig ? {
      freshFoodEnabled: existingConfig.freshFoodEnabled,
      generalGoodsEnabled: existingConfig.generalGoodsEnabled,
      thiCongEnabled: existingConfig.thiCongEnabled,
      sundayFreshFoodOnly: existingConfig.sundayFreshFoodOnly,
      truckSlotMinutes: existingConfig.truckSlotMinutes,
      motorbikeSlotMinutes: existingConfig.motorbikeSlotMinutes,
      displayName: existingConfig.displayName,
      shortName: existingConfig.shortName,
      icon: existingConfig.icon,
    } : undefined,
    after: {
      freshFoodEnabled: config.freshFoodEnabled,
      generalGoodsEnabled: config.generalGoodsEnabled,
      thiCongEnabled: config.thiCongEnabled,
      sundayFreshFoodOnly: config.sundayFreshFoodOnly,
      truckSlotMinutes: config.truckSlotMinutes,
      motorbikeSlotMinutes: config.motorbikeSlotMinutes,
      displayName: config.displayName,
      shortName: config.shortName,
      icon: config.icon,
    },
  });
  res.json(safe);
}));

// GET /api/units/:unit/vendors?search= — proxy to unit's vendor API
router.get('/:unit/vendors', asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const search = (req.query.search as string) ?? '';

  const config = await getUnitConfigForDefaultLocation(unit);
  if (!config?.vendorApiUrl) {
    res.json({ vendors: [], configured: false });
    return;
  }

  try {
    const url = new URL(config.vendorApiUrl);
    if (search) url.searchParams.set('search', search);
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (config.vendorApiKey) headers['Authorization'] = `Bearer ${config.vendorApiKey}`;

    const resp = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    res.json(data);
  } catch {
    res.json({ vendors: [], error: 'Không thể kết nối API nhà cung cấp' });
  }
}));

// GET /api/units/:unit/po?search=&vendorId= — proxy to PO API
router.get('/:unit/po', asyncHandler(async (req: Request, res: Response) => {
  const unit = req.params.unit.toUpperCase() as ReceivingUnit;
  const { search, vendorId } = req.query as { search?: string; vendorId?: string };

  const config = await getUnitConfigForDefaultLocation(unit);
  if (!config?.poApiUrl) {
    res.json({ pos: [], configured: false });
    return;
  }

  try {
    const url = new URL(config.poApiUrl);
    if (search) url.searchParams.set('search', search);
    if (vendorId) url.searchParams.set('vendorId', vendorId);
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (config.poApiKey) headers['Authorization'] = `Bearer ${config.poApiKey}`;

    const resp = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    res.json(data);
  } catch {
    res.json({ pos: [], error: 'Không thể kết nối API PO' });
  }
}));

export default router;
