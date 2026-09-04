import bcrypt from 'bcryptjs';
import type { AuthUser } from '../../middleware/auth';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { assertCanAccessOperationalLocation } from '../../domain/permissionAssertions';
import { domainError } from '../shared/domainError';
import type { CreateDevicePayload, UpdateDevicePayload } from './deviceFormRequest';
import * as deviceRepository from './deviceRepository';

export function listDevices(user: AuthUser | undefined) {
  if (!user?.businessLocationId) throw domainError.forbidden('Tài khoản chưa có khu vực vận hành hiện tại.');
  const where: Record<string, unknown> = { businessLocationId: user.businessLocationId };
  return deviceRepository.listDevices(where);
}

export async function createDevice(body: CreateDevicePayload, user: AuthUser | undefined) {
  assertCanAccessOperationalLocation(user, body.businessLocationId);

  const location = await deviceRepository.findBusinessLocation(body.businessLocationId);
  if (!location) {
    throw domainError.badRequest('BusinessLocation không tồn tại.');
  }

  const exists = await deviceRepository.findDeviceByCode(body.code);
  if (exists) {
    throw domainError.conflict(`Mã thiết bị ${body.code} đã tồn tại.`);
  }

  const deviceSecretHash = await bcrypt.hash(body.deviceSecret, 10);
  const device = await deviceRepository.createDevice(body, deviceSecretHash);
  await recordAuditLog({
    ...userActor(user),
    action: 'device.create',
    targetType: 'Device',
    targetId: device.id,
    businessLocationId: device.businessLocationId,
    after: {
      code: device.code,
      name: device.name,
      deviceType: device.deviceType,
      isActive: device.isActive,
    },
  });
  return device;
}

export async function updateDevice(id: string, body: UpdateDevicePayload, user: AuthUser | undefined) {
  const existing = await deviceRepository.findDeviceById(id);
  if (!existing) {
    throw domainError.notFound('Device not found');
  }

  assertCanAccessOperationalLocation(user, existing.businessLocationId);

  const deviceSecretHash = body.deviceSecret
    ? await bcrypt.hash(body.deviceSecret, 10)
    : undefined;
  const device = await deviceRepository.updateDevice(id, body, deviceSecretHash);
  await recordAuditLog({
    ...userActor(user),
    action: 'device.update',
    targetType: 'Device',
    targetId: device.id,
    businessLocationId: device.businessLocationId,
    before: {
      code: existing.code,
      name: existing.name,
      deviceType: existing.deviceType,
      isActive: existing.isActive,
    },
    after: {
      code: device.code,
      name: device.name,
      deviceType: device.deviceType,
      isActive: device.isActive,
      secretRotated: Boolean(body.deviceSecret),
    },
  });
  return device;
}

export async function deactivateDevice(id: string, user: AuthUser | undefined) {
  const existing = await deviceRepository.findDeviceById(id);
  if (!existing) {
    throw domainError.notFound('Device not found');
  }

  assertCanAccessOperationalLocation(user, existing.businessLocationId);

  const device = await deviceRepository.deactivateDevice(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'device.deactivate',
    targetType: 'Device',
    targetId: device.id,
    businessLocationId: device.businessLocationId,
    before: {
      code: existing.code,
      name: existing.name,
      deviceType: existing.deviceType,
      isActive: existing.isActive,
    },
    after: {
      code: device.code,
      name: device.name,
      deviceType: device.deviceType,
      isActive: device.isActive,
    },
  });
  return { deactivated: true, device };
}
