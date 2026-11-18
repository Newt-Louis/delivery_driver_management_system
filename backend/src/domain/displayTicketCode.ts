/**
 * Ticket code exactly as the web UI shows it (frontend `lib/unitPresentation.ts#formatTicketCode`):
 * prefix = normalized(unitConfig.shortName || unitConfig.displayName || unit) + "-" + T/M + 3-digit number.
 *
 * Note: `routes/track.ts#formatTicketCode` builds the prefix from the unit code only, so it can differ
 * from what the screens show (known duplicated-formatter debt). New server-formatted payloads that are
 * rendered as-is by clients (waiting board) must use this function.
 */
const VEHICLE_TICKET_PREFIX: Record<string, string> = { TRUCK: 'T', MOTORBIKE: 'M' };

function normalizeTicketPrefix(value: string | null | undefined): string {
  const normalized = (value || 'UNIT')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return normalized || 'UNIT';
}

export function formatDisplayTicketCode(
  unit: string,
  vehicleType: string,
  ticketNumber: number,
  unitConfig?: { shortName?: string | null; displayName?: string | null } | null,
): string {
  const prefix = normalizeTicketPrefix(unitConfig?.shortName || unitConfig?.displayName || unit);
  return `${prefix}-${VEHICLE_TICKET_PREFIX[vehicleType] ?? 'X'}${String(ticketNumber).padStart(3, '0')}`;
}
