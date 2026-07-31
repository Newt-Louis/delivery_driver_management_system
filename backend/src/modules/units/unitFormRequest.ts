import { GoodsType, ReceivingUnit, VehicleType } from '@prisma/client';
import { z } from 'zod';

export class UnitRequestError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

const timeWindowSchema = z.object({
  goodsType: z.nativeEnum(GoodsType),
  unitGoodsTypeId: z.string().optional(),
  label: z.string().max(40).nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateTimeWindowSchema = timeWindowSchema
  .omit({ goodsType: true, unitGoodsTypeId: true })
  .partial();

const timeWindowQuerySchema = z.object({
  goodsType: z.nativeEnum(GoodsType).optional(),
  unitGoodsTypeId: z.string().optional(),
});

const unitGoodsTypeSchema = z.object({
  name: z.string().min(1).max(60),
  emoji: z.string().max(4).default('\u{1F4E6}'),
  baseType: z.enum([GoodsType.FRESH_FOOD, GoodsType.GENERAL_GOODS, GoodsType.THI_CONG]),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateUnitGoodsTypeSchema = unitGoodsTypeSchema
  .omit({ baseType: true })
  .partial();

const goodsTypeQuerySchema = z.object({
  baseType: z.nativeEnum(GoodsType).optional(),
  all: z.string().optional(),
});

const vehicleAvailabilityQuerySchema = z.object({
  goodsType: z.nativeEnum(GoodsType, { required_error: 'goodsType required' }),
  unitGoodsTypeId: z.string().optional(),
});

const slotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goodsType: z.nativeEnum(GoodsType),
  vehicleType: z.nativeEnum(VehicleType),
  unitGoodsTypeId: z.string().optional(),
});

const unitConfigSchema = z.object({
  freshFoodEnabled: z.boolean().optional(),
  generalGoodsEnabled: z.boolean().optional(),
  thiCongEnabled: z.boolean().optional(),
  sundayFreshFoodOnly: z.boolean().optional(),
  truckSlotMinutes: z.number().int().min(15).max(120).optional(),
  motorbikeSlotMinutes: z.number().int().min(5).max(60).optional(),
  truckMaxPerSlot: z.number().int().min(1).max(20).optional(),
  motorbikeMaxPerSlot: z.number().int().min(1).max(20).optional(),
  vendorApiUrl: z.string().url().nullable().optional(),
  vendorApiKey: z.string().nullable().optional(),
  poApiUrl: z.string().url().nullable().optional(),
  poApiKey: z.string().nullable().optional(),
  displayName: z.string().max(100).optional(),
  shortName: z.string().max(40).optional(),
  description: z.string().max(200).optional(),
  icon: z.string().max(40).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const integrationQuerySchema = z.object({
  search: z.string().optional(),
  vendorId: z.string().optional(),
});

const orderCodeQuerySchema = z.object({
  kind: z.enum(['PO', 'TC']).optional(),
  search: z.string().optional(),
});

export type TimeWindowPayload = z.infer<typeof timeWindowSchema>;
export type UpdateTimeWindowPayload = z.infer<typeof updateTimeWindowSchema>;
export type TimeWindowQuery = z.infer<typeof timeWindowQuerySchema>;
export type UnitGoodsTypePayload = z.infer<typeof unitGoodsTypeSchema>;
export type UpdateUnitGoodsTypePayload = z.infer<typeof updateUnitGoodsTypeSchema>;
export type GoodsTypeQuery = z.infer<typeof goodsTypeQuerySchema>;
export type VehicleAvailabilityQuery = z.infer<typeof vehicleAvailabilityQuerySchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type UnitConfigPayload = z.infer<typeof unitConfigSchema>;
export type IntegrationQuery = z.infer<typeof integrationQuerySchema>;
export type OrderCodeQuery = z.infer<typeof orderCodeQuerySchema>;

export const UnitFormRequest = {
  parseUnit: (unit: unknown): ReceivingUnit => (
    z.nativeEnum(ReceivingUnit).parse(typeof unit === 'string' ? unit.toUpperCase() : unit)
  ),
  parseTimeWindowQuery: (query: unknown): TimeWindowQuery => timeWindowQuerySchema.parse(query),
  parseCreateTimeWindow: (body: unknown): TimeWindowPayload => timeWindowSchema.parse(body),
  parseUpdateTimeWindow: (body: unknown): UpdateTimeWindowPayload => updateTimeWindowSchema.parse(body),
  parseGoodsTypeQuery: (query: unknown): GoodsTypeQuery => goodsTypeQuerySchema.parse(query),
  parseCreateGoodsType: (body: unknown): UnitGoodsTypePayload => unitGoodsTypeSchema.parse(body),
  parseUpdateGoodsType: (body: unknown): UpdateUnitGoodsTypePayload => updateUnitGoodsTypeSchema.parse(body),
  parseVehicleAvailabilityQuery: (query: unknown): VehicleAvailabilityQuery => {
    const raw = query as Record<string, unknown>;
    if (!raw.goodsType) throw new UnitRequestError('goodsType required');
    return vehicleAvailabilityQuerySchema.parse(query);
  },
  parseSlotsQuery: (query: unknown): SlotsQuery => {
    const raw = query as Record<string, unknown>;
    if (!raw.date || !raw.goodsType || !raw.vehicleType) {
      throw new UnitRequestError('date, goodsType, vehicleType required');
    }
    return slotsQuerySchema.parse(query);
  },
  parseUnitConfig: (body: unknown): UnitConfigPayload => unitConfigSchema.parse(body),
  parseIntegrationQuery: (query: unknown): IntegrationQuery => integrationQuerySchema.parse(query),
  parseOrderCodeQuery: (query: unknown): OrderCodeQuery => orderCodeQuerySchema.parse(query),
};
