import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, enforceScope, requireRole } from '../middleware/auth';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { domainError } from '../modules/shared/domainError';
import { UnitFormRequest } from '../modules/units/unitFormRequest';
import * as unitService from '../modules/units/unitService';
import { publicReadLimiter } from '../middleware/rateLimit';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    const data = await action;
    if (successStatus === 204) {
      res.status(204).end();
      return;
    }
    res.status(successStatus).json(data);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

router.get('/configs', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req, res) => {
  await respond(res, unitService.listConfigs(req.user, req.scope));
}));

router.get('/order-codes', asyncHandler(async (req, res) => {
  const query = UnitFormRequest.parseOrderCodeQuery(req.query);
  await respond(res, Promise.resolve(unitService.listOrderCodes(query)));
}));

router.get('/public/business-locations', publicReadLimiter, asyncHandler(async (_req, res) => {
  await respond(res, Promise.resolve(unitService.listPublicBusinessLocations()));
}));

router.get('/public/configs', publicReadLimiter, asyncHandler(async (req, res) => {
  const query = UnitFormRequest.parsePublicLocationQuery(req.query);
  await respond(res, unitService.listPublicConfigs(query));
}));

router.get('/:unit/time-windows', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const query = UnitFormRequest.parseTimeWindowQuery(req.query);
  await respond(res, unitService.listTimeWindows(unit, query, req.user, req.scope));
}));

router.post('/:unit/time-windows', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const body = UnitFormRequest.parseCreateTimeWindow(req.body);
  await respond(res, unitService.createTimeWindow(unit, body, req.user, req.scope), 201);
}));

router.patch('/time-windows/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const body = UnitFormRequest.parseUpdateTimeWindow(req.body);
  await respond(res, unitService.updateTimeWindow(req.params.id, body, req.user, req.scope));
}));

router.delete('/time-windows/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  await respond(res, unitService.deleteTimeWindow(req.params.id, req.user, req.scope), 204);
}));

// Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa — hệ thống chỉ dùng 3 loại mặc định từ enum GoodsType.
router.get('/:unit/goods-types', asyncHandler(async (_req, res) => {
  sendDomainError(res, domainError.forbidden('Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa'));
}));

router.post('/:unit/goods-types', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (_req, res) => {
  sendDomainError(res, domainError.forbidden('Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa'));
}));

router.patch('/goods-types/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (_req, res) => {
  sendDomainError(res, domainError.forbidden('Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa'));
}));

router.delete('/goods-types/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (_req, res) => {
  sendDomainError(res, domainError.forbidden('Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa'));
}));

router.get('/:unit/config', asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const scope = UnitFormRequest.parsePublicUnitScopeQuery(req.query);
  await respond(res, unitService.getPublicConfig(unit, scope));
}));

router.get('/:unit/vehicle-availability', publicReadLimiter, asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const query = UnitFormRequest.parseVehicleAvailabilityQuery(req.query);
  const scope = UnitFormRequest.parsePublicUnitScopeQuery(req.query);
  await respond(res, unitService.getVehicleAvailability(unit, query, scope));
}));

router.get('/:unit/slots', publicReadLimiter, asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const query = UnitFormRequest.parseSlotsQuery(req.query);
  const scope = UnitFormRequest.parsePublicUnitScopeQuery(req.query);
  await respond(res, unitService.getAvailableSlots(unit, query, scope));
}));

router.patch('/:unit/config', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const body = UnitFormRequest.parseUnitConfig(req.body);
  await respond(res, unitService.updateConfig(unit, body, req.user, req.scope));
}));

router.get('/:unit/vendors', asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const query = UnitFormRequest.parseIntegrationQuery(req.query);
  await respond(res, unitService.getVendors(unit, query));
}));

router.get('/:unit/po', asyncHandler(async (req, res) => {
  const unit = UnitFormRequest.parseUnit(req.params.unit);
  const query = UnitFormRequest.parseIntegrationQuery(req.query);
  await respond(res, unitService.getPurchaseOrders(unit, query));
}));

export default router;
