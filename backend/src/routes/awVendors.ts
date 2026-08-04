import { normalizeUnitCode, type ReceivingUnit as ReceivingUnitCode } from '../domain/unitCodes';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, enforceScope, requireRole } from '../middleware/auth';
import { assertCanOperateUnit } from '../domain/permissionAssertions';
import { canOperateUnit } from '../domain/permissions';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { domainError } from '../modules/shared/domainError';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    const data = await action;
    res.status(successStatus).json(data);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

const unitConfigSelect = {
  id: true,
  unit: true,
  displayName: true,
  shortName: true,
  icon: true,
  logoUrl: true,
  primaryColor: true,
  businessLocationId: true,
} as const;

async function scopedUnitConfigs(req: Request, unit?: string) {
  const businessLocationId = req.scope?.businessLocationId;
  if (!businessLocationId) {
    throw domainError.forbidden('Không thể xác định khu vực vận hành.');
  }
  const configs = await prisma.unitConfig.findMany({
    where: {
      businessLocationId,
      isActive: true,
      ...(req.scope?.unitConfigId ? { id: req.scope.unitConfigId } : {}),
      ...(unit ? { unit } : {}),
    },
    select: unitConfigSelect,
    orderBy: [{ unit: 'asc' }],
  });
  if (req.user?.role === 'SUPERADMIN') return configs;
  return configs.filter((config) => canOperateUnit(req.user, config.id));
}

async function resolveScopedUnitConfig(req: Request, unitConfigId?: string, unit?: string) {
  const configs = await scopedUnitConfigs(req, unit);
  const config = unitConfigId
    ? configs.find((item) => item.id === unitConfigId)
    : configs[0];
  if (!config) {
    throw domainError.badRequest('Đơn vị không tồn tại hoặc bạn không có quyền thao tác.');
  }
  assertCanOperateUnit(req.user, config.id);
  return config;
}

async function getScopedVendor(req: Request, id: string) {
  const vendor = await prisma.autoWarehouseVendor.findUnique({
    where: { id },
    include: { unitConfig: { select: unitConfigSelect } },
  });
  if (!vendor) throw domainError.notFound('Không tìm thấy nhà cung cấp.');
  if (!vendor.unitConfigId || !vendor.unitConfig) {
    throw domainError.forbidden('Nhà cung cấp chưa được gắn với đơn vị động.');
  }
  if (vendor.unitConfig.businessLocationId !== req.scope?.businessLocationId) {
    throw domainError.forbidden('Nhà cung cấp không thuộc khu vực hiện tại.');
  }
  assertCanOperateUnit(req.user, vendor.unitConfigId);
  return vendor;
}

// GET /api/aw-vendors — admin location only, returns active + inactive vendors in scoped units
router.get('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  await respond(res, (async () => {
    const unit = typeof req.query.unit === 'string' ? normalizeUnitCode(req.query.unit) : undefined;
    const configs = await scopedUnitConfigs(req, unit);
    const unitConfigIds = configs.map((config) => config.id);
    if (unitConfigIds.length === 0) return [];

    const vendors = await prisma.autoWarehouseVendor.findMany({
      where: { unitConfigId: { in: unitConfigIds } },
      include: { unitConfig: { select: unitConfigSelect } },
      orderBy: [{ unit: 'asc' }, { vendorCode: 'asc' }],
    });
    return vendors;
  })());
}));

// GET /api/aw-vendors/check?code=xxx&unit=EMART&unitConfigId=... — public, check active vendor code
router.get('/check', asyncHandler(async (req: Request, res: Response) => {
  const { code, unit, unitConfigId, businessLocationId } = req.query as {
    code?: string;
    unit?: string;
    unitConfigId?: string;
    businessLocationId?: string;
  };
  if (!code || !unit) {
    res.status(400).json({ error: 'code and unit are required' });
    return;
  }
  const normalizedUnit = normalizeUnitCode(unit);
  const unitConfig = unitConfigId || businessLocationId
    ? await prisma.unitConfig.findFirst({
        where: {
          unit: normalizedUnit,
          isActive: true,
          businessLocation: { isActive: true },
          ...(unitConfigId ? { id: unitConfigId } : {}),
          ...(businessLocationId ? { businessLocationId } : {}),
        },
        select: { id: true },
      })
    : null;
  if ((unitConfigId || businessLocationId) && !unitConfig) {
    res.status(404).json({ error: 'Unit config not found' });
    return;
  }
  const vendors = await prisma.autoWarehouseVendor.findMany({
    where: {
      vendorCode: code.toUpperCase().trim(),
      unit: normalizedUnit,
      ...(unitConfig ? { unitConfigId: unitConfig.id } : {}),
      active: true,
    },
    take: 1,
  });
  const vendor = vendors[0] ?? null;
  res.json({ isAutoWarehouse: !!vendor, vendor });
}));

const createSchema = z.object({
  unitConfigId: z.string().optional(),
  unit: z.string().trim().min(1).optional().transform((value) => value ? normalizeUnitCode(value) : undefined),
  vendorCode: z.string().min(1).max(50),
  vendorName: z.string().min(1).max(200),
  active: z.boolean().default(true),
  note: z.string().optional(),
}).refine((body) => !!body.unitConfigId || !!body.unit, {
  message: 'unitConfigId hoặc unit là bắt buộc.',
});

// POST /api/aw-vendors — admin only
router.post('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  await respond(res, (async () => {
    const body = createSchema.parse(req.body);
    const unitConfig = await resolveScopedUnitConfig(req, body.unitConfigId, body.unit);
    const vendorCode = body.vendorCode.toUpperCase().trim();

    const exists = await prisma.autoWarehouseVendor.findFirst({
      where: { unitConfigId: unitConfig.id, vendorCode },
    });
    if (exists) {
      throw domainError.conflict(`Mã NCC "${vendorCode}" đã tồn tại cho đơn vị này.`);
    }

    return prisma.autoWarehouseVendor.create({
      data: {
        unit: unitConfig.unit as ReceivingUnitCode,
        unitConfigId: unitConfig.id,
        vendorCode,
        vendorName: body.vendorName,
        active: body.active,
        note: body.note || undefined,
      },
      include: { unitConfig: { select: unitConfigSelect } },
    });
  })(), 201);
}));

const updateSchema = z.object({
  vendorName: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
  note: z.string().optional().nullable(),
});

// PATCH /api/aw-vendors/:id — admin only
router.patch('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  await respond(res, (async () => {
    await getScopedVendor(req, req.params.id);
    const body = updateSchema.parse(req.body);
    return prisma.autoWarehouseVendor.update({
      where: { id: req.params.id },
      data: body,
      include: { unitConfig: { select: unitConfigSelect } },
    });
  })());
}));

// DELETE /api/aw-vendors/:id — admin only
router.delete('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  await respond(res, (async () => {
    await getScopedVendor(req, req.params.id);
    await prisma.autoWarehouseVendor.delete({ where: { id: req.params.id } });
    return { deleted: true };
  })());
}));

export default router;
