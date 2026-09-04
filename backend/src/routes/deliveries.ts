import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, enforceScope, requireRole, resolvePublicScope } from '../middleware/auth';
import { publicWriteLimiter } from '../middleware/rateLimit';
import { DeliveryFormRequest } from '../modules/deliveries/deliveryFormRequest';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import * as deliveryService from '../modules/deliveries/deliveryService';
import { verifyQuickRegistrationCode } from '../modules/deliveries/quickRegistrationService';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    res.status(successStatus).json(await action);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

// POST /api/deliveries/auto-dispatch/:unit  — manually trigger auto-assign for a unit
router.post('/auto-dispatch/:unit', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  const unit = DeliveryFormRequest.parseAutoDispatchUnit(req.params.unit);
  if (!unit) {
    res.status(400).json({ error: 'Đơn vị không hợp lệ' });
    return;
  }
  await respond(res, deliveryService.autoDispatch(unit, req.user, req.scope));
}));

// POST /api/deliveries/register
router.post('/register', publicWriteLimiter, asyncHandler(async (req, res) => {
  const body = DeliveryFormRequest.parseRegister(req.body);
  await respond(res, deliveryService.registerDelivery(body), 201);
}));

// POST /api/deliveries/quick-verify
router.post('/quick-verify', publicWriteLimiter, asyncHandler(async (req, res) => {
  const body = DeliveryFormRequest.parseQuickVerify(req.body);
  await respond(res, verifyQuickRegistrationCode(body.code));
}));

// POST /api/deliveries/public-cancel
router.post('/public-cancel', publicWriteLimiter, asyncHandler(async (req, res) => {
  const body = DeliveryFormRequest.parsePublicCancel(req.body);
  await respond(res, deliveryService.publicCancel(body));
}));

// GET /api/deliveries
router.get('/', authenticate, enforceScope, asyncHandler(async (req, res) => {
  const query = DeliveryFormRequest.parseListQuery(req.query as Record<string, unknown>);
  res.json(await deliveryService.listDeliveries({ ...query, scope: req.scope }));
}));

// GET /api/deliveries/queue
router.get('/queue', resolvePublicScope, asyncHandler(async (req, res) => {
  res.json(await deliveryService.getQueue(req.scope));
}));

// PATCH /api/deliveries/check-in-lookup
router.patch('/check-in-lookup', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN'), asyncHandler(async (req, res) => {
  const body = DeliveryFormRequest.parseCheckInLookup(req.body);
  await respond(res, deliveryService.checkInLookup(body, req.user));
}));

// GET /api/deliveries/:id
router.get('/:id', authenticate, enforceScope, asyncHandler(async (req, res) => {
  await respond(res, deliveryService.getDeliveryDetails(req.params.id, req.user));
}));

// PATCH /api/deliveries/:id/check-in
router.patch('/:id/check-in', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN'), asyncHandler(async (req, res) => {
  await respond(res, deliveryService.checkInById(req.params.id, req.user));
}));

// PATCH /api/deliveries/:id/call
router.patch('/:id/call', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  const slotId = DeliveryFormRequest.parseCallSlotId(req.body);
  await respond(res, deliveryService.callDelivery(req.params.id, slotId, req.user));
}));

// PATCH /api/deliveries/:id/start-receiving
router.patch('/:id/start-receiving', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  await respond(res, deliveryService.startReceiving(req.params.id, req.user));
}));

// PATCH /api/deliveries/:id/complete
router.patch('/:id/complete', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  await respond(res, deliveryService.complete(req.params.id, req.user));
}));

// PATCH /api/deliveries/:id/cancel
router.patch('/:id/cancel', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  const reason = DeliveryFormRequest.parseCancelReason(req.body);
  await respond(res, deliveryService.cancel(req.params.id, reason, req.user));
}));

export default router;
