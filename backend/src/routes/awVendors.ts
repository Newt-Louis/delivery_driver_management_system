import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ReceivingUnit } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/aw-vendors — admin only, returns all (active + inactive)
router.get('/', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const unit = req.query.unit as string | undefined;
  const vendors = await prisma.autoWarehouseVendor.findMany({
    where: unit ? { unit: unit as ReceivingUnit } : undefined,
    orderBy: [{ unit: 'asc' }, { vendorCode: 'asc' }],
  });
  res.json(vendors);
}));

// GET /api/aw-vendors/check?code=xxx&unit=EMART — public, check active vendor code
router.get('/check', asyncHandler(async (req: Request, res: Response) => {
  const { code, unit } = req.query as { code?: string; unit?: string };
  if (!code || !unit) {
    res.status(400).json({ error: 'code and unit are required' });
    return;
  }
  const vendor = await prisma.autoWarehouseVendor.findFirst({
    where: {
      vendorCode: code.toUpperCase().trim(),
      unit: unit as ReceivingUnit,
      active: true,
    },
  });
  res.json({ isAutoWarehouse: !!vendor, vendor: vendor ?? null });
}));

const createSchema = z.object({
  unit: z.nativeEnum(ReceivingUnit),
  vendorCode: z.string().min(1).max(50),
  vendorName: z.string().min(1).max(200),
  active: z.boolean().default(true),
  note: z.string().optional(),
});

// POST /api/aw-vendors — admin only
router.post('/', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const body = createSchema.parse(req.body);
  const normalized = { ...body, vendorCode: body.vendorCode.toUpperCase().trim() };

  const exists = await prisma.autoWarehouseVendor.findFirst({
    where: { unit: normalized.unit, vendorCode: normalized.vendorCode },
  });
  if (exists) {
    res.status(409).json({ error: 'Conflict', message: `Mã NCC "${normalized.vendorCode}" đã tồn tại cho đơn vị này.` });
    return;
  }

  const vendor = await prisma.autoWarehouseVendor.create({ data: normalized });
  res.status(201).json(vendor);
}));

const updateSchema = z.object({
  vendorName: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
  note: z.string().optional().nullable(),
});

// PATCH /api/aw-vendors/:id — admin only
router.patch('/:id', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const body = updateSchema.parse(req.body);
  const vendor = await prisma.autoWarehouseVendor.update({ where: { id: req.params.id }, data: body });
  res.json(vendor);
}));

// DELETE /api/aw-vendors/:id — admin only
router.delete('/:id', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  await prisma.autoWarehouseVendor.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

export default router;
