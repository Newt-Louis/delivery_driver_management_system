import { Prisma, PrismaClient, ReceivingUnit } from '@prisma/client';
import { getVNDateKey, getVNDateRangeUtc } from '../lib/dateVN';

type RegistrationSequenceTransaction = Prisma.TransactionClient & {
  registrationSequence: PrismaClient['registrationSequence'];
};

const UNIT_PREFIX: Record<ReceivingUnit, string> = {
  [ReceivingUnit.EMART]:      'E',
  [ReceivingUnit.THISKYHALL]: 'T',
  [ReceivingUnit.TENANT]:     'M',
};

function dateCompact(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${year.slice(2)}${month}${day}`;
}

function codePrefix(unit: ReceivingUnit, dateKey: string): string {
  return `${UNIT_PREFIX[unit]}${dateCompact(dateKey)}`;
}

async function getExistingMaxRegistrationNumber(
  tx: Prisma.TransactionClient,
  registrationDate: string,
  receivingUnit: ReceivingUnit,
): Promise<number> {
  const { start, end } = getVNDateRangeUtc(registrationDate);
  const prefix = codePrefix(receivingUnit, registrationDate);
  const existing = await tx.deliveryRegistration.findMany({
    where: {
      receivingUnit,
      createdAt: { gte: start, lt: end },
      registrationCode: { startsWith: prefix },
    },
    select: { registrationCode: true },
  });

  return existing.reduce((max, row) => {
    const rawNumber = row.registrationCode.slice(prefix.length);
    const parsed = Number(rawNumber);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
}

export async function reserveRegistrationCode(
  tx: Prisma.TransactionClient,
  receivingUnit: ReceivingUnit,
  createdAt: Date = new Date(),
): Promise<string> {
  const registrationDate = getVNDateKey(createdAt);
  const existingMax = await getExistingMaxRegistrationNumber(tx, registrationDate, receivingUnit);

  const sequence = await (tx as RegistrationSequenceTransaction).registrationSequence.upsert({
    where: {
      registrationDate_receivingUnit: {
        registrationDate,
        receivingUnit,
      },
    },
    create: {
      registrationDate,
      receivingUnit,
      nextNumber: existingMax + 2,
    },
    update: {
      nextNumber: { increment: 1 },
    },
    select: { nextNumber: true },
  });

  const nextNumber = sequence.nextNumber - 1;
  return `${codePrefix(receivingUnit, registrationDate)}${String(nextNumber).padStart(3, '0')}`;
}
