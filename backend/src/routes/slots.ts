import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, enforceScope, requireRole } from '../middleware/auth';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { SlotFormRequest } from '../modules/slots/slotFormRequest';
import * as slotService from '../modules/slots/slotService';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    res.status(successStatus).json(await action);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

// GET /api/slots — active slots (Dashboard, SlotManagement, CallModal)
router.get('/', authenticate, enforceScope, asyncHandler(async (req, res) => {
  res.json(await slotService.listSlots(true, req.scope, req.user));
}));

// GET /api/slots/all — all slots including inactive (admin backoffice)
router.get('/all', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  res.json(await slotService.listSlots(false, req.scope, req.user));
}));

// PATCH /api/slots/:id/status
router.patch('/:id/status', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  const status = SlotFormRequest.parseStatus(req.body);
  await respond(res, slotService.updateSlotStatus(req.params.id, status, req.user));
}));

// POST /api/slots/:id/reconcile — recompute AVAILABLE/OCCUPIED from active deliveries.
router.post('/:id/reconcile', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  const force = SlotFormRequest.parseForce(req.query as Record<string, unknown>);
  await respond(res, slotService.reconcileSlot(req.params.id, force, req.user));
}));

// POST /api/slots/reconcile — admin maintenance endpoint for all slots.
router.post('/reconcile', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req, res) => {
  const activeOnly = SlotFormRequest.parseActiveOnly(req.query as Record<string, unknown>);
  const force = SlotFormRequest.parseForce(req.query as Record<string, unknown>);
  await respond(res, slotService.reconcileSlots(activeOnly, force));
}));

// PATCH /api/slots/:id/assign
router.patch('/:id/assign', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req, res) => {
  const deliveryId = SlotFormRequest.parseAssign(req.body);
  await respond(res, slotService.assignDeliveryToSlot(req.params.id, deliveryId, req.user));
}));

// POST /api/slots
router.post('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = SlotFormRequest.parseCreate(req.body);
  await respond(res, slotService.createSlot(body, req.user), 201);
}));

// PATCH /api/slots/:id
router.patch('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = SlotFormRequest.parseUpdate(req.body);
  await respond(res, slotService.updateSlot(req.params.id, body, req.user));
}));

// DELETE /api/slots/:id
router.delete('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  await respond(res, slotService.deleteSlot(req.params.id, req.user));
}));

export default router;
