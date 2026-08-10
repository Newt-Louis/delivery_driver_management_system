import { GoodsType, SlotStatus, VehicleType } from '@prisma/client';
import { z } from 'zod';

const statusSchema = z.object({ status: z.nativeEnum(SlotStatus) });
const assignSchema = z.object({ deliveryId: z.string() });

const createSlotSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  assignedUnit: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  vehicleType: z.nativeEnum(VehicleType).default(VehicleType.TRUCK),
  acceptedGoods: z.array(z.nativeEnum(GoodsType)).default([]),
  goodsPriority: z.array(z.nativeEnum(GoodsType)).default([]),
  autoAssign: z.boolean().default(true),
  autoWarehouseOnly: z.boolean().default(false),
  maxCapacity: z.number().int().min(1).max(10).default(1),
  status: z.nativeEnum(SlotStatus).default(SlotStatus.AVAILABLE),
  zoneId: z.string().min(1),
});

const updateSlotSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  assignedUnit: z.string().trim().min(1).transform((value) => value.toUpperCase()).optional(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
  acceptedGoods: z.array(z.nativeEnum(GoodsType)).optional(),
  goodsPriority: z.array(z.nativeEnum(GoodsType)).optional(),
  autoAssign: z.boolean().optional(),
  autoWarehouseOnly: z.boolean().optional(),
  maxCapacity: z.number().int().min(1).max(10).optional(),
  status: z.nativeEnum(SlotStatus).optional(),
  isActive: z.boolean().optional(),
  zoneId: z.string().min(1).optional(),
});

export type CreateSlotPayload = z.infer<typeof createSlotSchema>;
export type UpdateSlotPayload = z.infer<typeof updateSlotSchema>;

export const SlotFormRequest = {
  parseStatus: (body: unknown): SlotStatus => statusSchema.parse(body).status,
  parseAssign: (body: unknown): string => assignSchema.parse(body).deliveryId,
  parseCreate: (body: unknown): CreateSlotPayload => createSlotSchema.parse(body),
  parseUpdate: (body: unknown): UpdateSlotPayload => updateSlotSchema.parse(body),
  parseForce: (query: Record<string, unknown>): boolean => query.force === 'true',
  parseActiveOnly: (query: Record<string, unknown>): boolean => query.activeOnly !== 'false',
};
