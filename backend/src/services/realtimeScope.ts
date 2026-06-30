import { ReceivingUnit } from '@prisma/client';
import { getUnitConfigForDefaultLocation } from '../lib/businessLocation';
import { prisma } from '../lib/prisma';
import type { SocketScope } from '../socket';

type DeliveryScopeInput = {
  receivingUnit: ReceivingUnit;
  assignedSlotId?: string | null;
};

export async function getScopeForSlot(slotId?: string | null): Promise<SocketScope> {
  if (!slotId) return {};

  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    select: {
      zone: {
        select: {
          unitConfigId: true,
          unitConfig: { select: { businessLocationId: true } },
        },
      },
    },
  });

  return {
    unitConfigId: slot?.zone.unitConfigId,
    businessLocationId: slot?.zone.unitConfig.businessLocationId,
  };
}

export async function getScopeForDelivery(delivery: DeliveryScopeInput): Promise<SocketScope> {
  const slotScope = await getScopeForSlot(delivery.assignedSlotId);
  if (slotScope.businessLocationId || slotScope.unitConfigId) return slotScope;

  const unitConfig = await getUnitConfigForDefaultLocation(delivery.receivingUnit);
  return {
    unitConfigId: unitConfig?.id,
    businessLocationId: unitConfig?.businessLocationId,
  };
}
