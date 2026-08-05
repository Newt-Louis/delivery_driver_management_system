import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
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

export default router;
