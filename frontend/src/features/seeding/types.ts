export type SeedingType = 'registered-deliveries';

export interface SeedingOption {
  type: SeedingType;
  label: string;
  /** Shown in the confirmation popup; may depend on the caller's role. */
  confirmDescription: (role?: string) => string;
}

export interface SeedingUnitSummary {
  unitConfigId: string;
  unit: string;
  displayName: string;
  created: number;
  byVehicle: Record<'TRUCK' | 'MOTORBIKE', number>;
  byGoods: Record<'FRESH_FOOD' | 'GENERAL_GOODS' | 'THI_CONG' | 'AUTO_WAREHOUSE', number>;
  sharedOrderCodes: number;
}

export interface SeedingLocationSummary {
  businessLocationId: string;
  code: string;
  locationName: string;
  status: 'SEEDED' | 'SKIPPED' | 'FAILED';
  created: number;
  message?: string;
  units: SeedingUnitSummary[];
}

export interface RegisteredDeliverySeedResult {
  type: 'registered-deliveries';
  deliveryDate: string;
  perLocation: number;
  totalCreated: number;
  locations: SeedingLocationSummary[];
}

export type SeedingResult = RegisteredDeliverySeedResult;
