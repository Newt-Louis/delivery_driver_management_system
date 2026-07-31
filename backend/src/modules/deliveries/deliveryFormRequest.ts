import { GoodsType, ReceivingUnit, VehicleType } from '@prisma/client';
import { z } from 'zod';

const validUnits = ['EMART', 'THISKYHALL', 'TENANT'] as const;

const registerSchema = z.object({
  vendorName: z.string().min(1, 'Tên nhà cung cấp bắt buộc'),
  driverName: z.string().min(1, 'Tên tài xế bắt buộc'),
  driverPhone: z.string().min(9, 'Số điện thoại không hợp lệ'),
  vehiclePlate: z.string().min(1, 'Biển số xe bắt buộc'),
  vehicleType: z.nativeEnum(VehicleType).default(VehicleType.OTHER),
  receivingUnit: z.nativeEnum(ReceivingUnit),
  goodsType: z.nativeEnum(GoodsType),
  unitGoodsTypeId: z.string().optional(),
  poNumber: z.string().optional(),
  vendorCode: z.string().optional(),
  requestedTime: z.string().optional(),
  deliveryDate: z.string().optional(),
  note: z.string().optional(),
});

const checkInLookupSchema = z.object({
  registrationCode: z.string().optional(),
  vehiclePlate: z.string().optional(),
});

const callSchema = z.object({ slotId: z.string() });

const cancelSchema = z.object({
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do hủy'),
});

export type RegisterDeliveryPayload = z.infer<typeof registerSchema>;
export type CheckInLookupPayload = z.infer<typeof checkInLookupSchema>;

export const DeliveryFormRequest = {
  parseAutoDispatchUnit: (unit: string): ReceivingUnit | null => (
    (validUnits as readonly string[]).includes(unit) ? unit as ReceivingUnit : null
  ),
  parseRegister: (body: unknown): RegisterDeliveryPayload => registerSchema.parse(body),
  parseListQuery: (query: Record<string, unknown>) => ({
    unit: typeof query.unit === 'string' ? query.unit as ReceivingUnit : undefined,
    goodsType: typeof query.goodsType === 'string' ? query.goodsType as GoodsType : undefined,
    status: typeof query.status === 'string' ? query.status : undefined,
  }),
  parseCheckInLookup: (body: unknown): CheckInLookupPayload => checkInLookupSchema.parse(body),
  parseCallSlotId: (body: unknown): string => callSchema.parse(body).slotId,
  parseCancelReason: (body: unknown): string => cancelSchema.parse(body).reason,
};
