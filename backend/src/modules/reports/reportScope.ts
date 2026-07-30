import { ReceivingUnit } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ReportScope } from './reportTypes';

type ReportScopeUser = {
  role: string;
  businessLocationId: string | null;
};

export async function resolveReportScope(
  user: ReportScopeUser | undefined,
  requestedUnit?: ReceivingUnit,
): Promise<ReportScope> {
  if (user?.role !== 'SUPERADMIN' && user?.businessLocationId) {
    const unitConfigs = await prisma.unitConfig.findMany({
      where: { businessLocationId: user.businessLocationId },
      select: { unit: true },
    });
    const allowedUnits = [...new Set(unitConfigs.map((config) => config.unit))];
    const unitFilter = requestedUnit && allowedUnits.includes(requestedUnit) ? requestedUnit : undefined;

    return {
      businessLocationId: user.businessLocationId,
      allowedUnits,
      unitFilter,
    };
  }

  return { unitFilter: requestedUnit };
}
