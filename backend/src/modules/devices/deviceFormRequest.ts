import { DeviceType } from '@prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  code: z.string().min(2).max(40).toUpperCase(),
  name: z.string().min(1).max(100),
  businessLocationId: z.string().min(1),
  deviceType: z.nativeEnum(DeviceType).default(DeviceType.FIXED_DEVICE),
  deviceSecret: z.string().min(6, 'Device secret tối thiểu 6 ký tự').max(100),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.omit({ code: true, businessLocationId: true }).partial();

export type CreateDevicePayload = z.infer<typeof createSchema>;
export type UpdateDevicePayload = z.infer<typeof updateSchema>;

export const DeviceFormRequest = {
  parseCreate: (body: unknown): CreateDevicePayload => createSchema.parse(body),
  parseUpdate: (body: unknown): UpdateDevicePayload => updateSchema.parse(body),
};
