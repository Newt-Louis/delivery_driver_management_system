import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, enforceScope, requireRole } from '../middleware/auth';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { ZoneFormRequest } from '../modules/zones/zoneFormRequest';
import * as zoneService from '../modules/zones/zoneService';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    res.status(successStatus).json(await action);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

// GET /api/zones — all zones with slot counts
router.get('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  res.json(await zoneService.listZones(req.scope, req.user));
}));

// POST /api/zones — create zone (admin)
router.post('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = ZoneFormRequest.parseCreate(req.body);
  await respond(res, zoneService.createZone(body, req.user), 201);
}));

// PATCH /api/zones/:id — update zone (admin)
router.patch('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = ZoneFormRequest.parseUpdate(req.body);
  await respond(res, zoneService.updateZone(req.params.id, body, req.user));
}));

// DELETE /api/zones/:id — only if no slots assigned (admin)
router.delete('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  await respond(res, zoneService.deleteZone(req.params.id, req.user));
}));

export default router;
