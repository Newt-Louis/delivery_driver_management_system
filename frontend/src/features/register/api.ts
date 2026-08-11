import api from '../../lib/api';
import type { BusinessLocation, ReceivingUnit, UnitConfig, /* UnitGoodsType, */ SlotInfo, VehicleType, GoodsType } from '../../lib/types';

export type SlotAvailabilityParams = {
  date: string;
  goodsType: GoodsType;
  vehicleType: VehicleType;
  unitGoodsTypeId?: string;
};

export type DailyRegistrationStatsParams = {
  month: string;
  goodsType: GoodsType;
  vehicleType: VehicleType;
  unitGoodsTypeId?: string;
};

export type RegisterDeliveryPayload = {
  businessLocationId: string;
  unitConfigId: string;
  vendorName: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  vehicleType: VehicleType | '';
  receivingUnit: ReceivingUnit | '';
  goodsType: GoodsType | '';
  unitGoodsTypeId?: string;
  poNumber: string;
  vendorCode?: string;
  requestedTime?: string;
  deliveryDate?: string;
  note?: string;
  quickVerificationToken?: string;
};

export type RegisterDeliveryResponse = {
  registrationCode: string;
};

export type VehicleAvailabilityOption = {
  vehicleType: VehicleType;
  slotCount: number;
  capacity: number;
};

export type OrderCodeOption = {
  code: string;
  kind: 'PO' | 'TC';
};

export type QuickRegistrationKind = 'PO' | 'CONSTRUCTION';

export type QuickVerifyResponse = {
  kind: QuickRegistrationKind;
  orderCode: string;
  businessLocationId: string;
  businessLocationCode: string;
  businessLocationName: string;
  unitConfigId: string;
  receivingUnit: string;
  unitDisplayName: string;
  unitIcon: string | null;
  unitLogoUrl: string | null;
  goodsType: GoodsType;
  vehicleType: VehicleType;
  deliveryDate?: string;
  vendorCode?: string;
  vendorName?: string;
  title?: string;
  externalMessage?: string;
  verificationToken: string;
};

export type PublicUnitScope = {
  businessLocationId?: string;
  unitConfigId?: string;
};

export type DailyRegistrationStat = {
  date: string;
  registered: number;
  capacity: number;
  percent: number | null;
  level: 'none' | 'low' | 'medium' | 'high';
  available: boolean;
  reason?: string;
};

export async function getPublicBusinessLocations(): Promise<BusinessLocation[]> {
  const res = await api.get('/api/units/public/business-locations');
  return res.data;
}

export async function getPublicUnitConfigs(businessLocationId: string): Promise<UnitConfig[]> {
  const res = await api.get('/api/units/public/configs', { params: { businessLocationId } });
  return res.data;
}

export async function getUnitConfig(unit: ReceivingUnit, scope?: PublicUnitScope): Promise<UnitConfig> {
  const res = await api.get(`/api/units/${unit}/config`, { params: scope });
  return res.data;
}

// ⛔ Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa — hệ thống chỉ dùng 3 loại mặc định từ enum GoodsType.
// export async function getUnitGoodsTypes(unit: ReceivingUnit, scope?: PublicUnitScope): Promise<UnitGoodsType[]> {
//   const res = await api.get(`/api/units/${unit}/goods-types`, { params: scope });
//   return res.data;
// }

export async function getSlotAvailability(
  unit: ReceivingUnit,
  params: SlotAvailabilityParams,
  scope?: PublicUnitScope,
): Promise<{ slots: SlotInfo[]; reason?: string }> {
  const res = await api.get(`/api/units/${unit}/slots`, { params: { ...params, ...scope } });
  return res.data;
}

export async function getDailyRegistrationStats(
  unit: ReceivingUnit,
  params: DailyRegistrationStatsParams,
  scope?: PublicUnitScope,
): Promise<{ days: DailyRegistrationStat[]; reason?: string }> {
  const res = await api.get(`/api/units/${unit}/daily-registration-stats`, { params: { ...params, ...scope } });
  return res.data;
}

export async function getVehicleAvailability(
  unit: ReceivingUnit,
  params: { goodsType: GoodsType; unitGoodsTypeId?: string },
  scope?: PublicUnitScope,
): Promise<{ vehicles: VehicleAvailabilityOption[]; reason?: string }> {
  const res = await api.get(`/api/units/${unit}/vehicle-availability`, { params: { ...params, ...scope } });
  return res.data;
}

export async function getOrderCodes(search?: string): Promise<OrderCodeOption[]> {
  const res = await api.get('/api/units/order-codes', {
    params: search ? { search } : undefined,
  });
  return res.data.items ?? [];
}

export async function checkAutoWarehouseVendor(code: string, unit: ReceivingUnit, scope?: PublicUnitScope) {
  const res = await api.get('/api/aw-vendors/check', {
    params: { code, unit, ...scope },
  });
  return res.data as {
    isAutoWarehouse: boolean;
    vendor?: { vendorName?: string | null } | null;
  };
}

export async function registerDelivery(payload: RegisterDeliveryPayload): Promise<RegisterDeliveryResponse> {
  const res = await api.post('/api/deliveries/register', payload);
  return res.data;
}

export async function quickVerifyOrderCode(code: string): Promise<QuickVerifyResponse> {
  const res = await api.post('/api/deliveries/quick-verify', { code });
  return res.data;
}
