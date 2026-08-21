import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { GoodsType, VehicleType } from '@prisma/client';
import { z } from 'zod';

const registerSchema = z.object({
  vendorName: z.string().optional().default(''),
  driverName: z.string().default(''),
  driverPhone: z.string().min(9, 'Số điện thoại không hợp lệ'),
  vehiclePlate: z.string().min(1, 'Biển số xe bắt buộc'),
  vehicleType: z.nativeEnum(VehicleType).default(VehicleType.OTHER),
  receivingUnit: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  businessLocationId: z.string().min(1).optional(),
  unitConfigId: z.string().min(1).optional(),
  goodsType: z.nativeEnum(GoodsType),
  unitGoodsTypeId: z.string().optional(),
  poNumber: z.string().optional().default(''),
  vendorCode: z.string().optional(),
  requestedTime: z.string().optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().optional(),
  quickVerificationToken: z.string().optional(),
});

const quickVerifySchema = z.object({
  code: z.string().min(1, 'Vui lòng nhập mã PO hoặc mã Thi Công'),
});

const checkInLookupSchema = z.object({
  registrationCode: z.string().optional(),
  vehiclePlate: z.string().optional(),
});

const callSchema = z.object({ slotId: z.string() });

const cancelSchema = z.object({
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do hủy'),
});

const publicCancelSchema = z.object({
  vehiclePlate: z.string().min(1, 'Biển số xe bắt buộc'),
  driverPhone: z.string().min(9, 'Số điện thoại không hợp lệ'),
  poNumber: z.string().min(1, 'Vui lòng nhập Số PO hoặc Mã số thi công'),
  registrationCode: z.string().min(1, 'Mã đăng ký bắt buộc'),
  requestedTime: z.string().optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type RegisterDeliveryPayload = z.infer<typeof registerSchema>;
export type QuickVerifyPayload = z.infer<typeof quickVerifySchema>;
export type CheckInLookupPayload = z.infer<typeof checkInLookupSchema>;
export type PublicCancelPayload = z.infer<typeof publicCancelSchema>;

export const DeliveryFormRequest = {
  parseAutoDispatchUnit: (unit: string): ReceivingUnitCode | null => (
    unit?.trim() ? unit.trim().toUpperCase() as ReceivingUnit : null
  ),
  parseRegister: (body: unknown): RegisterDeliveryPayload => registerSchema.parse(body),
  parseQuickVerify: (body: unknown): QuickVerifyPayload => quickVerifySchema.parse(body),
  parseListQuery: (query: Record<string, unknown>) => ({
    unit: typeof query.unit === 'string' ? query.unit.trim().toUpperCase() as ReceivingUnit : undefined,
    goodsType: typeof query.goodsType === 'string' ? query.goodsType as GoodsType : undefined,
    status: typeof query.status === 'string' ? query.status : undefined,
  }),
  parseCheckInLookup: (body: unknown): CheckInLookupPayload => checkInLookupSchema.parse(body),
  parseCallSlotId: (body: unknown): string => callSchema.parse(body).slotId,
  parseCancelReason: (body: unknown): string => cancelSchema.parse(body).reason,
  parsePublicCancel: (body: unknown): PublicCancelPayload => publicCancelSchema.parse(body),
};
