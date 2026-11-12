import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { SeedingFormRequest } from '../modules/seeding/seedingFormRequest';
import * as seedingService from '../modules/seeding/seedingService';

const router = Router();

// Not behind enforceScope on purpose: SUPERADMIN seeds every active location
// even without a selected operational location. ADMIN_LOC is scoped to its own
// businessLocationId inside the service.
router.post('/run', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = SeedingFormRequest.parseRun(req.body);
  try {
    res.status(201).json(await seedingService.runSeeding(body.type, req.user));
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}));

export default router;
