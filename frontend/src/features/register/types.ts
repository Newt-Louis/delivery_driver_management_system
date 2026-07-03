import type { GoodsType as AppGoodsType, ReceivingUnit, VehicleType as AppVehicleType } from '../../lib/types';

export type Unit = ReceivingUnit;
export type GoodsType = AppGoodsType;
export type VehicleType = AppVehicleType;

export interface FormState {
  receivingUnit: Unit | '';
  goodsType: GoodsType | '';
  unitGoodsTypeId: string;
  vehicleType: VehicleType | '';
  vendorName: string;
  vendorCode: string;
  poNumber: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  deliveryDate: string;
  timeSlot: string;
  note: string;
}

export interface SuccessInfo {
  code: string;
  vehiclePlate: string;
  vendorName: string;
  driverName: string;
  receivingUnit: Unit;
  goodsType: GoodsType | '';
  goodsTypeName: string;
  vehicleType: VehicleType | '';
  requestedTime: string;
}

export type RegisterFieldErrors = Partial<Record<keyof FormState, string>>;

export type SetFormField = (key: keyof FormState, val: string) => void;

export interface DateOption {
  value: string;
  label: string;
  sub: string;
}
