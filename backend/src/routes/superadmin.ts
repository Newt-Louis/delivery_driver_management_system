import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { SuperadminFormRequest } from '../modules/superadmin/superadminFormRequest';
import * as superadminService from '../modules/superadmin/superadminService';

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

router.use(authenticate, requireRole('SUPERADMIN'));

router.get('/overview', asyncHandler(async (_req, res) => {
  await respond(res, superadminService.overview());
}));

router.get('/business-locations', asyncHandler(async (_req, res) => {
  await respond(res, superadminService.listBusinessLocations());
}));

router.post('/business-locations', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseBusinessLocationCreate(req.body);
  await respond(res, superadminService.createBusinessLocation(body, req.user), 201);
}));

router.patch('/business-locations/:id', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseBusinessLocationUpdate(req.body);
  await respond(res, superadminService.updateBusinessLocation(req.params.id, body, req.user));
}));

router.delete('/business-locations/:id', asyncHandler(async (req, res) => {
  await respond(res, superadminService.deleteBusinessLocation(req.params.id, req.user));
}));

router.get('/unit-configs', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, superadminService.listUnitConfigs(query));
}));

router.post('/unit-configs', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseUnitConfigCreate(req.body);
  await respond(res, superadminService.createUnitConfig(body, req.user), 201);
}));

router.patch('/unit-configs/:id', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseUnitConfigUpdate(req.body);
  await respond(res, superadminService.updateUnitConfig(req.params.id, body, req.user));
}));

router.delete('/unit-configs/:id', asyncHandler(async (req, res) => {
  await respond(res, superadminService.deleteUnitConfig(req.params.id, req.user));
}));

router.get('/zones', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, Promise.resolve(superadminService.listZones(query)));
}));

router.get('/slots', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, Promise.resolve(superadminService.listSlots(query)));
}));

router.get('/goods-types', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, Promise.resolve(superadminService.listGoodsTypes(query)));
}));

router.get('/time-windows', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, Promise.resolve(superadminService.listTimeWindows(query)));
}));

router.get('/auto-warehouse-vendors', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, Promise.resolve(superadminService.listAutoWarehouseVendors(query)));
}));

router.post('/auto-warehouse-vendors', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseAutoWarehouseVendorCreate(req.body);
  await respond(res, superadminService.createAutoWarehouseVendor(body, req.user), 201);
}));

router.patch('/auto-warehouse-vendors/:id', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseAutoWarehouseVendorUpdate(req.body);
  await respond(res, superadminService.updateAutoWarehouseVendor(req.params.id, body, req.user));
}));

router.delete('/auto-warehouse-vendors/:id', asyncHandler(async (req, res) => {
  await respond(res, superadminService.deleteAutoWarehouseVendor(req.params.id, req.user));
}));

router.get('/devices', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, Promise.resolve(superadminService.listDevices(query)));
}));

router.post('/devices', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseDeviceCreate(req.body);
  await respond(res, superadminService.createDevice(body, req.user), 201);
}));

router.patch('/devices/:id', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseDeviceUpdate(req.body);
  await respond(res, superadminService.updateDevice(req.params.id, body, req.user));
}));

router.delete('/devices/:id', asyncHandler(async (req, res) => {
  await respond(res, superadminService.deleteDevice(req.params.id, req.user));
}));

router.get('/app-configs', asyncHandler(async (_req, res) => {
  await respond(res, superadminService.listAppConfigs());
}));

router.patch('/app-configs/:key', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseAppConfigUpdate(req.body);
  await respond(res, superadminService.updateAppConfig(req.params.key, body, req.user));
}));

router.post('/api-configs', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseApiConfigCreate(req.body);
  await respond(res, superadminService.createApiConfig(body, req.user), 201);
}));

router.delete('/api-configs/:name', asyncHandler(async (req, res) => {
  await respond(res, superadminService.deleteApiConfig(req.params.name, req.user));
}));

router.get('/receiving-time-configs', asyncHandler(async (req, res) => {
  const query = SuperadminFormRequest.parseLocationQuery(req.query);
  await respond(res, Promise.resolve(superadminService.listReceivingTimeConfigs(query)));
}));

router.post('/receiving-time-configs', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseReceivingTimeConfigCreate(req.body);
  await respond(res, superadminService.createReceivingTimeConfig(body, req.user), 201);
}));

router.patch('/receiving-time-configs/:id', asyncHandler(async (req, res) => {
  const body = SuperadminFormRequest.parseReceivingTimeConfigUpdate(req.body);
  await respond(res, superadminService.updateReceivingTimeConfig(req.params.id, body, req.user));
}));

router.delete('/receiving-time-configs/:id', asyncHandler(async (req, res) => {
  await respond(res, superadminService.deleteReceivingTimeConfig(req.params.id, req.user));
}));

export default router;
