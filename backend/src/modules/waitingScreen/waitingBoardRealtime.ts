import { emitToWaitingScreen } from '../../socket';
import { buildWaitingBoard } from './waitingBoardService';

/**
 * Coalesces board rebuilds per BusinessLocation: a burst of changes (auto-assign calling several
 * vehicles, complete + auto-assign, scheduler runs) produces one `waiting_board_updated` emit
 * WAITING_BOARD_DEBOUNCE_MS after the last change, instead of one rebuild per change.
 * Triggered from emitQueueUpdated()/emitSlotUpdated(), which every queue/slot mutation already calls.
 */
export const WAITING_BOARD_DEBOUNCE_MS = 400;

const pending = new Map<string, NodeJS.Timeout>();

export function scheduleWaitingBoardRefresh(businessLocationId: string | null | undefined): void {
  if (!businessLocationId) return;
  const existing = pending.get(businessLocationId);
  if (existing) clearTimeout(existing);
  pending.set(businessLocationId, setTimeout(() => {
    pending.delete(businessLocationId);
    buildWaitingBoard(businessLocationId)
      .then((board) => emitToWaitingScreen(businessLocationId, 'waiting_board_updated', board))
      .catch((error) => console.error('[waiting-board] refresh failed', error));
  }, WAITING_BOARD_DEBOUNCE_MS));
}
