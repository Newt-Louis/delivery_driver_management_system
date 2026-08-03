export const LEGACY_UNIT_CODES = ['EMART', 'THISKYHALL', 'TENANT'] as const;

export type UnitCode = string;
export type ReceivingUnit = UnitCode;

// Compatibility object for old seed/test paths that still refer to ReceivingUnit.EMART.
// New runtime code should treat unit codes as database-owned strings.
export const ReceivingUnit: Record<(typeof LEGACY_UNIT_CODES)[number], UnitCode> = {
  EMART: 'EMART',
  THISKYHALL: 'THISKYHALL',
  TENANT: 'TENANT',
};

export function normalizeUnitCode(value: string): UnitCode {
  return value.trim().toUpperCase();
}
