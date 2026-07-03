import api from '../../lib/api';
import type { ReceivingUnit, UnitConfig, UnitGoodsType, SlotInfo, VehicleType, GoodsType } from '../../lib/types';

export type SlotAvailabilityParams = {
  date: string;
  goodsType: GoodsType;
  vehicleType: VehicleType;
  unitGoodsTypeId?: string;
};

export type RegisterDeliveryPayload = {
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
};

export type RegisterDeliveryResponse = {
  registrationCode: string;
};

export type VehicleAvailabilityOption = {
  vehicleType: VehicleType;
  slotCount: number;
  capacity: number;
};

export async function getUnitConfig(unit: ReceivingUnit): Promise<UnitConfig> {
  const res = await api.get(`/api/units/${unit}/config`);
  return res.data;
}

export async function getUnitGoodsTypes(unit: ReceivingUnit): Promise<UnitGoodsType[]> {
  const res = await api.get(`/api/units/${unit}/goods-types`);
  return res.data;
}

export async function getSlotAvailability(
  unit: ReceivingUnit,
  params: SlotAvailabilityParams,
): Promise<{ slots: SlotInfo[]; reason?: string }> {
  const res = await api.get(`/api/units/${unit}/slots`, { params });
  return res.data;
}

export async function getVehicleAvailability(
  unit: ReceivingUnit,
  params: { goodsType: GoodsType; unitGoodsTypeId?: string },
): Promise<{ vehicles: VehicleAvailabilityOption[]; reason?: string }> {
  const res = await api.get(`/api/units/${unit}/vehicle-availability`, { params });
  return res.data;
}

export async function checkAutoWarehouseVendor(code: string, unit: ReceivingUnit) {
  const res = await api.get('/api/aw-vendors/check', {
    params: { code, unit },
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
