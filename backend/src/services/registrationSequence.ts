import { Prisma, PrismaClient } from '@prisma/client';
import { getVNDateKey, getVNDateRangeUtc } from '../lib/dateVN';

type RegistrationSequenceTransaction = Prisma.TransactionClient & {
  registrationSequence: PrismaClient['registrationSequence'];
};

function dateCompact(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${year.slice(2)}${month}${day}`;
}

function normalizeCodeSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

export function registrationCodePrefix(args: {
  businessLocationCode: string;
  unitConfigId: string;
  registrationDate: string;
}): string {
  const locationCode = normalizeCodeSegment(args.businessLocationCode) || 'LOC';
  const unitConfigSuffix = normalizeCodeSegment(args.unitConfigId).slice(-4) || 'UNIT';
  return `${locationCode}${unitConfigSuffix}${dateCompact(args.registrationDate)}`;
}

export function formatRegistrationCode(args: {
  businessLocationCode: string;
  unitConfigId: string;
  registrationDate: string;
  sequenceNumber: number;
}): string {
  return `${registrationCodePrefix(args)}${String(args.sequenceNumber).padStart(3, '0')}`;
}

async function getExistingMaxRegistrationNumber(
  tx: Prisma.TransactionClient,
  registrationDate: string,
  unitConfigId: string,
  businessLocationCode: string,
): Promise<number> {
  const { start, end } = getVNDateRangeUtc(registrationDate);
  const prefix = registrationCodePrefix({ businessLocationCode, unitConfigId, registrationDate });
  const existing = await tx.deliveryRegistration.findMany({
    where: {
      unitConfigId,
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
  args: {
    unitConfigId: string;
    businessLocationCode: string;
    receivingUnit: string;
  },
  createdAt: Date = new Date(),
): Promise<string> {
  const registrationDate = getVNDateKey(createdAt);
  const existingMax = await getExistingMaxRegistrationNumber(
    tx,
    registrationDate,
    args.unitConfigId,
    args.businessLocationCode,
  );

  const sequence = await (tx as RegistrationSequenceTransaction).registrationSequence.upsert({
    where: {
      registrationDate_unitConfigId: {
        registrationDate,
        unitConfigId: args.unitConfigId,
      },
    },
    create: {
      registrationDate,
      receivingUnit: args.receivingUnit,
      unitConfigId: args.unitConfigId,
      nextNumber: existingMax + 2,
    },
    update: {
      nextNumber: { increment: 1 },
    },
    select: { nextNumber: true },
  });

  const nextNumber = sequence.nextNumber - 1;
  return formatRegistrationCode({
    businessLocationCode: args.businessLocationCode,
    unitConfigId: args.unitConfigId,
    registrationDate,
    sequenceNumber: nextNumber,
  });
}
