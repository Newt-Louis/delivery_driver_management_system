import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { UserFormRequest } from '../modules/users/userFormRequest';
import * as userService from '../modules/users/userService';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    res.status(successStatus).json(await action);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

// GET /api/users/location-staff
router.get('/location-staff', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req, res) => {
  await respond(res, userService.listLocationStaff(req.user));
}));

// POST /api/users/location-staff
router.post('/location-staff', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = UserFormRequest.parseLocationStaffCreate(req.body);
  await respond(res, userService.createLocationStaff(body, req.user), 201);
}));

// PATCH /api/users/location-staff/:id
router.patch('/location-staff/:id', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = UserFormRequest.parseLocationStaffUpdate(req.body);
  await respond(res, userService.updateLocationStaff(req.params.id, body, req.user));
}));

// PATCH /api/users/location-staff/:id/reset-password
router.patch('/location-staff/:id/reset-password', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req, res) => {
  const { password } = UserFormRequest.parseResetPassword(req.body);
  await respond(res, userService.resetLocationStaffPassword(req.params.id, password, req.user));
}));

// DELETE /api/users/location-staff/:id
router.delete('/location-staff/:id', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req, res) => {
  await respond(res, userService.deleteLocationStaff(req.params.id, req.user));
}));

// GET /api/users
router.get('/', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (_req, res) => {
  res.json(await userService.listUsers());
}));

// POST /api/users
router.post('/', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req, res) => {
  const body = UserFormRequest.parseCreate(req.body);
  await respond(res, userService.createUser(body, req.user), 201);
}));

// PATCH /api/users/:id
router.patch('/:id', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req, res) => {
  const body = UserFormRequest.parseUpdate(req.body);
  await respond(res, userService.updateUser(req.params.id, body, req.user));
}));

// PATCH /api/users/:id/reset-password
router.patch('/:id/reset-password', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req, res) => {
  const { password } = UserFormRequest.parseResetPassword(req.body);
  await respond(res, userService.resetUserPassword(req.params.id, password, req.user));
}));

// PATCH /api/users/:id/regenerate
router.patch('/:id/regenerate', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req, res) => {
  await respond(res, userService.regenerateUser(req.params.id, req.user));
}));

// DELETE /api/users/:id
router.delete('/:id', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req, res) => {
  await respond(res, userService.deleteUser(req.params.id, req.user));
}));

export default router;
