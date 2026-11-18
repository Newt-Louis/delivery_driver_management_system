import type { WaitingBoardUnit } from './types';

/** Own vehicles currently CALLED (in own slots or in borrowed slots) — the header/tab "loa" counter. */
export function countCalledInUnit(unit: WaitingBoardUnit | undefined): number {
  if (!unit) return 0;
  return unit.slotRows.filter((row) => row.state === 'CALLED').length
    + unit.borrowedRows.filter((row) => row.occupant.status === 'CALLED').length;
}
