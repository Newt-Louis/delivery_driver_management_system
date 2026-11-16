import type { DeliveryRegistration, Prisma, RegistrationDeviceType, RegistrationSource } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getVNDateKey, getVNDateRangeUtc } from '../../lib/dateVN';

type RegistrationHistoryClient = Pick<Prisma.TransactionClient, 'registrationHistory'>;

function snapshotFromDelivery(delivery: DeliveryRegistration, businessLocationId: string) {
  return {
    deliveryRegistrationId: delivery.id,
    registrationCode: delivery.registrationCode,
    businessLocationId,
    unitConfigId: delivery.unitConfigId,
    receivingUnit: delivery.receivingUnit,
    vendorName: delivery.vendorName,
    vendorCode: delivery.vendorCode,
    poNumber: delivery.poNumber,
    driverName: delivery.driverName,
    driverPhone: delivery.driverPhone,
    vehiclePlate: delivery.vehiclePlate,
    vehicleType: delivery.vehicleType,
    goodsType: delivery.goodsType,
    originalGoodsType: delivery.originalGoodsType,
    unitGoodsTypeId: delivery.unitGoodsTypeId,
    autoWarehouse: delivery.autoWarehouse,
    requestedTime: delivery.requestedTime,
    note: delivery.note,
    registeredAt: delivery.createdAt,
  };
}

/** Ghi lại một lượt đăng ký thành công, cùng transaction với dòng vận hành. */
export function recordRegistration(
  client: RegistrationHistoryClient,
  delivery: DeliveryRegistration,
  args: {
    businessLocationId: string;
    registrationSource: RegistrationSource;
    deviceType: RegistrationDeviceType | null;
    userAgent: string | null;
  },
) {
  return client.registrationHistory.create({
    data: {
      ...snapshotFromDelivery(delivery, args.businessLocationId),
      registrationSource: args.registrationSource,
      deviceType: args.deviceType,
      userAgent: args.userAgent,
    },
  });
}

/**
 * Đánh dấu lượt cũ đã bị thay thế. Lượt đăng ký trước khi có bảng này chưa có
 * dòng lịch sử, nên tạo snapshot từ dòng vận hành trước khi dòng đó bị xóa.
 */
export async function markSuperseded(
  client: RegistrationHistoryClient,
  previous: DeliveryRegistration,
  args: { businessLocationId: string; replacement: DeliveryRegistration; supersededAt: Date },
) {
  const supersession = {
    supersededAt: args.supersededAt,
    supersededByCode: args.replacement.registrationCode,
    supersededByRegistrationId: args.replacement.id,
  };
  const existing = await client.registrationHistory.findUnique({
    where: { registrationCode: previous.registrationCode },
    select: { id: true },
  });
  if (existing) {
    return client.registrationHistory.update({ where: { id: existing.id }, data: supersession });
  }
  return client.registrationHistory.create({
    data: { ...snapshotFromDelivery(previous, args.businessLocationId), ...supersession },
  });
}

export type SupersededRegistration = {
  registrationCode: string;
  businessLocationId: string;
  vehiclePlate: string;
  registeredAt: Date;
  supersededAt: Date;
  /** Lượt đăng ký mới nhất còn hiệu lực của cùng biển số, khu vực và ngày. */
  current: { registrationCode: string; registeredAt: Date } | null;
  /** Tổng số lần đăng ký thành công của biển số trong ngày đó. */
  registrationCount: number;
};

export async function findSupersededRegistration(
  registrationCode: string,
  businessLocationId?: string,
): Promise<SupersededRegistration | null> {
  const row = await prisma.registrationHistory.findUnique({
    where: { registrationCode },
    select: { registrationCode: true, businessLocationId: true, vehiclePlate: true, registeredAt: true, supersededAt: true },
  });
  if (!row?.supersededAt) return null;
  if (businessLocationId && row.businessLocationId !== businessLocationId) return null;

  const { start, end } = getVNDateRangeUtc(getVNDateKey(row.registeredAt));
  const sameDayPlate = {
    businessLocationId: row.businessLocationId,
    vehiclePlate: row.vehiclePlate,
    registeredAt: { gte: start, lt: end },
  };
  const [current, registrationCount] = await Promise.all([
    prisma.registrationHistory.findFirst({
      where: { ...sameDayPlate, supersededAt: null },
      orderBy: { registeredAt: 'desc' },
      select: { registrationCode: true, registeredAt: true },
    }),
    prisma.registrationHistory.count({ where: sameDayPlate }),
  ]);

  return { ...row, supersededAt: row.supersededAt, current, registrationCount };
}

const LIST_SELECT = {
  id: true,
  registrationCode: true,
  businessLocationId: true,
  unitConfigId: true,
  receivingUnit: true,
  vendorName: true,
  vendorCode: true,
  poNumber: true,
  driverName: true,
  driverPhone: true,
  vehiclePlate: true,
  vehicleType: true,
  goodsType: true,
  autoWarehouse: true,
  requestedTime: true,
  note: true,
  registrationSource: true,
  deviceType: true,
  registeredAt: true,
  supersededAt: true,
  supersededByCode: true,
} satisfies Prisma.RegistrationHistorySelect;

export async function listRegistrationHistory(args: {
  where: Prisma.RegistrationHistoryWhereInput;
  orderBy: Prisma.RegistrationHistoryOrderByWithRelationInput;
  skip: number;
  take: number;
}) {
  const [items, total] = await Promise.all([
    prisma.registrationHistory.findMany({
      where: args.where,
      orderBy: [args.orderBy, { id: 'desc' }],
      skip: args.skip,
      take: args.take,
      select: LIST_SELECT,
    }),
    prisma.registrationHistory.count({ where: args.where }),
  ]);
  return { items, total, dailyCounts: await countDailyRegistrations(items) };
}

function dailyKey(row: { businessLocationId: string; vehiclePlate: string; registeredAt: Date }) {
  return `${row.businessLocationId}|${row.vehiclePlate}|${getVNDateKey(row.registeredAt)}`;
}

/** Số lần đăng ký trong ngày của từng biển số xuất hiện trong trang hiện tại. */
async function countDailyRegistrations(
  items: Array<{ businessLocationId: string; vehiclePlate: string; registeredAt: Date }>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (items.length === 0) return counts;

  const dayKeys = items.map((item) => getVNDateKey(item.registeredAt)).sort();
  const start = getVNDateRangeUtc(dayKeys[0]).start;
  const end = getVNDateRangeUtc(dayKeys[dayKeys.length - 1]).end;
  const rows = await prisma.registrationHistory.findMany({
    where: {
      businessLocationId: { in: [...new Set(items.map((item) => item.businessLocationId))] },
      vehiclePlate: { in: [...new Set(items.map((item) => item.vehiclePlate))] },
      registeredAt: { gte: start, lt: end },
    },
    select: { businessLocationId: true, vehiclePlate: true, registeredAt: true },
  });
  for (const row of rows) {
    const key = dailyKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function dailyCountFor(
  counts: Map<string, number>,
  row: { businessLocationId: string; vehiclePlate: string; registeredAt: Date },
): number {
  return counts.get(dailyKey(row)) ?? 1;
}
