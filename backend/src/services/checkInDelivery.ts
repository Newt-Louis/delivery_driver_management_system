import { DeliveryStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { reserveTicketNumber } from './ticketSequence';

type DeliveryFindArgs = {
  include?: Prisma.DeliveryRegistrationInclude;
};

export async function checkInDelivery<TArgs extends DeliveryFindArgs>(args: {
  deliveryId: string;
  resultArgs: TArgs;
  now?: Date;
}): Promise<{
  checkedIn: boolean;
  delivery: Prisma.DeliveryRegistrationGetPayload<TArgs> | null;
}> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "delivery_registrations" WHERE "id" = ${args.deliveryId} FOR UPDATE
    `;

    const current = await tx.deliveryRegistration.findUnique({
      where: { id: args.deliveryId },
      ...args.resultArgs,
    } as Prisma.DeliveryRegistrationFindUniqueArgs) as Prisma.DeliveryRegistrationGetPayload<TArgs> | null;

    if (!current) return { checkedIn: false, delivery: null };
    const currentRecord = current as Prisma.DeliveryRegistrationGetPayload<Prisma.DeliveryRegistrationDefaultArgs>;
    if (currentRecord.status === DeliveryStatus.WAITING || currentRecord.status !== DeliveryStatus.REGISTERED) {
      return { checkedIn: false, delivery: current };
    }

    const checkinTime = args.now ?? new Date();
    const ticketNumber = await reserveTicketNumber(tx, currentRecord.receivingUnit, currentRecord.vehicleType, checkinTime);
    const updated = await tx.deliveryRegistration.update({
      where: { id: currentRecord.id },
      data: { status: DeliveryStatus.WAITING, checkinTime, ticketNumber },
      ...args.resultArgs,
    } as Prisma.DeliveryRegistrationUpdateArgs) as Prisma.DeliveryRegistrationGetPayload<TArgs>;

    return { checkedIn: true, delivery: updated };
  });
}
