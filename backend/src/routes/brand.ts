import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ReceivingUnit } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const UNIT_DEFAULTS: Record<ReceivingUnit, { displayName: string; shortName: string; description: string; primaryColor: string }> = {
  EMART:      { displayName: 'Emart',             shortName: 'Emart',    description: 'Siêu thị',              primaryColor: '#FF9500' },
  THISKYHALL: { displayName: 'Thiskyhall',         shortName: 'Skyhall',  description: 'Trung tâm thương mại',  primaryColor: '#27A55E' },
  TENANT:     { displayName: 'Mall (Khách thuê)', shortName: 'Mall',     description: 'Khu vực khách thuê',    primaryColor: '#1C1C1C' },
};

// GET /api/brand — public: mall branding + all unit brandings
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const [mall, unitConfigs] = await Promise.all([
    prisma.mallConfig.findUnique({ where: { id: 'singleton' } }),
    prisma.unitConfig.findMany({ select: { unit: true, displayName: true, shortName: true, description: true, logoUrl: true, primaryColor: true } }),
  ]);

  const units: Record<string, object> = {};
  for (const u of Object.values(ReceivingUnit)) {
    const cfg = unitConfigs.find(c => c.unit === u);
    const def = UNIT_DEFAULTS[u];
    units[u] = {
      displayName:  cfg?.displayName  || def.displayName,
      shortName:    cfg?.shortName    || def.shortName,
      description:  cfg?.description  || def.description,
      logoUrl:      cfg?.logoUrl      ?? null,
      primaryColor: cfg?.primaryColor || def.primaryColor,
    };
  }

  res.json({
    mall: {
      mallName:   mall?.mallName   ?? 'THISO GROUP',
      logoUrl:    mall?.logoUrl    ?? null,
      tagline:    mall?.tagline    ?? 'Delivery Management System',
      kioskBgUrl: mall?.kioskBgUrl ?? null,
    },
    units,
  });
}));

// PATCH /api/brand/mall — admin: update mall branding
const mallSchema = z.object({
  mallName:   z.string().min(1).max(100).optional(),
  logoUrl:    z.string().nullable().optional(),
  tagline:    z.string().max(200).nullable().optional(),
  kioskBgUrl: z.string().nullable().optional(),
});

router.patch('/mall', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const data = mallSchema.parse(req.body);
  const mall = await prisma.mallConfig.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton', mallName: data.mallName ?? 'THISO GROUP', logoUrl: data.logoUrl ?? null, tagline: data.tagline ?? null },
    update: data,
  });
  res.json(mall);
}));

export default router;
