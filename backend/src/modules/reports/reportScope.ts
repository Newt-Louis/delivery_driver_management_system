import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';

import type { ReportScope } from './reportTypes';

type ReportScopeUser = {
  role: string;
  businessLocationId: string | null;
  operationUnits?: Array<{
    id: string;
    unit?: string;
    code?: string;
    displayName: string;
    shortName: string;
    icon: string | null;
    logoUrl?: string | null;
    primaryColor?: string;
  }>;
};

export async function resolveReportScope(
  user: ReportScopeUser | undefined,
  requestedUnit?: ReceivingUnitCode,
): Promise<ReportScope> {
  if (user?.businessLocationId) {
    const operationUnits = user.operationUnits ?? [];

    const normalizedUnits = operationUnits.map((config) => ({
      ...config,
      unit: (config.unit ?? ('code' in config ? config.code : undefined)) as ReceivingUnitCode,
    }));
    const allowedUnits = [...new Set(normalizedUnits.map((config) => config.unit))];
    const unitFilter = requestedUnit && allowedUnits.includes(requestedUnit) ? requestedUnit : undefined;
    const unitConfigIds = normalizedUnits
      .filter((config) => !unitFilter || config.unit === unitFilter)
      .map((config) => config.id);
    const unitMeta = Object.fromEntries(normalizedUnits.map((config) => [config.unit, {
      id: config.id,
      unit: config.unit,
      displayName: config.displayName,
      shortName: config.shortName,
      icon: config.icon,
      logoUrl: config.logoUrl ?? null,
      primaryColor: config.primaryColor ?? '#1C1C1C',
    }]));

    return {
      businessLocationId: user.businessLocationId,
      allowedUnits,
      allowedUnitConfigIds: operationUnits.map((config) => config.id),
      unitConfigIds,
      unitFilter,
      unitMeta,
    };
  }

  return { unitFilter: requestedUnit };
}
