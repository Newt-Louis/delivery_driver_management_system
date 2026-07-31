import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, enforceScope, requireRole } from '../middleware/auth';
import { DeviceFormRequest } from '../modules/devices/deviceFormRequest';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import * as deviceService from '../modules/devices/deviceService';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    res.status(successStatus).json(await action);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

router.get('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  res.json(await deviceService.listDevices(req.user));
}));

router.post('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = DeviceFormRequest.parseCreate(req.body);
  await respond(res, deviceService.createDevice(body, req.user), 201);
}));

router.patch('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = DeviceFormRequest.parseUpdate(req.body);
  await respond(res, deviceService.updateDevice(req.params.id, body, req.user));
}));

router.delete('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  await respond(res, deviceService.deactivateDevice(req.params.id, req.user));
}));

export default router;
