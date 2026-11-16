import { DeliveryHistoryEventType, DeliveryStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { reserveTicketNumber } from './ticketSequence';
import { recordDeliveryEvent } from '../modules/history/historyService';
import type { HistoryActor } from '../modules/history/types';
import { resolveCheckInGoodsType } from './autoWarehousePolicy';
import { domainError } from '../modules/shared/domainError';
import { formatDeliveryWindows, isWithinDeliveryWindows, listEnabledDeliveryWindows } from './deliveryWindowPolicy';

type DeliveryFindArgs = {
  include?: Prisma.DeliveryRegistrationInclude;
};

export async function checkInDelivery<TArgs extends DeliveryFindArgs>(args: {
  deliveryId: string;
  resultArgs: TArgs;
  now?: Date;
  actor?: HistoryActor;
  expectedUnitConfigId?: string | null;
  /**
   * Check-in ngoài khung giờ giao hàng bị chặn. `allowOverride` cho biết người
   * thao tác có quyền xác nhận; `override` là xác nhận của họ cho lượt này.
   */
  deliveryWindow?: { allowOverride: boolean; override: boolean };
}): Promise<{
  checkedIn: boolean;
  delivery: Prisma.DeliveryRegistrationGetPayload<TArgs> | null;
  deliveryWindowOverride?: { windows: string };
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
    if (args.expectedUnitConfigId !== undefined && currentRecord.unitConfigId !== args.expectedUnitConfigId) {
      throw domainError.conflict('Đơn vị của lượt đăng ký đã thay đổi. Vui lòng tải lại và kiểm tra quyền.', 'RegistrationUnitChanged');
    }
    if (currentRecord.status === DeliveryStatus.WAITING || currentRecord.status !== DeliveryStatus.REGISTERED) {
      return { checkedIn: false, delivery: current };
    }

    const checkinTime = args.now ?? new Date();
    // Khung giờ theo loại hàng tài xế đã chọn khi đăng ký; lượt kho tự động
    // không có khung riêng nên dùng loại hàng gốc.
    const windows = currentRecord.unitConfigId
      ? await listEnabledDeliveryWindows(tx, {
        unitConfigId: currentRecord.unitConfigId,
        goodsType: currentRecord.originalGoodsType ?? currentRecord.goodsType,
        unitGoodsTypeId: currentRecord.unitGoodsTypeId,
      })
      : [];
    let deliveryWindowOverride: { windows: string } | undefined;
    if (!isWithinDeliveryWindows(windows, checkinTime)) {
      const allowOverride = args.deliveryWindow?.allowOverride ?? false;
      if (!allowOverride || !args.deliveryWindow?.override) {
        throw domainError.unprocessable('Quá khung giờ giao hàng quy định', 'OutsideDeliveryWindow', {
          deliveryWindows: formatDeliveryWindows(windows),
          canOverride: allowOverride,
        });
      }
      deliveryWindowOverride = { windows: formatDeliveryWindows(windows) };
    }

    const vendorCode = currentRecord.vendorCode?.trim().toUpperCase();
    const vendor = vendorCode && currentRecord.unitConfigId
      ? await tx.autoWarehouseVendor.findFirst({ where: {
        vendorCode, unit: currentRecord.receivingUnit, unitConfigId: currentRecord.unitConfigId, active: true,
      }, select: { id: true } })
      : null;
    const classification = resolveCheckInGoodsType({
      goodsType: currentRecord.goodsType,
      originalGoodsType: currentRecord.originalGoodsType,
      vendorMatches: Boolean(vendor),
    });
    const ticketNumber = await reserveTicketNumber(tx, currentRecord.receivingUnit, currentRecord.vehicleType, checkinTime);
    const updated = await tx.deliveryRegistration.update({
      where: { id: currentRecord.id },
      data: { status: DeliveryStatus.WAITING, checkinTime, ticketNumber, ...classification },
      ...args.resultArgs,
    } as Prisma.DeliveryRegistrationUpdateArgs) as Prisma.DeliveryRegistrationGetPayload<TArgs>;

    await recordDeliveryEvent(updated as Prisma.DeliveryRegistrationGetPayload<Prisma.DeliveryRegistrationDefaultArgs>, {
      ...(args.actor ?? {}),
      eventType: DeliveryHistoryEventType.CHECKED_IN,
      fromStatus: currentRecord.status,
      toStatus: DeliveryStatus.WAITING,
      occurredAt: checkinTime,
      message: 'Check-in tại cổng',
      metadata: {
        ticketNumber, goodsType: classification.goodsType, autoWarehouse: classification.autoWarehouse,
        ...(deliveryWindowOverride ? { deliveryWindowOverride: true, deliveryWindows: deliveryWindowOverride.windows } : {}),
      },
    }, tx);

    return { checkedIn: true, delivery: updated, deliveryWindowOverride };
  });
}
