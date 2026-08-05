import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { getDefaultBusinessLocation } from '../lib/businessLocation';

const router = Router();

function fallbackUnitBrand(unit: string) {
  return {
    displayName: unit,
    shortName: unit,
    description: '',
    primaryColor: '#1C1C1C',
    icon: '📦',
  };
}

// GET /api/brand — public: mall branding + all active unit brandings in one business location
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const businessLocationId = typeof req.query.businessLocationId === 'string' ? req.query.businessLocationId : undefined;
  const location = businessLocationId
    ? await prisma.businessLocation.findFirst({ where: { id: businessLocationId, isActive: true } })
    : await getDefaultBusinessLocation();

  if (!location) {
    res.status(404).json({ error: 'Không tìm thấy khu vực kinh doanh.' });
    return;
  }

  const unitConfigs = await prisma.unitConfig.findMany({
    where: { businessLocationId: location.id, isActive: true },
    orderBy: [{ unit: 'asc' }],
    select: {
      id: true,
      unit: true,
      displayName: true,
      shortName: true,
      description: true,
      icon: true,
      logoUrl: true,
      primaryColor: true,
    },
  });

  const units: Record<string, object> = {};
  for (const cfg of unitConfigs) {
    const def = fallbackUnitBrand(cfg.unit);
    units[cfg.unit] = {
      id:           cfg.id,
      unit:         cfg.unit,
      displayName:  cfg?.displayName  || def.displayName,
      shortName:    cfg?.shortName    || def.shortName,
      description:  cfg?.description  || def.description,
      icon:         cfg?.icon         || def.icon,
      logoUrl:      cfg?.logoUrl      ?? null,
      primaryColor: cfg?.primaryColor || def.primaryColor,
    };
  }

  res.json({
    mall: {
      id:           location.id,
      code:         location.code,
      locationName: location.locationName,
      mallName:     location.locationName,
      address:      location.address,
      avatarUrl:    location.avatarUrl,
      logoUrl:      location.logoUrl,
      tagline:      location.tagline ?? 'Delivery Management System',
    },
    units,
  });
}));

// PATCH /api/brand/mall — admin: update mall branding
const mallSchema = z.object({
  mallName:   z.string().min(1).max(100).optional(),
  locationName: z.string().min(1).max(100).optional(),
  address:    z.string().max(250).optional(),
  avatarUrl:  z.string().nullable().optional(),
  logoUrl:    z.string().nullable().optional(),
  tagline:    z.string().max(200).nullable().optional(),
});

router.patch('/mall', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const data = mallSchema.parse(req.body);
  const location = await getDefaultBusinessLocation();
  const locationName = data.locationName ?? data.mallName;
  const updated = await prisma.businessLocation.update({
    where: { id: location.id },
    data: {
      ...(locationName !== undefined ? { locationName } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.tagline !== undefined ? { tagline: data.tagline } : {}),
    },
  });
  res.json({ ...updated, mallName: updated.locationName });
}));

export default router;
