import type { PublicQueueDelivery } from '../../lib/types';

export interface BrandConfig {
  mall: { id?: string; code?: string; mallName: string; logoUrl: string | null; tagline: string };
  units: Record<string, {
    id?: string;
    unit?: string;
    displayName: string;
    shortName: string;
    icon?: string | null;
    logoUrl: string | null;
    primaryColor: string;
  }>;
}

export type UnitKey = string;

export interface CalledAlert {
  vehiclePlate: string;
  slotName: string;
  slotCode: string;
  message: string;
  id: string;
  receivingUnit?: string;
  callCount?: number;
  ticketCode?: string;
  delivery?: PublicQueueDelivery;
}

// ─── GET /api/waiting-screen/board + socket `waiting_board_updated` ──────────
// Rule R1: one row per capacity place of a slot; server computes each row's state.
export type WaitingBoardRowState = 'EMPTY' | 'CALLED' | 'RECEIVING' | 'FOREIGN' | 'UNAVAILABLE';

export interface WaitingBoardOccupant {
  deliveryId: string;
  ticketCode: string | null;
  vehiclePlate: string;
  status: PublicQueueDelivery['status'];
  unit: string;
  unitConfigId: string | null;
}

export interface WaitingBoardSlotRow {
  slotId: string;
  slotName: string;
  vehicleType: PublicQueueDelivery['vehicleType'];
  capacity: number;
  overCapacity: boolean;
  state: WaitingBoardRowState;
  occupant: WaitingBoardOccupant | null;
}

export interface WaitingBoardBorrowedRow {
  slotId: string;
  slotName: string;
  vehicleType: PublicQueueDelivery['vehicleType'];
  lenderUnitConfigId: string;
  lenderUnit: string;
  state: 'FOREIGN';
  occupant: WaitingBoardOccupant;
}

export interface WaitingBoardWaitingItem {
  deliveryId: string;
  ticketCode: string | null;
  vehiclePlate: string;
  vehicleType: PublicQueueDelivery['vehicleType'];
  goodsType: string;
  checkinTime: string | null;
}

export interface WaitingBoardUnit {
  unitConfigId: string;
  unit: string;
  slotRows: WaitingBoardSlotRow[];
  borrowedRows: WaitingBoardBorrowedRow[];
  /** Next vehicles in line, at most 10 per vehicle type. */
  waiting: WaitingBoardWaitingItem[];
  /** Real number of waiting vehicles per vehicle type. */
  waitingTotal: Partial<Record<PublicQueueDelivery['vehicleType'], number>>;
}

export interface WaitingBoard {
  businessLocationId: string;
  generatedAt: string;
  units: WaitingBoardUnit[];
}
