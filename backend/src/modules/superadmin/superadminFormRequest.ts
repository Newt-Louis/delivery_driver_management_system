import { DeviceType, GoodsType, VehicleType } from '@prisma/client';
import { z } from 'zod';

const nullableText = z.string().trim().nullable().optional();
const code = z.string().trim().min(1).max(50).transform((value) => value.toUpperCase());
const id = z.string().trim().min(1);

const unitConfigCreateSchema = z.object({
  businessLocationId: id,
  unit: code,
  displayName: z.string().trim().min(1).max(120),
  shortName: z.string().trim().max(30).optional().default(''),
  description: z.string().trim().max(300).optional().default(''),
  icon: nullableText,
  logoUrl: nullableText,
  primaryColor: z.string().trim().min(1).max(30).optional().default('#1C1C1C'),
  isActive: z.boolean().optional().default(true),
  freshFoodEnabled: z.boolean().optional().default(true),
  generalGoodsEnabled: z.boolean().optional().default(true),
  thiCongEnabled: z.boolean().optional().default(true),
  sundayFreshFoodOnly: z.boolean().optional().default(false),
  truckSlotMinutes: z.coerce.number().int().min(1).max(1440).optional().default(30),
  motorbikeSlotMinutes: z.coerce.number().int().min(1).max(1440).optional().default(15),
  truckMaxPerSlot: z.coerce.number().int().min(1).max(100).optional().default(1),
  motorbikeMaxPerSlot: z.coerce.number().int().min(1).max(100).optional().default(3),
  vendorApiUrl: nullableText,
  vendorApiKey: nullableText,
  poApiUrl: nullableText,
  poApiKey: nullableText,
});

export const SuperadminFormRequest = {
  parseLocationQuery(query: unknown) {
    return z.object({
      businessLocationId: z.string().trim().min(1).optional(),
      unitConfigId: z.string().trim().min(1).optional(),
      unit: z.string().trim().min(1).transform((value) => value.toUpperCase()).optional(),
    }).parse(query);
  },

  parseBusinessLocationCreate(body: unknown) {
    return z.object({
      code,
      locationName: z.string().trim().min(1).max(120),
      address: z.string().trim().max(300).optional().default(''),
      avatarUrl: nullableText,
      logoUrl: nullableText,
      tagline: nullableText,
      isActive: z.boolean().optional().default(true),
    }).parse(body);
  },

  parseBusinessLocationUpdate(body: unknown) {
    return z.object({
      code: code.optional(),
      locationName: z.string().trim().min(1).max(120).optional(),
      address: z.string().trim().max(300).optional(),
      avatarUrl: nullableText,
      logoUrl: nullableText,
      tagline: nullableText,
      isActive: z.boolean().optional(),
    }).parse(body);
  },

  parseUnitConfigCreate(body: unknown) {
    return unitConfigCreateSchema.parse(body);
  },

  parseUnitConfigUpdate(body: unknown) {
    return unitConfigCreateSchema.omit({ businessLocationId: true }).partial().parse(body);
  },

  parseAutoWarehouseVendorCreate(body: unknown) {
    return z.object({
      unitConfigId: id,
      vendorCode: code,
      vendorName: z.string().trim().min(1).max(200),
      active: z.boolean().optional().default(true),
      note: nullableText,
    }).parse(body);
  },

  parseAutoWarehouseVendorUpdate(body: unknown) {
    return z.object({
      vendorCode: code.optional(),
      vendorName: z.string().trim().min(1).max(200).optional(),
      active: z.boolean().optional(),
      note: nullableText,
    }).parse(body);
  },

  parseAppConfigUpdate(body: unknown) {
    return z.object({
      value: z.unknown(),
      category: z.string().trim().min(1).max(80).optional(),
      description: z.string().trim().max(500).optional(),
      isRuntimeEditable: z.boolean().optional(),
    }).parse(body);
  },

  parseReceivingTimeConfigCreate(body: unknown) {
    return z.object({
      unitConfigId: id,
      vehicleType: z.nativeEnum(VehicleType),
      goodsType: z.nativeEnum(GoodsType),
      configuredMinutes: z.coerce.number().min(1).max(1440),
      recommendedMinutes: z.coerce.number().min(1).max(1440).nullable().optional(),
    }).parse(body);
  },

  parseReceivingTimeConfigUpdate(body: unknown) {
    return z.object({
      configuredMinutes: z.coerce.number().min(1).max(1440).optional(),
      recommendedMinutes: z.coerce.number().min(1).max(1440).nullable().optional(),
      sampleCount: z.coerce.number().int().min(0).optional(),
      lastAnalyzedAt: z.coerce.date().nullable().optional(),
    }).parse(body);
  },

  parseDeviceCreate(body: unknown) {
    return z.object({
      code,
      name: z.string().trim().min(1).max(120),
      businessLocationId: id,
      deviceType: z.nativeEnum(DeviceType).optional().default(DeviceType.FIXED_DEVICE),
      deviceSecret: z.string().min(8).max(200),
      isActive: z.boolean().optional().default(true),
    }).parse(body);
  },

  parseDeviceUpdate(body: unknown) {
    return z.object({
      name: z.string().trim().min(1).max(120).optional(),
      deviceType: z.nativeEnum(DeviceType).optional(),
      deviceSecret: z.string().min(8).max(200).optional(),
      isActive: z.boolean().optional(),
    }).parse(body);
  },
};
