import { DeliveryStatus, type SlotStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { formatDisplayTicketCode } from '../../domain/displayTicketCode';
import { compareSlotsForDisplay } from '../../domain/slotCode';
import { ACTIVE_SLOT_DELIVERY_STATUSES, isManualSlotStatus } from '../../services/slotState';

/**
 * Waiting-screen board (public, GET /api/waiting-screen/board + socket `waiting_board_updated`).
 *
 * Rule R1 ("mỗi xe một dòng"): every capacity place of a slot is one row. A slot with
 * maxCapacity 5 is 5 rows whatever its occupancy; each row holds at most one vehicle and has its
 * own state. Occupied rows come first (earliest called first), then empty rows. Row order inside a
 * slot is display-only, not a physical parking place. If a slot holds more vehicles than its
 * capacity (capacity lowered while occupied), every vehicle still gets a row and `overCapacity` is true.
 *
 * Row state, seen from the unit whose panel shows it:
 *  - EMPTY        free place
 *  - CALLED       own vehicle called into the place
 *  - RECEIVING    own vehicle receiving (RECEIVING / AUTO_WAREHOUSE_RECEIVING)
 *  - FOREIGN      vehicle of another unit borrowing the place ("Mượn slot"), any status
 *  - UNAVAILABLE  free place of a slot in MAINTENANCE / RESERVED
 * Borrowing units additionally get `borrowedRows` (state FOREIGN) for their vehicles in other units' slots.
 *
 * Payload is public: no driver/vendor/PO/note/registrationCode.
 */

export type WaitingBoardRowState = 'EMPTY' | 'CALLED' | 'RECEIVING' | 'FOREIGN' | 'UNAVAILABLE';

export type WaitingBoardOccupant = {
  deliveryId: string;
  ticketCode: string | null;
  vehiclePlate: string;
  status: DeliveryStatus;
  unit: string;
  unitConfigId: string | null;
};

export type WaitingBoardSlotRow = {
  slotId: string;
  slotName: string;
  vehicleType: string;
  capacity: number;
  overCapacity: boolean;
  state: WaitingBoardRowState;
  occupant: WaitingBoardOccupant | null;
};

export type WaitingBoardBorrowedRow = {
  slotId: string;
  slotName: string;
  vehicleType: string;
  lenderUnitConfigId: string;
  lenderUnit: string;
  state: 'FOREIGN';
  occupant: WaitingBoardOccupant;
};

export type WaitingBoardWaitingItem = {
  deliveryId: string;
  ticketCode: string | null;
  vehiclePlate: string;
  vehicleType: string;
  goodsType: string;
  checkinTime: Date | null;
};

export type WaitingBoardUnit = {
  unitConfigId: string;
  unit: string;
  slotRows: WaitingBoardSlotRow[];
  borrowedRows: WaitingBoardBorrowedRow[];
  waiting: WaitingBoardWaitingItem[];
  waitingTotal: Record<string, number>;
};

export type WaitingBoard = {
  businessLocationId: string;
  generatedAt: string;
  units: WaitingBoardUnit[];
};

/** Rule 5h: the waiting list shows only the next vehicles in line, per vehicle type. */
export const WAITING_LIST_LIMIT_PER_VEHICLE_TYPE = 10;

const RECEIVING_STATUSES: DeliveryStatus[] = [DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING];

function time(value: Date | null | undefined): number {
  return value ? value.getTime() : Number.POSITIVE_INFINITY;
}

export async function buildWaitingBoard(businessLocationId: string): Promise<WaitingBoard> {
  const [units, slots, deliveries] = await Promise.all([
    prisma.unitConfig.findMany({
      where: { businessLocationId, isActive: true },
      select: { id: true, unit: true },
      orderBy: { unit: 'asc' },
    }),
    prisma.slot.findMany({
      where: { isActive: true, zone: { unitConfig: { businessLocationId } } },
      select: {
        id: true, name: true, assignedUnit: true, vehicleType: true, maxCapacity: true, status: true,
        zone: { select: { unitConfigId: true, unitConfig: { select: { unit: true } } } },
      },
    }),
    prisma.deliveryRegistration.findMany({
      where: {
        status: { in: [DeliveryStatus.WAITING, ...ACTIVE_SLOT_DELIVERY_STATUSES] },
        OR: [
          { unitConfig: { businessLocationId } },
          { assignedSlot: { zone: { unitConfig: { businessLocationId } } } },
        ],
      },
      select: {
        id: true, status: true, ticketNumber: true, vehiclePlate: true, vehicleType: true, goodsType: true,
        receivingUnit: true, unitConfigId: true, assignedSlotId: true, checkinTime: true, calledTime: true,
        createdAt: true,
        unitConfig: { select: { shortName: true, displayName: true } },
      },
      // Same queue order as the previous waiting screen: check-in, ticket, registration time, id.
      orderBy: [{ checkinTime: 'asc' }, { ticketNumber: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  type Delivery = (typeof deliveries)[number];
  const sortedSlots = [...slots].sort(compareSlotsForDisplay);
  const slotById = new Map(sortedSlots.map((slot) => [slot.id, slot]));

  const occupantsBySlot = new Map<string, Delivery[]>();
  for (const delivery of deliveries) {
    if (!delivery.assignedSlotId || !ACTIVE_SLOT_DELIVERY_STATUSES.includes(delivery.status)) continue;
    if (!slotById.has(delivery.assignedSlotId)) continue;
    const list = occupantsBySlot.get(delivery.assignedSlotId) ?? [];
    list.push(delivery);
    occupantsBySlot.set(delivery.assignedSlotId, list);
  }
  for (const list of occupantsBySlot.values()) {
    list.sort((a, b) => time(a.calledTime) - time(b.calledTime) || a.id.localeCompare(b.id));
  }

  const occupant = (delivery: Delivery): WaitingBoardOccupant => ({
    deliveryId: delivery.id,
    ticketCode: delivery.ticketNumber
      ? formatDisplayTicketCode(delivery.receivingUnit, delivery.vehicleType, delivery.ticketNumber, delivery.unitConfig)
      : null,
    vehiclePlate: delivery.vehiclePlate,
    status: delivery.status,
    unit: delivery.receivingUnit,
    unitConfigId: delivery.unitConfigId,
  });

  const belongsTo = (delivery: Delivery, unit: { id: string; unit: string }) => (
    delivery.unitConfigId ? delivery.unitConfigId === unit.id : delivery.receivingUnit === unit.unit
  );

  return {
    businessLocationId,
    generatedAt: new Date().toISOString(),
    units: units.map((unit) => {
      const slotRows: WaitingBoardSlotRow[] = [];
      for (const slot of sortedSlots) {
        if (slot.zone.unitConfigId !== unit.id) continue;
        const occupants = occupantsBySlot.get(slot.id) ?? [];
        const overCapacity = occupants.length > slot.maxCapacity;
        const base = { slotId: slot.id, slotName: slot.name, vehicleType: slot.vehicleType, capacity: slot.maxCapacity, overCapacity };
        for (const delivery of occupants) {
          const state: WaitingBoardRowState = !belongsTo(delivery, unit)
            ? 'FOREIGN'
            : RECEIVING_STATUSES.includes(delivery.status) ? 'RECEIVING' : 'CALLED';
          slotRows.push({ ...base, state, occupant: occupant(delivery) });
        }
        const emptyState: WaitingBoardRowState = isManualSlotStatus(slot.status as SlotStatus) ? 'UNAVAILABLE' : 'EMPTY';
        for (let i = occupants.length; i < slot.maxCapacity; i += 1) {
          slotRows.push({ ...base, state: emptyState, occupant: null });
        }
      }

      const borrowedRows: WaitingBoardBorrowedRow[] = [];
      for (const [slotId, occupants] of occupantsBySlot) {
        const slot = slotById.get(slotId)!;
        if (slot.zone.unitConfigId === unit.id) continue;
        for (const delivery of occupants) {
          if (!belongsTo(delivery, unit)) continue;
          borrowedRows.push({
            slotId,
            slotName: slot.name,
            vehicleType: delivery.vehicleType,
            lenderUnitConfigId: slot.zone.unitConfigId,
            lenderUnit: slot.zone.unitConfig.unit,
            state: 'FOREIGN',
            occupant: occupant(delivery),
          });
        }
      }
      borrowedRows.sort((a, b) => {
        const slotA = slotById.get(a.slotId)!;
        const slotB = slotById.get(b.slotId)!;
        return compareSlotsForDisplay(slotA, slotB);
      });

      const waitingAll = deliveries.filter((delivery) => delivery.status === DeliveryStatus.WAITING && belongsTo(delivery, unit));
      const waitingTotal: Record<string, number> = {};
      const waiting: WaitingBoardWaitingItem[] = [];
      for (const delivery of waitingAll) {
        const count = waitingTotal[delivery.vehicleType] ?? 0;
        waitingTotal[delivery.vehicleType] = count + 1;
        if (count >= WAITING_LIST_LIMIT_PER_VEHICLE_TYPE) continue;
        waiting.push({
          deliveryId: delivery.id,
          ticketCode: occupant(delivery).ticketCode,
          vehiclePlate: delivery.vehiclePlate,
          vehicleType: delivery.vehicleType,
          goodsType: delivery.goodsType,
          checkinTime: delivery.checkinTime,
        });
      }

      return { unitConfigId: unit.id, unit: unit.unit, slotRows, borrowedRows, waiting, waitingTotal };
    }),
  };
}

export async function resolveBoardBusinessLocationId(scope: { businessLocationId?: string; unitConfigId?: string } | undefined) {
  if (scope?.businessLocationId) return scope.businessLocationId;
  if (!scope?.unitConfigId) return null;
  const unitConfig = await prisma.unitConfig.findUnique({ where: { id: scope.unitConfigId }, select: { businessLocationId: true } });
  return unitConfig?.businessLocationId ?? null;
}
