import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../domain/unitCodes';
import { Prisma, PrismaClient, VehicleType } from '@prisma/client';
import { getVNDateKey, getVNDateRangeUtc } from '../lib/dateVN';

type TicketSequenceTransaction = Prisma.TransactionClient & {
  ticketSequence: PrismaClient['ticketSequence'];
};

async function getExistingMaxTicketNumber(
  tx: Prisma.TransactionClient,
  ticketDate: string,
  receivingUnit: ReceivingUnitCode,
  vehicleType: VehicleType,
): Promise<number> {
  const { start, end } = getVNDateRangeUtc(ticketDate);
  const maxRow = await tx.deliveryRegistration.findFirst({
    where: {
      receivingUnit,
      vehicleType,
      ticketNumber: { not: null },
      checkinTime: { gte: start, lt: end },
    },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });

  return maxRow?.ticketNumber ?? 0;
}

export async function reserveTicketNumber(
  tx: Prisma.TransactionClient,
  receivingUnit: ReceivingUnitCode,
  vehicleType: VehicleType,
  checkinTime: Date,
): Promise<number> {
  const ticketDate = getVNDateKey(checkinTime);
  const existingMax = await getExistingMaxTicketNumber(tx, ticketDate, receivingUnit, vehicleType);

  const sequence = await (tx as TicketSequenceTransaction).ticketSequence.upsert({
    where: {
      ticketDate_receivingUnit_vehicleType: {
        ticketDate,
        receivingUnit,
        vehicleType,
      },
    },
    create: {
      ticketDate,
      receivingUnit,
      vehicleType,
      nextNumber: existingMax + 2,
    },
    update: {
      nextNumber: { increment: 1 },
    },
    select: { nextNumber: true },
  });

  return sequence.nextNumber - 1;
}
