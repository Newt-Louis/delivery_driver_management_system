import { prisma } from '../../lib/prisma';
import type { CreateDevicePayload, UpdateDevicePayload } from './deviceFormRequest';

export const DEVICE_SAFE_SELECT = {
  id: true,
  code: true,
  name: true,
  businessLocationId: true,
  businessLocation: { select: { id: true, code: true, locationName: true } },
  deviceType: true,
  isActive: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function listDevices(where: Record<string, unknown>) {
  return prisma.device.findMany({
    where,
    select: DEVICE_SAFE_SELECT,
    orderBy: [{ isActive: 'desc' }, { deviceType: 'asc' }, { code: 'asc' }],
  });
}

export function findBusinessLocation(id: string) {
  return prisma.businessLocation.findUnique({ where: { id } });
}

export function findDeviceByCode(code: string) {
  return prisma.device.findUnique({ where: { code } });
}

export function findDeviceById(id: string) {
  return prisma.device.findUnique({ where: { id } });
}

export function createDevice(body: CreateDevicePayload, deviceSecretHash: string) {
  return prisma.device.create({
    data: {
      code: body.code,
      name: body.name,
      businessLocationId: body.businessLocationId,
      deviceType: body.deviceType,
      deviceSecretHash,
      isActive: body.isActive ?? true,
    },
    select: DEVICE_SAFE_SELECT,
  });
}

export function updateDevice(id: string, body: UpdateDevicePayload, deviceSecretHash?: string) {
  return prisma.device.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.deviceType !== undefined ? { deviceType: body.deviceType } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(deviceSecretHash ? { deviceSecretHash } : {}),
    },
    select: DEVICE_SAFE_SELECT,
  });
}

export function deactivateDevice(id: string) {
  return prisma.device.update({
    where: { id },
    data: { isActive: false },
    select: DEVICE_SAFE_SELECT,
  });
}
